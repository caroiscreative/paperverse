import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { TOPICS, type TopicId } from '../lib/topics';
import {
  fetchFeed,
  fetchPaper,
  fetchReferences,
  fetchCitedBy,
  fetchRandomPaper,
  searchPapers,
  type Paper,
} from '../lib/openalex';
import { TopicChip } from '../components/TopicChip';
import { PaperCard } from '../components/PaperCard';
import { PaperCardTile } from '../components/PaperCardTile';
import { Icon } from '../components/Icon';

const TOPIC_STORAGE_KEY = 'pv_topics_v1';
const WINDOW_STORAGE_KEY = 'pv_window_days_v2';
const VIEW_STORAGE_KEY = 'pv_feed_view_v1';

type ViewMode = 'list' | 'cards';

function readStoredView(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    return raw === 'cards' ? 'cards' : 'list';
  } catch {
    return 'list';
  }
}

/**
 * Time windows for the feed. `limit` scales with the window — a 1-day window
 * has fewer indexed papers than a 1-year window, so pulling 150 for "hoy" just
 * returns a ton of low-quality dregs. Numbers tuned so each step roughly doubles
 * the haul while still fitting OpenAlex's 200-per-page ceiling.
 */
const WINDOWS: { label: string; short: string; days: number; limit: number; endText: string }[] = [
  { label: 'Hoy',      short: 'Hoy',  days: 1,   limit: 20,  endText: 'No hay más papers publicados hoy' },
  { label: '7 días',   short: '7d',   days: 7,   limit: 40,  endText: 'No hay más papers publicados esta semana' },
  { label: '1 mes',    short: '1m',   days: 30,  limit: 60,  endText: 'No hay más papers publicados este mes' },
  { label: '6 meses',  short: '6m',   days: 180, limit: 100, endText: 'No hay más papers publicados en los últimos 6 meses' },
  { label: '1 año',    short: '1a',   days: 365, limit: 150, endText: 'No hay más papers publicados este año' },
];
const DEFAULT_WINDOW_DAYS = 30;

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

/**
 * Buzón de recomendaciones — form pequeño en el sidebar. Sin backend: al
 * enviar abrimos el cliente de mail del usuario con un mailto: prellenado
 * apuntando a mi inbox personal. El trade-off: si el usuario no tiene
 * cliente de mail configurado, no pasa nada. Pero la mayoría lo tiene, y
 * esta solución evita tener que correr un servidor / pagar un form endpoint
 * sólo para recibir feedback esporádico.
 */
function BuzonForm() {
  const [msg, setMsg] = useState('');
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim()) return;
    const subject = encodeURIComponent('Paperverse · recomendación');
    const body = encodeURIComponent(msg.trim());
    window.location.href = `mailto:francomatacarolina@gmail.com?subject=${subject}&body=${body}`;
    setMsg('');
  };
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          color: 'var(--fg-4)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        Buzón de recomendaciones
      </div>
      <textarea
        value={msg}
        onChange={e => setMsg(e.target.value)}
        placeholder="¿Qué te gustaría ver? ¿Algo que falta?"
        rows={3}
        style={{
          resize: 'vertical',
          minHeight: 64,
          padding: '8px 10px',
          border: '1px solid var(--border-1)',
          borderRadius: 6,
          background: 'var(--bg-1)',
          color: 'var(--fg-1)',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          lineHeight: 1.45,
          outline: 'none',
        }}
      />
      <button
        type="submit"
        disabled={!msg.trim()}
        className="pv-cargar-mas"
        style={{
          alignSelf: 'flex-start',
          opacity: msg.trim() ? 1 : 0.5,
          cursor: msg.trim() ? 'pointer' : 'not-allowed',
        }}
      >
        Mandar
      </button>
    </form>
  );
}

