// "Destacados por tema" — grilla de hasta 6 tiles (3 col × 2 filas en desktop),
// uno por tema, mostrando el paper más citado dentro de ese tema del feed
// actual. Reemplaza al hero único para que las 14 animaciones del DS2 del
// Paperverse Design System 2 se vean todas en la home.
//
// Decisiones:
// - Sin fetches extra: agrupamos en cliente desde los `papers` ya cargados.
// - Prioridad al paper más citado de cada tema (los papers vienen ordenados
// por citedByCount desc gracias a fetchFeed).
// - Si un paper no matchea ningún tema (topicForConcepts → null), se lo saltea
// — preferimos banners reales a uno genérico en una sección que se trata
// justamente de categorizar.
// - Máximo 6 tiles. Si hay menos temas representados, llenamos con menos.
// - Devuelve `featuredIds` vía callback opcional para que Feed.tsx pueda
// sacarlos del "Recién publicado" y no duplicarse.

import { useMemo } from 'react';
import type { Paper } from '../lib/openalex';
import { topicForConcepts, type Topic } from '../lib/topics';
import { TopicBanner } from './TopicBanner';
import { useTranslated } from '../lib/translate';
import { useLibrary } from '../lib/library';
import { useReadPapers } from '../lib/read';
import { showToast } from '../lib/toast';
import { Icon } from './Icon';

const MAX_TILES = 6;

interface Props {
  papers: Paper[];
  onPaperClick: (paper: Paper) => void;
  /** Optional: label del eyebrow arriba a la derecha del tile (default: "Más citado"). */
  weekLabel?: string;
}

interface Tile {
  paper: Paper;
  topic: Topic;
}

export function TopicHeroGrid({ papers, onPaperClick, weekLabel = 'Más citado' }: Props) {
  // Agrupar por tema primario, conservando el orden (papers vienen ya
  // ordenados desc por citas desde fetchFeed). El primer paper que caiga en
  // un tema lo "reclama" y los siguientes del mismo tema se saltean.
  const tiles = useMemo<Tile[]>(() => {
    const seen = new Set<string>();
    const result: Tile[] = [];
    for (const p of papers) {
      const topic = topicForConcepts(p.conceptsRaw);
      if (!topic) continue;
      if (seen.has(topic.id)) continue;
      seen.add(topic.id);
      result.push({ paper: p, topic });
      if (result.length >= MAX_TILES) break;
    }
    return result;
  }, [papers]);

  if (tiles.length === 0) return null;

  return (
    <div
      className="topic-hero-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 20,
        marginBottom: 28,
      }}
    >
      {tiles.map(({ paper, topic }) => (
        <TopicHeroTile
          key={paper.id}
          paper={paper}
          topic={topic}
          onClick={() => onPaperClick(paper)}
          weekLabel={weekLabel}
        />
      ))}
    </div>
  );
}

/**
 * Tile individual. Cada tile necesita su propia instancia de useTranslated
 * porque el hook se indexa por paperId — por eso lo separo en un subcomponente.
 */
function TopicHeroTile({
  paper,
  topic,
  onClick,
  weekLabel,
}: {
  paper: Paper;
  topic: Topic;
  onClick: () => void;
  weekLabel: string;
}) {
  const { title: titleEs } = useTranslated(paper);
  const { has, toggle } = useLibrary();
  const saved = has(paper.id);

  const { has: readHas, toggle: readToggle } = useReadPapers();
  const read = readHas(paper.id);

  // toasts de feedback al guardar/marcar leído. Leemos
  // estado previo antes del toggle para que el copy siga la transición real.
  const onBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    const wasSaved = saved;
    toggle(paper);
    showToast(wasSaved ? 'Quitado de tu biblioteca' : 'Guardado en tu biblioteca');
  };
  const onMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    const wasRead = read;
    readToggle(paper);
    showToast(wasRead ? 'Desmarcado como leído' : 'Marcado como leído');
  };

  return (
    <article
      className={`topic-hero-tile${read ? ' is-read' : ''}`}
      onClick={onClick}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border-1)',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      <div
        className="banner"
        style={{ position: 'relative', aspectRatio: '16 / 9', background: topic.soft }}
      >
        <TopicBanner topicId={topic.id} />
        <span
          className="eye"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            background: 'var(--pv-ink)',
            color: 'var(--pv-cream)',
            padding: '4px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Icon name="trending" size={11} strokeWidth={2} />
          {weekLabel}
        </span>
      </div>
      <div
        className="tile-body"
        style={{
          padding: '14px 16px 16px',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 12,
          alignItems: 'start',
          flex: 1,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <span
            className="eyebrow"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--fg-3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                background: topic.color,
                display: 'inline-block',
              }}
            />
            {topic.name} · {paper.year ?? '—'}
          </span>
          <h3
            className="title"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              lineHeight: 1.22,
              margin: '6px 0 8px 0',
              fontWeight: 400,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {titleEs}
          </h3>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              color: 'var(--fg-3)',
              lineHeight: 1.5,
            }}
          >
            {paper.primaryAuthor} · Citado {paper.citedByCount.toLocaleString()}
          </div>
        </div>

        <div
          className="actions-col"
          style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}
        >
          <button
            type="button"
            className={`pv-read${read ? ' on' : ''}`}
            onClick={onMarkRead}
            aria-pressed={read}
            aria-label={read ? 'Marcar como no leído' : 'Marcar como leído'}
            title={read ? 'Leído' : 'Marcar como leído'}
          >
            <Icon name={read ? 'check-filled' : 'check'} size={13} />
          </button>
          <button
            type="button"
            className={`pv-bookmark${saved ? ' on' : ''}`}
            onClick={onBookmark}
            aria-pressed={saved}
            aria-label={saved ? 'Quitar de biblioteca' : 'Guardar en biblioteca'}
            title={saved ? 'Guardado en tu biblioteca' : 'Guardar en biblioteca'}
          >
            <Icon name={saved ? 'bookmark-filled' : 'bookmark'} size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * Helper que Feed.tsx puede usar para saber qué papers ya destacamos arriba,
 * para filtrarlos del "Recién publicado" y evitar mostrar el mismo paper dos
 * veces. Mantiene la misma lógica de selección que TopicHeroGrid arriba.
 */
export function featuredIdsFor(papers: Paper[]): Set<string> {
  const seen = new Set<string>();
  const ids = new Set<string>();
  for (const p of papers) {
    const topic = topicForConcepts(p.conceptsRaw);
    if (!topic) continue;
    if (seen.has(topic.id)) continue;
    seen.add(topic.id);
    ids.add(p.id);
    if (ids.size >= MAX_TILES) break;
  }
  return ids;
}
