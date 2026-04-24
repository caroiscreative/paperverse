/**
 * Edge Middleware — Per-paper Open Graph preview (QA2 P2.2, 2026-04-22)
 * ======================================================================
 *
 * Problema que resuelve
 * ---------------------
 * Paperverse es un SPA con React Router. Cuando pega un link
 * de paper (`/paper/W4400123456`) en WhatsApp/Slack/Twitter, el crawler
 * del chat pega GET al link para buscar meta tags. Los crawlers NO
 * ejecutan JavaScript: ven el index.html crudo que sirve Vercel. Sin
 * este middleware, TODOS los links muestran el mismo preview genérico
 * ("Paperverse — La ciencia real, para curiosos reales") porque ese es
 * el meta tag hardcoded en index.html.
 *
 * Lo que hace
 * -----------
 * Intercepta GETs a `/paper/:id`, detecta si es un bot de chat
 * (WhatsApp, Slack, Twitter, Facebook, LinkedIn, Discord, iMessage, etc.),
 * y si lo es:
 *   1. Pega GET a OpenAlex para traer title + abstract + concepts del paper
 *   2. Clasifica el tema del paper (IA, clima, neuro, etc.) usando la misma
 *      lógica que el cliente (topicForConcepts)
 *   3. Traduce title + abstract al español via Pollinations (4s timeout,
 *      best-effort, cae al original si falla)
 *   4. Fetch del index.html estático
 *   5. Reescribe los og:*, twitter:* con los datos del paper + URL de
 *      imagen dinámica (/api/og?title=X&topic=Y)
 *   6. Devuelve el HTML modificado con cache agresivo
 *
 * Para humanos (no-bot) hacemos passthrough sin modificar nada: la ruta
 * sigue el SPA flow normal y React Router se encarga. Así evitamos
 * pagar la latencia de OpenAlex+Pollinations en cada click humano.
 *
 * Por qué bot detection en vez de always-rewrite
 * -----------------------------------------------
 * Con always-rewrite, el primer visitante humano a un paper "raro" (no
 * cacheado) esperaría 3-4s para que termine la traducción. Mal UX.
 * Con bot-only, humanos siempre tienen carga rápida, bots (que no miran
 * tiempo de carga) reciben el HTML correcto y nosotros cacheamos el
 * resultado a nivel edge para que la segunda vez que el mismo bot o uno
 * distinto pegue el mismo paper, la respuesta sea instantánea.
 *
 * Caché
 * -----
 * - Edge cache: `s-maxage=86400` (24h en la CDN de Vercel)
 * - Browser cache: `max-age=600` (10 min, evita pedidos repetidos del mismo
 *   chat que crawlea varias veces)
 * - SWR: `stale-while-revalidate=604800` (7 días devolvemos stale mientras
 *   re-validamos en background)
 *
 * Fallback
 * --------
 * Si OpenAlex devuelve 404/500, o Pollinations timeoutea, caemos al
 * index.html sin modificar. Nunca rompemos la respuesta: el preview
 * "genérico" es peor que el dinámico pero infinitamente mejor que un
 * 500 al crawler.
 */

export const config = {
  // Matcher de Vercel — sólo corremos en rutas de paper. Cualquier otra
  // URL (/, /paper, /biblioteca, /manifiesto, etc.) pasa sin tocar el
  // middleware y va directo al static/SPA flow.
  matcher: '/paper/:path*',
};

// ─────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────

const OPENALEX_MAILTO = 'francomatacarolina@gmail.com';
const POLLINATIONS_TIMEOUT_MS = 4000;
const POLLINATIONS_URL = 'https://text.pollinations.ai';

// ─────────────────────────────────────────────────────────────────────────
// Topic map — duplicado de src/lib/topics.ts (inlined porque el Edge
// runtime no puede importar desde el bundle de React). Si cambian los
// colores/conceptos en topics.ts, hay que espejar el cambio acá.
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

/** Misma lógica que src/lib/topics.ts → topicForConcepts. */
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

