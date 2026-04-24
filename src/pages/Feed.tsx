// Main page — one component that handles four modes driven by URL:
//   (none)              → feed filtered by selected topics
//   ?q=…                → search results
//   ?cites=W123         → papers cited by W123 (references)
//   ?citedBy=W123       → papers citing W123

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { TOPICS, TOPICS_ALPHABETICAL, type TopicId } from '../lib/topics';
import { rememberFeedUrl } from '../lib/feedReturn';
import {
  fetchFeed,
  fetchPaper,
  fetchReferences,
  fetchCitedBy,
  fetchRandomPaper,
  searchPapers,
  isSortKey,
  DEFAULT_SORT,
  type Paper,
  type SortKey,
} from '../lib/openalex';
import { TopicChip } from '../components/TopicChip';
import { PaperCard } from '../components/PaperCard';
import { PaperCardTile } from '../components/PaperCardTile';
import { Icon } from '../components/Icon';
import { SortDropdown } from '../components/SortDropdown';
import { useTheme } from '../lib/theme';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { prefetchTranslations } from '../lib/translate';
import { useReadPapers } from '../lib/read';

const TOPIC_STORAGE_KEY = 'pv_topics_v1';
// Bump v2 → v3 porque cambió el default (30 días → 5 años). Si dejamos
// la key vieja, los usuarios que ya visitaron traen su preferencia
// cacheada y el default nuevo no se les aplica nunca. Preferimos
// invalidar una vez y que el nuevo valor por defecto tome efecto.
const WINDOW_STORAGE_KEY = 'pv_window_days_v3';
const VIEW_STORAGE_KEY = 'pv_feed_view_v1';
// Preferencia del usuario: ¿mostrar los papers ya leídos en el feed/search?
// Por default los escondemos — se pidió que al leer un
// paper desaparezca del feed. Pero algunos usuarios van a querer ver los
// que ya leyeron de nuevo (curiosidad, repaso, o para volver a un hilo),
// así que agregamos un toggle en la meta-row debajo del divider.
// Valor '1' = mostrar, cualquier otra cosa (o ausencia) = ocultar.
const SHOW_READ_STORAGE_KEY = 'pv_show_read_v1';

type ViewMode = 'list' | 'cards';

function readStoredView(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    return raw === 'cards' ? 'cards' : 'list';
  } catch {
    return 'list';
  }
}

