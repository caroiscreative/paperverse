import type { Paper } from '../lib/openalex';
import { topicForConcepts } from '../lib/topics';
import { TopicBanner } from './TopicBanner';
import { HeroBanner } from './HeroBanner';
import { useTranslated } from '../lib/translate';
import { useLibrary } from '../lib/library';
import { useReadPapers } from '../lib/read';
import { useOnScreen } from '../lib/useOnScreen';
import { Icon } from './Icon';

interface Props {
  paper: Paper;
  onClick?: () => void;
  /** Opcional: etiqueta en la esquina del banner (ej: "Más citado · 7d"). */
  weekLabel?: string;
}

export function PaperCardTile({ paper, onClick, weekLabel }: Props) {
  const topic = topicForConcepts(paper.conceptsRaw);
  const topicColor = topic?.color ?? '#2E4BE0';
  const topicName = topic?.name ?? 'Ciencia';
  const bannerBg = topic?.soft ?? 'var(--bg-sunken)';

  const [visibilityRef, isVisible] = useOnScreen<HTMLElement>('300px');

  const { title: titleEs } = useTranslated(paper, { enabled: isVisible });

  const { has, toggle } = useLibrary();
  const saved = has(paper.id);

  const { has: readHas, toggle: readToggle } = useReadPapers();
  const read = readHas(paper.id);

  const onBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggle(paper);
  };
  const onMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    readToggle(paper);
  };

  return (
    <article
      ref={visibilityRef}
      className={`paper-card-tile${read ? ' is-read' : ''}`}
      onClick={onClick}
    >
      <div className="banner" style={{ background: bannerBg }}>
        {topic ? <TopicBanner topicId={topic.id} /> : <HeroBanner color={topicColor} />}
        {weekLabel && (
          <span className="eye">
            <Icon name="trending" size={11} strokeWidth={2} />
            {weekLabel}
          </span>
        )}
      </div>
      <div className="tile-body">
        <div className="tile-text">
          <span className="eyebrow">
            <span className="dot" style={{ background: topicColor }} />
            {topicName} · {paper.year ?? '—'}
            {read && <> · <span className="read-tag">leído</span></>}
          </span>
          <h3 className="title">{titleEs}</h3>
          <div className="tile-meta">
            {paper.primaryAuthor} · Citado {paper.citedByCount.toLocaleString()}
          </div>
        </div>

        <div className="actions-col">
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
