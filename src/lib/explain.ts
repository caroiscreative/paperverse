// Explicámelo: traducí el abstract de un paper a español neutro claro usando
// un endpoint LLM público gratis (Pollinations.ai) — sin API key, sin server,
// con CORS habilitado. Perfecto para parafrasear un abstract, que no necesita
// razonamiento pesado.
//
// Tres niveles de lectura:
// · kid — "como si tuviera 5 años": metáforas, cero jerga, 2 oraciones máx.
// · teen — "adolescente/secundario": tono casual, oraciones cortas, 2–4
// párrafos. Este es el nivel por defecto.
// · sci — "científico/universitario": rigor alto, jerga aceptada,
// preservando cifras, métodos y limitaciones.
// Cada nivel se cachea por separado — pedir "kid" no regenera "teen".
//
// Cache shape: Record<paperId, { kid?, teen?, sci? }>.
//
// Español neutro (no rioplatense): usuario es venezolana; forzar "vos"
// creaba un sesgo regional innecesario. Neutral LATAM se lee natural en
// cualquier país hispanohablante.
//
// Si Pollinations desaparece o nos bloquea, la función sigue devolviendo el
// error tal cual y la UI cae al abstract original.

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
 * Realidad del endpoint legacy a abril 2026: `GET /openai/models` devuelve
 * UN solo modelo, `openai-fast` (GPT-OSS 20B vía OVH). El alias `openai`
 * mapea a `openai-fast` y es lo único que responde. Todo lo demás
 * (`mistral`, `openai-large`, `nova-fast`, etc.) devuelve 404. Por eso la
 * "cadena de fallback" hoy tiene un solo eslabón — la dejamos como array
 * para no tocar la forma del loop cuando Pollinations vuelva a sumar
 * modelos o cuando migremos a la nueva API.
 *
 * Histórico:
 * - Arrancamos con `['openai', 'mistral', 'openai-large']`. Pollinations
 * deprecó `openai-large` en 2026 y después también `mistral` en el
 * legacy endpoint. El único sobreviviente es `openai-fast`.
 * - Probamos migrar a `nova-fast`/`gemini-fast` (P95 ~1-2s en el monitor
 * de Pollinations). Esos modelos solo viven en la nueva API
 * (`gen.pollinations.ai`), que requiere Bearer key. El legacy no los
 * acepta.
 * - La latencia alta que nota el usuario no es el modelo sino la cola:
 * el legacy limita a 1 request en vuelo por IP y encola/rebota el
 * resto con 429 "Queue full". Con `openai-fast` (P95 ~38s en el
 * monitor), una explicación típica cae en 6-15s cuando hay suerte.
 * - Decisión: quedarse en legacy anónimo. Cada usuario consume su propia
 * IP, usuario no paga ni gestiona cuenta, el deploy en Vercel no se
 * ve afectado por la cuota. Una `pk_` key nos daría modelos más
 * rápidos pero el rate limit es 1 pollen/IP/hora — peor para un lector
 * activo que la cola legacy, que permite ~60-90 requests/hora en
 * serie. Si el legacy eventualmente cae del todo, tocará migrar.
 */
const MODELS: ReadonlyArray<string> = ['openai'];

// v4: bumped desde v3 cuando ELIMINAMOS el multi-idioma. v3 indexaba las
// entries como `${level}_${lang}` (p.ej. "teen_es", "kid_en") para soportar
// 5 idiomas. Ahora todas las entries son español neutro y se indexan sólo
// por level ("kid" | "teen" | "sci"). Bumpear a v4 borra todo y arranca de
// cero sin acarrear entries rioplatenses viejas con "vos".
const CACHE_KEY = 'pv_explain_cache_v4';

// Directiva de idioma que usamos en el prompt. Mismo criterio que translate.ts:
// español neutro LATAM, sin "vos" rioplatense ni "vosotros" peninsular.
const LANG_PROMPT_NAME =
  'español neutro latinoamericano (sin "vos", sin "vosotros", sin modismos regionales)';

// Cap duro de papers cacheados (no de entries). Cada paper carga hasta 3
// variantes, así que ~80 papers × ~2 KB × 3 = ~480 KB peor caso. Lejos de
// cualquier cuota realista de localStorage (5–10 MB). Eviction FIFO.
const MAX_PAPERS = 80;

export type ExplainLevel = 'kid' | 'teen' | 'sci';

