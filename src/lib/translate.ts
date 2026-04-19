import { useEffect, useState } from 'react';
import type { Paper } from './openalex';
import {
  withPollinationsSlot,
  fetchPollinations,
  friendlyPollinationsError,
  timeoutSignal,
  isAbortError,
} from './pollirate';
import { useLang, getLangDef, type LangId } from './lang';

/**
 * Presupuesto duro por traducción, en ms. Bumpeamos de 5s → 30s cuando
 * descubrimos que Pollinations devuelve 429 en ráfagas (no sólo por
 * concurrencia sino también por RPM). pollirate.ts ahora hace hasta 3
 * intentos con backoff exponencial 2s/4s/8s por request, así que el peor
 * caso acumula ~14s de espera + tiempo en cola + latencia del fetch. 30s
 * deja margen para que eso converja antes de tirar la toalla. Si Pollinations
 * está realmente caído, el usuario ve el fallback en inglés limpio después
 * de 30s — mejor que spinner colgado, pero se da todas las chances de éxito.
 */
const TRANSLATION_TIMEOUT_MS = 30_000;

const CACHE_KEY = 'pv_translate_cache_v3';

const MAX_ENTRIES = 200;

export interface TranslatedPaper {
  titleEs: string;
  ledeEs: string;
}

type Cache = Record<string, TranslatedPaper>;

function readCache(): Cache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : {};
  } catch {
    return {};
  }
}

function capCache(c: Cache): Cache {
  const keys = Object.keys(c);
  if (keys.length <= MAX_ENTRIES) return c;
  const toDrop = keys.slice(0, keys.length - MAX_ENTRIES);
  for (const k of toDrop) delete c[k];
  return c;
}

function writeCache(c: Cache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(capCache(c)));
  } catch {
  }
}

/** Clave interna de cache: combina paperId + idioma. */
function cacheKey(paperId: string, lang: LangId): string {
  return `${paperId}:${lang}`;
}

/**
 * Nuke all translation cache. Usado por el botón de refresh del ThemeDock
 * cuando Pollinations dejó titulos en inglés en la cache y el usuario quiere
 * re-pedirlos. No distingue por idioma — es el martillo, no el escalpelo.
 *
 * También limpia el Map de in-flight: si una request quedó pegada (por ejemplo,
 * el tab perdió foco justo después de pedir y Pollinations nunca respondió),
 * su entrada en `inflight` seguiría ahí y cualquier nuevo fetch del mismo key
 * se subscribiría a esa promesa zombie en vez de hacer un fetch nuevo. Limpiar
 * el map obliga a todos los fetches posteriores a arrancar de cero.
 */
export function clearTranslationCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {

  }
  inflight.clear();
}

export function getCachedTranslation(paperId: string, lang: LangId): TranslatedPaper | null {
  const hit = readCache()[cacheKey(paperId, lang)];
  if (!hit) return null;
  return {
    titleEs: ensureCapitalized(hit.titleEs),
    ledeEs: ensureCapitalized(hit.ledeEs),
  };
}

