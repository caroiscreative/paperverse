// Paper title + lede translation/cleanup via Pollinations.ai.
//
// Por qué existe:
//   Los títulos y abstracts de OpenAlex vienen en el idioma original del paper
//   (mayormente inglés), con basura de LaTeX ($\alpha$, \textit{...}), entidades
//   HTML (&lt;), markup suelto, ALL-CAPS de revistas viejas, o glifos rotos por
//   OCR malo. En un feed eso es ruido: el lector rebota frente a títulos feos
//   y se pierde contenido que podría interesarle. La promesa editorial de
//   Paperverse es "ciencia para scrollear", así que en una sola pasada hacemos:
//     1. Limpieza de basura (LaTeX, HTML, capitalización rota).
//     2. Traducción a español neutro (LATAM) — no literal, vamos por la "crema"
//        del tema. Una frase que captura de qué va el paper, no una traducción
//        palabra-por-palabra del título académico.
//
// Por qué español neutro y no rioplatense / Argentino: es venezolana,
// y aunque el lector ideal es bilingüe (porque estamos leyendo papers), forzar
// "vos" / modismos rioplatenses creaba un sesgo regional innecesario. Español
// neutro LATAM (sin "vos", sin "vosotros") se lee natural en cualquier país
// hispanohablante y a le queda como Venezuela.
//
// Caché: localStorage, cap FIFO. Mismo patrón que Explicámelo — una vez
// traducido, el paper conserva su título/lede en español en este dispositivo
// para siempre (o hasta que MAX_ENTRIES expulse al más viejo).
//
// Modo de falla: si Pollinations está caído o devuelve basura, el hook cae al
// título/abstract original así el feed nunca muestra blancos.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Paper } from './openalex';
import {
  withPollinationsSlot,
  fetchPollinations,
  friendlyPollinationsError,
  timeoutSignal,
  isAbortError,
} from './pollirate';

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

// v5: bumped desde v4 porque se reportó títulos que se
// quedaban en malayo ("a veces me salen algunos en malisio y no entiendo
// nada"). La causa era que el prompt del modelo decía "Even if the abstract
// is in English…" — sesgaba hacia asumir inglés como source y cuando el
// input venía en malayo/indonesio/chino, el modelo a veces devolvía el título
// sin traducir, que después se cacheaba. Reforzamos el prompt para decir
// explícitamente que traduzca desde CUALQUIER idioma (ver
// buildSystemPrompt y buildBatchSystemPrompt). Bumpear a v5 invalida todas
// las entries del cache viejo — mayormente buenas, pero mezcladas con
// títulos en malayo que eran los que rompían la UX. Se re-traduce bajo
// demanda vía batcher, sin refresh manual.
//
// v4: bumped desde v3 cuando ELIMINAMOS el multi-idioma. v3 indexaba la cache
// como `${paperId}:${lang}`. v4 la indexa sólo por paperId — todas las
// entries son español neutro y las viejas con sufijo `:es` quedaron muertas.
const CACHE_KEY = 'pv_translate_cache_v5';

// Los títulos son chicos (cientos de bytes), pero renderizamos muchos papers
// por sesión. 200 entries son ~40–80 KB — un error de redondeo contra la
// cuota de localStorage, y de sobra para el scrolling normal del usuario.
const MAX_ENTRIES = 200;

/**
 * Ventana de debounce para el batcher. Cuando el feed monta 12 cards a la vez,
 * todos los `useTranslated` disparan un `fetchTranslation` casi simultáneo.
 * Si esperamos antes de llamar a Pollinations, los requests caen en la misma
 * ventana y los agrupamos en UNA sola llamada que pide las traducciones en JSON.
 *
 * 200ms (y no 50ms) por dos razones: (1) cuando el usuario aprieta refresh,
 * queremos que las requests del nuevo "intento" se coalescan y las anteriores
 * queden olvidadas. (2) la latencia de Pollinations es 2–5s, así que 200ms
 * sigue siendo ruido para el usuario.
 */
const BATCH_DEBOUNCE_MS = 200;

/**
 * Tope por batch. Más papers por request = más ahorro, pero también output
 * más largo y más riesgo de que Pollinations trunque el JSON o se olvide
 * algún campo. Probamos con 8 y vimos que algunos batches devolvían sólo el
 * título sin lede — síntoma típico de truncado. 5 baja el output medio a
 * ~1200 chars, cómodo incluso para modelos chicos, y sigue dando ahorro
 * (12 cards visibles → ~3 batches en vez de 12 calls).
 */
const BATCH_MAX = 5;

/**
 * Directiva de idioma que metemos al system prompt. Español neutro LATAM:
 * sin "vos" rioplatense ni "vosotros" peninsular. Al modelo le pedimos
 * explícitamente que NO use regionalismos así no se va a "vos sabés" o
 * "habéis encontrado" según con qué corpus haya sido entrenado.
 */
const LANG_PROMPT_NAME =
  'neutral Latin American Spanish (no "vos", no "vosotros", no regional slang)';

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
    // quota / disabled — la próxima vez vamos a re-fetchar nomás. OK.
  }
}

/**
 * Nuke a toda la cache de traducción. Lo usa el botón de refresh del ThemeDock
 * cuando Pollinations dejó títulos en inglés en la cache y el usuario quiere
 * re-pedirlos.
 *
 * También limpia el Map de in-flight: si una request quedó pegada (por ejemplo,
 * el tab perdió foco justo después de pedir y Pollinations nunca respondió),
 * su entrada en `inflight` seguiría ahí y cualquier nuevo fetch del mismo key
 * se subscribiría a esa promesa zombie en vez de hacer un fetch nuevo. Limpiar
 * el map obliga a todos los fetches posteriores a arrancar de cero.
 */
export function clearTranslationCache(): void {
  cacheVersion++;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage disabled */
  }
  inflight.clear();
  // Si hay un batch esperando su ventana de debounce, matamos el timer y
  // rechazamos a los waiters con AbortError. El hook `useTranslated` silencia
  // AbortErrors (no loggea), y el bumpRefresh de abajo va a disparar fetches
  // frescos que empiezan con cache vacía.
  if (batchTimer !== null) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
  for (const w of batchQueue) {
    w.reject(new DOMException('Aborted by cache clear', 'AbortError'));
  }
  batchQueue.length = 0;

  // Abortar cualquier request de Pollinations en vuelo: libera el slot
  // inmediato en vez de esperar el timeout de 30s. El fetch rechaza con
  // AbortError, el slot de pollirate se libera, y las requests nuevas del
  // version bumpeado arrancan sin pelea por el slot.
  for (const c of inflightAbortControllers) c.abort();
  inflightAbortControllers.clear();

  // Notificar a useTranslated para que re-dispare con cache vacía.
  bumpRefresh();
}