type LevelMap = Partial<Record<ExplainLevel, string>>;
type Cache = Record<string, LevelMap>;

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
 * Expulsar los papers más viejos para no pasarnos de MAX_PAPERS. Depende del
 * orden de inserción de Object.keys() — papers nuevos se agregan al final,
 * así que los más viejos están al frente. FIFO, no LRU; no es el tipo de
 * data donde "visto recientemente" pese mucho más que "visto hace un rato".
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
    // quota / disabled — la próxima llamada re-fetchea.
  }
}

/**
 * Buscar una explicación cacheada para un nivel. Devuelve null si todavía no
 * la fetcheamos.
 */
export function getCachedExplanation(
  paperId: string,
  level: ExplainLevel = 'teen'
): string | null {
  return readCache()[paperId]?.[level] ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// System prompts por nivel. Todos en español neutro (sin "vos"). Antes
// pivoteábamos por idioma agregando un override en inglés al final; al volver
// a single-language eso desaparece.
// ────────────────────────────────────────────────────────────────────────────

const SYSTEM_KID = `Le explicás papers científicos a una niña o niño de 5 años en ${LANG_PROMPT_NAME}.

Reglas:
- Usá palabras simples, metáforas cotidianas (pelotitas, árboles, cocina, juguetes) y oraciones MUY cortas.
- Nada de jerga técnica. Nada de porcentajes ni años salvo que la idea no tenga sentido sin ellos.
- 2 o 3 oraciones en total. Un solo párrafo.
- Empezá por lo que descubrieron, en términos que un niño entienda.
- Nunca mientas. Si el paper es sobre algo feo o triste, decilo suave pero honesto.
- No uses emoji. No uses markdown. Solo prosa simple.
- Tono cálido y curioso, como si le contaras un cuento.
- Escribí en ${LANG_PROMPT_NAME}. No uses "vos" rioplatense ni "vosotros" peninsular.`;

const SYSTEM_TEEN = `Sos un editor científico que escribe para lectores curiosos pero sin formación técnica.
Traducís abstracts de papers al ${LANG_PROMPT_NAME}, claro y directo.

Reglas:
- Escribí en voz activa, oraciones cortas. Nivel: alguien con secundaria terminada.
- Tono cercano pero serio, nunca infantil.
- Conservá los números importantes (porcentajes, tamaños de muestra, años).
- Si hay jerga imprescindible, explicala una vez entre paréntesis la primera vez.
- NO inventes hallazgos que no estén en el abstract. Si algo es ambiguo, decilo.
- 2 a 4 párrafos cortos. Sin listas ni bullets ni markdown.
- No empieces con "Este paper…" ni "Los autores…". Empezá por el hallazgo o la pregunta.
- Terminá con una línea sobre la limitación más relevante si el abstract la menciona.
- No uses emoji. Solo prosa.
- Escribí en ${LANG_PROMPT_NAME}. No uses "vos" rioplatense ni "vosotros" peninsular.`;

const SYSTEM_SCI = `Sos un editor científico que reformula abstracts para colegas con formación técnica en ${LANG_PROMPT_NAME}.

Reglas:
- Mantené rigor técnico. La jerga del área es bienvenida si es estándar; no la simplifiques.
- Conservá todos los números, métodos, tamaños de muestra, tests estadísticos y métricas del abstract.
- Identificá claramente: (a) la pregunta o hipótesis, (b) el método, (c) los resultados principales con magnitudes, (d) las limitaciones o caveats explícitos del abstract.
- 3 a 5 párrafos densos pero legibles. Sin listas ni bullets ni markdown.
- Usá voz activa y oraciones concisas.
- NO inventes resultados, métodos ni limitaciones que no estén en el abstract. Si el abstract omite algo importante (n, p-valor, efecto), decilo explícitamente ("el abstract no reporta…").
- No uses emoji. Solo prosa.
- Escribí en ${LANG_PROMPT_NAME}. No uses "vos" rioplatense ni "vosotros" peninsular.`;

function systemFor(level: ExplainLevel): string {
  return level === 'kid' ? SYSTEM_KID : level === 'sci' ? SYSTEM_SCI : SYSTEM_TEEN;
}

/** Seed determinístico por (paper, level). */
function seedFrom(id: string, level: ExplainLevel): number {
  const key = `${id}::${level}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 1_000_000;
}

/**
 * Dedup de requests in-flight para que dos componentes pidiendo la misma
 * (paperId, level) no hagan race a Pollinations.
 */
const inflight = new Map<string, Promise<string>>();

/**
 * Un solo intento contra Pollinations con un modelo específico. Sin timeout:
 * esperamos hasta que el modelo responda o dé error HTTP. Si usuario quiere
 * cancelar, recarga la página — pero nunca abortamos nosotros por lentitud,
 * porque Pollinations a veces responde bien a los 20s y eso sigue siendo
 * mejor que no tener explicación.
 *
 * Si se pasa `onToken`, abrimos un stream SSE y llamamos al callback con cada
 * delta de texto conforme llega del modelo. La latencia total es la misma,
 * pero el primer token aparece en ~500ms-1s en vez de ~6-15s, así que el
 * usuario ve la explicación "tipeándose" en vez de mirar un loader. Al
 * terminar el stream devolvemos el texto completo (ya pasado por
 * stripBanners) para cachear.
 *
 * Si NO se pasa `onToken`, usamos el path non-stream original: una request
 * bloqueante que devuelve el texto completo de una. Esto lo preservamos para
 * los tests y por si algún caller no necesita incremental.
 */
async function attemptExplain(
  model: string,
  level: ExplainLevel,
  userPrompt: string,
  paperId: string,
  onToken?: (delta: string) => void
): Promise<string> {
  return await withPollinationsSlot(
    async () => {
      const useStream = typeof onToken === 'function';
      const r = await fetchPollinations(
        'https://text.pollinations.ai/openai',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            // stream:true hace que Pollinations devuelva SSE (text/event-stream)
            // con chunks { choices: [{ delta: { content: "..." } }] }. Es el
            // mismo formato que usa OpenAI, así que Pollinations lo pasa
            // transparente desde el modelo upstream.
            stream: useStream,
            messages: [
              { role: 'system', content: systemFor(level) },
              { role: 'user', content: userPrompt },
            ],
            temperature: level === 'kid' ? 0.6 : level === 'sci' ? 0.25 : 0.4,
            seed: seedFrom(paperId, level),
            referrer: 'paperverse',
            private: true,
            // Tokens por nivel. Kid corto (2-3 oraciones), teen medio, sci
            // largo. Limitar acorta generación y reduce el tiempo que
            // Pollinations tarda en devolver la respuesta completa.
            max_tokens: level === 'kid' ? 200 : level === 'sci' ? 900 : 500,
          }),
        }
      );

      if (!r.ok) {
        const errText = await r.text().catch(() => '');
        throw new Error(friendlyPollinationsError(r.status, errText));
      }

      // Path non-stream: el caller no quiere incremental, devolvemos el texto
      // completo de una en cuanto Pollinations cierra la response. Mantiene
      // compatibilidad con callers que esperan comportamiento bloqueante
      // (tests, usos programáticos) sin tocar la forma del código viejo.
      if (!useStream) {
        const data = (await r.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        let explanation = data.choices?.[0]?.message?.content?.trim() ?? '';
        explanation = stripBanners(explanation);
        if (!explanation) {
          throw new Error('El modelo no devolvió texto.');
        }
        return explanation;
      }

      // Path stream: leemos la response como ReadableStream y parseamos SSE
      // on-the-fly. Acumulamos todo el texto en `acc` para devolverlo al
      // final (para la cache), pero al mismo tiempo llamamos onToken en cada
      // delta para que la UI se actualice.
      if (!r.body) {
        throw new Error('Respuesta de stream sin body.');
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      // `buffer` acumula bytes crudos; las líneas SSE pueden llegar partidas
      // entre chunks (un `data: {...}\n\n` puede cortarse a la mitad), así
      // que recién procesamos eventos cuando vemos `\n\n`.
      let buffer = '';
      let acc = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Un "evento" SSE termina en doble newline. Separamos por eso y
        // guardamos el último fragmento (que puede estar incompleto) para
        // la próxima iteración.
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const ev of events) {
          for (const line of ev.split('\n')) {
            // Solo nos interesan las líneas "data: ..."; comentarios ":"
            // y cabeceras como "event:" las ignoramos.
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            // Marcador de fin — Pollinations/OpenAI lo mandan al cerrar.
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta.length > 0) {
                acc += delta;
                onToken(delta);
              }
            } catch {
              // Líneas malformadas (a veces Pollinations mete un "ping" o
              // un banner crudo) — las ignoramos y seguimos.
            }
          }
        }
      }

      // Flush del decoder por si quedó un byte multibyte colgando, y por
      // si quedó un evento sin el \n\n final al cerrarse el stream.
      buffer += decoder.decode();
      if (buffer.trim().startsWith('data: ')) {
        const payload = buffer.trim().slice(6).trim();
        if (payload && payload !== '[DONE]') {
          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              acc += delta;
              onToken(delta);
            }
          } catch {
            /* ignorar */
          }
        }
      }

      const explanation = stripBanners(acc.trim());
      if (!explanation) {
        throw new Error('El modelo no devolvió texto.');
      }
      return explanation;
    },
    { priority: 'high' }
  );
}

/**
 * Si el caller pasa `onToken`, se emite un delta de texto por cada chunk
 * que llega del modelo (streaming SSE). La promesa sigue resolviendo al
 * final con el texto completo (ya limpio de banners) para que el caller
 * pueda hacer la normalización final en el state.
 *
 * Importante para el callback: si hay un intento que falla a medio stream
 * y caemos al siguiente modelo, ese callback va a recibir los tokens DEL
 * SEGUNDO intento. Para el consumidor React eso significa que puede tener
 * que descartar/resetear lo que fue acumulando. En la práctica casi nunca
 * pasa (con un solo modelo en MODELS hoy) pero vale tenerlo documentado.
 */
export async function fetchExplanation(
  paperId: string,
  title: string,
  abstract: string,
  level: ExplainLevel = 'teen',
  onToken?: (delta: string) => void
): Promise<string> {
  const cache = readCache();
  const existing = cache[paperId]?.[level];
  if (existing) {
    // Cache hit: simulamos un "stream instantáneo" emitiendo todo el texto
    // como un único delta. Así el consumidor no tiene que diferenciar entre
    // "vino del cache" y "llegó en vivo" — el mismo callback funciona en
    // ambos casos y el render del PaperDetail no tiene rama especial.
    if (typeof onToken === 'function') onToken(existing);
    return existing;
  }

  const flightKey = `${paperId}::${level}`;
  const pending = inflight.get(flightKey);
  if (pending) {
    // Otro componente está pidiendo exactamente esto — nos sumamos. Pero
    // NO le pasamos nuestro onToken: el stream ya arrancó con el callback
    // del primer caller. Al terminar, emitimos el texto completo en un
    // único delta para que nuestro consumidor se ponga al día.
    const text = await pending;
    if (typeof onToken === 'function') onToken(text);
    return text;
  }

  const userPrompt = `Título del paper: ${title}

Abstract original:
${abstract}

Reformulá el abstract siguiendo las reglas del sistema. Escribí en ${LANG_PROMPT_NAME}.`;

  const p = (async () => {
    // Recorremos la cadena de modelos. Apenas uno devuelve texto válido,
    // cacheamos y salimos. Si TODOS fallan, lanzamos un error amable.
    // Ya no hay timeout: el fallback se dispara solo si un modelo da error
    // HTTP o devuelve texto vacío, no por lentitud.
    let lastError: unknown = null;
    for (const model of MODELS) {
      try {
        const explanation = await attemptExplain(
          model,
          level,
          userPrompt,
          paperId,
          onToken
        );
        // Éxito: cachear y devolver.
        const next = readCache();
        const entry = next[paperId] ?? {};
        entry[level] = explanation;
        // Re-insertar al final para marcarlo como "reciente" (eviction FIFO).
        delete next[paperId];
        next[paperId] = entry;
        writeCache(next);
        return explanation;
      } catch (err) {
        lastError = err;
        // 403/4xx/5xx: probamos el próximo modelo — a veces uno rechaza un
        // contenido que otro acepta, o uno está caído mientras los demás no.
        continue;
      }
    }

    // Todos los modelos fallaron. Convertimos a mensaje amable para la UI.
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
 * Pollinations ocasionalmente antepone un aviso de deprecation o una nota de
 * rate-limit al mensaje del assistant. Estos siempre vienen en inglés y
 * envueltos en markdown bold/emoji, así que son triviales de detectar y
 * strippear para que el usuario nunca los vea.
 */
function stripBanners(text: string): string {
  let out = text;

  // Banner conocido: "⚠️ **IMPORTANT NOTICE** ⚠️ The Pollinations legacy text
  // API is being deprecated …". Strippeamos todo hasta la primera línea en
  // blanco después del aviso, después dejamos lo que venga (la respuesta real).
  out = out.replace(
    /⚠️\s*\*\*IMPORTANT NOTICE\*\*[\s\S]*?(?:normally\.?\s*\n+|$)/i,
    ''
  );
  // Banners genéricos de rate-limit / upgrade en inglés envueltos en bold.
  out = out.replace(
    /^\s*(?:\*\*|##)\s*(?:NOTICE|IMPORTANT|RATE LIMIT)[\s\S]*?\n{2,}/i,
    ''
  );

  return out.trim();
}