export function preCleanTitle(raw: string): string {
  let t = raw ?? '';
  t = t
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  t = t.replace(/\$([^$]+)\$/g, '$1');
  t = t.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1');
  t = t.replace(/\\[a-zA-Z]+/g, '');
  t = t.replace(/<[^>]+>/g, '');
  t = t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
  if (/^[A-Z0-9 ,.\-:;'"()/&]+$/.test(t) && t.split(/\s+/).length > 3) {
    t = t.toLowerCase();
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  // Collapse whitespace.
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/**
 * El prompt se construye a partir del idioma target. Antes era fijo en
 * español rioplatense; ahora recibe el nombre "humano" del idioma (de
 * LANG_NAME en lang.ts) y ajusta pequeños matices del prompt. El formato
 * de salida sigue usando TITULO/LEDE como labels porque al modelo no le
 * importa en qué idioma estén las etiquetas — lo que lo condiciona es el
 * "write in X language" explícito de la primera línea.
 */
function buildSystemPrompt(langName: string): string {
  return `You are a science editor titling papers for a short-form reading feed. You MUST write everything in ${langName}. Do not output anything in a different language. Even if the paper's abstract is in English, your TITULO and LEDE must be in ${langName}.

Your job is to take a paper's original title + abstract (which may contain LaTeX, inline code, stray symbols, or broken typography) and return TWO things:

1) TITULO — the "essence" of the paper. Not a literal translation. A short editorial title (max 90 characters, ideally 50–70) that captures what the paper found or what question it answers, written so a curious reader will want to click. No clickbait, no exclamations, no emoji. Sentence case — lowercase except the first letter and proper nouns. Avoid "Thing: subtitle" colons unless strictly necessary.

2) LEDE — 1 or 2 sentences (max 220 characters) summarizing the paper's main finding in plain, modern ${langName}. Keep important numbers (percentages, sample sizes). Don't start with "This paper..." or "The authors..."; start from the idea.

General rules:
- If the abstract is empty or unusable, leave LEDE blank (empty line after "LEDE:").
- Strip LaTeX (\\alpha, $...$), HTML (&lt;), markdown and broken symbols.
- Do not invent findings that aren't in the abstract.
- No markdown in the output.

OUTPUT FORMAT — return EXACTLY these two lines, nothing before or after, no quotes, no markdown, no \`\`\`:
TITULO: <title in ${langName}, single line>
LEDE: <lede in ${langName}, single line>`;
}

/** Deterministic seed per paper+lang — same paper+language always gets the same wording. */
function seedFrom(id: string, lang: LangId): number {
  const k = `${id}:${lang}`;
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
  return Math.abs(h) % 1_000_000;
}

/**
 * In-flight request dedup: if two components mount at the same time and both
 * ask for the same paperId, we only want to hit Pollinations once. The
 * `useTranslated` hook awaits this shared promise.
 */
const inflight = new Map<string, Promise<TranslatedPaper>>();

export interface FetchTranslationOptions {
  /**
   * 'high' = detail page (jumps el queue del feed).
   * 'low'  = feed (default).
   */
  priority?: 'high' | 'low';
  /** Idioma target. Default: 'es' (rioplatense). */
  lang?: LangId;
}

export async function fetchTranslation(
  paper: Paper,
  options: FetchTranslationOptions = {}
): Promise<TranslatedPaper> {
  const lang: LangId = options.lang ?? 'es';
  const key = cacheKey(paper.id, lang);
  const cache = readCache();
  if (cache[key]) return cache[key];

  const existing = inflight.get(key);
  if (existing) return existing;

  const cleanTitle = preCleanTitle(paper.title);
  const cleanAbstract = paper.abstract ? preCleanTitle(paper.abstract) : '';

  const langDef = getLangDef(lang);
  const systemPrompt = buildSystemPrompt(langDef.promptName);
  const userPrompt = `Original title: ${cleanTitle}

Original abstract (may be empty):
${cleanAbstract || '(no abstract)'}

Return the two lines TITULO: and LEDE: as the system says, writing in ${langDef.promptName}.`;

  const { signal, cleanup } = timeoutSignal(TRANSLATION_TIMEOUT_MS);

  const p = (async () => {
    try {
      return await withPollinationsSlot(async () => {
        const r = await fetchPollinations(
          'https://text.pollinations.ai/openai',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'openai',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.5,
              seed: seedFrom(paper.id, lang),
              referrer: 'paperverse',
              private: true,
              max_tokens: 220,
            }),
            signal,
          },
          { signal }
        );

        if (!r.ok) {
          const body = await r.text().catch(() => '');
          throw new Error(friendlyPollinationsError(r.status, body));
        }

        const data = (await r.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
        const parsed = parseTranslation(raw);

        const result: TranslatedPaper = {
          titleEs: ensureCapitalized(parsed.titleEs || cleanTitle),
          ledeEs: ensureCapitalized(parsed.ledeEs || deriveLede(cleanAbstract)),
        };

        const next = readCache();
        next[key] = result;
        writeCache(next);
        return result;
      }, { priority: options.priority ?? 'low', signal });
    } finally {
      cleanup();
    }
  })();

  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

export { isAbortError };

/**
 * Parse the model's line-delimited output. We asked for:
 *   TITULO: ...
 *   LEDE: ...
 * …but Pollinations sometimes wraps in ```, prepends a banner, or slips in an
 * extra blank line. We normalize and match by label so the order or extra
 * whitespace doesn't break us. If it still looks JSON-y (older cache hits or
 * model drift), fall back to the previous JSON parser as a safety net.
 */
function parseTranslation(raw: string): TranslatedPaper {
  let s = raw.trim();
  s = s.replace(/^```(?:[a-z]+)?\s*/i, '').replace(/```$/i, '').trim();

  const titleMatch = s.match(/(?:^|\n)\s*(?:TITULO|TÍTULO|TITLE)\s*:\s*(.+)/i);
  const ledeMatch = s.match(/(?:^|\n)\s*(?:LEDE|LEAD|LEDA)\s*:\s*([\s\S]+)$/i);
  if (titleMatch) {
    const titleEs = stripQuotes(titleMatch[1].trim()).split(/\n/)[0].trim();
    let ledeEs = ledeMatch ? stripQuotes(ledeMatch[1].trim()) : '';
    ledeEs = ledeEs.replace(/\n\s*(?:TITULO|TÍTULO|TITLE)\s*:[\s\S]*$/i, '').trim();
    return { titleEs, ledeEs };
  }

  const jsonMatch = s.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]) as { titleEs?: string; ledeEs?: string };
      return {
        titleEs: typeof obj.titleEs === 'string' ? obj.titleEs.trim() : '',
        ledeEs: typeof obj.ledeEs === 'string' ? obj.ledeEs.trim() : '',
      };
    } catch {

    }
  }

  return { titleEs: '', ledeEs: '' };
}