export function getCachedTranslation(paperId: string): TranslatedPaper | null {
  const hit = readCache()[paperId];
  if (!hit) return null;
  // Normalizamos al leer — el cache viejo tenía entradas en minúsculas puras
  // que se guardaron antes del fix de capitalización. Aplicar acá evita tener
  // que invalidar todo el cache y las próximas cards salen bien incluso si
  // nunca se re-pidieron al modelo.
  return {
    titleEs: ensureCapitalized(hit.titleEs),
    ledeEs: ensureCapitalized(hit.ledeEs),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Lightweight pre-clean: algunos títulos tienen basura obvia que podemos
// arreglar sin un round-trip al LLM. Corre como fallback (cuando la API falla)
// y como input al modelo (así no gasta tokens re-explicándose LaTeX roto).
// ────────────────────────────────────────────────────────────────────────────
export function preCleanTitle(raw: string): string {
  let t = raw ?? '';
  // Entidades HTML que OpenAlex pasa verbatim.
  t = t
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Colapsar LaTeX matemático a su token interno (e.g., "$\alpha$" → "α" es
  // difícil sin lib, así que strippeamos los delimitadores y comandos).
  t = t.replace(/\$([^$]+)\$/g, '$1');
  t = t.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1');
  t = t.replace(/\\[a-zA-Z]+/g, '');
  // Tags HTML/XML (algunos abstracts incluyen <jats:p>).
  t = t.replace(/<[^>]+>/g, '');
  // Markdown italic/bold suelto que aparece en la normalización de OpenAlex.
  t = t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
  // Normalizar all-caps que tienen >3 palabras (común en revistas viejas).
  if (/^[A-Z0-9 ,.\-:;'"()/&]+$/.test(t) && t.split(/\s+/).length > 3) {
    t = t.toLowerCase();
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  // Colapsar whitespace.
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/**
 * System prompt para el path single. Hardcoded a español neutro. Antes
 * recibía un `langName` parametrizable cuando soportábamos 15 idiomas; al
 * volver a single-language eliminamos ese parámetro y dejamos el español
 * directo en el string.
 */
function buildSystemPrompt(): string {
  return `You are a science editor titling papers for a short-form reading feed. You MUST write everything in ${LANG_PROMPT_NAME}. Do not output anything in a different language.

CRITICAL — source language: the input title and abstract can be in ANY language (English, Malay, Indonesian, Chinese, Japanese, Arabic, German, French, Portuguese, Russian, etc.). No matter what language the source is in, your TITULO and LEDE MUST be translated into ${LANG_PROMPT_NAME}. Never echo the source language back — always translate. If you cannot understand the source language, translate as best you can from what you can infer; do not leave it untranslated.

Your job is to take a paper's original title + abstract (which may contain LaTeX, inline code, stray symbols, or broken typography) and return TWO things:

1) TITULO — the "essence" of the paper. Not a literal translation. A short editorial title (max 90 characters, ideally 50–70) that captures what the paper found or what question it answers, written so a curious reader will want to click. No clickbait, no exclamations, no emoji. Sentence case — lowercase except the first letter and proper nouns. Avoid "Thing: subtitle" colons unless strictly necessary.

2) LEDE — 1 or 2 sentences (max 220 characters) summarizing the paper's main finding in plain, modern ${LANG_PROMPT_NAME}. Keep important numbers (percentages, sample sizes). Don't start with "This paper..." or "The authors..."; start from the idea.

General rules:
- If the abstract is empty or unusable, leave LEDE blank (empty line after "LEDE:").
- Strip LaTeX (\\alpha, $...$), HTML (&lt;), markdown and broken symbols.
- Do not invent findings that aren't in the abstract.
- No markdown in the output.

OUTPUT FORMAT — return EXACTLY these two lines, nothing before or after, no quotes, no markdown, no \`\`\`:
TITULO: <title in Spanish, single line>
LEDE: <lede in Spanish, single line>`;
}

/** Seed determinístico por paper — mismo paper siempre da la misma redacción. */
function seedFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 1_000_000;
}

/**
 * In-flight request dedup: si dos componentes montan al mismo tiempo y ambos
 * piden el mismo paperId, sólo queremos pegarle a Pollinations una vez. El
 * hook `useTranslated` espera esta promesa compartida.
 */
const inflight = new Map<string, Promise<TranslatedPaper>>();

/**
 * Contador monotónico que se bumpea en `clearTranslationCache`. Antes de
 * escribir al localStorage, las funciones de fetch chequean si el contador
 * cambió — si cambió, la request ya empezó ANTES del refresh y sus resultados
 * son stale. No pisamos la caché limpia con datos viejos. Sin esto, el
 * refresh del ThemeDock tenía un race: si el usuario clickeaba refresh mientras
 * un batch estaba esperando la respuesta de Pollinations, el batch terminaba
 * y re-escribía los títulos viejos a la cache "limpia", anulando el refresh.
 */
let cacheVersion = 0;

/**
 * AbortControllers de todas las requests de traducción en vuelo (batch y single).
 * Se poblan al arrancar el fetch, se limpian al terminar, y se abortan TODAS
 * cuando el usuario clickea refresh (`clearTranslationCache`). Sin esto, el
 * slot de Pollinations quedaba tomado hasta que venciera el timeout de 30s —
 * durante ese tiempo, las nuevas requests post-refresh se encolaban detrás y
 * veía el feed congelado. Abortarlas libera el slot inmediatamente.
 */
const inflightAbortControllers = new Set<AbortController>();

// ────────────────────────────────────────────────────────────────────────────
// Refresh pub/sub — mecanismo mínimo para que useTranslated re-dispare cuando
// el usuario aprieta el botón de refresh del ThemeDock. Antes esto vivía en
// `lang.ts` junto con todo el state multi-idioma; al eliminar multi-idioma lo
// ponemos acá adentro porque el único consumer es useTranslated.
// ────────────────────────────────────────────────────────────────────────────

let refreshVersion = 0;
const refreshListeners = new Set<() => void>();

/** Bumpea la versión y notifica a todos los suscriptores. */
function bumpRefresh(): void {
  refreshVersion++;
  for (const fn of refreshListeners) fn();
}

function subscribeRefresh(fn: () => void): () => void {
  refreshListeners.add(fn);
  return () => {
    refreshListeners.delete(fn);
  };
}

function getRefreshSnapshot(): number {
  return refreshVersion;
}

/**
 * Hook React: devuelve el version actual de refresh. Componentes que lo usan
 * se re-renderizan cuando alguien llama a `clearTranslationCache` (que internamente
 * bumpea refresh). Implementado con `useSyncExternalStore` — el hook oficial
 * de React 18 para suscribirse a stores externos, que evita edge cases con
 * concurrent rendering y StrictMode.
 */
export function useTranslationRefresh(): number {
  return useSyncExternalStore(subscribeRefresh, getRefreshSnapshot, getRefreshSnapshot);
}

export interface FetchTranslationOptions {
  /**
   * 'high' = detail page (jumps el queue del feed).
   * 'low'  = feed (default).
   */
  priority?: 'high' | 'low';
}

/**
 * Cuántos papers prefetechamos eagerly al cargar el feed. El resto queda
 * viewport-gated (se traducen cuando IntersectionObserver los detecta cerca
 * del viewport).
 *
 * Por qué 8 y no "todos": probamos con el feed completo (~20 papers) y
 * Pollinations tiraba 429 en cascada — la ráfaga inicial ya lo saturaba, y
 * después las cards de abajo se encontraban con un servicio "caído" por
 * cooldown. 8 cubre las primeras 2 pantallas de scroll (hero + ~5-6 cards
 * visibles) que es lo que el usuario ve en el primer segundo. Los batches
 * de 5 de abajo (BATCH_MAX) hacen que estos 8 salgan en 2 llamadas HTTP,
 * margen sano bajo el RPM límite de Pollinations. A partir de la 9na card
 * el viewport-gating asegura que sólo lo que se acerca al viewport
 * enqueue-a — el scroll natural reparte la carga en el tiempo.
 */
const PREFETCH_MAX = 8;

/**
 * Eager prefetch de traducciones para la cabecera de una lista de papers —
 * fire-and-forget.
 *
 * Antes las cards del feed sólo disparaban la traducción cuando
 * IntersectionObserver decía que entraban al viewport. Eso mantenía la cola
 * corta pero introducía un delay muy visible: apenas scrolleabas, la próxima
 * card aparecía un segundo en idioma original hasta que el batcher la
 * traducía. En papers en francés/portugués/malayo eso se notaba fuerte
 * (títulos ilegibles que después swappeaban al español).
 *
 * Ahora: apenas el Feed recibe el array de papers de OpenAlex, llamamos a
 * `prefetchTranslations(papers)` y el batcher empieza a resolver los primeros
 * PREFETCH_MAX. Las cards que el usuario ve primero ya tienen la traducción
 * cacheada cuando aparecen; las de abajo siguen viewport-gated y se traducen
 * cuando se acercan.
 *
 * Por qué sigue respetando el viewport en el hook: el hook `useTranslated` con
 * `enabled={isVisible}` todavía es el responsable de leer la cache y pintar
 * la card — si ya está cacheada cuando se monta, se renderiza sincrónica sin
 * spinner. Esta función sólo adelanta el fetch de la cabecera; no desactiva
 * el gating.
 *
 * Dedup: `fetchTranslation` internamente comparte la promesa por paperId
 * (Map `inflight`), así que llamar a esto dos veces no duplica requests.
 * También saltea papers que ya están en la cache (chequeo sincrónico al
 * inicio de fetchTranslation).
 */
export function prefetchTranslations(papers: readonly Paper[]): void {
  // Sólo los primeros PREFETCH_MAX — el resto va por viewport gating. Así
  // evitamos la ráfaga de 20+ requests que disparaba 429 en cascada al
  // cargar el feed.
  const head = papers.slice(0, PREFETCH_MAX);
  for (const paper of head) {
    // Fire-and-forget. Cada request maneja sus propios errores adentro;
    // si algo falla, useTranslated cae al fallback pre-limpiado cuando la
    // card se monte.
    fetchTranslation(paper, { priority: 'low' }).catch(() => {
      /* silenciado a propósito — no hay UI que notificar desde acá */
    });
  }
}

export async function fetchTranslation(
  paper: Paper,
  options: FetchTranslationOptions = {}
): Promise<TranslatedPaper> {
  const priority = options.priority ?? 'low';
  const key = paper.id;

  const cache = readCache();
  if (cache[key]) return cache[key];

  const existing = inflight.get(key);
  if (existing) return existing;

  // Nuevo flujo: en vez de pegarle directo a Pollinations con un paper,
  // registramos el request en el batcher. Si en los próximos 200ms llegan más
  // requests, todos salen juntos en UNA sola llamada. Si falla el batch (JSON
  // mal parseado, Pollinations tira error transitorio), cada waiter cae al
  // path single (fetchTranslationSingle) por su cuenta.
  const p = enqueueForBatch(paper, priority);
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

/**
 * Path single-per-paper — el que usábamos antes del batching. Queda como
 * fallback: si el batch devuelve JSON inválido o no trae un id determinado,
 * cada waiter que quedó huérfano se re-intenta solo por acá.
 *
 * También se usa si el batch entero falla (error de red, parse roto): mejor
 * disparar N requests individuales que dejar a todos los waiters colgados.
 * EXCEPCIÓN: si el batch falló por rate-limit/abort, NO caemos a single
 * porque amplificaría el problema (5 requests más sobre algo que ya rebotó).
 */
async function fetchTranslationSingle(
  paper: Paper,
  priority: 'high' | 'low'
): Promise<TranslatedPaper> {
  const key = paper.id;
  const cleanTitle = preCleanTitle(paper.title);
  const cleanAbstract = paper.abstract ? preCleanTitle(paper.abstract) : '';

  const systemPrompt = buildSystemPrompt();
  const userPrompt = `Original title: ${cleanTitle}

Original abstract (may be empty):
${cleanAbstract || '(no abstract)'}

Return the two lines TITULO: and LEDE: as the system says, writing in ${LANG_PROMPT_NAME}.`;

  // Timeout duro + abort externo: el `ctrl` permite que clearTranslationCache
  // aborte esta request inmediatamente al hacer refresh. Combinamos ambos en
  // un solo signal con `timeoutSignal(ms, parent)` — se dispara con el primero
  // que ocurra. El signal final se propaga al slot (cancela el lugar en la
  // cola) y al fetch (aborta la request).
  const ctrl = new AbortController();
  inflightAbortControllers.add(ctrl);
  const { signal, cleanup } = timeoutSignal(TRANSLATION_TIMEOUT_MS, ctrl.signal);
  // Capturamos version antes del fetch; si cambia, refresh del usuario pisó
  // la cache y no queremos escribir datos stale al volver.
  const startVersion = cacheVersion;

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
            seed: seedFrom(paper.id),
            referrer: 'paperverse',
            private: true,
            // `max_tokens` chico: el output es ~50 tokens (dos líneas
            // TITULO/LEDE). Limitar acorta la generación y reduce la
            // latencia desde Pollinations.
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

      // Sanity floor: si algún campo vino vacío, caemos al pre-cleaned original
      // así la card al menos renderea algo útil. Además forzamos mayúscula
      // inicial — el modelo a veces devuelve el título en minúsculas puras
      // ("enseñando relaciones métricas…") aunque el prompt diga lo contrario.
      // Mejor normalizar en la capa de parsing que esperar que el modelo lo
      // haga bien siempre.
      const result: TranslatedPaper = {
        titleEs: ensureCapitalized(parsed.titleEs || cleanTitle),
        ledeEs: ensureCapitalized(parsed.ledeEs || deriveLede(cleanAbstract)),
      };

      // Sólo escribimos a cache si la version no cambió — ver comentario en
      // cacheVersion arriba. Si cambió, igualmente devolvemos el resultado al
      // waiter (que va a descartarlo porque su componente ya re-rendeó).
      if (cacheVersion === startVersion) {
        const next = readCache();
        next[key] = result;
        writeCache(next);
      }
      return result;
    }, { priority, signal });
  } finally {
    cleanup();
    inflightAbortControllers.delete(ctrl);
  }
}

export { isAbortError };

/**
 * Parsea el output line-delimited del modelo. Pedimos:
 *   TITULO: ...
 *   LEDE: ...
 * …pero Pollinations a veces lo envuelve en ```, antepone un banner, o mete
 * una línea en blanco extra. Normalizamos y matcheamos por label así el orden
 * o el whitespace extra no nos rompe. Si igual parece JSON (cache vieja o
 * drift del modelo), caemos al parser JSON anterior como red de seguridad.
 */
function parseTranslation(raw: string): TranslatedPaper {
  let s = raw.trim();
  // Strippear fences ``` si están.
  s = s.replace(/^```(?:[a-z]+)?\s*/i, '').replace(/```$/i, '').trim();

  // Forma line-delimited (contrato actual).
  const titleMatch = s.match(/(?:^|\n)\s*(?:TITULO|TÍTULO|TITLE)\s*:\s*(.+)/i);
  const ledeMatch = s.match(/(?:^|\n)\s*(?:LEDE|LEAD|LEDA)\s*:\s*([\s\S]+)$/i);
  if (titleMatch) {
    const titleEs = stripQuotes(titleMatch[1].trim()).split(/\n/)[0].trim();
    // El lede puede wrappear varias líneas; tomamos todo después de "LEDE:"
    // hasta el final, después strippeamos markdown / labels que sobren.
    let ledeEs = ledeMatch ? stripQuotes(ledeMatch[1].trim()) : '';
    // Si el match del lede chupó accidentalmente otra línea TITULO, la cortamos.
    ledeEs = ledeEs.replace(/\n\s*(?:TITULO|TÍTULO|TITLE)\s*:[\s\S]*$/i, '').trim();
    return { titleEs, ledeEs };
  }

  // Fallback JSON legacy — entries viejas de cache o drift del modelo.
  const jsonMatch = s.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]) as { titleEs?: string; ledeEs?: string };
      return {
        titleEs: typeof obj.titleEs === 'string' ? obj.titleEs.trim() : '',
        ledeEs: typeof obj.ledeEs === 'string' ? obj.ledeEs.trim() : '',
      };
    } catch {
      /* fall through */
    }
  }

  return { titleEs: '', ledeEs: '' };
}