export function Feed() {
  const [params] = useSearchParams();
  const nav = useNavigate();

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

  const [selected, setSelected] = useState<TopicId[]>(readStoredTopics);
  const [daysBack, setDaysBack] = useState<number>(readStoredWindow);
  const [view, setView] = useState<ViewMode>(readStoredView);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [referencePaper, setReferencePaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const [relatedLimit, setRelatedLimit] = useState<number>(50);
  const [feedLimit, setFeedLimit] = useState<number>(() => windowFor(readStoredWindow()).limit);
  const [loadingMore, setLoadingMore] = useState(false);

  const currentWindow = useMemo(() => windowFor(daysBack), [daysBack]);

  useEffect(() => {
    localStorage.setItem(TOPIC_STORAGE_KEY, JSON.stringify(selected));
  }, [selected]);
  useEffect(() => {
    localStorage.setItem(WINDOW_STORAGE_KEY, String(daysBack));
  }, [daysBack]);
  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  const activeTopics = useMemo(() => {
    const set = new Set(selected);
    return selected.length === 0 ? TOPICS : TOPICS.filter(t => set.has(t.id));
  }, [selected]);

  useEffect(() => {
    setRelatedLimit(50);
  }, [mode, cites, citedBy]);

  useEffect(() => {
    setFeedLimit(currentWindow.limit);
  }, [currentWindow.limit, selected]);

  const [lastRequested, setLastRequested] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
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
          const topicsForSearch = selected.length > 0 && selected.length < TOPICS.length
            ? activeTopics
            : undefined;
          const results = await searchPapers(q, { topics: topicsForSearch, limit: 50 });
          if (!cancelled) {
            setPapers(results);
            setLastRequested(50);
          }
        } else if (mode === 'cites' || mode === 'citedBy') {
          const id = mode === 'cites' ? cites : citedBy;
          const ref = referencePaper && referencePaper.id === id
            ? referencePaper
            : await fetchPaper(id);
          if (cancelled) return;
          setReferencePaper(ref);
          const related = mode === 'cites'
            ? await fetchReferences(ref, relatedLimit)
            : await fetchCitedBy(ref, relatedLimit);
          if (!cancelled) {
            setPapers(related);
            setLastRequested(relatedLimit);
          }
        } else {
          const feed = await fetchFeed({
            topics: activeTopics,
            limit: feedLimit,
            daysBack,
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
  }, [mode, q, cites, citedBy, activeTopics, daysBack, feedLimit, selected.length, relatedLimit]);

  const toggleTopic = (id: TopicId) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const handleRandom = async () => {
    if (randomLoading) return;
    setRandomLoading(true);
    try {
      const p = await fetchRandomPaper({
        topics: selected.length > 0 && selected.length < TOPICS.length ? activeTopics : undefined,
      });
      if (p) nav(`/paper/${p.id}`);
    } catch {
    } finally {
      setRandomLoading(false);
    }
  };

  return (
    <div className="main">
      <aside className="sidebar">
        <div>
          <div className="section-head" style={{ margin: '0 0 12px 0' }}>
            <h2>Tus temas</h2>
          </div>
          <div className="filter-row">
            {TOPICS.map(t => (
              <TopicChip
                key={t.id}
                topic={t}
                active={selected.includes(t.id)}
                onClick={() => toggleTopic(t.id)}
              />
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border-1)', paddingTop: 20 }}>
          <div className="section-head" style={{ margin: '0 0 10px 0' }}>
            <h2>Estado</h2>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.6, marginBottom: 14 }}>
            {mode === 'cites' ? (
              <>
                <div>{papers.length} referencias</div>
                <div>ordenadas por citaciones</div>
                <div>OpenAlex · live</div>
              </>
            ) : mode === 'citedBy' ? (
              <>
                <div>{papers.length} citaciones</div>
                <div>ordenadas por impacto</div>
                <div>OpenAlex · live</div>
              </>
            ) : mode === 'search' ? (
              <>
                <div>{papers.length} resultados</div>
                <div>{selected.length === 0 ? 'todos los temas' : `${selected.length} temas activos`}</div>
                <div>OpenAlex · live</div>
              </>
            ) : (
              <>
                <div>{papers.length} papers</div>
                <div>{selected.length === 0 ? 'todos los temas' : `${selected.length} temas activos`}</div>
                <div>OpenAlex · live</div>
              </>
            )}
          </div>

          {}
          {mode === 'feed' && (
            <>
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
              {}

              <button
                type="button"
                className="pv-dato-random"
                onClick={handleRandom}
                disabled={randomLoading}
                title="Abrir un paper al azar dentro de tus temas"
              >
                <Icon name={randomLoading ? 'loader' : 'dice'} size={15} />
                {randomLoading ? 'Buscando…' : 'Dato random'}
              </button>
            </>
          )}

          {}
          <div
            style={{
              marginTop: 32,
              paddingTop: 24,
              borderTop: '1px solid var(--border-1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  color: 'var(--fg-4)',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Creado por
              </div>
              <div style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.45 }}>
                caro is creative
              </div>
              <a
                href="https://x.com/caroiscreativee"
                target="_blank"
                rel="noreferrer"
                style={{
                  marginTop: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  color: 'var(--fg-3)',
                  textDecoration: 'none',
                }}
              >
                @caroiscreativee <Icon name="external" size={10} />
              </a>
            </div>

            <nav
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <Link
                to="/manifiesto"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 13,
                  color: 'var(--fg-2)',
                  textDecoration: 'none',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border-1)',
                }}
              >
                <span>Manifiesto</span>
                <Icon name="arrow-right" size={12} />
              </Link>
              <Link
                to="/colophon"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 13,
                  color: 'var(--fg-2)',
                  textDecoration: 'none',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border-1)',
                }}
              >
                <span>Colophon</span>
                <Icon name="arrow-right" size={12} />
              </Link>
            </nav>

            {}
            <BuzonForm />
          </div>
        </div>
      </aside>

      <main className="col-feed">
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
          </div>
        )}

        {mode === 'search' && (
          <div className="section-head" style={{ marginTop: 0 }}>
            <h2>Resultados para "{q}"</h2>
            <span className="count">{papers.length} papers</span>
          </div>
        )}

        {mode === 'feed' && (
          <div className="section-head">
            <h2>Recién publicado</h2>
            <div className="head-right">
              <span className="count">
                {papers.length} papers · {currentWindow.label.toLowerCase()}
              </span>
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>
        )}

        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && !error && (
          view === 'cards' ? (
            <div className="feed-tiles">
              {papers.map(p => (
                <PaperCardTile key={p.id} paper={p} onClick={() => nav(`/paper/${p.id}`)} />
              ))}
              {papers.length === 0 && <EmptyState mode={mode} />}
            </div>
          ) : (
            <div className="feed-list">
              {papers.map(p => (
                <PaperCard key={p.id} paper={p} onClick={() => nav(`/paper/${p.id}`)} />
              ))}
              {papers.length === 0 && <EmptyState mode={mode} />}
            </div>
          )
        )}

        {}
        {!loading && !error && mode === 'feed' && papers.length > 0 && (
          (() => {
            const hitCap = feedLimit >= 200;
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
  return (
    <div className="pv-view-group" role="group" aria-label="Vista del feed">
      <button
        type="button"
        className={view === 'list' ? 'on' : ''}
        onClick={() => onChange('list')}
        aria-pressed={view === 'list'}
        title="Vista de lista"
      >
        <Icon name="list" size={14} />
        Lista
      </button>
      <button
        type="button"
        className={view === 'cards' ? 'on' : ''}
        onClick={() => onChange('cards')}
        aria-pressed={view === 'cards'}
        title="Vista de tarjetas"
      >
        <Icon name="grid" size={14} />
        Tarjetas
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fg-3)' }}>
      <Icon name="loader" size={24} />
      <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Buscando en OpenAlex…
      </div>
    </div>
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

function EmptyState({ mode }: { mode: string }) {
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
