import {
  withPollinationsSlot,
  fetchPollinations,
  friendlyPollinationsError,
} from './pollirate';

/**
 * Cadena de modelos que probamos en orden. Pollinations ofrece varios modelos
 * detrás del mismo endpoint; cada uno corre en una infra distinta con su
 * propia cola. Si `openai` (GPT-4o-mini) está saturado, `mistral` suele
 * estar libre, y `openai-large` (GPT-4o) es el último recurso — más lento
 * pero más estable cuando los otros se cuelgan.
 *
 * NO hay timeout por intento. Pollinations a veces tarda 15-30s cuando está
 * lento pero igual contesta bien; cortar a 5s mataba requests que habrían
 * funcionado y dejaba la UI inutilizable. Ahora esperamos lo que haga falta.
 * El fallback solo se dispara si el modelo devuelve error HTTP (429, 5xx,
 * payload rechazado), no por lentitud.
 *
 * Nota: el orden importa. `openai` (fast, small) primero porque suele ser
 * el más rápido. `mistral` segundo porque suele estar menos saturado.
 * `openai-large` último porque es más lento pero raramente se cae.
 */
const MODELS: ReadonlyArray<string> = ['openai', 'mistral', 'openai-large'];

const CACHE_KEY = 'pv_explain_cache_v3';

export type ExplainLang = 'es' | 'en' | 'pt' | 'fr' | 'it';

export const EXPLAIN_LANGS: ReadonlyArray<{
  id: ExplainLang;
  label: string;
  short: string;
}> = [
  { id: 'es', label: 'Español', short: 'ES' },
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'pt', label: 'Português', short: 'PT' },
  { id: 'fr', label: 'Français', short: 'FR' },
  { id: 'it', label: 'Italiano', short: 'IT' },
];

/** Full language name we feed to the model as a writing directive. */
const LANG_NAME: Record<ExplainLang, string> = {
  es: 'rioplatense Spanish (use "vos", not "tú")',
  en: 'clear, conversational English',
  pt: 'Brazilian Portuguese',
  fr: 'French',
  it: 'Italian',
};

const MAX_PAPERS = 80;

export type ExplainLevel = 'kid' | 'teen' | 'sci';

/** Composite cache key: "teen_es", "kid_en", "sci_fr", etc. */
type LevelLangKey = `${ExplainLevel}_${ExplainLang}`;
type LevelMap = Partial<Record<LevelLangKey, string>>;
type Cache = Record<string, LevelMap>;

function levelLangKey(level: ExplainLevel, lang: ExplainLang): LevelLangKey {
  return `${level}_${lang}` as LevelLangKey;
}

function readCache(): Cache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Cache;
  } catch {
    return {};
  }
}

/**
 * Evict oldest papers to stay under MAX_ENTRIES. Relies on Object.keys()
 * insertion order — new papers are added at the end, so the oldest are at
 * the front. FIFO, not LRU; this isn't the kind of data where "recently
 * viewed" much outweighs "viewed once a while ago".
 */
function capCache(c: Cache): Cache {
  const keys = Object.keys(c);
  if (keys.length <= MAX_PAPERS) return c;
  const toDrop = keys.slice(0, keys.length - MAX_PAPERS);
  for (const k of toDrop) delete c[k];
  return c;
}

function writeCache(c: Cache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(capCache(c)));
  } catch {
  }
}

/**
 * Look up a cached explanation for one (level, language) pair. Returns null
 * if we haven't fetched this combination yet.
 */
export function getCachedExplanation(
  paperId: string,
  level: ExplainLevel = 'teen',
  lang: ExplainLang = 'es'
): string | null {
  return readCache()[paperId]?.[levelLangKey(level, lang)] ?? null;
}

const SYSTEM_KID = `Explicás papers científicos a una chica o chico de 5 años en español rioplatense.

Reglas:
- Usá palabras simples, metáforas cotidianas (pelotitas, árboles, cocina, juguetes) y oraciones MUY cortas.
- Nada de jerga técnica. Nada de porcentajes ni años salvo que la idea no tenga sentido sin ellos.
- 2 o 3 oraciones en total. Un solo párrafo.
- Empezá por lo que descubrieron, en términos que un chico entienda.
- Nunca mientas. Si el paper es sobre algo feo o triste, decilo suave pero honesto.
- No uses emoji. No uses markdown. Solo prosa simple.
- Tono cálido y curioso, como si le contaras un cuento.`;

const SYSTEM_TEEN = `Sos un editor científico que escribe para lectores curiosos pero sin formación técnica.
Traducís abstracts de papers al español rioplatense, claro y directo.

Reglas:
- Escribí en voz activa, oraciones cortas. Nivel: alguien con secundaria terminada.
- Usá "vos" (no "tú"). Tono cercano pero serio, nunca infantil.
- Conservá los números importantes (porcentajes, tamaños de muestra, años).
- Si hay jerga imprescindible, explicala una vez entre paréntesis la primera vez.
- NO inventes hallazgos que no estén en el abstract. Si algo es ambiguo, decilo.
- 2 a 4 párrafos cortos. Sin listas ni bullets ni markdown.
- No empieces con "Este paper…" ni "Los autores…". Empezá por el hallazgo o la pregunta.
- Terminá con una línea sobre la limitación más relevante si el abstract la menciona.
- No uses emoji. Solo prosa.`;