/** Quita comillas matchadas que el modelo a veces agrega al rodear el output. */
function stripQuotes(s: string): string {
  const m = s.match(/^["“'«](.*)["”'»]$/s);
  return m ? m[1].trim() : s;
}

/**
 * Asegura que la primera *letra* esté en mayúsculas. Saltea prefijos no-letra
 * (comillas, guiones, dígitos) así cosas como "5 pasos para…" o "«cómo
 * medimos…»" no pierden su primera letra real. Usa toLocaleUpperCase('es')
 * para manejar ñ/acentos.
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

// El concurrency limiting vive en ./pollirate — compartido con explain.ts así
// las traducciones del feed y Explicámelo no pelean por el slot único de
// Pollinations.

/** Fallback local para el lede: truncar el abstract pre-limpiado. */
function deriveLede(cleanAbstract: string): string {
  if (!cleanAbstract) return '';
  if (cleanAbstract.length <= 220) return cleanAbstract;
  return cleanAbstract.slice(0, 220).replace(/\s+\S*$/, '') + '…';
}

// ────────────────────────────────────────────────────────────────────────────
// Batcher — agrupa requests simultáneas en una sola llamada a Pollinations
// ────────────────────────────────────────────────────────────────────────────

/**
 * Cada waiter representa un `fetchTranslation` encolado esperando su batch.
 * Se resuelve cuando flushBatch termina y le llegan el titleEs/ledeEs del
 * JSON que devolvió Pollinations.
 */
type BatchWaiter = {
  paper: Paper;
  priority: 'high' | 'low';
  resolve: (t: TranslatedPaper) => void;
  reject: (e: unknown) => void;
};

/**
 * Una única queue (no por idioma como antes — ahora todo es español neutro).
 * Y un único timer. Esto simplifica mucho el código y evita bookkeeping
 * innecesario.
 */
const batchQueue: BatchWaiter[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Registra un request en el batcher y devuelve una promesa que se resuelve
 * cuando flushBatch termine. La promesa también puede rechazarse con
 * AbortError si clearTranslationCache() se llama mientras el waiter espera.
 */
function enqueueForBatch(
  paper: Paper,
  priority: 'high' | 'low'
): Promise<TranslatedPaper> {
  return new Promise<TranslatedPaper>((resolve, reject) => {
    batchQueue.push({ paper, priority, resolve, reject });

    // Si ya llenamos el batch al tope, disparamos ya — no tiene sentido
    // esperar el debounce porque el próximo request que entre arranca su
    // propio batch igual.
    if (batchQueue.length >= BATCH_MAX) {
      if (batchTimer !== null) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }
      // microtask para no correr sincrónico dentro del constructor de la
      // promise (que está dentro de fetchTranslation → inflight.set aún no
      // ocurrió). 0ms es suficiente: el loop de microtareas ya corrió.
      batchTimer = setTimeout(() => {
        batchTimer = null;
        void flushBatch();
      }, 0);
      return;
    }

    // Si es el primer request de la ventana, arrancamos el timer. Si ya hay
    // timer corriendo, no lo reiniciamos — mantenemos la ventana fija desde
    // el primer request para evitar que un stream continuo de requests
    // postergue el flush indefinidamente.
    if (batchTimer === null) {
      batchTimer = setTimeout(() => {
        batchTimer = null;
        void flushBatch();
      }, BATCH_DEBOUNCE_MS);
    }
  });
}

/**
 * Toma hasta BATCH_MAX waiters de la queue, los manda en UNA request a
 * Pollinations pidiendo JSON, y dispatch-ea los resultados a cada waiter.
 * Si el parse falla o faltan ids, los waiters huérfanos caen al path
 * single-per-paper.
 */
async function flushBatch(): Promise<void> {
  if (batchQueue.length === 0) return;

  const batch = batchQueue.splice(0, BATCH_MAX);

  // Si quedaron waiters en la queue (ej. llegaron 15 y procesamos 5),
  // agendamos un flush inmediato para los restantes. Usamos 0ms porque el
  // slot de Pollinations está ocupado con el batch actual igual, así que no
  // hay beneficio en esperar.
  if (batchQueue.length > 0 && batchTimer === null) {
    batchTimer = setTimeout(() => {
      batchTimer = null;
      void flushBatch();
    }, 0);
  }

  // Prioridad efectiva del batch = la más alta de sus waiters. Si el detail
  // page está esperando, todo el batch salta al priority 'high' para que no
  // quede atrás del feed ya encolado.
  const priority: 'high' | 'low' =
    batch.some(w => w.priority === 'high') ? 'high' : 'low';

  // Snapshot de la version ANTES de pegarle a Pollinations. Si el usuario
  // clickea refresh mientras la request está en vuelo, al volver vemos que
  // cacheVersion cambió y descartamos el resultado en vez de pisar la cache
  // limpia con datos stale.
  const startVersion = cacheVersion;

  let results: Map<string, TranslatedPaper>;
  try {
    results = await runBatchTranslation(batch.map(w => w.paper), priority);
  } catch (err) {
    // Dos caminos según el tipo de error:
    //
    // 1) Rate-limit o abort → NO reintentamos con single. Mandar 5 requests
    //    individuales después de un 429 amplifica el problema: Pollinations
    //    nos rebotó porque ya estábamos por encima del límite, y 5 más lo
    //    empeoran. Mejor rechazar a los waiters (useTranslated cae al
    //    fallback pre-limpiado) y esperar a que la cola drene. El próximo
    //    render — o el próximo refresh manual — intenta de nuevo con la
    //    cola ya desahogada.
    //
    // 2) Error transitorio (red, parse, timeout corto) → sí tiene sentido
    //    el fallback single por waiter. Un single request usa gramática
    //    line-delimited más simple, y si el batch falló por JSON malformado
    //    cada paper individualmente tiene más chances de salir limpio.
    const errMsg = err instanceof Error ? err.message : String(err);
    const isRateLimit =
      errMsg.includes('saturado') ||
      errMsg.includes('429') ||
      errMsg.includes('caído');
    if (isAbortError(err) || isRateLimit) {
      for (const w of batch) w.reject(err);
      if (!isAbortError(err)) {
        console.warn('[translate] batch rate-limited, not retrying single', errMsg);
      }
      return;
    }

    for (const w of batch) {
      fetchTranslationSingle(w.paper, w.priority)
        .then(w.resolve)
        .catch(w.reject);
    }
    console.warn('[translate] batch failed, falling back to single', err);
    return;
  }

  // Si el usuario refresheó mientras el batch estaba en vuelo, los resultados
  // que llegaron son de la cache vieja — no los escribimos. Los waiters
  // originales los rechazamos con AbortError (sus componentes ya re-rendearon
  // con el nuevo `version` y van a disparar fetches nuevos).
  if (startVersion !== cacheVersion) {
    for (const w of batch) {
      w.reject(new DOMException('Cache cleared during batch', 'AbortError'));
    }
    return;
  }

  // Protección contra amplificación: si el batch devolvió Map vacío (JSON
  // inválido o respuesta basura) pero no tiró error, NO caemos al path single
  // por waiter. Causa más común de esto: Pollinations devolvió HTTP 200 con
  // un body que no es un JSON array (por ejemplo, un mensaje de rate-limit
  // disfrazado, o el modelo terminó con un prose antes de arrancar el array
  // y nuestro parser no encontró `[`). En ese escenario, disparar 5 requests
  // single-per-paper multiplica la carga justo cuando el servicio está más
  // débil. Mejor rechazar a los waiters y dejar que `useTranslated` los
  // reintente después (con su retry-on-error scheduling, de abajo).
  if (results.size === 0 && batch.length > 0) {
    console.warn(
      '[translate] batch returned empty results; rejecting waiters without single fallback to avoid amplification'
    );
    for (const w of batch) {
      w.reject(new Error('El servicio de IA está saturado'));
    }
    return;
  }

  // Dispatch — para cada waiter, buscamos su id en el map. Si el modelo
  // omitió un id (pasó) o devolvió título pero se olvidó el lede cuando había
  // abstract para resumir, ese waiter cae al path single. Así evitamos dejar
  // cards con título traducido pero lede truncado/faltante.
  //
  // Papers con abstract vacío legítimamente tienen lede vacío — no son
  // huérfanos, sólo tienen nada que resumir.
  const next = readCache();
  const orphans: BatchWaiter[] = [];
  for (const w of batch) {
    const hit = results.get(w.paper.id);
    const cleanAbstract = w.paper.abstract ? preCleanTitle(w.paper.abstract) : '';
    const expectsLede = cleanAbstract.length > 0;
    const missingTitle = !hit || !hit.titleEs.trim();
    const missingLede = expectsLede && (!hit || !hit.ledeEs.trim());
    if (missingTitle || missingLede) {
      orphans.push(w);
      continue;
    }
    const result: TranslatedPaper = {
      titleEs: ensureCapitalized(hit!.titleEs.trim()),
      ledeEs: ensureCapitalized(hit!.ledeEs.trim()),
    };
    next[w.paper.id] = result;
    w.resolve(result);
  }
  writeCache(next);

  // Huérfanos: reintentar por single. Ojo — acá sólo llegan waiters que
  // sí tuvieron un match parcial en el batch (falta título, falta lede, id
  // ausente). Si el batch entero falló, arriba ya cortamos. Así que como
  // mucho tenemos 1-2 orphans por batch, no 5, y una retransmisión single
  // para completar el lede que el modelo se olvidó es aceptable.
  for (const w of orphans) {
    fetchTranslationSingle(w.paper, w.priority)
      .then(w.resolve)
      .catch(w.reject);
  }
}

/**
 * La llamada HTTP en sí — arma el prompt JSON-in/JSON-out, pega una vez,
 * parsea y devuelve un Map<id, {titleEs, ledeEs}>. No toca la cache ni
 * resuelve waiters: sólo traduce; el dispatching lo hace flushBatch.
 */
async function runBatchTranslation(
  papers: Paper[],
  priority: 'high' | 'low'
): Promise<Map<string, TranslatedPaper>> {
  const systemPrompt = buildBatchSystemPrompt();

  const inputs = papers.map(p => ({
    id: p.id,
    title: preCleanTitle(p.title),
    abstract: p.abstract ? preCleanTitle(p.abstract) : '',
  }));

  const userPrompt = `Translate these papers to ${LANG_PROMPT_NAME}. Input JSON:
${JSON.stringify(inputs)}

Return the JSON array described in the system prompt — one object per input, in the same order, preserving each id exactly.`;

  // Seed determinístico derivado de todos los ids del batch. Mismo batch →
  // mismo output. Como el batch composition varía según quién llegue en la
  // ventana, un paper puede terminar con seed distinto en reintentos, pero la
  // cache absorbe eso — primer resultado que llega se queda.
  const seedSource = papers.map(p => p.id).join('|');
  let h = 0;
  for (let i = 0; i < seedSource.length; i++) h = (h * 31 + seedSource.charCodeAt(i)) | 0;
  const seed = Math.abs(h) % 1_000_000;

  // Mismo patrón que fetchTranslationSingle: AbortController externo + timeout
  // duro combinados. Permite que clearTranslationCache aborte el batch en vuelo
  // sin esperar 30s, liberando el slot de Pollinations al toque.
  const ctrl = new AbortController();
  inflightAbortControllers.add(ctrl);
  const { signal, cleanup } = timeoutSignal(TRANSLATION_TIMEOUT_MS, ctrl.signal);

  try {
    const raw = await withPollinationsSlot(async () => {
      const resp = await fetchPollinations(
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
            seed,
            referrer: 'paperverse',
            private: true,
            // ~220 tokens por paper (título + lede + JSON overhead) × N + margen
            // para no truncar el cierre del array.
            max_tokens: 220 * papers.length + 200,
          }),
          signal,
        },
        { signal }
      );
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(friendlyPollinationsError(resp.status, body));
      }
      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content?.trim() ?? '';
    }, { priority, signal });

    return parseBatchResponse(raw);
  } finally {
    cleanup();
    inflightAbortControllers.delete(ctrl);
  }
}

