/**
 * Edge Middleware — Per-paper Open Graph preview
 * =================================================
 *
 * Paperverse is a SPA with React Router. When a paper link
 * (`/paper/W4400123456`) is pasted in WhatsApp/Slack/Twitter, the chat
 * crawler GETs the link looking for meta tags. Crawlers do NOT execute
 * JavaScript — they see the raw index.html served by Vercel. Without
 * this middleware, every link shows the same generic preview because
 * that's what's hardcoded in index.html.
 *
 * What it does
 * ------------
 * Intercepts GETs to `/paper/:id`, detects if the caller is a chat bot
 * (WhatsApp, Slack, Twitter, Facebook, LinkedIn, Discord, iMessage, etc.),
 * and if it is:
 *   1. GETs OpenAlex for title + abstract + concepts
 *   2. Classifies the paper's topic (IA, clima, neuro, etc.) using the
 *      same logic as the client (topicForConcepts)
 *   3. Translates title + abstract to Spanish via Pollinations (4s
 *      timeout, best-effort, falls back to source language)
 *   4. Fetches the static index.html
 *   5. Rewrites og:*, twitter:* with paper data + dynamic image URL
 *      (/api/og?title=X&topic=Y)
 *   6. Returns modified HTML with aggressive caching
 *
 * For humans (non-bots) we passthrough unchanged — the SPA flow
 * continues normally and React Router handles navigation. This avoids
 * paying the OpenAlex+Pollinations latency on every human click.
 *
 * Why bot-only instead of always-rewrite
 * ---------------------------------------
 * With always-rewrite, the first human visitor to an uncached paper
 * would wait 3-4s for translation to finish. Bad UX. Bot-only means
 * humans always get a fast load, bots (which don't care about timing)
 * receive correct HTML, and we cache the result at the edge so the
 * second hit to the same paper is instant.
 *
 * Cache
 * -----
 * - Edge cache: `s-maxage=86400` (24h on Vercel's CDN)
 * - Browser cache: `max-age=600` (10 min, avoids repeat hits from the
 *   same chat re-crawling)
 * - SWR: `stale-while-revalidate=604800` (7 days serve stale while
 *   revalidating in the background)
 *
 * Fallback
 * --------
 * If OpenAlex returns 404/500, or Pollinations times out, we fall back
 * to the unmodified index.html. We never return a 5xx to the crawler.
 */

export const config = {
  // Vercel matcher — only run on paper routes. Any other URL (/,
  // /biblioteca, /manifiesto, etc.) bypasses the middleware and goes
  // straight to static/SPA flow.
  matcher: '/paper/:path*',
};

// ─────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────

const OPENALEX_MAILTO = 'paperverse@example.com';
const POLLINATIONS_TIMEOUT_MS = 4000;
const POLLINATIONS_URL = 'https://text.pollinations.ai';

// ─────────────────────────────────────────────────────────────────────────
// Topic map — duplicated from src/lib/topics.ts (inlined because the
// Edge runtime can't import from the React bundle). If colors/concepts
// change in topics.ts, mirror the change here.
// ─────────────────────────────────────────────────────────────────────────

interface Topic {
  id: string;
  name: string;
  concepts: string[];
  color: string;
  soft: string;
  deep: string;
}

