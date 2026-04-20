import type { Paper } from '../lib/openalex';
import { topicOrCiencia, resolveTopicVisual } from '../lib/topics';
import { Byline } from './Byline';
import { TopicBanner } from './TopicBanner';
import { Icon } from './Icon';
import { useLibrary } from '../lib/library';
import { useReadPapers } from '../lib/read';
import { showToast } from '../lib/toast';
import { useTranslated } from '../lib/translate';

interface Props {
  paper: Paper;
  onClick?: () => void;
  weekLabel?: string;
}

export function HeroPaperCard({ paper, onClick, weekLabel }: Props) {
  // Tema "honesto" para el eyebrow — ahora siempre devuelve un Topic real
  // (cae al Topic "ciencia" si no hay match específico). Antes era null +
  // fallbacks literales; ahora tratamos Ciencia como tema de primera clase.
  const topic = topicOrCiencia(paper.conceptsRaw);
  // Tema "visual" para la animación DS2 del banner — nunca Ciencia porque
  // topic-anim.js no tiene renderer para ese id (resolveTopicVisual excluye
  // Ciencia del pool de fallback y forzá uno de los 14 animados).
  const topicVisual = resolveTopicVisual(paper.conceptsRaw, paper.id);
  const topicColor = topic.color;
  const topicName = topic.name;

  // Spanish editorial title + lede (cached, falls back to pre-cleaned
  // original while loading). See src/lib/translate.ts.
  const { title: titleEs, lede: ledeEs } = useTranslated(paper);
  const lede = ledeEs ||
    'Este paper es el más citado entre los que coinciden con tus temas en los últimos 60 días.';

  const { has, toggle } = useLibrary();
  const saved = has(paper.id);
  // toast al guardar/quitar. Estado previo leído
  // ANTES del toggle para que el texto acompañe la transición correcta.
  const onBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    const wasSaved = saved;
    toggle(paper);
    showToast(wasSaved ? 'Quitado de tu biblioteca' : 'Guardado en tu biblioteca');
  };

  const { has: readHas, toggle: readToggle } = useReadPapers();
  const read = readHas(paper.id);
  const onMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    const wasRead = read;
    readToggle(paper);
    showToast(wasRead ? 'Desmarcado como leído' : 'Marcado como leído');
  };

  return (
    <article className={`hero-card${read ? ' is-read' : ''}`} onClick={onClick}>
      {/*
        DS2 per-topic animation. TopicBanner mounts the vanilla IIFE from
        /public/topic-anim.js — cada tema pinta su propio motif (neuronas para
        neuro, planeta/órbita para espacio, matraz para química, etc.).
        Usamos `topicVisual` (resolveTopicVisual) en vez de `topic` para que
        SIEMPRE haya una animación DS2 — antes, cuando el clasificador fallaba,
        caíamos a HeroBanner (la escena cósmica DS1 vieja) y eso es lo que
        usuario vio rota en "espacio".
      */}
      <div className="banner">
        <TopicBanner topicId={topicVisual.id} />
        <span className="eye">
          <Icon name="trending" size={14} strokeWidth={2} />
          {weekLabel ?? 'El más citado · últimos 60 días'}
        </span>
      </div>
      {/*
        hero-main becomes a two-column grid: content on the left, the CITADO
        block + bookmark on the top-right (mirrors PaperCard's actions-col).
        This kills the tall vote-row footer and reclaims the wasted space the
        user flagged.
      */}
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