/**
 * Igual que buildSystemPrompt pero para múltiples papers en JSON. El modelo
 * tiene que devolver un array de objetos con id/titulo/lede. Si el JSON sale
 * mal, el parser detecta y cada waiter cae al path single.
 */
function buildBatchSystemPrompt(): string {
  return `You are a science editor titling papers for a short-form reading feed. You MUST write everything in ${LANG_PROMPT_NAME}. Do not output anything in a different language.

CRITICAL — source language: each paper's title and abstract can be in ANY language (English, Malay, Indonesian, Chinese, Japanese, Arabic, German, French, Portuguese, Russian, etc.). No matter what language a paper's source is in, your "titulo" and "lede" for that paper MUST be translated into ${LANG_PROMPT_NAME}. Never echo the source language back — always translate. If a paper is in a language you cannot fully parse, translate as best you can from what you can infer; do not leave it untranslated or copy the original.

You will receive a JSON array of papers. For EACH paper, return a JSON object with:
- "id": the EXACT id from the input (do not modify or translate).
- "titulo": the "essence" of the paper — a short editorial title (max 90 characters, ideally 50–70) in ${LANG_PROMPT_NAME}. Not a literal translation; capture what the paper found or what question it answers, written so a curious reader will want to click. No clickbait, no exclamations, no emoji. Sentence case — lowercase except the first letter and proper nouns. Avoid "Thing: subtitle" colons unless strictly necessary.
- "lede": 1 or 2 sentences (max 220 characters) in plain, modern ${LANG_PROMPT_NAME} summarizing the paper's main finding. Keep important numbers (percentages, sample sizes). Don't start with "This paper..." or "The authors..."; start from the idea.

Rules:
- If a paper's abstract is empty or unusable, return "lede": "" for that paper.
- Strip LaTeX (\\alpha, $...$), HTML (&lt;), markdown, and broken symbols.
- Do not invent findings that aren't in the abstract.
- No markdown in the output.

OUTPUT FORMAT — return ONLY a JSON array, one object per input paper, in the same order. No prose before or after, no code fences, no \`\`\`:
[{"id":"<id>","titulo":"<title in Spanish>","lede":"<lede in Spanish>"}, ...]`;
}