const TOPICS: Topic[] = [
  { id: 'ia',         name: 'IA',            concepts: ['C154945302', 'C119857082'], color: '#2E4BE0', soft: '#E0E6FF', deep: '#1E34B0' },
  { id: 'clima',      name: 'Clima',         concepts: ['C132651083', 'C39432304'],  color: '#1BA5B8', soft: '#CDEEF2', deep: '#0F7E8E' },
  { id: 'neuro',      name: 'Neurociencia',  concepts: ['C169760540'],               color: '#8B4FE0', soft: '#E8DCF9', deep: '#6A2FC0' },
  { id: 'espacio',    name: 'Espacio',       concepts: ['C1276947', 'C111368507'],   color: '#F5B638', soft: '#FDEEC8', deep: '#C48A1A' },
  { id: 'fisica',     name: 'Física',        concepts: ['C121332964'],               color: '#F2542D', soft: '#FDE4DA', deep: '#C73F1D' },
  { id: 'biologia',   name: 'Biología',      concepts: ['C86803240'],                color: '#2E8B57', soft: '#D6EEDE', deep: '#1F6B3F' },
  { id: 'medicina',   name: 'Medicina',      concepts: ['C71924100'],                color: '#E03E8C', soft: '#FADCEA', deep: '#B32168' },
  { id: 'energia',    name: 'Energía',       concepts: ['C172651191', 'C548081761'], color: '#E8572C', soft: '#FBE0D3', deep: '#B8401A' },
  { id: 'materiales', name: 'Materiales',    concepts: ['C192562407'],               color: '#0E1116', soft: '#DADCE0', deep: '#2A2F38' },
  { id: 'matematica', name: 'Matemática',    concepts: ['C33923547'],                color: '#3D6AE0', soft: '#D9E3FB', deep: '#254AB0' },
  { id: 'psicologia', name: 'Psicología',    concepts: ['C15744967'],                color: '#A35FD8', soft: '#ECDCF9', deep: '#7A3FB8' },
  { id: 'ecologia',   name: 'Ecología',      concepts: ['C18903297'],                color: '#4FA068', soft: '#DFEEDF', deep: '#2F7040' },
  { id: 'tecnologia', name: 'Tecnología',    concepts: ['C41008148', 'C127413603'],  color: '#D89A2C', soft: '#F6E7C7', deep: '#A87818' },
  { id: 'quimica',    name: 'Química',       concepts: ['C185592680'],               color: '#E06AA8', soft: '#F9DCE8', deep: '#B34378' },
  { id: 'ciencia',    name: 'Ciencia',       concepts: ['C144024400', 'C127313418', 'C205649164'], color: '#5B6472', soft: '#E3E6EB', deep: '#3F4752' },
];

/** Same logic as src/lib/topics.ts → topicForConcepts. */
function topicForConcepts(concepts: Array<{ id: string; score?: number }> | undefined): Topic | null {
  if (!concepts || concepts.length === 0) return null;
  const pool = [...concepts]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3)
    .filter(c => (c.score ?? 0) >= 0.35);
  const topicScores = new Map<string, number>();
  const positionWeights = [1.0, 0.7, 0.5];
  pool.forEach((c, idx) => {
    const weight = positionWeights[idx] ?? 0.5;
    const shortId = c.id.split('/').pop() ?? c.id;
    for (const topic of TOPICS) {
      if (!topic.concepts.includes(shortId)) continue;
      const weightedScore = (c.score ?? 0) * weight;
      topicScores.set(topic.id, (topicScores.get(topic.id) ?? 0) + weightedScore);
    }
  });
  if (topicScores.size === 0) return null;
  let bestId: string | null = null;
  let bestScore = -Infinity;
  for (const [id, score] of topicScores) {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId ? (TOPICS.find(t => t.id === bestId) ?? null) : null;
}

