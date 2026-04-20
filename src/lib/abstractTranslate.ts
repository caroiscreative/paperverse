// Traducción completa del abstract, separada de translate.ts.
//
// Por qué vive aparte del módulo de title+lede (src/lib/translate.ts):
//
// 1. Input distinto: acá traducimos el abstract ENTERO, no una "crema"
// editorial de 220 caracteres. El prompt es otro (no reescribe, sólo
// traduce fiel), y el output puede ser varios párrafos.
//
// 2. Cadencia distinta: el título/lede del feed se pide apenas la card
// entra al viewport y se batchea con otros (lib/translate.ts hace
// requests agrupados de hasta 5 papers). Acá el usuario tiene que
// abrir un paper + hacer click en el tab "Abstract" + elegir ver
// ambos — es un opt-in explícito, no una precarga. No tiene sentido
// batchear algo que sólo se pide una vez cada tanto.
//
// 3. Cache independiente: si bumpeo la versión del cache de títulos (por
// ejemplo para re-traducir feed tras un fix de prompt) no quiero
// perder todas las traducciones de abstract que el usuario ya leyó.
// Y viceversa.
//
// Trade-off asumido: duplico un poco de plumbing (cache, in-flight dedup)
// pero el módulo queda legible y los dos caminos evolucionan por separado.
//
// este módulo nace porque usuario decidió que en el
// modo "Abstract" del paper detail queremos mostrar el texto original +
// siempre una traducción al español. Ver src/pages/PaperDetail.tsx.

import { useEffect, useState } from 'react';
import type { Paper } from './openalex';
import { isSpanish } from './language';
import {
  withPollinationsSlot,
  fetchPollinations,
  friendlyPollinationsError,
  timeoutSignal,
  isAbortError,
} from './pollirate';

/**
 * Presupuesto duro por traducción. Los abstracts son más largos que los
 * títulos (pueden ser 1500+ caracteres), así que bumpeamos un poco por
 * encima del presupuesto del feed (30s) para dar margen al modelo. Si
 * Pollinations está caído el usuario ve el fallback "no pudimos traducir"
 * después de 40s — aceptable dado que esta traducción es opt-in.
 */
const TRANSLATION_TIMEOUT_MS = 40_000;

/**
 * v1 inicial. Bumpear este número invalida toda la cache de abstracts
 * traducidos en este navegador. Sólo hacerlo si cambiamos el prompt de una
 * manera que amerite re-traducir todo lo cacheado (p.ej. arreglar un bug
 * sistemático en la traducción).
 */
const CACHE_KEY = 'pv_abstract_translate_cache_v1';

/**
 * Los abstracts son más pesados que los títulos (pueden ser 2–8 KB de texto
 * traducido). 120 entries son ~400 KB–1 MB — todavía cómodo contra la cuota
 * de localStorage (~5 MB), y cubre al usuario que lee 5–10 papers por día
 * durante varios meses.
 */
const MAX_ENTRIES = 120;

/**
 * Directiva de idioma — misma que translate.ts. Español neutro LATAM, sin
 * "vos" rioplatense ni "vosotros" peninsular, sin regionalismos. El usuario
 * es venezolana y el feed ideal es pan-LATAM.
 */
const LANG_PROMPT_NAME =
  'neutral Latin American Spanish (no "vos", no "vosotros", no regional slang)';

export interface AbstractTranslation {
  /** Abstract completo traducido. Puede tener varios párrafos (separados por \n\n). */
  abstractEs: string;
}

type Cache = Record<string, AbstractTranslation>;

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
    // quota exhausta o localStorage deshabilitado — la próxima vez se
    // re-fetchea. El hook está preparado para no romper en ese caso.
  }
}

function getCachedAbstract(paperId: string): AbstractTranslation | null {
  return readCache()[paperId] ?? null;
}

/**
 * Prompt específico para traducción de abstract. Distinto al del feed:
 * acá NO editorializamos, NO condensamos. Traducción fiel, respetando
 * el tono original (que sigue siendo académico). Le pedimos conservar
 * términos técnicos (DNA, CRISPR, p-value) porque forzar "ADN" en un
 * contexto donde el resto del abstract usa el término inglés genera
 * inconsistencia.
 */
function buildSystemPrompt(): string {
  return `You are a scientific translator. Translate the given paper abstract from its source language (which can be ANY language: English, Malay, Chinese, German, French, Portuguese, Russian, Japanese, etc.) into ${LANG_PROMPT_NAME}.

Rules:
- Faithful translation, NOT a summary or rewrite. Preserve the academic tone and structure.
- Keep paragraph breaks if present (use blank lines between paragraphs).
- Keep widely-recognized technical terms in their canonical form (e.g., "DNA", "RNA", "CRISPR", "p-value", "machine learning", proper gene/protein names). Translate surrounding prose but not these technical tokens.
- Keep numerical values and units exactly as-is.
- Strip any LaTeX (\\alpha, $...$), HTML entities (&lt;), stray XML tags, and broken symbols you encounter.
- Do NOT add a preface like "Here is the translation:" and do NOT wrap the output in quotes or code fences.
- Do NOT shorten the abstract. If the original has 8 sentences, the translation must also have around 8 sentences.

Output ONLY the translated abstract text, nothing else.`;
}