/**
 * Normaliza una clave de objeto JSON para matching: lowercase + sin acentos.
 * "Título" → "titulo", "TITULO" → "titulo". Así no importa si el modelo
 * devolvió la key con acento o mayúsculas.
 */
function normalizeKey(k: string): string {
  return k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const TITLE_KEYS = new Set(['titulo', 'title']);
const LEDE_KEYS = new Set(['lede', 'lead', 'summary', 'resumen']);

function pickField(item: Record<string, unknown>, validKeys: Set<string>): string {
  for (const [k, v] of Object.entries(item)) {
    if (typeof v === 'string' && validKeys.has(normalizeKey(k))) {
      return v;
    }
  }
  return '';
}

/**
 * Parsea el array JSON que devolvió Pollinations. Tolera:
 *   - Fences ```json ... ``` (se strippean)
 *   - Prose antes o después del array (tomamos de primer [ a último ])
 *   - Keys en español o inglés ("titulo", "título", "Title")
 *   - Keys con/sin acento y en distintas capitalizaciones
 *
 * Si el JSON no parsea, logueamos el raw para debug y devolvemos map vacío.
 * flushBatch interpreta eso como "nadie fue resuelto" y cada waiter cae a
 * single, que tiene una gramática line-delimited más simple para el modelo.
 */
function parseBatchResponse(raw: string): Map<string, TranslatedPaper> {
  const map = new Map<string, TranslatedPaper>();
  let s = raw.trim();
  s = s.replace(/^```(?:[a-z]+)?\s*/i, '').replace(/```$/i, '').trim();

  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    // Sin brackets y con señales de banner de error del proveedor → tiramos
    // un error de rate-limit en vez de devolver Map vacío. Así flushBatch lo
    // clasifica como rate-limit directo y salta la guarda empty-results
    // (ambas terminan rechazando waiters con "saturado", pero así el log es
    // 1 warning en vez de 2 y la clasificación es más precisa). Heurística:
    // respuesta corta (< 400 chars) con al menos una palabra típica de banner
    // de error en inglés o español.
    const lower = s.toLowerCase();
    const looksLikeErrorBanner =
      s.length < 400 &&
      /\b(rate[\s-]?limit|quota|too many|unavailable|saturado|error|forbidden|unauthorized|try again)\b/.test(lower);
    if (looksLikeErrorBanner) {
      throw new Error(`El servicio de IA está saturado (${s.slice(0, 80)})`);
    }
    console.warn('[translate] batch response had no JSON array', raw.slice(0, 300));
    return map;
  }
  const jsonStr = s.slice(start, end + 1);

  let arr: unknown;
  try {
    arr = JSON.parse(jsonStr);
  } catch (err) {
    console.warn('[translate] batch JSON parse failed', err, jsonStr.slice(0, 300));
    return map;
  }

  if (!Array.isArray(arr)) {
    console.warn('[translate] batch JSON was not an array', typeof arr);
    return map;
  }

  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id : null;
    if (!id) continue;
    const titleEs = stripQuotes(pickField(obj, TITLE_KEYS).trim());
    const ledeEs = stripQuotes(pickField(obj, LEDE_KEYS).trim());
    map.set(id, { titleEs, ledeEs });
  }
  return map;
}

