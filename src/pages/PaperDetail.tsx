// Paper Detail — single screen with:
//   · editorial title, byline, meta rail
//   · Abstract ↔ Explicámelo toggle (AI explanation via Pollinations.ai)
//   · Referencias ↔ Citado por pair of buttons → navigates to the feed
//   · "Similar papers" row (same top concepts)
//   · "Otros temas para explorar" row (cycled from the main feed's topic order)

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchPaper,
  fetchSimilar,
  fetchFeed,
  type Paper,
} from '../lib/openalex';
import { nextTopicsFrom, topicForConcepts, TOPICS_BY_ID, type TopicId } from '../lib/topics';
import {
  fetchExplanation,
  getCachedExplanation,
  type ExplainLevel,
} from '../lib/explain';
import { fetchRandomQuote, type Quote } from '../lib/quoteLibrary';
import { useLibrary } from '../lib/library';
import { useReadPapers } from '../lib/read';
import { showToast } from '../lib/toast';
import { useTranslated, fetchTranslation, getCachedTranslation } from '../lib/translate';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useAbstractTranslation } from '../lib/abstractTranslate';
import { languageLabel, isSpanish } from '../lib/language';
import { PaperCard } from '../components/PaperCard';
import { TopicChip } from '../components/TopicChip';
import { CountryFlag } from '../components/CountryFlag';
import { Icon } from '../components/Icon';

type AbstractMode = 'original' | 'explain';

/**
 * Mensajes que narran el progreso del stream mientras esperamos el primer
 * token. Uno cada 3s. El último queda "pegado" si el modelo tarda más, así
 * que lo elegimos adrede para que aguante quedarse visible: editorial,
 * divulgativo, sin sugerir error.
 *
 * sacamos el nombre del provider ("Pollinations") del
 * copy visible. Era un leak de infra que no aportaba nada al lector —
 * confundía más que informaba. Lo reemplaza "Conectando con el modelo…"
 * que narra la misma etapa en términos que el usuario sí entiende. El
 * provider sigue siendo Pollinations internamente; es sólo el label de
 * UI el que se neutraliza.
 *
 * el último mensaje era "Traduciendo a cristiano…",
 * un idiom castellano para "poner en palabras simples". Funcionaba bien
 * pero pareaba con un easter egg de versículos bíblicos (ver
 * quoteLibrary.ts, que reemplazó a bibleVerse.ts) y decidió
 * desplazar todo ese imaginario a un registro secular. El reemplazo es
 * "Poniéndolo en palabras…": literalmente lo mismo, sin la referencia
 * religiosa. Mantiene la métrica sonora y el tono cadencioso del arco.
 *
 * Orden pensado para acompañar lo que de verdad está pasando abajo:
 *   1) armamos la request y la mandamos al endpoint,
 *   2) el provider la tomó y le pregunta al modelo upstream,
 *   3) esperamos que el modelo arranque a generar,
 *   4) sigue generando, ya casi sale el primer chunk.
 */
const LOADER_MESSAGES: ReadonlyArray<string> = [
  'Conectando con el modelo…',
  'Preguntándole al modelo…',
  'Esperando la respuesta…',
  'Poniéndolo en palabras…',
];

