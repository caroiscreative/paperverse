import type { Paper } from '../lib/openalex';
import type { Topic } from '../lib/topics';
import { useTranslated } from '../lib/translate';

interface Props {
  topic: Topic;
  paper: Paper | null | undefined;
  onClick: () => void;
}

export function NextTopicPreview({ topic, paper, onClick }: Props) {
  const { title: titleEs } = useTranslated(paper ?? null);
  const clickable = !!paper;

  return (
    <article
      className="paper-card paper-card-compact"
      onClick={() => {
        if (clickable) onClick();
      }}
      style={{ cursor: clickable ? 'pointer' : 'default', opacity: clickable ? 1 : 0.55 }}
    >
      <div className="paper-body">
        <span className="eyebrow">
          <span className="dot" style={{ background: topic.color }} />
          {topic.name}
        </span>
        <h3 className="title" style={{ fontSize: 20 }}>
          {paper ? titleEs : 'Cargando…'}
        </h3>
        {paper && (
          <div
            className="meta"
            style={{
              marginTop: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-3)',
            }}
          >
            {paper.primaryAuthor} · {paper.year ?? '—'} · Citado {paper.citedByCount}
          </div>
        )}
      </div>
    </article>
  );
}
