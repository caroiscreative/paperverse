import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchPaper,
  fetchSimilar,
  fetchFeed,
  type Paper,
} from '../lib/openalex';
import { nextTopicsFrom, topicForConcepts, type TopicId } from '../lib/topics';
import {
  fetchExplanation,
  getCachedExplanation,
  type ExplainLevel,
} from '../lib/explain';
import { useLibrary } from '../lib/library';
import { useReadPapers } from '../lib/read';
import { useTranslated } from '../lib/translate';
import { PaperCard } from '../components/PaperCard';
import { TopicChip } from '../components/TopicChip';
import { CountryFlag } from '../components/CountryFlag';
import { Icon } from '../components/Icon';

type AbstractMode = 'original' | 'explain';

export function PaperDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { has: libraryHas, toggle: libraryToggle } = useLibrary();
  const { has: readHas, toggle: readToggle } = useReadPapers();

  const [mode, setMode] = useState<AbstractMode>('explain');
  const [level, setLevel] = useState<ExplainLevel>('teen');
  type ExplainKey = `${ExplainLevel}_es`;
  const [explanations, setExplanations] = useState<Partial<Record<ExplainKey, string>>>({});
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const currentKey = `${level}_es` as ExplainKey;
  const explanation = explanations[currentKey] ?? null;

  const [similar, setSimilar] = useState<Paper[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const [nextPreview, setNextPreview] = useState<Record<TopicId, Paper | null>>(
    {} as Record<TopicId, Paper | null>
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPaper(null);
    setExplanations({});
    setExplainError(null);
    setExplainLoading(false);
    setMode('explain');
    setLevel('teen');

    fetchPaper(id)
      .then(p => {
        if (cancelled) return;
        setPaper(p);

        const cached: Partial<Record<ExplainKey, string>> = {};
        (['kid', 'teen', 'sci'] as ExplainLevel[]).forEach(lv => {
          const hit = getCachedExplanation(p.id, lv, 'es');
          if (hit) cached[`${lv}_es` as ExplainKey] = hit;
        });
        setExplanations(cached);

        if (!p.abstract) {
          setMode('original');
          return;
        }
        if (cached['teen_es' as ExplainKey]) return; // already hot

        setExplainLoading(true);
        fetchExplanation(p.id, p.title, p.abstract, 'teen', 'es')
          .then(text => {
            if (!cancelled)
              setExplanations(prev => ({ ...prev, ['teen_es' as ExplainKey]: text }));
          })
          .catch(err => {
            if (!cancelled) {
              setExplainError(err instanceof Error ? err.message : 'Falló el traductor.');
            }
          })
          .finally(() => {
            if (!cancelled) setExplainLoading(false);
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

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id]);

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

  const detectedTopic = useMemo(() => (paper ? topicForConcepts(paper.conceptsRaw) : null), [paper]);
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

  const handleExplain = async () => {
    if (!paper?.abstract) return;
    setMode('explain');
    await ensureLevel(level);
  };

  /**
   * Make sure we have an explanation for the given level (siempre en
   * español por ahora). No-op si ya está cacheada en state.
   */
  const ensureLevel = async (lv: ExplainLevel) => {
    if (!paper?.abstract) return;
    const key = `${lv}_es` as ExplainKey;
    if (explanations[key]) return;
    setExplainLoading(true);
    setExplainError(null);
    try {
      const text = await fetchExplanation(paper.id, paper.title, paper.abstract, lv, 'es');
      setExplanations(prev => ({ ...prev, [key]: text }));
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : 'Falló el traductor.');
    } finally {
      setExplainLoading(false);
    }
  };

  const changeLevel = (lv: ExplainLevel) => {
    setLevel(lv);
    setMode('explain');
    const key = `${lv}_es` as ExplainKey;
    if (explanations[key]) setExplainError(null);
    void ensureLevel(lv);
  };

  const { title: titleEs, original: titleOriginal } = useTranslated(paper, { priority: 'high' });

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

  const topicColor = detectedTopic?.color ?? 'var(--pv-ink)';
  const topicName = detectedTopic?.name ?? 'Ciencia';

  const displayTitle = titleEs ? titleEs.charAt(0).toUpperCase() + titleEs.slice(1) : titleEs;
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
        {}
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

      {}
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
            <p style={{ margin: 0 }}>{paper.abstract}</p>
          ) : (
            <p style={{ margin: 0, color: 'var(--fg-3)' }}>
              Este paper no publicó abstract en OpenAlex. Usá "Leer paper completo" para abrir la fuente.
            </p>
          )
        ) : explainLoading ? (
          <div
            style={{
              color: 'var(--fg-3)',
              minHeight: 160,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: 10,
            }}
          >
            <Icon name="loader" size={22} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Traduciendo a cristiano…
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
          <p style={{ margin: 0 }}>{explanation}</p>
        ) : (
          <p style={{ margin: 0, color: 'var(--fg-3)' }}>Tocá "Explicámelo" para pedir una traducción clara.</p>
        )}
      </div>

      {}
      <div className="paper-actions">
        <div className="paper-actions-row paper-actions-row--explore">
          {}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => nav(`/?cites=${paper.id}`)}
            disabled={paper.referencedWorks.length === 0}
            title={paper.referencedWorks.length === 0 ? 'Este paper no listó referencias' : undefined}
          >
            <Icon name="arrow-left" size={14} />
            Ver referencias
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, marginLeft: 4, color: 'var(--fg-3)' }}>
              {paper.referencedWorks.length || 0}
            </span>
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => nav(`/?citedBy=${paper.id}`)}
            disabled={paper.citedByCount === 0}
            title={paper.citedByCount === 0 ? 'Todavía nadie lo citó' : undefined}
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
            onClick={() => readToggle(paper)}
            aria-pressed={readHas(paper.id)}
            aria-label={readHas(paper.id) ? 'Marcar como no leído' : 'Marcar como leído'}
            title={readHas(paper.id) ? 'Leído' : 'Marcar como leído'}
          >
            <Icon name={readHas(paper.id) ? 'check-filled' : 'check'} size={15} />
          </button>
          <button
            type="button"
            className={`pv-bookmark${libraryHas(paper.id) ? ' on' : ''}`}
            onClick={() => libraryToggle(paper)}
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

      {}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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

      {}
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
                localStorage.setItem('pv_topics_v1', JSON.stringify([t.id]));
                nav('/');
              }}
            />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {nextTopics.map(t => {
            const previewPaper = nextPreview[t.id];
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