export function PaperDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { has: libraryHas, toggle: libraryToggle } = useLibrary();
  // Auto-marcar al abrir: se pidió que al abrir un paper
  // se marque como leído automáticamente porque "siempre me olvido de marcar
  // el botón de leído". El botón del footer sigue existiendo por dos razones:
  // (a) el usuario puede abrir un paper por curiosidad y no querer marcarlo
  //     como leído → el toggle le permite desmarcarlo en ese mismo view.
  // (b) el estado visual (tick filled vs outline) es info útil en la página.
  // Exponemos `mark` además de `toggle` para la auto-marcación del useEffect
  // de abajo: `mark` es idempotente (no-op si ya está marcado, ver read.ts)
  // así que es seguro llamarlo en cada mount sin preocuparnos de duplicar.
  const { has: readHas, toggle: readToggle, mark: markRead } = useReadPapers();

  // Default to Explicámelo — the whole point of the app is the simplified
  // read. Users can still flip to the original abstract with the toggle.
  const [mode, setMode] = useState<AbstractMode>('explain');
  // Explicámelo tiene 3 niveles de lectura. Todo va en español neutro
  // (Paperverse es single-language — ver notas en explain.ts).
  //
  // Default = 'kid' ("5 años"): se pidió que al abrir
  // cualquier paper siempre se cargue la explicación más simple. La idea
  // es que el reader entre por la puerta más accesible — el paper
  // "explicado como a un niño/a" — y si quiere subir de nivel, use la
  // perilla. El abstract original queda a un click en el toggle de
  // arriba, pero no es el default. Antes era 'teen' (Adolescente) como
  // término medio, pero el cambio a 'kid' prioriza accesibilidad sobre
  // neutralidad editorial.
  const [level, setLevel] = useState<ExplainLevel>('kid');
  // Cache por nivel. Antes era `${level}_${lang}` cuando soportábamos 5
  // idiomas para Explicámelo; al eliminar multi-idioma simplificamos a la
  // clave del nivel directamente.
  const [explanations, setExplanations] = useState<Partial<Record<ExplainLevel, string>>>({});
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const explanation = explanations[level] ?? null;
  // Mensajes que rotan en el loader mientras esperamos el primer token del
  // stream. Pollinations puede tardar 1-10s en devolver el primer chunk
  // (depende de la cola y el warm-up del modelo). Un solo "Traduciendo…" se
  // siente colgado; ir narrando qué está pasando baja la percepción de
  // espera aunque la latencia real sea la misma. El índice solo avanza
  // mientras `explainLoading && !explanation` — apenas llega un token, el
  // render salta al texto con caret y el efecto se detiene.
  const [loaderMsgIdx, setLoaderMsgIdx] = useState(0);
  // Easter egg: cuando la espera se estira y el loader llega al mensaje
  // "Poniéndolo en palabras…" (el último de LOADER_MESSAGES), mostramos
  // una cita al azar de la quoteLibrary (Lem, Huxley, Orwell) para que
  // haya algo chiquito pero sustancioso que leer. El pick es local (no
  // hay red) así que se resuelve instantáneo; conservamos la forma async
  // por paridad con el fetcher anterior. Fallo silencioso: si por algún
  // motivo la promesa falla, simplemente no aparece y el loader sigue
  // normal — el easter egg es bonus, no crítico.
  //
  // Histórico: antes esto tiraba un versículo random de la Reina-Valera
  // 1960 via bolls.life. Se reemplazó por la biblioteca secular curada
  // en quoteLibrary.ts. El fetcher bíblico viejo (bibleVerse.ts) se
  // eliminó del repo; si algún día se reactiva como modo opcional hay
  // que reintroducirlo desde git history.
  const [quote, setQuote] = useState<Quote | null>(null);
  // `quoteVisible` controla el fade-in de la cita. Se separa de `quote`
  // para que la cita NO aparezca pegada al cambio del último mensaje
  // del loader: primero tiene que "asentarse" el texto "Poniéndolo en
  // palabras…" durante 2s, y recién después aparece la cita con fade
  // + translate. Así se lee como narración: primero se posa el título,
  // después se asoma la cita como reveal.
  const [quoteVisible, setQuoteVisible] = useState(false);

  const [similar, setSimilar] = useState<Paper[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const [nextPreview, setNextPreview] = useState<Record<TopicId, Paper | null>>(
    {} as Record<TopicId, Paper | null>
  );

  // Load the paper. Default lands on Explicámelo; if a cached translation
  // exists we show it immediately, otherwise we kick off the fetch so the
  // simplified version is waiting by the time the reader scrolls down.
  // If the paper has no abstract at all there's nothing to translate, so we
  // silently fall back to the "original" view (which itself renders a "no
  // abstract published" message).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPaper(null);
    // Reset the explanations map when the paper changes — opportunistically
    // pre-fill from localStorage so a revisit feels instant.
    setExplanations({});
    setExplainError(null);
    setExplainLoading(false);
    setMode('explain');
    setLevel('kid');

    fetchPaper(id)
      .then(p => {
        if (cancelled) return;
        setPaper(p);

        // Pre-cargar cualquier nivel cacheado para que cambiar de Niño/Teen/Sci
        // se sienta instantáneo si el usuario ya pidió ese nivel antes.
        const cached: Partial<Record<ExplainLevel, string>> = {};
        (['kid', 'teen', 'sci'] as ExplainLevel[]).forEach(lv => {
          const hit = getCachedExplanation(p.id, lv);
          if (hit) cached[lv] = hit;
        });
        setExplanations(cached);

        if (!p.abstract) {
          setMode('original');
          return;
        }
        if (cached.kid) return; // already hot

        setExplainLoading(true);

        // Orden: Explicámelo PRIMERO, título después.
        // El endpoint gratis de Pollinations (sin API key) admite sólo 1
        // request en vuelo por IP. Tenemos dos traducciones que competir:
        // el título del header y el texto de Explicámelo. Elegimos que
        // Explicámelo gane el slot inmediato porque es LO QUE EL LECTOR
        // VIENE A LEER — el título ayuda a orientarse pero el contenido
        // es la promesa editorial de la página.
        //
        // El título se traduce en paralelo via `useTranslated` más abajo.
        // Mientras Explicámelo ocupa el slot, `useTranslated` va a recibir
        // 429s y encolar retries con backoff exponencial (2s, 4s, 8s via
        // pollirate.ts). Cuando Explicámelo termine, el slot queda libre
        // y la próxima pasada del retry landea la traducción → swappea
        // del título original al español en el header.
        //
        // Además, al final de Explicámelo (en el `.finally()` de abajo),
        // hacemos un "empujón" explícito a fetchTranslation por si
        // `useTranslated` ya agotó sus retries y quedó cacheado el
        // original. Es barato (si ya hay cache hit, resuelve instantáneo;
        // si hay inflight, se dedupea) y cubre el peor caso.
        //
        // Usamos el título en español para el prompt de Explicámelo SI ya
        // está en cache (visita previa al paper). Si no, caemos al
        // original — mejor empezar a streamear con título en inglés que
        // bloquear el contenido esperando.
        const cachedTitleEs = getCachedTranslation(p.id)?.titleEs;
        const titleForExplain = cachedTitleEs || p.title;

        // onToken: por cada chunk que llega del SSE, appendeamos al state.
        // Dejamos `explainLoading` en true durante todo el stream — el
        // guard del render `explainLoading && !explanation` ya esconde el
        // loader apenas hay texto, y conservar el flag nos sirve para
        // pintar el caret "tipeando" al final del texto mientras sigue
        // streaming. La normalización final (stripBanners) la hace el
        // .then() de abajo con el texto completo que devuelve la promesa
        // — eso sobreescribe cualquier fragmento sucio que hayamos
        // pintado en vivo.
        fetchExplanation(p.id, titleForExplain, p.abstract, 'kid', delta => {
          if (cancelled) return;
          setExplanations(prev => ({
            ...prev,
            kid: (prev.kid ?? '') + delta,
          }));
        })
          .then(text => {
            if (!cancelled)
              setExplanations(prev => ({ ...prev, kid: text }));
          })
          .catch(err => {
            if (!cancelled) {
              setExplainError(err instanceof Error ? err.message : 'Falló el traductor.');
              // Si el stream se cortó a mitad, limpiar el fragmento parcial
              // para no dejar basura debajo del mensaje de error.
              setExplanations(prev => {
                const next = { ...prev };
                delete next.kid;
                return next;
              });
            }
          })
          .finally(() => {
            if (cancelled) return;
            setExplainLoading(false);

            // Empujón al título: si sigue sin cachear (ej. `useTranslated`
            // agotó sus retries mientras Explicámelo ocupaba el slot),
            // forzamos una pasada más. Fire-and-forget: el resultado va
            // directo al cache, y `useTranslated` lo lee en el próximo
            // tick → swappea el header a español.
            if (!getCachedTranslation(p.id)?.titleEs) {
              void fetchTranslation(p, { priority: 'high' }).catch(() => {
                // Silencio total: si falla acá, el usuario ya tiene todo
                // el contenido visible, el título queda en el idioma
                // original y puede apretar refresh si lo necesita en
                // español.
              });
            }
          });
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No pudimos cargar el paper.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Scroll to top on id change so the user doesn't land in the middle.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id]);

  // Auto-marcar como leído. "siempre me olvido de
  // marcar el botón de leído". Disparamos `markRead(paper)` cada vez que
  // tenemos un paper cargado. El effect depende de `paper` (no sólo de
  // `paper?.id`) para garantizar que tengamos el objeto Paper completo,
  // que es lo que necesitamos para que la entrada en `pv_read_v1` quede
  // denormalizada (Biblioteca > "Cosas que ya leí" depende de eso para
  // renderizar sin re-fetchear OpenAlex).
  //
  // markRead es idempotente: si el paper ya está marcado, no hace nada.
  // Por eso es seguro correrlo en cada mount/cambio de paper sin lógica
  // extra de "ya marcado o no". El usuario sigue pudiendo desmarcar con
  // el botón del footer si abrió por curiosidad y no quiere contarlo.
  useEffect(() => {
    if (!paper) return;
    markRead(paper);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper]);

  // Rotación de mensajes del loader. Mientras `explainLoading && !explanation`
  // (o sea, esperamos el primer token del SSE), avanzamos un mensaje cada 3s.
  // Cuando llega el primer token el render salta al branch del texto con caret
  // y este efecto termina (el guard del deps lo apaga). Al arrancar un ciclo
  // nuevo (cambio de nivel, nuevo paper), reseteamos a 0 para que el usuario
  // no arranque en "Poniéndolo en palabras…" directo — quiere ver el arco
  // completo.
  const showingLoader = explainLoading && !explanation;
  useEffect(() => {
    if (!showingLoader) {
      setLoaderMsgIdx(0);
      setQuote(null);
      return;
    }
    setLoaderMsgIdx(0);
    setQuote(null);
    const interval = setInterval(() => {
      setLoaderMsgIdx(i => Math.min(i + 1, LOADER_MESSAGES.length - 1));
    }, 3000);
    // Pedimos la cita apenas arranca el loader (no esperamos al último
    // mensaje) para que — si la espera se estira — ya esté lista cuando
    // el loader llegue a "Poniéndolo en palabras…". Hoy el pick es local
    // (quoteLibrary.ts resuelve instantáneo), así que el AbortController
    // no hace nada visible, pero lo mantenemos por paridad con la vieja
    // implementación remota por si algún día volvemos a una fuente async.
    const ctrl = new AbortController();
    fetchRandomQuote(ctrl.signal)
      .then(q => setQuote(q))
      .catch(() => {
        /* silencioso — sin cita, el loader sigue normal */
      });
    return () => {
      clearInterval(interval);
      ctrl.abort();
    };
  }, [showingLoader]);

  // Fade-in de la cita. Queremos que el usuario primero lea "Poniéndolo
  // en palabras…" y, recién 2s después, vea aparecer la cita con un
  // fade + translate. Sin este delay, la cita aparece pegada al cambio
  // de mensaje y se siente como un salto; con delay se lee como reveal
  // narrado (primero el título del momento, después la cita que se asoma).
  useEffect(() => {
    if (loaderMsgIdx === LOADER_MESSAGES.length - 1 && quote) {
      const t = setTimeout(() => setQuoteVisible(true), 2000);
      return () => clearTimeout(t);
    }
    // Cualquier otro estado (loader no llegó al final, o quote se reseteó
    // por cambio de paper/nivel) → ocultar la cita para que el próximo
    // ciclo arranque invisible.
    setQuoteVisible(false);
  }, [loaderMsgIdx, quote]);

  // Similar papers (based on top concepts)
  useEffect(() => {
    if (!paper) return;
    let cancelled = false;
    setSimilarLoading(true);
    fetchSimilar(paper, 6)
      .then(list => {
        if (!cancelled) setSimilar(list);
      })
      .catch(() => {
        if (!cancelled) setSimilar([]);
      })
      .finally(() => {
        if (!cancelled) setSimilarLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paper]);

  // Top pick per "next topic" (one paper per topic for the recommendation row).
  const detectedTopic = useMemo(() => (paper ? topicForConcepts(paper.conceptsRaw) : null), [paper]);
  // Seed con el id del paper: mismo paper siempre muestra los mismos 4 temas
  // (estabilidad al refrescar), pero cambiar de paper rota el set. Así
  // Biología, Química, Materiales, etc. también aparecen en la rotación.
  const nextTopics = useMemo(
    () => nextTopicsFrom(detectedTopic?.id ?? null, 4, paper?.id),
    [detectedTopic, paper?.id]
  );

  useEffect(() => {
    if (!paper) return;
    let cancelled = false;
    setNextPreview({} as Record<TopicId, Paper | null>);

    async function run() {
      for (const topic of nextTopics) {
        if (cancelled) return;
        try {
          // daysBack: 7 → el top paper de la última semana (antes eran 120
          // días, pero como ya está leyendo activamente, "lo mejor
          // de hace 4 meses" se sentía viejo. Una semana da picks frescos
          // sin quedar vacío — los papers más citados de IA/Biología/etc.
          // acumulan cientos de citas en días).
          const [top] = await fetchFeed({ topics: [topic], limit: 1, daysBack: 7 });
          if (cancelled) return;
          setNextPreview(prev => ({ ...prev, [topic.id]: top ?? null }));
        } catch {
          if (!cancelled) setNextPreview(prev => ({ ...prev, [topic.id]: null }));
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [paper, nextTopics]);

  // Switch to Explicámelo mode at the currently selected level. Used when
  // the user clicks the "Explicámelo" tab in the abstract toggle.
  const handleExplain = async () => {
    if (!paper?.abstract) return;
    setMode('explain');
    await ensureLevel(level);
  };

  /**
   * Asegurá que tengamos una explicación para el nivel dado. No-op si ya
   * está cacheada en state o en localStorage. Usa streaming: el texto se va
   * appendendo al state conforme llega del modelo, así el lector ve la
   * explicación "tipeándose" en vez de un loader que tarda 6-15s.
   *
   * la cache es por (paperId, nivel). Esta función
   * es el único punto de entrada para asegurar que un nivel esté disponible
   * en state, y chequea en dos niveles antes de decidir fetchear:
   *   1. ¿Está en React state? → no-op, ya tenemos el texto montado.
   *   2. ¿Está en localStorage? → hidratamos state desde cache sin prender
   *      explainLoading. Esto evita el flicker del loader que aparecía
   *      brevemente cuando fetchExplanation devolvía instantáneo desde
   *      cache (el flag se prendía y apagaba en el mismo tick).
   *   3. Si ninguno lo tiene, recién ahí fetcheamos con stream.
   * La condición (2) es defensiva — normalmente el useEffect del load
   * precarga todos los niveles cacheados en state. Pero si el state se
   * vació (cross-tab storage sync, re-mount, etc.) y cache sigue vivo,
   * este guard preserva la promesa "nivel cacheado = instantáneo".
   */
  const ensureLevel = async (lv: ExplainLevel) => {
    if (!paper?.abstract) return;
    if (explanations[lv]) return;
    const cached = getCachedExplanation(paper.id, lv);
    if (cached) {
      setExplanations(prev => ({ ...prev, [lv]: cached }));
      setExplainError(null);
      return;
    }
    setExplainLoading(true);
    setExplainError(null);
    try {
      // Usar el título en español si ya está en cache de traducción. Cuando
      // el user cambia de nivel, la traducción del título arrancó al mount
      // del PaperDetail y lo más probable es que ya haya landeado en cache
      // (ver EXPLAIN_WAIT_TITLE_MS arriba para el por qué de secuenciar
      // título → Explicámelo). Si por algún motivo no está todavía (cache
      // clear + Pollinations muy saturado), caemos al título original — no
      // bloqueamos el cambio de nivel por eso; el user quiere ver el nuevo
      // nivel ya.
      const titleForExplain = getCachedTranslation(paper.id)?.titleEs || paper.title;
      const text = await fetchExplanation(
        paper.id,
        titleForExplain,
        paper.abstract,
        lv,
        delta => {
          // Appendear el delta al state. NO bajamos `explainLoading` acá
          // adrede — el guard del render `explainLoading && !explanation`
          // esconde el loader apenas hay texto, pero el flag sigue en true
          // para que el render pinte el caret "tipeando" al final del
          // párrafo. Lo baja el .finally() cuando termina el stream.
          setExplanations(prev => ({
            ...prev,
            [lv]: (prev[lv] ?? '') + delta,
          }));
        }
      );
      // Sobreescribir con el texto final ya pasado por stripBanners. Esto
      // pisa cualquier banner que se haya pintado en vivo (raro con el
      // modelo actual, pero pasa cuando Pollinations antepone el aviso de
      // deprecation al output del modelo).
      setExplanations(prev => ({ ...prev, [lv]: text }));
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : 'Falló el traductor.');
      // Limpiar fragmento parcial si el stream se cortó.
      setExplanations(prev => {
        const next = { ...prev };
        delete next[lv];
        return next;
      });
    } finally {
      setExplainLoading(false);
    }
  };

  const changeLevel = (lv: ExplainLevel) => {
    setLevel(lv);
    setMode('explain');
    if (explanations[lv]) setExplainError(null);
    void ensureLevel(lv);
  };

  // Spanish editorial title for the detail header. IMPORTANT: this hook runs
  // BEFORE the early returns below — React requires the same hook call order
  // every render. Passing `paper` (which is null while loading) is safe — the
  // hook handles null/undefined. Earlier this lived after the early returns
  // and triggered "Rendered more hooks than during the previous render",
  // which rendered the detail page as a blank screen.
  // Priority HIGH: el título de la página de detalle es la lectura activa
  // del usuario — tiene que saltarse la cola del feed (60-150 traducciones
  // en background) para no quedar esperando detrás de cards que ni se ven.
  const { title: titleEs, original: titleOriginal } = useTranslated(paper, { priority: 'high' });

  // tab title = "{título} — Paperverse". Usamos
  // `titleEs` cuando la traducción ya está lista, y caemos al título
  // original (o a null, si tampoco llegó) mientras tanto. IMPORTANTE: este
  // hook también va antes de los early returns — react hooks order rule.
  // Si `paper` es null (loading o 404), pasamos null y el hook restaura el
  // default "Paperverse — La ciencia real, para curiosos reales" hasta que
  // haya un título real con el que reemplazarlo. Evitamos el flash "null —
  // Paperverse" que pasaría si concatenáramos sin este check.
  useDocumentTitle(titleEs || paper?.title || null);

  // traducción del abstract completo. Es opt-in — sólo se dispara
  // cuando el usuario está en el tab "Abstract original". Si el paper ya
  // está en español, el hook lo detecta y devuelve el abstract sin pasar
  // por el LLM. IMPORTANTE: este hook va ANTES de los early returns —
  // memory/feedback_react_hooks_order.md.
  const {
    text: abstractEs,
    loading: abstractTranslating,
    error: abstractTranslationError,
  } = useAbstractTranslation(paper, { enabled: mode === 'original' });

  if (loading) {
    return (
      <div className="detail-wrap">
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--fg-3)' }}>
          <Icon name="loader" size={24} />
          <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Buscando el paper…
          </div>
        </div>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="detail-wrap">
        <button type="button" onClick={() => nav('/')} className="back">
          <Icon name="arrow-left" size={13} /> Volver al feed
        </button>
        <div className="lib-empty">
          <div className="display">No pudimos abrir el paper.</div>
          <div className="lead" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {error ?? 'Inténtalo de nuevo en un minuto.'}
          </div>
        </div>
      </div>
    );
  }

  // "ciencia": ahora Ciencia es un Topic real en TOPICS.
  // Antes acá fallbackeábamos a strings literales ('var(--pv-ink)' / 'Ciencia')
  // que generaban la inconsistencia visual que flaggeó Carolina — el eyebrow
  // de un paper "genérico" no tenía el mismo tratamiento que los 14 temas.
  // Si `detectedTopic` es null usamos el Topic "ciencia" directamente, así
  // hereda color, name, soft, deep, etc. uniformemente.
  const effectiveTopic = detectedTopic ?? TOPICS_BY_ID.ciencia;
  const topicColor = effectiveTopic.color;
  const topicName = effectiveTopic.name;

  // Título traducido — forzamos mayúscula inicial siempre. El traductor a
  // veces devuelve "la memoria..." en minúscula (el original en inglés
  // empieza con un verbo "Remembering..." que al traducir como sustantivo
  // queda en minúscula después del artículo). Esto garantiza que se lea
  // siempre como título editorial, sin depender de cómo salga del LLM.
  const displayTitle = titleEs ? titleEs.charAt(0).toUpperCase() + titleEs.slice(1) : titleEs;
  // titleOriginal ya no se muestra — se pidió sacar la línea "orig ·"
  // porque el usuario no busca el título en inglés acá; el paper original
  // está a un click (botón "Leer paper completo").
  void titleOriginal;

  return (
    <div className="detail-wrap">
      <button type="button" onClick={() => nav(-1)} className="back">
        <Icon name="arrow-left" size={13} /> Volver
      </button>

      <span className="eyebrow">
        <span className="dot" style={{ background: topicColor }} />
        {topicName} · {paper.journal} · {paper.year ?? '—'}
        {paper.openAccess && <> · <span style={{ color: 'var(--pv-clorofila-deep)' }}>acceso abierto</span></>}
      </span>

      <h1>{displayTitle}</h1>

      <div className="authors" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {/* The users icon makes the byline scannable at a glance — it's the
            first thing people check when sizing up a paper. */}
        <Icon
          name={paper.authorsLine.includes('&') || paper.authorsLine.includes('más') ? 'users' : 'user'}
          size={16}
          strokeWidth={1.75}
          style={{ color: 'var(--fg-3)', flexShrink: 0 }}
        />
        <span>{paper.authorsLine}</span>
      </div>
      <div className="meta-rail" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <CountryFlag code={paper.countryCode} />
        {paper.institution}
        {paper.publicationDate && <> · {formatDate(paper.publicationDate)}</>}
        {paper.doi && <> · doi:{paper.doi}</>}
        {' · '}Citado {paper.citedByCount.toLocaleString()} veces
      </div>

      {/* Abstract ↔ Explicámelo toggle + perilla row. El meta "Generado por
          IA" vive ahora en el top-row (al lado de Volver). Acá conviven el
          toggle y la perilla — cuando estás en Explicámelo aparece el
          selector de nivel a la derecha; en modo "Abstract original" se
          oculta porque no aplica. Así la fila siempre comunica "modo de
          lectura + profundidad", sin ruido extra. */}
      <div className="toggle-row">
        <div className="toggle" role="tablist" aria-label="Modo de lectura">
          <button
            type="button"
            className={mode === 'original' ? 'on' : ''}
            onClick={() => setMode('original')}
            role="tab"
            aria-selected={mode === 'original'}
          >
            Abstract original
          </button>
          <button
            type="button"
            className={mode === 'explain' ? 'on' : ''}
            onClick={handleExplain}
            role="tab"
            aria-selected={mode === 'explain'}
            disabled={!paper.abstract}
          >
            <Icon name="sparkle" size={13} /> Explicámelo
          </button>
        </div>
        {mode === 'explain' && paper.abstract && (
          <div className="pv-perilla-wrap">
            <div
              className="pv-perilla"
              role="radiogroup"
              aria-label="Nivel de lectura"
              data-level={level}
            >
              <div className="pv-perilla-track" aria-hidden="true" />
              {(
                [
                  { id: 'kid', label: '5 años', icon: 'baby' },
                  { id: 'teen', label: 'Adolescente', icon: 'guitar' },
                  { id: 'sci', label: 'Científico', icon: 'microscope' },
                ] as { id: ExplainLevel; label: string; icon: 'baby' | 'guitar' | 'microscope' }[]
              ).map(opt => {
                const on = level === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`pv-perilla-stop${on ? ' on' : ''}`}
                    onClick={() => changeLevel(opt.id)}
                    role="radio"
                    aria-checked={on}
                    title={opt.label}
                  >
                    <span className="pv-perilla-knob" aria-hidden="true">
                      <Icon name={opt.icon} size={18} strokeWidth={1.75} />
                    </span>
                    <span className="pv-perilla-label">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="abstract-body">
        {mode === 'original' ? (
          paper.abstract ? (
            // mostramos ambos — texto original en su
            // idioma + traducción al español siempre. "en la 2,
            // muestres ambas, que se vea el idio original pero me traduzca
            // siempre al español".
            //
            // Estructura: primero el original con un eyebrow que identifica
            // su idioma ("Original en inglés"), después un separador sutil,
            // y abajo la traducción al español con su propio eyebrow. Si
            // el paper ya es español (language === 'es' o idioma descono-
            // cido que no disparó traducción) sólo mostramos el original
            // sin el bloque de traducción — no tiene sentido duplicar.
            <AbstractBilingual
              abstract={paper.abstract}
              originalLanguage={paper.language}
              translation={abstractEs}
              translating={abstractTranslating}
              error={abstractTranslationError}
            />
          ) : (
            <p style={{ margin: 0, color: 'var(--fg-3)' }}>
              Este paper no publicó abstract en OpenAlex. Usá "Leer paper completo" para abrir la fuente.
            </p>
          )
        ) : explainLoading && !explanation ? (
          // Loader solo si NO tenemos ni un solo token todavía. Apenas llega
          // el primer delta del stream, `explanation` deja de ser null y
          // caemos al bloque `explanation ?` de más abajo, que renderiza el
          // texto que se va acumulando con un caret "tipeando" al final.
          // asked for the loader to feel like it "owns" the
          // container while waiting.
          //
          // Layout: contenedor de alto fijo (~380px) con dos slots verticales:
          //   · slot superior  → loader icon + mensaje rotativo (anclado arriba
          //     con paddingTop, NO centrado vertical — así no se mueve cuando
          //     el slot de abajo se llena con el versículo).
          //   · slot inferior  → versículo, siempre reservando espacio. Empieza
          //     con opacity:0 + translateY(8px) y se anima a opacity:1 +
          //     translateY(0) cuando `verseVisible` se enciende (2s después
          //     de llegar al último mensaje).
          // El truco que evita el shift es que el slot de abajo siempre ocupa
          // espacio aunque la figura no se haya pintado todavía — usamos un
          // contenedor flex con altura mínima que reserva el "footprint" del
          // versículo desde el primer render del loader.
          <div
            style={{
              color: 'var(--fg-3)',
              minHeight: 380,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            {/* Slot superior: loader + mensaje. paddingTop generoso para que
                respire y no quede pegado al borde del contenedor blanco. */}
            <div
              style={{
                paddingTop: 56,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <Icon name="loader" size={22} />
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  // Transición sutil al cambiar el texto — sin esto el mensaje
                  // "salta" duro cada 3s y se siente arrebatado. Un fade corto
                  // da continuidad sin distraer.
                  transition: 'opacity 220ms ease',
                }}
              >
                {LOADER_MESSAGES[loaderMsgIdx]}
              </div>
            </div>
            {/* Slot inferior: versículo. Siempre reserva espacio (flex:1) para
                que cuando aparezca no empuje al loader hacia arriba — la
                "huella" del bloque ya está reservada desde el primer render.
                La figura se monta solo cuando el versículo está disponible,
                pero el slot que la contiene existe desde el principio. */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                paddingTop: 36,
                paddingBottom: 28,
              }}
            >
              {/* Easter egg: solo cuando el loader llegó al último mensaje
                  ("Poniéndolo en palabras…") Y el pick de la cita ya llegó.
                  Si la espera no se estira tanto, este bloque no se muestra
                  y el slot queda vacío (pero el espacio ya estaba
                  reservado, no hay shift). Estilo: cita editorial, italic
                  + color fg-3 + autor al pie en mono. Línea clamp a 5 por
                  si alguna cita se pasa de largo (quoteLibrary no trunca,
                  todas están entre ~60 y ~200 caracteres por diseño). */}
              {loaderMsgIdx === LOADER_MESSAGES.length - 1 && quote && (
                <figure
                  style={{
                    margin: 0,
                    maxWidth: 420,
                    padding: '12px 16px',
                    borderLeft: '2px solid var(--line)',
                    color: 'var(--fg-2)',
                    textAlign: 'left',
                    // Fade-in controlado por `quoteVisible`. Los 2s de delay
                    // se manejan en la useEffect; acá solo aplicamos la
                    // transición visual (opacidad + un translate suave para
                    // que se sienta como "asomarse" más que como "encenderse").
                    opacity: quoteVisible ? 1 : 0,
                    transform: quoteVisible ? 'translateY(0)' : 'translateY(8px)',
                    transition: 'opacity 600ms ease, transform 600ms ease',
                  }}
                >
                  <figcaption
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--fg-3)',
                      marginBottom: 6,
                    }}
                  >
                    Mientras tanto, alguien escribió:
                  </figcaption>
                  <blockquote
                    style={{
                      margin: 0,
                      fontStyle: 'italic',
                      fontSize: 14,
                      lineHeight: 1.5,
                      // Hard cap a 5 líneas. Las citas del pool están
                      // pensadas para que todas entren más cortas; el
                      // line-clamp es defensivo por si alguien agrega
                      // después una cita más larga sin recortarla.
                      display: '-webkit-box',
                      WebkitLineClamp: 5,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {quote.text}
                  </blockquote>
                  <cite
                    style={{
                      display: 'block',
                      marginTop: 6,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--fg-3)',
                      fontStyle: 'normal',
                    }}
                  >
                    {quote.reference}
                  </cite>
                </figure>
              )}
            </div>
          </div>
        ) : explainError ? (
          <div
            style={{
              color: 'var(--pv-magma)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              minHeight: 120,
              gap: 10,
            }}
          >
            <p style={{ margin: 0, maxWidth: 420 }}>{explainError}</p>
            <button type="button" className="btn-link" onClick={handleExplain}>
              Probar de nuevo
            </button>
          </div>
        ) : explanation ? (
          // Caret "tipeando" al final del texto mientras el stream sigue
          // activo. `explainLoading` sigue siendo true durante todo el stream
          // (ver comentario en la useEffect), así que este render lo usa
          // como señal de "aún escribiendo" para decidir si pintar el caret.
          // Cuando la promesa resuelve (.finally lo baja a false), el caret
          // desaparece naturalmente y queda el texto final sin cursor.
          <p style={{ margin: 0 }}>
            {explanation}
            {explainLoading && <span className="pv-typing-caret" aria-hidden="true" />}
          </p>
        ) : (
          <p style={{ margin: 0, color: 'var(--fg-3)' }}>Tocá "Explicámelo" para pedir una traducción clara.</p>
        )}
      </div>

      {/* Paper actions — ahora en dos filas. Arriba van los botones de
          "salir a explorar" (referencias + citado por) porque mandan a
          otras vistas; abajo van las acciones sobre ESTE paper
          (marcar leído, guardar, leer completo) con el CTA primario
          anclado al extremo derecho — así la lectura termina en la
          acción más importante. Orden solicitado por Carolina: 4 5 / 3 2 1. */}
      <div className="paper-actions">
        {/* Explore-row: Ver referencias + Ver quién lo citó.
            Revert: volvimos al patrón botón-siempre-presente,
            con `disabled` cuando el contador es 0. Una iteración anterior
 había reemplazado el estado-cero por un span italic
            muted con copy explicativo ("Sin referencias indexadas" /
            "Todavía no lo citaron"), pero (a) ese texto más largo empujaba
            "Leer paper completo" a una segunda línea en desktop rompiendo
            la regla de que los 5 botones vivan en UNA sola fila, y
            (b) visualmente el estilo italic-empty no encajaba con el
            lenguaje btn-ghost del resto. Volver a un disabled ghost con
            el label corto restaura ambos: la grilla de 5 en línea y la
            coherencia visual. El `title` conserva el porqué del estado
            cero para quien quiera más contexto en hover. */}
        <div className="paper-actions-row paper-actions-row--explore">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => nav(`/?cites=${paper.id}`)}
            disabled={paper.referencedWorks.length === 0}
            title={
              paper.referencedWorks.length === 0
                ? 'OpenAlex no indexó las referencias de este paper.'
                : undefined
            }
          >
            <Icon name="arrow-left" size={14} />
            Ver referencias
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, marginLeft: 4, color: 'var(--fg-3)' }}>
              {paper.referencedWorks.length}
            </span>
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => nav(`/?citedBy=${paper.id}`)}
            disabled={paper.citedByCount === 0}
            title={
              paper.citedByCount === 0
                ? 'Todavía no hay papers que lo citen en OpenAlex.'
                : undefined
            }
          >
            Ver quién lo citó
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, marginLeft: 4, color: 'var(--fg-3)' }}>
              {paper.citedByCount.toLocaleString()}
            </span>
            <Icon name="arrow-right" size={14} />
          </button>
        </div>
        <div className="paper-actions-row">
          <button
            type="button"
            className={`pv-read${readHas(paper.id) ? ' on' : ''}`}
            onClick={() => {
              // Chequeamos el estado ANTES de togglear para decidir qué
              // mensaje mostrar. Si leemos después del toggle, el estado
              // ya cambió y el mensaje queda invertido.
              const wasRead = readHas(paper.id);
              readToggle(paper);
              showToast(wasRead ? 'Desmarcado como leído' : 'Marcado como leído');
            }}
            aria-pressed={readHas(paper.id)}
            aria-label={readHas(paper.id) ? 'Marcar como no leído' : 'Marcar como leído'}
            title={readHas(paper.id) ? 'Leído' : 'Marcar como leído'}
          >
            <Icon name={readHas(paper.id) ? 'check-filled' : 'check'} size={15} />
          </button>
          <button
            type="button"
            className={`pv-bookmark${libraryHas(paper.id) ? ' on' : ''}`}
            onClick={() => {
              const wasSaved = libraryHas(paper.id);
              libraryToggle(paper);
              showToast(wasSaved ? 'Quitado de tu biblioteca' : 'Guardado en tu biblioteca');
            }}
            aria-pressed={libraryHas(paper.id)}
            aria-label={libraryHas(paper.id) ? 'Quitar de biblioteca' : 'Guardar en biblioteca'}
            title={libraryHas(paper.id) ? 'Guardado en tu biblioteca' : 'Guardar en biblioteca'}
          >
            <Icon name={libraryHas(paper.id) ? 'bookmark-filled' : 'bookmark'} size={15} />
          </button>
          <a href={paper.url} target="_blank" rel="noreferrer" className="btn btn-primary">
            Leer paper completo <Icon name="external" size={14} />
          </a>
        </div>
      </div>

      {/* Similar papers row */}
      <section style={{ marginTop: 48 }}>
        <div className="section-head">
          <h2>Papers similares</h2>
        </div>
        {similarLoading && (
          <div style={{ padding: '24px 0', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            <Icon name="loader" size={16} /> Cargando…
          </div>
        )}
        {!similarLoading && similar.length === 0 && (
          <div style={{ padding: '16px 0', color: 'var(--fg-3)', fontSize: 13 }}>
            No encontramos papers con conceptos suficientemente parecidos.
          </div>
        )}
        {!similarLoading && similar.length > 0 && (
          <div className="paper-card-grid">
            {similar.map(p => (
              <PaperCard
                key={p.id}
                paper={p}
                variant="compact"
                onClick={() => nav(`/paper/${p.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* "Otros temas para explorar" row. Antes se llamaba "Próximos temas"
          pero era ambiguo — sonaba a "los siguientes en el orden" más que a
          "otras opciones". El nombre nuevo comunica la intención: invitar a
          saltar a un tema distinto al del paper actual. */}
      <section style={{ marginTop: 48, marginBottom: 48 }}>
        <div className="section-head">
          <h2>Otros temas para explorar</h2>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {nextTopics.map(t => (
            <TopicChip
              key={t.id}
              topic={t}
              onClick={() => {
                // Jump to a filtered feed for that topic.
                localStorage.setItem('pv_topics_v1', JSON.stringify([t.id]));
                nav('/');
              }}
            />
          ))}
        </div>
        <div className="paper-card-grid">
          {nextTopics.map(t => {
            const previewPaper = nextPreview[t.id];
            // Reusamos el PaperCard "compact" del feed para que las cards de
            // "Próximos temas" lean igual que las de la lista principal:
            // misma eyebrow (categoría · journal · año), mismo título, misma
            // línea meta. Antes usábamos NextTopicPreview, que era más
            // minimalista y mostraba info inconsistente con el resto del feed.
            if (!previewPaper) {
              return (
                <div
                  key={t.id}
                  className="paper-card paper-card-compact"
                  style={{ opacity: 0.5, cursor: 'default' }}
                >
                  <div className="paper-body">
                    <span className="eyebrow">
                      <span className="dot" style={{ background: t.color }} />
                      {t.name}
                    </span>
                    <h3 className="title">Cargando…</h3>
                  </div>
                </div>
              );
            }
            return (
              <PaperCard
                key={t.id}
                paper={previewPaper}
                variant="compact"
                onClick={() => nav(`/paper/${previewPaper.id}`)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return isoDate;
  }
}

/**
 * Renderiza el abstract en dos idiomas: original (con etiqueta de idioma)
 * + traducción al español neutro. Si el paper ya es español, sólo muestra
 * el original. Si la traducción falló, muestra el original + un aviso
 * discreto explicando que la traducción no está disponible por ahora.
 *
 * Comentario de estilo: los dos bloques comparten estructura visual — un
 * eyebrow mono-uppercase (misma familia que el resto de los labels
 * editoriales del detalle) + el texto debajo. Entre los dos hay un
 * separador fino (`border-top`) que marca la frontera sin gritar.
 */
function AbstractBilingual({
  abstract,
  originalLanguage,
  translation,
  translating,
  error,
}: {
  abstract: string;
  originalLanguage: string | null;
  translation: string;
  translating: boolean;
  error: string | null;
}) {
  const original = originalLanguage?.toLowerCase() ?? null;
  // Cross-check OpenAlex con el texto: si el ISO dice "es" pero el abstract
  // claramente no está en español (caso típico: papers en portugués mal
  // etiquetados como 'es'), forzamos el modo bilingüe para que se dispare
  // la traducción y el lector tenga una versión en español. Sin este cruce,
  // un paper portugués mislabeled colapsaba al bloque único en portugués
  // y el lector quedaba varado.
  const alreadySpanish = isSpanish(original, abstract);
  // Si el paper ya es español, no pedimos traducción — es el mismo texto.
  // Mostrarlo dos veces sería ruido puro, así que colapsamos al bloque
  // único sin etiquetas bilingües. Cuando el idioma viene como null/desconocido,
  // igual mostramos el bloque de traducción (la traducción al español del
  // texto sigue siendo útil incluso si no sabemos el idioma de origen).
  if (alreadySpanish) {
    return <p style={{ margin: 0 }}>{abstract}</p>;
  }

  const eyebrowStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--fg-3)',
    display: 'block',
    marginBottom: 8,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <span style={eyebrowStyle}>
          Original {original ? `en ${languageLabel(original)}` : '(idioma no indicado)'}
        </span>
        <p style={{ margin: 0 }}>{abstract}</p>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border-1)',
          paddingTop: 16,
        }}
      >
        <span style={eyebrowStyle}>Traducción al español</span>
        {translating ? (
          <div
            style={{
              color: 'var(--fg-3)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon name="loader" size={14} />
            Traduciendo…
          </div>
        ) : error ? (
          <p style={{ margin: 0, color: 'var(--fg-3)' }}>
            No pudimos traducir el abstract ahora mismo. Intentá de nuevo en unos
            segundos, o leelo en {original ? languageLabel(original).toLowerCase() : 'el idioma original'} arriba.
          </p>
        ) : translation ? (
          <p style={{ margin: 0 }}>{translation}</p>
        ) : (
          // Estado inicial (cache-miss + aún no disparamos traducción):
          // no debería ocurrir porque el hook arranca con enabled=true cuando
          // el tab está activo, pero si pasa dejamos un placeholder honesto.
          <p style={{ margin: 0, color: 'var(--fg-3)' }}>
            Aún no hay traducción disponible.
          </p>
        )}
      </div>
    </div>
  );
}
