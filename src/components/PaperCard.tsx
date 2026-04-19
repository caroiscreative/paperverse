import type { Paper } from '../lib/openalex';
import { topicForConcepts } from '../lib/topics';
import { Byline } from './Byline';
import { Icon } from './Icon';
import { useLibrary } from '../lib/library';
import { useReadPapers } from '../lib/read';
import { useTranslated } from '../lib/translate';
import { useOnScreen } from '../lib/useOnScreen';

interface Props {
  paper: Paper;
  onClick?: () => void;
  /** Compact variant drops the illustration + byline. Used in recommendation rails. */
  variant?: 'full' | 'compact';
}

export function PaperCard({ paper, onClick, variant = 'full' }: Props) {
  const topic = topicForConcepts(paper.conceptsRaw);
  const dotColor = topic?.color ?? '#0E1116';
  const topicName = topic?.name ?? 'Ciencia';
  const illus = topic?.illus ?? 'illus-paper.svg';

  const [visibilityRef, isVisible] = useOnScreen<HTMLElement>('300px');

  const { title: titleEs, lede: ledeEs } = useTranslated(paper, { enabled: isVisible });
  const lede = ledeEs || null;

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

  if (variant === 'compact') {
    return (
      <article
        ref={visibilityRef}
        className={`paper-card paper-card-compact${read ? ' is-read' : ''}`}
        onClick={onClick}
      >
        <div className="paper-body">
          <span className="eyebrow">
            <span className="dot" style={{ background: dotColor }} />
            {topicName} · {paper.journal} · {paper.year ?? '—'}
            {read && <> · <span className="read-tag">leído</span></>}
          </span>
          <h3 className="title">{titleEs}</h3>
          {}
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              columnGap: 8,
              rowGap: 2,
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.4 }}>
              {paper.primaryAuthor}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.02em',
                color: 'var(--fg-3)',
                lineHeight: 1.4,
              }}
            >
              · Citado {paper.citedByCount.toLocaleString('es-AR')} veces
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      ref={visibilityRef}
      className={`paper-card${read ? ' is-read' : ''}`}
      onClick={onClick}
    >
      <div className="thumb">
        <img src={`/assets/${illus}`} alt="" />
      </div>
      <div className="paper-body">
        <span className="eyebrow">
          <span className="dot" style={{ background: dotColor }} />
          {topicName} · {paper.journal} · {paper.year ?? '—'}
          {paper.openAccess && <> · <span style={{ color: 'var(--pv-clorofila-deep)' }}>acceso abierto</span></>}
          {read && <> · <span className="read-tag">leído</span></>}
        </span>
        <h3 className="title">{titleEs}</h3>
        {lede && <p className="lede">{lede}</p>}
        <Byline paper={paper} />
      </div>
      <div className="actions-col">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg-4)', textAlign: 'center', lineHeight: 1.4 }}>
          Citado<br />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--pv-ink)', letterSpacing: 0 }}>
            {paper.citedByCount.toLocaleString()}
          </span>
        </div>
        <button
          type="button"
          className={`pv-read${read ? ' on' : ''}`}
          onClick={onMarkRead}
          aria-pressed={read}
          aria-label={read ? 'Marcar como no leído' : 'Marcar como leído'}
          title={read ? 'Leído' : 'Marcar como leído'}
        >
          <Icon name={read ? 'check-filled' : 'check'} size={15} />
        </button>
        <button
          type="button"
          className={`pv-bookmark${saved ? ' on' : ''}`}
          onClick={onBookmark}
          aria-pressed={saved}
          aria-label={saved ? 'Quitar de biblioteca' : 'Guardar en biblioteca'}
          title={saved ? 'Guardado en tu biblioteca' : 'Guardar en biblioteca'}
        >
          <Icon name={saved ? 'bookmark-filled' : 'bookmark'} size={15} />
        </button>
      </div>
    </article>
  );
}