const SYSTEM_SCI = `Sos un editor científico que reformula abstracts para colegas con formación técnica en español rioplatense.

Reglas:
- Mantené rigor técnico. La jerga del área es bienvenida si es estándar; no la simplifiques.
- Conservá todos los números, métodos, tamaños de muestra, tests estadísticos y métricas del abstract.
- Identificá claramente: (a) la pregunta o hipótesis, (b) el método, (c) los resultados principales con magnitudes, (d) las limitaciones o caveats explícitos del abstract.
- 3 a 5 párrafos densos pero legibles. Sin listas ni bullets ni markdown.
- Usá voz activa y oraciones concisas.
- NO inventes resultados, métodos ni limitaciones que no estén en el abstract. Si el abstract omite algo importante (n, p-valor, efecto), decilo explícitamente ("el abstract no reporta…").
- No uses emoji. Solo prosa.`;

function systemFor(level: ExplainLevel, lang: ExplainLang = 'es'): string {
  const basePrompt =
    level === 'kid' ? SYSTEM_KID : level === 'sci' ? SYSTEM_SCI : SYSTEM_TEEN;
  if (lang === 'es') return basePrompt;
  return `${basePrompt}

IMPORTANT — OUTPUT LANGUAGE OVERRIDE:
All rules above describe STYLE and STRUCTURE (tone, length, how to open, what to preserve). You MUST follow the structural rules, but you MUST write the final output in ${LANG_NAME[lang]}, NOT in Spanish. Do not translate the rules; translate the ABSTRACT into the target language according to the style rules above.`;
}

/** Deterministic seed per (paper, level, language). */
function seedFrom(id: string, level: ExplainLevel, lang: ExplainLang): number {
  const key = `${id}::${level}::${lang}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 1_000_000;
}

/**
 * Dedup in-flight requests so two components asking for the same
 * (paperId, level) don't race to Pollinations.
 */
const inflight = new Map<string, Promise<string>>();

/**
 * Un solo intento contra Pollinations con un modelo específico. Sin timeout:
 * esperamos hasta que el modelo responda o dé error HTTP. Si Carolina quiere
 * cancelar, recarga la página — pero nunca abortamos nosotros por lentitud,
 * porque Pollinations a veces responde bien a los 20s y eso sigue siendo
 * mejor que no tener explicación.
 */
async function attemptExplain(
  model: string,
  level: ExplainLevel,
  lang: ExplainLang,
  userPrompt: string,
  paperId: string
): Promise<string> {
  return await withPollinationsSlot(
    async () => {
      const r = await fetchPollinations(
        'https://text.pollinations.ai/openai',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemFor(level, lang) },
              { role: 'user', content: userPrompt },
            ],
            temperature: level === 'kid' ? 0.6 : level === 'sci' ? 0.25 : 0.4,
            seed: seedFrom(paperId, level, lang),
            referrer: 'paperverse',
            private: true,
            max_tokens: level === 'kid' ? 200 : level === 'sci' ? 900 : 500,
          }),
        }
      );

      if (!r.ok) {
        const errText = await r.text().catch(() => '');
        throw new Error(friendlyPollinationsError(r.status, errText));
      }

      const data = (await r.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      let explanation = data.choices?.[0]?.message?.content?.trim() ?? '';
      explanation = stripBanners(explanation);

      if (!explanation) {
        throw new Error('El modelo no devolvió texto.');
      }
      return explanation;
    },
    { priority: 'high' }
  );
}

export async function fetchExplanation(
  paperId: string,
  title: string,
  abstract: string,
  level: ExplainLevel = 'teen',
  lang: ExplainLang = 'es'
): Promise<string> {
  const cache = readCache();
  const cacheKey = levelLangKey(level, lang);
  const existing = cache[paperId]?.[cacheKey];
  if (existing) return existing;

  const flightKey = `${paperId}::${cacheKey}`;
  const pending = inflight.get(flightKey);
  if (pending) return pending;

  const userPrompt = `Título del paper: ${title}

Abstract original:
${abstract}

Reformulá el abstract siguiendo las reglas del sistema.`;

  const p = (async () => {
    let lastError: unknown = null;
    for (const model of MODELS) {
      try {
        const explanation = await attemptExplain(
          model,
          level,
          lang,
          userPrompt,
          paperId
        );
        const next = readCache();
        const entry = next[paperId] ?? {};
        entry[cacheKey] = explanation;
        delete next[paperId];
        next[paperId] = entry;
        writeCache(next);
        return explanation;
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    if (lastError instanceof Error) {
      throw new Error(
        `No pudimos generar la explicación. ${lastError.message}`
      );
    }
    throw new Error('No pudimos generar la explicación. Probá de nuevo.');
  })();

  inflight.set(flightKey, p);
  try {
    return await p;
  } finally {
    inflight.delete(flightKey);
  }
}

/**
 * Pollinations occasionally prepends a deprecation notice or rate-limit note
 * to the assistant message. These are always in English and wrapped in
 * markdown bold/emoji, so they're trivial to detect and strip so the user
 * never sees them.
 */
function stripBanners(text: string): string {
  let out = text;

  out = out.replace(
    /⚠️\s*\*\*IMPORTANT NOTICE\*\*[\s\S]*?(?:normally\.?\s*\n+|$)/i,
    ''
  );
  out = out.replace(
    /^\s*(?:\*\*|##)\s*(?:NOTICE|IMPORTANT|RATE LIMIT)[\s\S]*?\n{2,}/i,
    ''
  );

  return out.trim();
}