/** Fallback que nunca devuelve null — si nada matchea, cae a ciencia. */
function topicOrCiencia(concepts: Array<{ id: string; score?: number }> | undefined): Topic {
  return topicForConcepts(concepts) ?? TOPICS[TOPICS.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────
// Abstract reconstruction — idéntico a src/lib/abstract.ts
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
 * Lista (case-insensitive) de tokens que aparecen en los User-Agent strings
 * de los crawlers de chat más comunes. No es exhaustiva pero cubre los que
 * va a usar día a día:
 *
 * - WhatsApp: `WhatsApp/...`
 * - Slack: `Slackbot-LinkExpanding` / `Slack-ImgProxy`
 * - Twitter/X: `Twitterbot`
 * - Facebook: `facebookexternalhit` / `Facebot`
 * - LinkedIn: `LinkedInBot`
 * - Discord: `Discordbot`
 * - Telegram: `TelegramBot`
 * - iMessage/Apple: `facebookexternalhit` (iMessage usa el mismo que FB)
 *   y a veces `Apple-iMessage` — chequeamos ambos
 * - Google: `Googlebot`, `Google-InspectionTool`
 * - Bing: `bingbot`
 * - Referencias generales: `bot`, `crawler`, `spider` como net seguridad
 *   (puede haber falsos positivos pero los "humanos" nunca tienen estos
 *   tokens en su UA — peor caso, un humano con "bot" en el UA recibe HTML
 *   rewriteado, que también es válido, sólo un poco más lento)
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
 * Pega GET a OpenAlex y extrae los campos que necesitamos. Devuelve null
 * si el paper no existe o la API está caída — el caller debe interpretar
 * null como "servir index.html sin modificar".
 *
 * Select minimiza el payload: sólo traemos lo que vamos a usar. Evita
 * traer authorships/locations/cited_by que sumarían varios KB sin utilidad
 * para el preview de chat.
 */
async function fetchPaper(paperId: string): Promise<PaperMeta | null> {
  const url = new URL(`https://api.openalex.org/works/${paperId}`);
  url.searchParams.set('select', 'title,display_name,abstract_inverted_index,concepts');
  url.searchParams.set('mailto', OPENALEX_MAILTO);
  try {
    const res = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
      // OpenAlex suele responder en < 500ms; 6s de timeout es defensivo.
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
 * Traduce title + abstract al español via Pollinations. Usa el MISMO prompt
 * que src/lib/translate.ts para que la redacción sea consistente con lo que
 * el usuario ve en la card: si abre el link desde un chat y entra a la
 * pagina, el título del preview debería matchear el título del paper en la
 * UI, no dos traducciones distintas.
 *
 * Timeout agresivo (4s). Si pasa, caemos al original en inglés/idioma fuente.
 * Para bots es preferible un preview en inglés a un 500.
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
    // Fallback: devolvemos lo que vino. El preview queda en idioma original
    // pero sigue siendo informativo (título y primera frase del abstract).
    return {
      title,
      lede: abstract ? truncate(abstract, 200) : '',
    };
  }
}

function parseTranslated(raw: string, fallbackTitle: string, fallbackAbstract: string | null): Translated {
  // Esperamos:
  //   TITULO: <line>
  //   LEDE: <line>
  // Pollinations a veces devuelve con fences o texto extra — extraemos por regex.
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
 * Reescribe los meta tags og:* y twitter:* del index.html con los datos del
 * paper. Usamos regex simples porque (a) el index.html es nuestro y sabemos
 * que los tags están todos en una línea, (b) un parser HTML completo en
 * edge es overkill para reemplazar 8 tags.
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
  // Escapamos para no romper el HTML si el título o descripción tienen
  // comillas, ampersands, o menor/mayor. Esto es crítico para títulos
  // científicos que a veces llevan "p < 0.05" o "ADHD: meta-analysis".
  const t = escapeHtmlAttr(opts.title);
  const d = escapeHtmlAttr(opts.description);
  const u = escapeHtmlAttr(opts.pageUrl);
  const img = escapeHtmlAttr(opts.imageUrl);

  return html
    // og:title
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/i,
      `<meta property="og:title" content="${t}" />`
    )
    // og:description
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/i,
      `<meta property="og:description" content="${d}" />`
    )
    // og:url
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/i,
      `<meta property="og:url" content="${u}" />`
    )
    // og:image
    .replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/i,
      `<meta property="og:image" content="${img}" />`
    )
    // og:image:alt
    .replace(
      /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/>/i,
      `<meta property="og:image:alt" content="${t}" />`
    )
    // twitter:title
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/i,
      `<meta name="twitter:title" content="${t}" />`
    )
    // twitter:description
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/i,
      `<meta name="twitter:description" content="${d}" />`
    )
    // twitter:image
    .replace(
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/i,
      `<meta name="twitter:image" content="${img}" />`
    )
    // <title>
    .replace(
      /<title>[^<]*<\/title>/i,
      `<title>${t} — Paperverse</title>`
    )
    // meta description (no-og)
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

  // Passthrough para humanos — les dejamos el static index.html y que
  // React Router haga su trabajo. No rewriteamos porque la latencia de
  // OpenAlex+Pollinations (2-4s peor caso) se sentiría en la carga inicial.
  if (!isBot(ua)) {
    return fetch(new URL('/index.html', url.origin).toString(), {
      // Heredamos cache del static — Vercel ya sabe cachear el index.html.
    });
  }

  // Extraemos el paperId del path. Formato esperado: /paper/W4400123456
  const match = url.pathname.match(/^\/paper\/(W[0-9]+)/i);
  if (!match) {
    return fetch(new URL('/index.html', url.origin).toString());
  }
  const paperId = match[1].toUpperCase();

  // Fetch paralelo: meta del paper + index.html estático. Optimiza ~100-300ms
  // versus secuencial porque el HTML estático suele venir en < 50ms y puede
  // resolverse mientras esperamos OpenAlex.
  const [meta, htmlRes] = await Promise.all([
    fetchPaper(paperId),
    fetch(new URL('/index.html', url.origin).toString()),
  ]);

  // Si OpenAlex falló o el paper no existe, servimos index.html tal cual.
  // El bot va a ver los meta tags genéricos del sitio — no ideal, pero nunca
  // un 500.
  if (!meta) {
    return htmlRes;
  }

  // Traducción al español (best-effort, con timeout).
  const translated = await translateToEs(paperId, meta.title, meta.abstract);

  // Construimos la URL de la imagen OG dinámica: /api/og?title=...&topic=...
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
      // Cache agresivo en el edge — la traducción de un paper es estable.
      // - max-age=600: browsers (y crawlers que respetan cache) re-usan 10 min
      // - s-maxage=86400: CDN de Vercel cachea 24h por URL — la segunda vez
      //   que alguien pega el mismo link, 0ms de latencia
      // - stale-while-revalidate=604800: 7 días servimos stale mientras
      //   revalidamos en background. Para este caso (título de paper) es
      //   prácticamente infinito — los títulos no cambian.
      'cache-control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800',
      // Vary por UA para que bots y humanos reciban respuestas distintas
      // del edge cache correctamente.
      'vary': 'user-agent',
    },
  });
}