// ────────────────────────────────────────────────────────────────────────────
// React hook
// ────────────────────────────────────────────────────────────────────────────

export interface UseTranslatedResult {
  /** Título editorial en español — cae al pre-limpiado original mientras carga. */
  title: string;
  /** Lede en español — cae al abstract original truncado mientras carga. */
  lede: string;
  /** True mientras hay una llamada a Pollinations en vuelo. */
  loading: boolean;
  /** El título original (pre-limpiado), por si la UI lo quiere como subtítulo. */
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
 * Cuántas veces reintentamos una traducción por card después de un error
 * antes de rendirnos. Bajado a 1 porque más retries saturan más: el
 * cooldown de Pollinations ya es de hasta 20s interno, y si reintentamos
 * agresivamente alimentamos el problema. Con 1 solo retry a los 8s
 * cubrimos el caso típico (ráfaga inicial 429 que se libera en <10s) sin
 * insistir cuando el servicio está realmente caído.
 */
const USE_TRANSLATED_MAX_RETRIES = 1;

/**
 * Demora del único reintento (ms). 8s ≈ lo que tarda Pollinations en
 * drenar una cola típica después de un 429.
 */
const USE_TRANSLATED_RETRY_DELAYS_MS = [8_000];

/**
 * Tope duro de cuánto mostramos el skeleton antes de swappear al título
 * original pre-limpiado. Si la traducción llega antes, perfecto — el
 * skeleton nunca se ve porque fue < frame de render. Si tarda más (batch
 * lento, 429, etc.), después de este timeout el usuario ve el título
 * original en inglés/francés/etc, legible, y la traducción sigue
 * viniendo en background — swappea en cuanto llega.
 *
 * Trade-off: 3.5s es suficiente para cubrir un batch normal (~2–3s) sin
 * que el skeleton se sienta indefinido cuando las cosas van mal. Carolina:
 * "si se satura y entro en cooldown pierdo toda la capacidad de lectura,
 * aun en inglés" — este timeout garantiza que siempre hay texto leíble
 * en ≤3.5s desde el mount, pase lo que pase con Pollinations.
 */
const SKELETON_MAX_MS = 3_500;

/**
 * Lazy-loads + cachea el título + lede traducidos de un paper. Devuelve el
 * texto original (pre-limpiado) como fallback inmediato, después swappea a
 * la traducción cuando llega. Seguro de llamar en cada PaperCard — los
 * requests in-flight están dedupeados por paperId.
 *
 * Retry-on-error (fix 2026-04-21): cuando una traducción falla por 429 /
 * rate-limit / JSON malformado, el hook programa un reintento con delay
 * exponencial hasta `USE_TRANSLATED_MAX_RETRIES` veces — siempre y cuando la
 * card siga `enabled` (viewport-visible). Sin esto, cuando una ráfaga de
 * requests saturaba Pollinations las cards quedaban muertas en fallback y
 * el usuario tenía que apretar el botón de refresh manualmente para
 * recuperarlas. Ahora se recuperan solas cuando la cola drena.
 */
export function useTranslated(
  paper: Paper | null | undefined,
  options: UseTranslatedOptions = {}
): UseTranslatedResult {
  const { enabled = true, priority = 'low' } = options;
  // Versión de refresh global: cuando el usuario aprieta el botón de
  // refresh del ThemeDock, este número sube y el efecto re-corre la
  // traducción aun si había cache hit.
  // IMPORTANTE: hooks SIEMPRE antes de cualquier early return o rama — ver
  // memory/feedback_react_hooks_order.md.
  const version = useTranslationRefresh();
  const fallbackTitle = paper ? preCleanTitle(paper.title) : '';

  // Fallback lede — abstract original pre-limpiado, truncado. Decisión de
  // diseño: antes dejábamos el lede vacío mientras Pollinations traducía,
  // para no mezclar inglés con español. Pero cuando la cache de traducción
  // se borra (ej. bump de versión) + Pollinations tira 429, el feed queda
  // con cards sin descripción durante minutos — y eso es peor que ver el
  // abstract original en inglés por un rato. Ahora siempre mostramos algo:
  // español cuando lo tenemos cacheado o recién llegado, abstract original
  // limpio cuando todavía no. Papers sin abstract siguen mostrando lede
  // vacío (no hay nada que inventar).
  const fallbackLede = paper?.abstract ? deriveLede(preCleanTitle(paper.abstract)) : '';

  // Chequear cache sincrónico así los papers cacheados nunca flashean fallback.
  const initial = (() => {
    if (!paper) return { title: '', lede: '', loading: false };
    const cached = getCachedTranslation(paper.id);
    if (cached) {
      return {
        title: cached.titleEs || fallbackTitle,
        lede: cached.ledeEs || fallbackLede,
        loading: false,
      };
    }
    // Si no está habilitado todavía (off-screen), no arrancamos spinner — el
    // caller verá el título original + loading=false hasta que el viewport
    // lo despierte.
    return { title: fallbackTitle, lede: fallbackLede, loading: enabled };
  })();

  const [state, setState] = useState(initial);
  // Tick que se bumpea cuando queremos reintentar. Agregado a los deps del
  // effect principal así cambiarlo re-dispara el fetch. Resetear a 0 por sí
  // solo no re-corre el effect (mismo valor), así que usamos un contador
  // monótono y lo incrementamos.
  const [retryTick, setRetryTick] = useState(0);
  // Contador de intentos hechos para el paper actual. Vive en ref porque no
  // queremos que cada aumento re-renderee, sólo que sobreviva al próximo
  // tick. Se resetea en el efecto cuando cambia paper.id o version.
  const attemptRef = useRef(0);
  // Guardamos el último paper.id / version que "conocimos" para saber cuándo
  // corresponde resetear el attempt counter. Sin esto, el efecto tendría que
  // ser consciente de diferencias entre sus propios re-runs (retry vs reset).
  const lastKeyRef = useRef<string | null>(null);
  const lastVersionRef = useRef<number>(version);

  useEffect(() => {
    if (!paper) {
      setState({ title: '', lede: '', loading: false });
      return;
    }

    // Cuando cambia el paper (otro id) o el usuario refresheó la cache
    // (version bumpeó), arrancamos de cero con los intentos. Si estamos
    // acá por un retryTick, mantenemos el counter.
    const keyChanged = lastKeyRef.current !== paper.id;
    const versionChanged = lastVersionRef.current !== version;
    if (keyChanged || versionChanged) {
      attemptRef.current = 0;
      lastKeyRef.current = paper.id;
      lastVersionRef.current = version;
    }

    // Re-check cache en cada cambio de id — el componente puede haberse
    // reusado con un paper distinto, o el usuario puede haber refresheado.
    const cached = getCachedTranslation(paper.id);
    if (cached) {
      setState({
        title: cached.titleEs || fallbackTitle,
        lede: cached.ledeEs || fallbackLede,
        loading: false,
      });
      return;
    }

    if (!enabled) {
      // Viewport gating: no request todavía. Quedate en fallback, sin spinner.
      setState({ title: fallbackTitle, lede: fallbackLede, loading: false });
      return;
    }

    // Skeleton sólo en el PRIMER intento de cada paper. Una vez que ya
    // intentamos una vez (con éxito o con error), los retries corren en
    // background silenciosos — la card mantiene visible el título original
    // pre-limpiado (inglés / francés / lo que sea) mientras esperamos. Si
    // llega la traducción, swappeamos a español; si no, el usuario al menos
    // puede leer algo. Sin esto, cada retry re-prendía loading=true y la
    // card volvía al skeleton, dejando al usuario ~30s mirando placeholders
    // grises sin texto.
    const isFirstAttempt = attemptRef.current === 0;
    if (isFirstAttempt) {
      setState({ title: fallbackTitle, lede: fallbackLede, loading: true });
    }
    // En retry: NO tocamos el state — el catch del intento anterior ya dejó
    // el fallback visible (loading=false). La request corre invisible.

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let skeletonTimer: ReturnType<typeof setTimeout> | null = null;

    // Tope duro al skeleton inicial: si la traducción no llegó en
    // SKELETON_MAX_MS, swappeamos al fallback igual. La fetch sigue corriendo
    // en background (no la cancelamos) — cuando termine, va a actualizar el
    // state con la traducción en español. Esto evita el peor caso donde
    // Pollinations está saturado y el skeleton se queda indefinido.
    if (isFirstAttempt) {
      skeletonTimer = setTimeout(() => {
        if (cancelled) return;
        setState(s => (s.loading ? { ...s, loading: false } : s));
      }, SKELETON_MAX_MS);
    }

    fetchTranslation(paper, { priority })
      .then(t => {
        if (cancelled) return;
        if (skeletonTimer !== null) clearTimeout(skeletonTimer);
        setState({
          title: t.titleEs || fallbackTitle,
          lede: t.ledeEs || fallbackLede,
          loading: false,
        });
        // Éxito — resetear el contador por si más adelante algún refresh
        // re-dispara la traducción para el mismo paper.
        attemptRef.current = 0;
      })
      .catch(err => {
        if (cancelled) return;

        // Abort (user refresheó la cache, cambió el paper, etc.) — no
        // reintentar. El componente ya va a re-renderearse con nuevos
        // inputs y arrancar de cero.
        if (isAbortError(err)) {
          if (skeletonTimer !== null) clearTimeout(skeletonTimer);
          return;
        }

        console.warn('[translate] fetch failed', paper.id, err);
        if (skeletonTimer !== null) clearTimeout(skeletonTimer);
        // Fallback visual mientras esperamos el retry. En retry esto es
        // idempotente (loading ya estaba false) pero lo seteamos igual para
        // asegurarnos que el título quede en el fallback fresco.
        setState({ title: fallbackTitle, lede: fallbackLede, loading: false });

        // Retry-on-error: 1 sólo retry a los 8s. Si vuelve a fallar, nos
        // quedamos con el original — el usuario puede leerlo y/o apretar
        // refresh manual si lo necesita en español.
        const attempt = attemptRef.current;
        if (attempt < USE_TRANSLATED_MAX_RETRIES) {
          const delay =
            USE_TRANSLATED_RETRY_DELAYS_MS[
              Math.min(attempt, USE_TRANSLATED_RETRY_DELAYS_MS.length - 1)
            ];
          attemptRef.current = attempt + 1;
          retryTimer = setTimeout(() => {
            if (!cancelled) {
              // Dentro del setState — usar updater form para evitar depender
              // del closure viejo del tick.
              setRetryTick(t => t + 1);
            }
          }, delay);
        }
      });

    return () => {
      cancelled = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      if (skeletonTimer !== null) clearTimeout(skeletonTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper?.id, enabled, priority, version, retryTick]);

  return { ...state, original: fallbackTitle };
}