/** Fallback that never returns null — if nothing matches, falls back to ciencia. */
function topicOrCiencia(concepts: Array<{ id: string; score?: number }> | undefined): Topic {
  return topicForConcepts(concepts) ?? TOPICS[TOPICS.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────
// Abstract reconstruction — identical to src/lib/abstract.ts
// ─────────────────────────────────────────────────────────────────────────

function reconstructAbstract(index: Record<string, number[]> | null | undefined): string | null {
  if (!index) return null;
  const positions: Array<{ word: string; pos: number }> = [];
  for (const [word, spots] of Object.entries(index)) {
    for (const pos of spots) positions.push({ word, pos });
  }
  if (positions.length === 0) return null;
  positions.sort((a, b) => a.pos - b.pos);
  return positions.map(p => p.word).join(' ');
}

// ─────────────────────────────────────────────────────────────────────────
// Bot detection
// ─────────────────────────────────────────────────────────────────────────

/**
 * Case-insensitive tokens that appear in the User-Agent strings of common
 * chat crawlers. Not exhaustive but covers the main targets.
 */
const BOT_UA_PATTERNS = [
  'whatsapp',
  'slackbot',
  'slack-imgproxy',
  'twitterbot',
  'facebookexternalhit',
  'facebot',
  'linkedinbot',
  'discordbot',
  'telegrambot',
  'apple-imessage',
  'googlebot',
  'bingbot',
  'bot',
  'crawler',
  'spider',
  'embedly',
  'quora link preview',
  'pinterest',
  'redditbot',
  'skypeuripreview',
  'applebot',
];

function isBot(ua: string | null): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return BOT_UA_PATTERNS.some(p => lower.includes(p));
}

// ─────────────────────────────────────────────────────────────────────────
// OpenAlex fetch
// ─────────────────────────────────────────────────────────────────────────

interface PaperMeta {
  title: string;
  abstract: string | null;
  topic: Topic;
}

/**
 * GETs OpenAlex and extracts only the fields we need. Returns null if
 * the paper doesn't exist or the API is down — callers should treat
 * null as "serve index.html unmodified".
 *
 * The select param minimizes payload. No authorships/locations/cited_by
 * — none are needed for the chat preview.
 */
async function fetchPaper(paperId: string): Promise<PaperMeta | null> {
  const url = new URL(`https://api.openalex.org/works/${paperId}`);
  url.searchParams.set('select', 'title,display_name,abstract_inverted_index,concepts');
  url.searchParams.set('mailto', OPENALEX_MAILTO);
  try {
    const res = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
      // OpenAlex usually responds in < 500ms; 6s timeout is defensive.
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const title = (data.title ?? data.display_name ?? '').toString().trim();
    if (!title) return null;
    const abstract = reconstructAbstract(data.abstract_inverted_index ?? null);
    const topic = topicOrCiencia(data.concepts);
    return { title, abstract, topic };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Pollinations translation
// ─────────────────────────────────────────────────────────────────────────

/**
 * Translates title + abstract to Spanish via Pollinations. Uses the SAME
 * prompt as src/lib/translate.ts so the wording is consistent with what
 * the user sees in-app: opening a paper from a chat preview should match
 * the title shown in the UI, not two different translations.
 *
 * Aggressive timeout (4s). If it expires, we fall back to the source
 * language. For bots it's better to have an English preview than a 500.
 */
interface Translated {
  title: string;
  lede: string;
}

async function translateToEs(paperId: string, title: string, abstract: string | null): Promise<Translated> {
  const userMsg = `PAPER ID: ${paperId}
TITLE: ${title}
ABSTRACT: ${abstract ?? ''}`;

  const systemPrompt = `You are a science editor titling papers for a short-form reading feed. You MUST write everything in Spanish (neutro LATAM, sin "vos" rioplatense, sin "vosotros" peninsular). Do not output anything in a different language.

CRITICAL — source language: the input title and abstract can be in ANY language. No matter what language the source is in, your TITULO and LEDE MUST be translated into Spanish. Never echo the source language back.

1) TITULO — max 90 characters, sentence case, no emoji, no clickbait. Captures the essence of the paper in Spanish.
2) LEDE — 1 or 2 sentences (max 220 characters), plain modern Spanish, keep key numbers. Don't start with "This paper".

Rules: strip LaTeX/HTML/markdown. Don't invent findings. No markdown in output.

OUTPUT FORMAT — return EXACTLY these two lines, nothing before or after:
TITULO: <title in Spanish>
LEDE: <lede in Spanish>`;

  try {
    const res = await fetch(`${POLLINATIONS_URL}/openai`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
      }),
      signal: AbortSignal.timeout(POLLINATIONS_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content ?? '').toString();
    return parseTranslated(text, title, abstract);
  } catch {
    // Fallback: return what we got. The preview ends up in the source
    // language but still informative (title + first sentence of abstract).
    return {
      title,
      lede: abstract ? truncate(abstract, 200) : '',
    };
  }
}

function parseTranslated(raw: string, fallbackTitle: string, fallbackAbstract: string | null): Translated {
  // We expect:
  //   TITULO: <line>
  //   LEDE: <line>
  // Pollinations sometimes returns with fences or extra text — extract by regex.
  const titleMatch = raw.match(/TITULO:\s*(.+?)(?:\n|$)/i);
  const ledeMatch = raw.match(/LEDE:\s*(.+?)(?:\n|$)/i);
  const title = titleMatch?.[1]?.trim() || fallbackTitle;
  const lede = ledeMatch?.[1]?.trim() || (fallbackAbstract ? truncate(fallbackAbstract, 200) : '');
  return { title, lede };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

// ─────────────────────────────────────────────────────────────────────────
// HTML rewriting
// ─────────────────────────────────────────────────────────────────────────

/**
 * Rewrites the og:* and twitter:* meta tags of index.html with paper
 * data. We use simple regex because (a) the index.html is ours and
 * we know the tags are on one line each, (b) a full HTML parser in
 * Edge is overkill for replacing 8 tags.
 */
function rewriteMeta(
  html: string,
  opts: {
    title: string;
    description: string;
    imageUrl: string;
    pageUrl: string;
  }
): string {
  // Escape to avoid breaking the HTML if title/description contain
  // quotes, ampersands, or less/greater-than. Critical for scientific
  // titles that sometimes include "p < 0.05" or "ADHD: meta-analysis".
  const t = escapeHtmlAttr(opts.title);
  const d = escapeHtmlAttr(opts.description);
  const u = escapeHtmlAttr(opts.pageUrl);
  const img = escapeHtmlAttr(opts.imageUrl);

  return html
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/i,
      `<meta property="og:title" content="${t}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/i,
      `<meta property="og:description" content="${d}" />`
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/i,
      `<meta property="og:url" content="${u}" />`
    )
    .replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/i,
      `<meta property="og:image" content="${img}" />`
    )
    .replace(
      /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/>/i,
      `<meta property="og:image:alt" content="${t}" />`
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/i,
      `<meta name="twitter:title" content="${t}" />`
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/i,
      `<meta name="twitter:description" content="${d}" />`
    )
    .replace(
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/i,
      `<meta name="twitter:image" content="${img}" />`
    )
    .replace(
      /<title>[^<]*<\/title>/i,
      `<title>${t} — Paperverse</title>`
    )
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/i,
      `<meta name="description" content="${d}" />`
    );
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const ua = request.headers.get('user-agent');

  // Passthrough for humans — let them hit the static index.html and let
  // React Router do its work. No rewrite because OpenAlex+Pollinations
  // latency (2-4s worst case) would show up in the initial page load.
  if (!isBot(ua)) {
    return fetch(new URL('/index.html', url.origin).toString());
  }

  // Extract paperId from path. Expected format: /paper/W4400123456
  const match = url.pathname.match(/^\/paper\/(W[0-9]+)/i);
  if (!match) {
    return fetch(new URL('/index.html', url.origin).toString());
  }
  const paperId = match[1].toUpperCase();

  // Parallel fetch: paper meta + static index.html. Saves ~100-300ms
  // versus sequential because the static HTML usually comes back in
  // < 50ms and can resolve while we wait for OpenAlex.
  const [meta, htmlRes] = await Promise.all([
    fetchPaper(paperId),
    fetch(new URL('/index.html', url.origin).toString()),
  ]);

  // If OpenAlex failed or the paper doesn't exist, serve index.html
  // unmodified. The bot sees the site's generic meta tags — not ideal,
  // but never a 500.
  if (!meta) {
    return htmlRes;
  }

  // Spanish translation (best-effort, with timeout).
  const translated = await translateToEs(paperId, meta.title, meta.abstract);

  // Build the dynamic OG image URL: /api/og?title=...&topic=...
  const ogImageUrl = new URL('/api/og', url.origin);
  ogImageUrl.searchParams.set('title', truncate(translated.title, 180));
  ogImageUrl.searchParams.set('topic', meta.topic.id);

  const pageUrl = `${url.origin}/paper/${paperId}`;
  const description = translated.lede || 'Papers científicos traducidos al español claro.';

  const originalHtml = await htmlRes.text();
  const rewrittenHtml = rewriteMeta(originalHtml, {
    title: translated.title,
    description,
    imageUrl: ogImageUrl.toString(),
    pageUrl,
  });

  return new Response(rewrittenHtml, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Aggressive edge cache — the translation of a paper is stable.
      'cache-control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800',
      // Vary by UA so bots and humans correctly receive different
      // responses from the edge cache.
      'vary': 'user-agent',
    },
  });
}