/** Remove matching surrounding quotes that the model sometimes adds. */
function stripQuotes(s: string): string {
  const m = s.match(/^["“'«](.*)["”'»]$/s);
  return m ? m[1].trim() : s;
}

/**
 * Ensures the first *letter* is uppercase. Skips non-letter prefixes (quotes,
 * dashes, digits) so cosas como "5 pasos para…" o "«cómo medimos…»" no pierden
 * su primera letra real. Usa toLocaleUpperCase('es') para manejar ñ/acentos.
 */
function ensureCapitalized(s: string): string {
  if (!s) return s;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    // Saltamos hasta la primera letra real (Unicode property escape).
    if (/\p{L}/u.test(ch)) {
      const upper = ch.toLocaleUpperCase('es');
      if (ch === upper) return s;
      return s.slice(0, i) + upper + s.slice(i + 1);
    }
  }
  return s;
}

// Concurrency limiting lives in ./pollirate — shared with explain.ts so
// feed translations and Explicámelo don't fight for Pollinations' 1-slot-per-IP
// queue.

/** Local fallback for the lede: truncate the pre-cleaned abstract. */
function deriveLede(cleanAbstract: string): string {
  if (!cleanAbstract) return '';
  if (cleanAbstract.length <= 220) return cleanAbstract;
  return cleanAbstract.slice(0, 220).replace(/\s+\S*$/, '') + '…';
}

// ────────────────────────────────────────────────────────────────────────────
// React hook
// ────────────────────────────────────────────────────────────────────────────

export interface UseTranslatedResult {
  /** Spanish editorial title — falls back to pre-cleaned original while loading. */
  title: string;
  /** Spanish lede — falls back to truncated original abstract while loading. */
  lede: string;
  /** True while a Pollinations call is in flight. */
  loading: boolean;
  /** The original (pre-cleaned) title, in case the UI wants to show it as a subtitle. */
  original: string;
}

export interface UseTranslatedOptions {
  /**
   * Cuándo disparar la request. PaperCard lo usa para gatear por viewport:
   * pasa `false` hasta que IntersectionObserver dice que la card entró al
   * viewport. Default: true. Si hay cache, igual la devolvemos sincrónico,
   * sin importar `enabled`.
   */
  enabled?: boolean;
  /**
   * 'high' = detail page jumps queue; 'low' = feed. Default: 'low'.
   */
  priority?: 'high' | 'low';
}

/**
 * Lazy-loads + caches a paper's translated title + lede. Returns the original
 * (pre-cleaned) text as a fallback immediately, then swaps in the translation
 * when it arrives. Safe to call in every PaperCard — in-flight requests are
 * deduped per paperId.
 */
export function useTranslated(
  paper: Paper | null | undefined,
  options: UseTranslatedOptions = {}
): UseTranslatedResult {
  const { enabled = true, priority = 'low' } = options;
  const { lang, version } = useLang();
  const fallbackTitle = paper ? preCleanTitle(paper.title) : '';

  const initial = (() => {
    if (!paper) return { title: '', lede: '', loading: false };
    const cached = getCachedTranslation(paper.id, lang);
    if (cached) {
      return {
        title: cached.titleEs || fallbackTitle,
        lede: cached.ledeEs || '',
        loading: false,
      };
    }
    return { title: fallbackTitle, lede: '', loading: enabled };
  })();

  const [state, setState] = useState(initial);

  useEffect(() => {
    if (!paper) {
      setState({ title: '', lede: '', loading: false });
      return;
    }

    const cached = getCachedTranslation(paper.id, lang);
    if (cached) {
      setState({
        title: cached.titleEs || fallbackTitle,
        lede: cached.ledeEs || '',
        loading: false,
      });
      return;
    }

    if (!enabled) {
      setState({ title: fallbackTitle, lede: '', loading: false });
      return;
    }

    setState({ title: fallbackTitle, lede: '', loading: true });

    let cancelled = false;
    fetchTranslation(paper, { priority, lang })
      .then(t => {
        if (cancelled) return;
        setState({
          title: t.titleEs || fallbackTitle,
          lede: t.ledeEs || '',
          loading: false,
        });
      })
      .catch(err => {
        if (!isAbortError(err)) {
          console.warn('[translate] fetch failed', paper.id, lang, err);
        }
        if (!cancelled) {
          setState({ title: fallbackTitle, lede: '', loading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [paper?.id, enabled, priority, lang, version]);

  return { ...state, original: fallbackTitle };
}