function readStoredShowRead(): boolean {
  try {
    return localStorage.getItem(SHOW_READ_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Time windows for the feed. `limit` scales with the window — a 1-day window
 * has fewer indexed papers than a 1-year window, so pulling 150 for "hoy" just
 * returns a ton of low-quality dregs. Numbers tuned so each step roughly doubles
 * the haul while still fitting OpenAlex's 200-per-page ceiling.
 */
const WINDOWS: { label: string; short: string; days: number; limit: number; endText: string }[] = [
  { label: 'Hoy',      short: 'Hoy',  days: 1,    limit: 20,  endText: 'No hay más papers publicados hoy' },
  { label: '7 días',   short: '7d',   days: 7,    limit: 40,  endText: 'No hay más papers publicados esta semana' },
  { label: '1 mes',    short: '1m',   days: 30,   limit: 60,  endText: 'No hay más papers publicados este mes' },
  { label: '6 meses',  short: '6m',   days: 180,  limit: 100, endText: 'No hay más papers publicados en los últimos 6 meses' },
  { label: '1 año',    short: '1a',   days: 365,  limit: 150, endText: 'No hay más papers publicados este año' },
  // 5 años — ventana amplia para buscar papers ya establecidos (no recién
  // publicados). Topeamos el limit en 200 porque la API de OpenAlex corta
  // ahí per_page; con 5 años de cobertura, 200 papers por tanda alcanza
  // para que el feed se sienta generoso sin que el primer scroll tarde
  // eternidades en renderizar.
  { label: '5 años',   short: '5a',   days: 1825, limit: 200, endText: 'No hay más papers publicados en los últimos 5 años' },
];
// Default = 5 años. Antes era 30 días, pero se pidió que el feed
// arranque con la ventana más ancha — tiene sentido: los papers más citados
// y consolidados viven en un horizonte de años, no de semanas. Los usuarios
// que quieren "novedades de la semana" siempre pueden achicar la ventana
// manualmente con la perilla.
const DEFAULT_WINDOW_DAYS = 1825;

function windowFor(days: number) {
  return WINDOWS.find(w => w.days === days) ?? WINDOWS.find(w => w.days === DEFAULT_WINDOW_DAYS)!;
}

function readStoredWindow(): number {
  try {
    const raw = localStorage.getItem(WINDOW_STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return WINDOWS.some(w => w.days === n) ? n : DEFAULT_WINDOW_DAYS;
  } catch {
    return DEFAULT_WINDOW_DAYS;
  }
}

function readStoredTopics(): TopicId[] {
  try {
    const raw = localStorage.getItem(TOPIC_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as TopicId[];
    return [];
  } catch {
    return [];
  }
}

export function Feed() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  // useLocation nos da pathname+search en un solo
  // objeto reactivo. Lo usamos para memorizar la URL exacta del feed en
  // sessionStorage cada vez que cambia — ver effect abajo. El Header
  // consume esa memoria para devolver al usuario al mismo estado del
  // feed en vez de a la raíz pelada.
  const loc = useLocation();

  const q = params.get('q') ?? '';
  const cites = params.get('cites') ?? '';
  const citedBy = params.get('citedBy') ?? '';
  const mode: 'feed' | 'search' | 'cites' | 'citedBy' = q
    ? 'search'
    : cites
    ? 'cites'
    : citedBy
    ? 'citedBy'
    : 'feed';

  // Sort (Fase 4, 2026-04-21). El orden vive en el URL param ?sort=… para
  // que viaje entre feed/refs/cites y sea compartible. Si no hay param,
  // cada modo tiene su default "natural": search → relevancia (lo que
  // busca el usuario), feed/refs/cites → latest_cited (lo nuevo + citado).
  // isSortKey() sanitiza entradas inválidas (alguien pega un URL viejo o
  // tipea mal) para no romper el fetch con un sort desconocido.
  const rawSort = params.get('sort');
  const sort: SortKey = isSortKey(rawSort)
    ? rawSort
    : mode === 'search'
    ? 'relevance'
    : DEFAULT_SORT;
  const handleSortChange = (next: SortKey) => {
    // Preservamos todos los otros params (q, cites, citedBy, etc.) para
    // no perder contexto al cambiar el orden. `replace: false` para que
    // el back del browser funcione como toggle entre órdenes.
    const nextParams = new URLSearchParams(params);
    nextParams.set('sort', next);
    setParams(nextParams);
  };

  const [selected, setSelected] = useState<TopicId[]>(readStoredTopics);
  const [daysBack, setDaysBack] = useState<number>(readStoredWindow);
  const [view, setView] = useState<ViewMode>(readStoredView);
  // Toggle de mostrar/ocultar papers ya leídos en el feed y
  // search. Carolina: el contador de "N leídos ocultos" queda más honesto
  // si al lado le ofrecemos un botón para verlos (por curiosidad, repaso,
  // o porque el usuario quiere volver a un paper). Default false = siguen
  // ocultos como hasta ahora; el usuario opta-in explícitamente.
  const [showRead, setShowRead] = useState<boolean>(readStoredShowRead);
  // Theme toggle vive acá — se renderiza como tercer bloque del meta-row
  // del sidebar (junto a "¿Qué es Paperverse?" y "Creado por"). Antes
  // estaba en un footer fijo mobile, pero prefirió integrarlo
  // al flujo del sidebar para no meter una barra extra encima del feed.
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const [papers, setPapers] = useState<Paper[]>([]);
  const [referencePaper, setReferencePaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [randomLoading, setRandomLoading] = useState(false);
  // Paginación para modo citas/referencias. Arrancamos en 50 y subimos en
  // tandas con "Cargar más". OpenAlex tapa per_page en 200, así que ese es
  // nuestro techo. Se resetea cada vez que cambia el paper de referencia.
  const [relatedLimit, setRelatedLimit] = useState<number>(50);
  // Paginación del feed — arranca con el límite base de la ventana activa
  // (Hoy = 20, 7d = 40, …) y crece en tandas del mismo tamaño. Mismo techo
  // duro de 200 por la API.
  const [feedLimit, setFeedLimit] = useState<number>(() => windowFor(readStoredWindow()).limit);
  const [loadingMore, setLoadingMore] = useState(false);

  const currentWindow = useMemo(() => windowFor(daysBack), [daysBack]);

  // Ocultar leídos en feed home + búsqueda. "cuando
  // leo o abro un articulo me gustaria que ademas lo esconda del feed
  // porque ya lo lei" + "del feed y de los filtros, bien sea de categoria
  // o de periodo". Scope:
  //   · mode='feed' (home, con o sin filtros de topic/window) → ocultar
  //   · mode='search' (?q=) → ocultar
  //   · mode='cites' / 'citedBy' → mantener visibles (navegar el grafo de
  //     citaciones incluye papers que ya leíste; filtrarlos romperia el
  //     contexto del paper que estás explorando).
  //
  // Filter es client-side: OpenAlex sigue trayendo los N top por relevancia
  // y acá filtramos. Si todos los resultados están leídos, EmptyState
  // explica "ya los leíste todos" y sugiere desmarcar desde Biblioteca.
  //
  // Derivamos un Set de ids leídos para búsquedas O(1) dentro del filter.
  // `readEntries` es reactivo via useSyncExternalStore: marcar un paper
  // desde PaperDetail (auto-mark en mount) o desde una card re-renderiza
  // el Feed automáticamente y el paper desaparece de la lista sin refresh.
  const { entries: readEntries } = useReadPapers();
  const readIds = useMemo(() => new Set(readEntries.map(e => e.paper.id)), [readEntries]);
  // El modo soporta ocultarlos (feed + search). El toggle del usuario
  // (`showRead`) decide si efectivamente los escondemos. En refs/cites
  // `canHideRead` queda false y nunca filtramos, independiente del toggle.
  const canHideRead = mode === 'feed' || mode === 'search';
  const shouldHideRead = canHideRead && !showRead;
  const visiblePapers = useMemo(
    () => (shouldHideRead ? papers.filter(p => !readIds.has(p.id)) : papers),
    [papers, shouldHideRead, readIds]
  );
  // Papers leídos dentro de la tanda actual del feed — sirve tanto para
  // el contador "N leídos ocultos" (cuando showRead=false) como para
  // "mostrando N leídos" (cuando showRead=true).
  const readInFeedCount = canHideRead ? papers.filter(p => readIds.has(p.id)).length : 0;
  const hiddenReadCount = shouldHideRead ? papers.length - visiblePapers.length : 0;

  // títulos de pestaña por ruta. El Feed soporta 4
  // modos y cada uno tiene un "lead" distinto:
  //   · feed  → null (mantenemos el landing title "Paperverse — …")
  //   · search → el query textual, al estilo Google
  //   · cites / citedBy → etiqueta + título del paper de referencia, para que
  //     la pestaña diga algo como "Citaron a Hybrid quantum… — Paperverse"
  //     en vez de repetir el landing title y dejar al usuario sin pista de
  //     dónde está parado cuando tiene varias pestañas.
  // Cuando `referencePaper` todavía no se resolvió (primer render antes del
  // fetch), pasamos null → default. En cuanto llega el paper, el effect del
  // hook se reengancha y el título se actualiza.
  const titleLead =
    mode === 'search'
      ? q
      : mode === 'cites' && referencePaper
      ? `Referencias de ${referencePaper.title}`
      : mode === 'citedBy' && referencePaper
      ? `Citaron a ${referencePaper.title}`
      : null;
  useDocumentTitle(titleLead);

  useEffect(() => {
    localStorage.setItem(TOPIC_STORAGE_KEY, JSON.stringify(selected));
  }, [selected]);
  useEffect(() => {
    localStorage.setItem(WINDOW_STORAGE_KEY, String(daysBack));
  }, [daysBack]);
  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);
  useEffect(() => {
    // '1' = mostrar leídos; '0' = ocultarlos (default editorial).
    localStorage.setItem(SHOW_READ_STORAGE_KEY, showRead ? '1' : '0');
  }, [showRead]);
  // Memoriza la URL actual del feed. Cuando el usuario navega a paper
  // detail o biblioteca y vuelve a clickear "Feed", lo llevamos de vuelta
  // a este estado exacto en vez de perder ?q=/?cites=/?citedBy=.
  // Sólo ejecuta cuando el pathname es '/' (defensivo — la guarda debería
  // ser redundante porque Feed sólo renderiza bajo esa ruta, pero no
  // cuesta nada y protege contra refactors futuros).
  useEffect(() => {
    if (loc.pathname !== '/') return;
    rememberFeedUrl(`${loc.pathname}${loc.search}`);
  }, [loc.pathname, loc.search]);

  const activeTopics = useMemo(() => {
    const set = new Set(selected);
    return selected.length === 0 ? TOPICS : TOPICS.filter(t => set.has(t.id));
  }, [selected]);

  // Al cambiar de paper de referencia (o salir del modo citas), reseteamos
  // la paginación. Si no lo hicieras, abrir un nuevo paper heredaría el
  // límite acumulado del anterior y pedirías 200 papers de una de arranque.
  useEffect(() => {
    setRelatedLimit(50);
  }, [mode, cites, citedBy]);

  // Reseteamos el límite del feed cuando cambia la ventana o los temas: si
  // estabas en "6 meses · cargar más" y volvés a "Hoy", no queremos seguir
  // pidiendo 100 papers de un día (la API los daría pero los de abajo no
  // serían representativos de lo "publicado hoy").
  useEffect(() => {
    setFeedLimit(currentWindow.limit);
  }, [currentWindow.limit, selected]);

  // Guardamos la última cantidad pedida para saber si llegamos al fondo:
  // si la API devolvió menos que lo solicitado, no hay sentido en seguir
  // pidiendo más. Tracked separately del papers.length para no depender
  // del timing de setState.
  const [lastRequested, setLastRequested] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    // Si ya teníamos papers y sólo subió el límite (paginación), tratamos
    // el fetch como "cargar más" — no borramos la lista ni mostramos el
    // spinner gigante central. Aplica tanto al feed como a citas.
    const relevantLimit =
      mode === 'cites' || mode === 'citedBy' ? relatedLimit : mode === 'feed' ? feedLimit : 0;
    const isLoadMore =
      (mode === 'feed' || mode === 'cites' || mode === 'citedBy') &&
      papers.length > 0 &&
      relevantLimit > papers.length;
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setReferencePaper(null);
    }
    setError(null);

    async function run() {
      try {
        if (mode === 'search') {
          // Only pass topics when user has a *proper subset* selected. If no topics
          // are selected (= "todos los temas") we don't want to restrict search at all.
          const topicsForSearch = selected.length > 0 && selected.length < TOPICS.length
            ? activeTopics
            : undefined;
          // Pasamos daysBack para que la perilla de Período también filtre la
          // búsqueda. Antes el search era global y la perilla, aunque
          // visible, no hacía nada en modo query — ahora son coherentes.
          const results = await searchPapers(q, { topics: topicsForSearch, limit: 50, daysBack, sort });
          if (!cancelled) {
            setPapers(results);
            setLastRequested(50);
          }
        } else if (mode === 'cites' || mode === 'citedBy') {
          const id = mode === 'cites' ? cites : citedBy;
          // Reusamos el paper de referencia si ya lo tenemos cargado (caso
          // "cargar más"): evita un round-trip innecesario a OpenAlex.
          const ref = referencePaper && referencePaper.id === id
            ? referencePaper
            : await fetchPaper(id);
          if (cancelled) return;
          setReferencePaper(ref);
          const related = mode === 'cites'
            ? await fetchReferences(ref, relatedLimit, sort)
            : await fetchCitedBy(ref, relatedLimit, sort);
          if (!cancelled) {
            setPapers(related);
            setLastRequested(relatedLimit);
          }
        } else {
          const feed = await fetchFeed({
            topics: activeTopics,
            limit: feedLimit,
            daysBack,
            sort,
          });
          if (!cancelled) {
            setPapers(feed);
            setLastRequested(feedLimit);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Algo salió mal.');
          setPapers([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, q, cites, citedBy, activeTopics, daysBack, feedLimit, selected.length, relatedLimit, sort]);

  // Ataque 1: apenas llegan los papers, disparamos la traducción
  // eager de TODA la página — no esperamos a que cada card entre al viewport.
  // El batcher agrupa de a 5 y la cola de pollirate serializa todo, así que el
  // costo real es el mismo; lo que cambia es QUE mientras el usuario lee la
  // primera card, las de abajo ya se están traduciendo en background. Cuando
  // scrollee, encuentra la cache caliente y las cards aparecen en español
  // directo en vez de flashear el original.
  useEffect(() => {
    if (papers.length === 0) return;
    prefetchTranslations(papers);
  }, [papers]);

  const toggleTopic = (id: TopicId) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  // "Paper al azar" — pull a semi-random paper biased toward the user's
  // active topics. If the API hiccups or returns nothing we keep the user on
  // the feed rather than flashing a broken state.
  //
  // el botón antes se llamaba "Dato random" — un
  // spanglish que mezclaba "dato" (ES) con "random" (EN) y además era
  // impreciso, porque lo que abre no es "un dato" sino un paper entero.
  // Renombrado a "Paper al azar": mismo ritmo, deja claro que es un paper,
  // y el "al azar" comunica aleatoriedad en ES sin necesidad de anglicismo.
  const handleRandom = async () => {
    if (randomLoading) return;
    setRandomLoading(true);
    try {
      const p = await fetchRandomPaper({
        topics: selected.length > 0 && selected.length < TOPICS.length ? activeTopics : undefined,
      });
      if (p) nav(`/paper/${p.id}`);
    } catch {
      // swallow; the user can just click again
    } finally {
      setRandomLoading(false);
    }
  };

  // Antes la home tenía una sección "Destacados por tema" (grilla de 6 tiles)
  // arriba del feed. Se sacó: la visualización bonita de ese tile ahora es
  // una opción para TODO el feed via button group (lista ↔ tarjetas).

  return (
    <div className="main">
      <aside className="sidebar">
        <div>
          {/* Section-head con counter + "Limpiar (N)" a la derecha.
              El chip-row abajo es un carrusel horizontal en mobile (y scrolleable
              en desktop si la lista se pasa), así que fuera del viewport no ves
              cuántos temas tenés seleccionados. El counter "(N)" resuelve eso
              de un vistazo. El "Limpiar" aparece SÓLO cuando hay al menos un
              filtro activo — si no, no habría nada que limpiar y la palabra
              estaría pidiéndole al usuario una acción inútil.

              Historial del control:
                · QA2: era texto inerte con underline → lo
                  convertimos en chip-pill con border ink + ícono × para
                  que se leyera claramente como botón.
                · Fase 4.1: se pidió volver a una forma
                  más simple — el chip con border empujaba verticalmente
                  el section-head al activarse/desactivarse. Ahora el botón
                  es tipográficamente idéntico al h2 (mono 10.5px uppercase,
                  mismo letter-spacing y weight), con underline sutil como
                  marca de acción. Al compartir métrica con el h2, la altura
                  del section-head queda constante: aparece/desaparece sin
                  jump visual. */}
          <div className="section-head" style={{ margin: '0 0 12px 0' }}>
            <h2>
              Tus temas
              <span
                style={{
                  marginLeft: 8,
                  color: 'var(--fg-4)',
                  fontWeight: 400,
                  // Un toque de espaciado más suave que el 0.18em del h2 —
                  // el "(N)" es info complementaria, no parte del título.
                  letterSpacing: '0.04em',
                }}
              >
                ({selected.length})
              </span>
            </h2>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected([])}
                title="Quitar todos los filtros de temas"
                className="pv-clear-chip"
                aria-label={`Limpiar ${selected.length} filtros de temas`}
              >
                Limpiar ({selected.length})
              </button>
            )}
          </div>
          <div className="filter-row">
            {TOPICS_ALPHABETICAL.map(t => (
              <TopicChip
                key={t.id}
                topic={t}
                active={selected.includes(t.id)}
                onClick={() => toggleTopic(t.id)}
              />
            ))}
          </div>
        </div>
        {/* ────────────────────────────────────────────────────────────
            Período + "Paper al azar" (feed mode only). Ambos son controles
            del feed, así que viven juntos directamente debajo de "Tus
            temas". "Estado" + "Creado por" quedan abajo como meta-info.
            Decisión: "Paper al azar" se queda en el sidebar (no se mueve
            al ThemeDock). El dock es para acciones utilitarias (theme), y
            este botón es exploratorio — necesita estar visible con label,
            no un ícono pelado en un toolbar flotante.
            ──────────────────────────────────────────────────────────── */}
        {(mode === 'feed' || mode === 'search') && (
          // Antes había un `borderTop` acá separando "Tus temas" de
          // "Período", pero lo pidió borrar: en mobile
          // los chips ya dan un cierre visual claro al bloque de temas y la
          // línea extra sentía ruido. Mantenemos `paddingTop: 20` para
          // respiración, sin hairline.
          //
          // incluimos también `mode === 'search'` para
          // que la perilla de Período no desaparezca cuando el usuario activa
          // la búsqueda. Antes la perilla se ocultaba al escribir en el
          // buscador y eso rompía la expectativa: el usuario que llegó al
          // resultado con "últimos 7 días" perdía el control y no entendía
          // por qué. Ahora persiste y, gracias al `daysBack` que pasamos a
          // `searchPapers`, el filtro temporal sigue siendo efectivo.
          //
          // "Paper al azar" sigue siendo exclusivo del feed — en search no
          // tiene sentido un botón "abrime un paper al azar" porque ya
          // estás buscando uno específico.
          <div style={{ paddingTop: 20 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
              Período
            </div>
            <div className="pv-window-group" role="group" aria-label="Ventana de tiempo">
              {WINDOWS.map(w => (
                <button
                  key={w.days}
                  type="button"
                  className={daysBack === w.days ? 'on' : ''}
                  onClick={() => setDaysBack(w.days)}
                  title={`${w.label} · hasta ${w.limit} papers`}
                >
                  {w.short}
                </button>
              ))}
            </div>

            {mode === 'feed' && (
              <button
                type="button"
                className="pv-dato-random"
                onClick={handleRandom}
                disabled={randomLoading}
                title="Abrir un paper al azar dentro de tus temas"
              >
                <Icon name={randomLoading ? 'loader' : 'dice'} size={15} />
                {randomLoading ? 'Buscando…' : 'Paper al azar'}
              </button>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────
            Meta-row del sidebar — tres bloques hermanos en formato
            "label — valor" inline (label arriba a la izquierda, valor
            justo a su derecha). Antes los blocks eran stacked (label
            arriba en su propia línea, valor debajo) pero Carolina
            (2026-04-20, tercera iteración): "siento que se pierde
            mucho espacio podríamos hacer algo como Título: contenido".
            Cada bloque ahora es un flex row con `align-items: baseline`
            y `flex-wrap: wrap` — en sidebars angostos el valor cae
            debajo del label como antes; en mobile (sidebar wide) cabe
            todo en una sola línea, que es donde se notaba más el
            desperdicio. Bajamos también el gap entre bloques (16 → 10)
            para apretar el conjunto.

              1) ¿Qué es Paperverse? → link al Manifiesto. El "?" del
                 label hace de separador natural con el valor — por eso
                 acá no agrego dos puntos (quedaría "¿…?:"  doble
                 puntuación fea). Acorté "Leer el Manifiesto →" a
                 "Manifiesto →" porque el label ya plantea la pregunta:
                 el verbo "leer" se vuelve redundante.
              2) Creado por → firma (@caroiscreativee).
              3) Tema → toggle claro/oscuro. El ícono va ADELANTE del
                 texto (a diferencia de los dos links de nav, donde va
                 al final con arrow-right/external) — así se distingue
                 visualmente "cambiar estado" de "ir a otra ruta". El
                 texto muestra el tema DESTINO ("Modo claro" cuando
                 estás en oscuro, y viceversa). Sin transition: el
                 toggle es instantáneo (memoria del proyecto: snap, no
                 fade).

            Los tres comparten la misma gramática: label mono 10.5px
            uppercase fg-4 + valor mono 11px fg-3. La diferencia de
            color (fg-4 vs fg-3) hace de separador sin necesidad de
            agregar dos puntos en cada label.
            ──────────────────────────────────────────────────────────── */}
        {(() => {
          // Estilos compartidos por los tres bloques del meta-row. Los
          // declaro como const adentro de un IIFE para no contaminar el
          // scope del componente con detalles de presentación que sólo
          // se usan acá. Si el patrón se repite en otra page, los
          // promovemos a una clase en index.css.
          const labelStyle: CSSProperties = {
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: 'var(--fg-4)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          };
          const valueStyle: CSSProperties = {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.04em',
            color: 'var(--fg-3)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          };
          // Cada row: flex baseline + wrap. En contenedores angostos
          // wrappea (valor cae debajo del label), en anchos queda
          // inline. Gap 10px funciona como separador visual horizontal
          // y como respiro vertical post-wrap.
          const rowStyle: CSSProperties = {
            display: 'flex',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: 10,
          };
          return (
            <div
              className="pv-meta-row"
              style={{
                borderTop: '1px solid var(--border-1)',
                paddingTop: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={rowStyle}>
                <span style={labelStyle}>¿Qué es Paperverse?</span>
                <Link to="/manifiesto" style={valueStyle}>
                  Manifiesto <Icon name="arrow-right" size={10} />
                </Link>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Creado por</span>
                <a
                  href="https://x.com/caroiscreativee"
                  target="_blank"
                  rel="noreferrer"
                  style={valueStyle}
                >
                  @caroiscreativee <Icon name="external" size={10} />
                </a>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Tema</span>
                <button
                  type="button"
                  onClick={() => setTheme(isDark ? 'light' : 'dark')}
                  aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                  title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                  style={{
                    ...valueStyle,
                    gap: 6,
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    cursor: 'pointer',
                    transition: 'none',
                  }}
                >
                  <Icon name={isDark ? 'sun' : 'moon'} size={11} />
                  {isDark ? 'Modo claro' : 'Modo oscuro'}
                </button>
              </div>
            </div>
          );
        })()}
      </aside>

      <main className="col-feed">
        {/* jerarquía de encabezados.
            El Feed en modo 'feed' y 'search' no tenía un <h1> visible —
            la página arrancaba en <h2> ("20 papers · 5 años" / "X
            resultados para 'quantum'") lo que creaba un "skip from H2"
            en el outline semántico y confundía a screen readers.
            Para 'cites' y 'citedBy' sí hay un <h1> visible más abajo
            (el título del paper referenciado) así que ahí no agregamos.
            Para 'feed' y 'search' ponemos un h1 *sr-only* contextual:
            es audible pero no visible, así el visual no cambia y el
            H2 informativo sigue haciendo su trabajo. La copy del h1
            es descriptiva — "Resultados para 'quantum'" le da al
            screen reader un ancla mucho más útil que "Feed genérico". */}
        {mode === 'feed' && <h1 className="pv-sr-only">Feed de papers</h1>}
        {mode === 'search' && <h1 className="pv-sr-only">Resultados de búsqueda para "{q}"</h1>}

        {(mode === 'cites' || mode === 'citedBy') && referencePaper && (
          <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border-1)' }}>
            <button
              type="button"
              onClick={() => nav(`/paper/${referencePaper.id}`)}
              className="back"
              style={{ background: 'transparent', border: 0, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg-3)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content', marginBottom: 16 }}
            >
              <Icon name="arrow-left" size={13} /> Volver al paper
            </button>
            <div style={{ marginTop: 12 }}>
              <span className="overline" style={{ color: 'var(--fg-3)' }}>
                {mode === 'cites' ? 'Referencias de' : 'Citado por'}
              </span>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, lineHeight: 1.15, margin: '6px 0 0 0', fontWeight: 400 }}>
                {referencePaper.title}
              </h1>
            </div>
            {/* SortDropdown también en refs/cites (Fase 4). lo pidió
                explícitamente: "en el feed, en las citas y referencias".
                Lo ponemos debajo del título del paper de referencia para que
                no compita con el back-link arriba. hasSearch=false porque en
                estas vistas no hay query de búsqueda — el item Relevancia
                queda oculto automáticamente. */}
            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
              <SortDropdown value={sort} onChange={handleSortChange} hasSearch={false} />
            </div>
          </div>
        )}

        {(mode === 'feed' || mode === 'search') && (
          // Fase 4.1: se pidió mover el contador de papers
          // ("199 papers · 5 años") del top-bar hacia DEBAJO del divider, para
          // que la barra sticky quede exclusivamente de controles (Ordenar
          // por + Lista/Tarjetas). Razones:
          //   · La barra sticky se siente más ordenada sin el h2 rompiendo
          //     el balance visual con los dos botones cuadrados alineados.
          //   · El contador se lee mejor "en contexto" junto al hint de
          //     "N leídos ocultos" — ambos son metadata descriptiva del
          //     resultset, no controles.
          //   · Libera espacio horizontal en mobile: dos botones cuadrados
          //     + contador largo ("199 resultados para 'quantum'") no
          //     cabían sin truncar.
          //
          // La clase `feed-top-bar` sigue haciéndola sticky debajo del header;
          // sólo que ahora `justify-content: flex-end` alinea los controles
          // a la derecha (CSS ajustado en kit.css).
          //
          // search y feed comparten esta barra, así el
          // usuario que busca sigue teniendo acceso a sort + view toggle.
          <div className="section-head feed-top-bar">
            <div className="head-right">
              {/* SortDropdown — hasSearch=true sólo en modo search, para que
                  el item "Relevancia" aparezca únicamente cuando tiene
                  sentido (OpenAlex sólo devuelve relevance_score si hay
                  ?search=…). El valor/handler son los mismos que usan las
                  vistas de refs/cites, así el orden viaja entre las cuatro. */}
              <SortDropdown
                value={sort}
                onChange={handleSortChange}
                hasSearch={mode === 'search'}
              />
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>
        )}

        {/* Meta-row debajo del divider (Fase 4.1, 2026-04-21). Consolida en
            una sola línea: (a) contador de resultados, (b) hint de leídos
            ocultos / mostrados, (c) toggle para verlos / volverlos a
            ocultar. Tipografía mono uppercase para que lea como metadata
            editorial, no como título. Flex-wrap para que en mobile baje
            a dos líneas si no cabe. */}
        {(mode === 'feed' || mode === 'search') && (
          <div className="feed-meta-row" role="status" aria-live="polite">
            <span className="feed-meta-count">
              {mode === 'search'
                ? `${visiblePapers.length} resultados para "${q}"`
                : `${visiblePapers.length} papers · ${currentWindow.label.toLowerCase()}`}
            </span>
            {/* Hint + toggle de leídos. Sólo tiene sentido cuando hay
                leídos presentes en la tanda actual (readInFeedCount > 0).
                Si el usuario nunca leyó nada de esta ventana, escondemos
                el bloque entero — no queremos ofrecer una acción que
                no cambia nada visible. */}
            {readInFeedCount > 0 && (
              <>
                <span className="feed-meta-sep" aria-hidden="true">·</span>
                <span className="feed-meta-hint">
                  {shouldHideRead
                    ? (hiddenReadCount === 1
                        ? '1 paper ya leído oculto'
                        : `${hiddenReadCount} papers ya leídos ocultos`)
                    : (readInFeedCount === 1
                        ? '1 paper ya leído visible'
                        : `${readInFeedCount} papers ya leídos visibles`)}
                </span>
                <button
                  type="button"
                  className="feed-meta-toggle"
                  onClick={() => setShowRead(v => !v)}
                  aria-pressed={showRead}
                  // Tooltip explica qué pasa al click, útil en desktop.
                  title={showRead ? 'Volver a ocultar los papers ya leídos' : 'Mostrar los papers ya leídos'}
                >
                  {showRead ? 'Ocultar' : 'Ver'}
                </button>
              </>
            )}
          </div>
        )}

        {mode === 'search' && selected.length > 0 && selected.length < TOPICS.length && (
          <div
            style={{
              padding: '10px 0 0 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.04em',
              color: 'var(--fg-3)',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              columnGap: 10,
              rowGap: 4,
            }}
            role="status"
            aria-live="polite"
          >
            <span>
              Buscando en{' '}
              <span style={{ color: 'var(--fg-2)' }}>
                {activeTopics.map(t => t.name).join(', ')}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setSelected([])}
              style={{
                background: 'transparent',
                border: 0,
                padding: 0,
                color: 'var(--fg-accent)',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                letterSpacing: 'inherit',
                textDecoration: 'underline',
                textUnderlineOffset: 2,
                cursor: 'pointer',
              }}
              title="Quita los filtros de tema para buscar sobre todo el catálogo"
            >
              Buscar en todos los temas
            </button>
          </div>
        )}

        {loading && <LoadingState view={view} />}
        {error && <ErrorState message={error} />}
        {!loading && !error && (
          view === 'cards' ? (
            <div className="feed-tiles">
              {visiblePapers.map(p => (
                <PaperCardTile key={p.id} paper={p} onClick={() => nav(`/paper/${p.id}`)} />
              ))}
              {visiblePapers.length === 0 && (
                <EmptyState mode={mode} allFilteredAsRead={hiddenReadCount > 0 && papers.length > 0} />
              )}
            </div>
          ) : (
            <div className="feed-list">
              {visiblePapers.map(p => (
                <PaperCard key={p.id} paper={p} onClick={() => nav(`/paper/${p.id}`)} />
              ))}
              {visiblePapers.length === 0 && (
                <EmptyState mode={mode} allFilteredAsRead={hiddenReadCount > 0 && papers.length > 0} />
              )}
            </div>
          )
        )}

        {/* Paginación — feed y citas/referencias comparten el mismo patrón.
            El botón aparece cuando la API devolvió al menos tantos resultados
            como el límite pedido (señal de que hay más). Si devolvió menos
            o ya llegamos al techo de 200, aparece un divider con texto gris
            mono que explica *por qué* no hay más. Search no pagina: ya trae
            los top 50 por relevancia, más abajo la calidad cae rápido. */}
        {!loading && !error && mode === 'feed' && papers.length > 0 && (
          (() => {
            const hitCap = feedLimit >= 200;
            // "canLoad" = la API devolvió ≥ lo pedido → probablemente hay más.
            // Usamos `lastRequested` en vez de `feedLimit` porque al cambiar
            // de ventana el límite nuevo puede ser < que los resultados ya
            // en pantalla, y queremos seguir la señal de la ÚLTIMA petición.
            const canLoad = papers.length >= lastRequested && lastRequested > 0 && !hitCap;
            return (
              <CargarMas
                loading={loadingMore}
                canLoad={canLoad}
                onClick={() => setFeedLimit(prev => Math.min(prev + currentWindow.limit, 200))}
                endText={
                  hitCap
                    ? 'Tope de 200 · OpenAlex no devuelve más por consulta'
                    : currentWindow.endText
                }
              />
            );
          })()
        )}

        {!loading && !error && (mode === 'cites' || mode === 'citedBy') && papers.length > 0 && (
          (() => {
            const hitCap = relatedLimit >= 200;
            // En "cites" el máximo real es el tamaño del array referencedWorks.
            // Si ya mostramos todas, no tiene sentido ofrecer cargar más.
            const citesExhausted =
              mode === 'cites' && referencePaper && papers.length >= referencePaper.referencedWorks.length;
            const canLoad = papers.length >= relatedLimit && !hitCap && !citesExhausted;
            return (
              <CargarMas
                loading={loadingMore}
                canLoad={canLoad}
                onClick={() => setRelatedLimit(prev => Math.min(prev + 50, 200))}
                endText={
                  hitCap
                    ? 'Tope de 200 · OpenAlex no devuelve más por consulta'
                    : `Fin de la lista · ${papers.length} papers`
                }
              />
            );
          })()
        )}
      </main>
    </div>
  );
}

/**
 * Botón de paginación compartido entre feed y citas/referencias. Dos estados:
 * (a) se puede cargar más → botón secundario estilo "pv-dato-random".
 * (b) no hay más → divider fino con texto mono gris explicando por qué.
 * El texto del divider lo pasa el caller para que sea específico al contexto
 * ("No hay más papers publicados hoy" vs. "Fin de la lista · 24 papers").
 */
function CargarMas({
  loading,
  canLoad,
  onClick,
  endText,
}: {
  loading: boolean;
  canLoad: boolean;
  onClick: () => void;
  endText: string;
}) {
  if (canLoad) {
    // Sin divider — el botón solo alcanza para señalar "hay más abajo".
    // El divider/border aparece únicamente cuando realmente llegamos al
    // fondo, para que se lea como un cierre visual y no como decoración
    // repetida. Tampoco icono: el label solo ya dice todo.
    return (
      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <button
          type="button"
          onClick={onClick}
          disabled={loading}
          className="pv-cargar-mas"
          title="Traer más papers"
        >
          {loading ? 'Cargando…' : 'Cargar más'}
        </button>
      </div>
    );
  }
  return (
    <div
      style={{
        marginTop: 28,
        paddingTop: 20,
        borderTop: '1px solid var(--border-1)',
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--fg-4)',
      }}
    >
      {endText}
    </div>
  );
}

/**
 * Button group chiquito para alternar la vista del feed. Reusa el lenguaje
 * visual del pv-window-group (borde ink, fill ink al estar activo) con una
 * variante más compacta — va dentro del section-head al lado del count, así
 * que tiene que leerse rápido sin pelearse con el título.
 */
function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  // Decisión de diseño: sólo el botón activo muestra texto.
  // El inactivo colapsa a ícono-only para ahorrar espacio horizontal y que
  // "N papers · Xd" quepa en una línea dentro del section-head sticky en
  // tablet/mobile. lo pidió explícitamente porque el conteo se
  // estaba partiendo a dos líneas cuando ambos botones mostraban texto.
  //
  // El label va dentro de un <span className="label"> para que el CSS lo
  // oculte selectivamente con transición suave (max-width 0 → auto no
  // anima, pero sí con valor fijo). Mantenemos el aria-label en el botón
  // así los screen readers siguen anunciando "Lista" / "Tarjetas" aunque
  // visualmente sólo se vea el ícono en el estado inactivo.
  return (
    <div className="pv-view-group" role="group" aria-label="Vista del feed">
      <button
        type="button"
        className={view === 'list' ? 'on' : ''}
        onClick={() => onChange('list')}
        aria-pressed={view === 'list'}
        aria-label="Vista de lista"
        title="Vista de lista"
      >
        <Icon name="list" size={14} />
        <span className="label">Lista</span>
      </button>
      <button
        type="button"
        className={view === 'cards' ? 'on' : ''}
        onClick={() => onChange('cards')}
        aria-pressed={view === 'cards'}
        aria-label="Vista de tarjetas"
        title="Vista de tarjetas"
      >
        <Icon name="grid" size={14} />
        <span className="label">Tarjetas</span>
      </button>
    </div>
  );
}

/**
 * Skeletons del feed — reemplazan al spinner central (QA2 extra, 2026-04-20).
 *
 * Antes mostrábamos un único ícono `loader` centrado con la etiqueta
 * "Buscando en OpenAlex…". Problemas que reportó el QA:
 *   · El salto de spinner a grilla era brusco — cambio total de layout
 *     cuando llegaban los resultados.
 *   · En redes lentas el usuario no tiene feedback de qué aspecto va a
 *     tener la página, sólo un "algo está pasando".
 *   · El spinner central se sentía genérico, no propio del proyecto.
 *
 * Ahora renderizamos N cards placeholder con la misma shape que PaperCard /
 * PaperCardTile. El layout real ya está armado cuando llegan los datos, así
 * que el swap se siente continuo — sólo se pintan los bloques con datos
 * reales encima del armazón que ya ocupa el espacio.
 *
 * Sin animación shimmer: los toggles/estados en Paperverse son instant-snap
 * (ver memory/feedback_toggle_animations.md), y un shimmer barriendo sería
 * ruido extra de movimiento. Basta con el contraste sutil del fill sobre
 * el fondo crema para indicar "aquí viene algo".
 */
function LoadingState({ view }: { view: ViewMode }) {
  if (view === 'cards') {
    return (
      <div className="feed-tiles" aria-busy="true" aria-label="Cargando resultados">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonTile key={i} />
        ))}
      </div>
    );
  }
  return (
    <div className="feed-list" aria-busy="true" aria-label="Cargando resultados">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Placeholder para la vista "lista" — matchea la geometría de PaperCard:
 *  thumb 112×112 a la izquierda, body (eyebrow + title + lede), actions a
 *  la derecha. Todos los "slots" de texto son <div> con un fill sutil. */
function SkeletonRow() {
  const line: CSSProperties = {
    background: 'var(--bg-sunken)',
    borderRadius: 2,
  };
  return (
    <article className="paper-card" aria-hidden="true" style={{ pointerEvents: 'none' }}>
      <div className="thumb" style={{ background: 'var(--bg-sunken)' }} />
      <div className="paper-body">
        <div style={{ ...line, height: 10, width: '45%', marginBottom: 12 }} />
        <div style={{ ...line, height: 18, width: '85%', marginBottom: 8 }} />
        <div style={{ ...line, height: 18, width: '60%', marginBottom: 14 }} />
        <div style={{ ...line, height: 12, width: '90%', marginBottom: 6 }} />
        <div style={{ ...line, height: 12, width: '70%' }} />
      </div>
      <div className="actions-col">
        <div style={{ ...line, height: 36, width: 48 }} />
      </div>
    </article>
  );
}

/** Placeholder para la vista "tarjetas" — PaperCardTile es más compacto:
 *  thumb cuadrada arriba + 2 líneas de texto abajo. */
function SkeletonTile() {
  const line: CSSProperties = {
    background: 'var(--bg-sunken)',
    borderRadius: 2,
  };
  return (
    <article
      aria-hidden="true"
      style={{
        border: '2px solid var(--border-2)',
        background: 'var(--bg-surface)',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          aspectRatio: '1 / 1',
          background: 'var(--bg-sunken)',
        }}
      />
      <div style={{ padding: 14 }}>
        <div style={{ ...line, height: 10, width: '50%', marginBottom: 10 }} />
        <div style={{ ...line, height: 16, width: '90%', marginBottom: 6 }} />
        <div style={{ ...line, height: 16, width: '70%' }} />
      </div>
    </article>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="lib-empty" style={{ padding: '40px 20px' }}>
      <div className="display" style={{ fontSize: 28 }}>
        Se rompió algo.
      </div>
      <div className="lead" style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        {message}
      </div>
    </div>
  );
}

function EmptyState({
  mode,
  allFilteredAsRead = false,
}: {
  mode: string;
  allFilteredAsRead?: boolean;
}) {
  // Caso especial: la API devolvió resultados pero TODOS están marcados como
  // leídos y los ocultamos. Sin este copy, el usuario vería "No encontramos
  // papers" y pensaría que la query / filtro no matcheó, cuando en realidad
  // matcheó papers que ya leyó. El mensaje explica el porqué y le devuelve
  // control — puede buscar otra cosa, cambiar la ventana de tiempo, o
  // desmarcar uno desde la Biblioteca > Leídos si quiere revisarlo.
  if ((mode === 'search' || mode === 'feed') && allFilteredAsRead) {
    return (
      <div className="lib-empty">
        <div className="display" style={{ fontSize: 32 }}>
          Ya los leíste todos.
        </div>
        <div className="lead">
          {mode === 'search'
            ? 'Todos los resultados para esta búsqueda están en tu archivo de leídos. Probá otra búsqueda o desmarcá alguno desde la Biblioteca para que vuelva a aparecer.'
            : 'Todos los papers de esta selección ya están leídos. Probá ampliar la ventana de tiempo, elegir otro tema, o desmarcá alguno desde la Biblioteca para que vuelva a aparecer.'}
        </div>
      </div>
    );
  }
  const copy =
    mode === 'search'
      ? 'No encontramos papers con esos términos. Probá otra búsqueda.'
      : mode === 'cites'
      ? 'Este paper no tiene referencias indexadas en OpenAlex.'
      : mode === 'citedBy'
      ? 'Todavía nadie citó este paper en las bases indexadas.'
      : 'Todavía no hay papers en estos temas. Elegí un tema más o esperá al lunes — publicamos fuerte los lunes.';
  return (
    <div className="lib-empty">
      <div className="display" style={{ fontSize: 32 }}>
        Vacío por ahora.
      </div>
      <div className="lead">{copy}</div>
    </div>
  );
}