/** In-flight dedup: dos componentes con el mismo paperId comparten la misma promesa. */
const inflight = new Map<string, Promise<AbstractTranslation>>();

async function fetchAbstractTranslation(paper: Paper): Promise<AbstractTranslation> {
  const key = paper.id;

  const cached = getCachedAbstract(key);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = runFetch(paper);
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

async function runFetch(paper: Paper): Promise<AbstractTranslation> {
  if (!paper.abstract) {
    return { abstractEs: '' };
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = `Translate this abstract into ${LANG_PROMPT_NAME}:

${paper.abstract}`;

  const { signal, cleanup } = timeoutSignal(TRANSLATION_TIMEOUT_MS);

  try {
    return await withPollinationsSlot(
      async () => {
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
              // Temperatura baja — es una traducción, no una interpretación
              // creativa. Queremos consistencia y fidelidad al original.
              temperature: 0.2,
              referrer: 'paperverse',
              private: true,
              // Headroom grande: un abstract largo en español puede
              // necesitar ~1500 tokens. No queremos que el modelo trunque.
              max_tokens: 2000,
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

        // Saneamiento mínimo: a veces el modelo agrega un prefacio tipo
        // "Aquí está la traducción:" antes del texto real, aunque el
        // prompt lo prohíbe explícitamente. Limpiamos esos patrones
        // conocidos y strippeamos fences ``` por las dudas.
        const clean = sanitize(raw);

        const result: AbstractTranslation = { abstractEs: clean };
        const next = readCache();
        next[paper.id] = result;
        writeCache(next);
        return result;
      },
      // priority 'high' porque esto se pide desde el paper detail con el
      // usuario esperando activamente a que aparezca; no queremos que se
      // encole detrás de un feed re-cargando títulos.
      { priority: 'high', signal }
    );
  } finally {
    cleanup();
  }
}

/**
 * Limpieza post-output del modelo. Cubre los dos modos de falla que vi en
 * pruebas manuales:
 * 1. Fences ``` alrededor del texto (a veces ```spanish, a veces ``` nomás).
 * 2. Preambulos del tipo "Here is the translation:" / "Traducción:" / etc.
 */
function sanitize(raw: string): string {
  let s = raw.trim();
  // Strippear fences.
  s = s.replace(/^```(?:[a-z]+)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // Strippear preambulos típicos (primer línea solamente).
  s = s.replace(
    /^(aquí está (la )?traducción|aqui esta (la )?traduccion|traducción|traduccion|here is the translation|translation)\s*:\s*/i,
    ''
  );
  return s.trim();
}

/**
 * Hook React: encapsula fetch + cache + estado loading/error.
 *
 * `enabled` permite diferir la request hasta que el usuario realmente abra
 * el tab. Por defecto NO se pide — queremos opt-in explícito porque cada
 * llamada pega al rate-limit de Pollinations y los abstracts son caros.
 */
export function useAbstractTranslation(
  paper: Paper | null | undefined,
  options: { enabled?: boolean } = {}
): {
  text: string;
  loading: boolean;
  error: string | null;
} {
  const { enabled = false } = options;

  // Si el paper ya está en español, no hay nada que traducir. Devolvemos
  // el abstract original como "traducción" para que la UI pueda usar el
  // mismo componente sin ramas especiales.
  // IMPORTANTE: hooks SIEMPRE antes de cualquier early return — ver
  // memory/feedback_react_hooks_order.md.
  const alreadySpanish = isSpanish(paper?.language);

  const [state, setState] = useState<{
    text: string;
    loading: boolean;
    error: string | null;
  }>(() => {
    if (!paper) return { text: '', loading: false, error: null };
    if (alreadySpanish) return { text: paper.abstract ?? '', loading: false, error: null };
    const cached = getCachedAbstract(paper.id);
    if (cached) return { text: cached.abstractEs, loading: false, error: null };
    return { text: '', loading: false, error: null };
  });

  useEffect(() => {
    if (!paper || !paper.abstract) {
      setState({ text: '', loading: false, error: null });
      return;
    }

    if (alreadySpanish) {
      setState({ text: paper.abstract, loading: false, error: null });
      return;
    }

    const cached = getCachedAbstract(paper.id);
    if (cached) {
      setState({ text: cached.abstractEs, loading: false, error: null });
      return;
    }

    if (!enabled) {
      // Opt-in no disparado todavía: dejamos el estado en blanco sin
      // spinner. El caller decide si quiere renderizar un placeholder.
      setState({ text: '', loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ text: '', loading: true, error: null });

    fetchAbstractTranslation(paper)
      .then(t => {
        if (cancelled) return;
        setState({ text: t.abstractEs, loading: false, error: null });
      })
      .catch(err => {
        if (cancelled) return;
        if (isAbortError(err)) {
          setState({ text: '', loading: false, error: null });
          return;
        }
        console.warn('[abstractTranslate] failed', paper.id, err);
        const msg =
          err instanceof Error
            ? err.message
            : 'No pudimos traducir el abstract ahora mismo.';
        setState({ text: '', loading: false, error: msg });
      });

    return () => {
      cancelled = true;
    };
  }, [paper?.id, paper?.abstract, enabled, alreadySpanish]);

  return state;
}
