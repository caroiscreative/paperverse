import type { Paper } from '../lib/openalex';
import { topicForConcepts } from '../lib/topics';
import { Byline } from './Byline';
import { HeroBanner } from './HeroBanner';
import { TopicBanner } from './TopicBanner';
import { Icon } from './Icon';
import { useLibrary } from '../lib/library';
import { useReadPapers } from '../lib/read';
import { useTranslated } from '../lib/translate';

interface Props {
  paper: Paper;
  onClick?: () => void;
  weekLabel?: string;
}

export function HeroPaperCard({ paper, onClick, weekLabel }: Props) {
  const topic = topicForConcepts(paper.conceptsRaw);
  const topicColor = topic?.color ?? '#2E4BE0';
  const topicName = topic?.name ?? 'Ciencia';

  const { title: titleEs, lede: ledeEs } = useTranslated(paper);
  const lede = ledeEs ||
    'Este paper es el más citado entre los que coinciden con tus temas en los últimos 60 días.';

  const { has, toggle } = useLibrary();
  const saved = has(paper.id);
  const onBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggle(paper);
  };

  const { has: readHas, toggle: readToggle } = useReadPapers();
  const read = readHas(paper.id);
  const onMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    readToggle(paper);
  };

  return (
    <article className={`hero-card${read ? ' is-read' : ''}`} onClick={onClick}>
      {}
      <div className="banner">
        {topic ? (
          <TopicBanner topicId={topic.id} />
        ) : (
          <HeroBanner color={topicColor} />
        )}
        <span className="eye">
          <Icon name="trending" size={14} strokeWidth={2} />
          {weekLabel ?? 'El más citado · últimos 60 días'}
        </span>
      </div>
      {}
      <div
        className="hero-main"
        style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start' }}
      >
        <div style={{ minWidth: 0 }}>
          <span
            className="eyebrow"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--fg-3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <span style={{ width: 8, height: 8, background: topicColor, display: 'inline-block' }} />
            {topicName} · {paper.journal} · {paper.year ?? '—'}
            {paper.openAccess && (
              <>
                {' · '}
                <span style={{ color: 'var(--pv-clorofila-deep)' }}>acceso abierto</span>
              </>
            )}
          </span>
          <h1 className="title">{titleEs}</h1>
          <p className="hook">{lede}</p>
          <Byline paper={paper} size="lg" />
        </div>

        <div
          className="actions-col"
          style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', paddingTop: 4 }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--fg-4)',
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            Citado<br />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 28,
                color: 'var(--pv-ink)',
                letterSpacing: 0,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
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
      </div>
    </article>
  );
}
