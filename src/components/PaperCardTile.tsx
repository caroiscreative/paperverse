// Tile con banner ilustrado arriba + cuerpo debajo. Es la visualización
// "bonita" del feed (antes exclusiva de Destacados por tema). Ahora se usa
// para TODO el feed cuando el usuario elige la vista de tarjetas con el
// button group del section-head.
//
// Decisiones:
// - Cada tile resuelve su propio tema vía topicForConcepts. Si no matchea
// ningún tema conocido cae a un pseudo-topic neutro (ink/cream) en vez de
// saltar el paper — queremos que la grilla refleje el feed completo, no
// una selección.
// - Hooks (useTranslated, useLibrary, useReadPapers) viven acá adentro
// porque se indexan por paperId. Separar el tile como subcomponente evita
// correr N llamadas en el padre.
// - El "eyebrow" con weekLabel es opcional: el feed normal no lo necesita,
// pero queda disponible por si se reusa en una sección tipo Más citado.
import type { Paper } from '../lib/openalex';
import { topicOrCiencia, resolveTopicVisual } from '../lib/topics';
import { TopicBanner } from './TopicBanner';
import { useTranslated } from '../lib/translate';
import { useLibrary } from '../lib/library';
import { useReadPapers } from '../lib/read';
import { showToast } from '../lib/toast';
import { useOnScreen } from '../lib/useOnScreen';
import { Icon } from './Icon';

interface Props {
  paper: Paper;
  onClick?: () => void;
  /** Opcional: etiqueta en la esquina del banner (ej: "Más citado · 7d"). */
  weekLabel?: string;
}

export function PaperCardTile({ paper, onClick, weekLabel }: Props) {
  // Tema "honesto" para el eyebrow/texto — ahora siempre devuelve un Topic real
  // (cae a "ciencia" si el clasificador no matchea). Antes esto era null + un
  // fallback literal 'Ciencia', pero al hacer Ciencia un Topic de primera clase
  // podemos tratarlo uniformemente (mismo color de dot, mismo name, etc.).
  const topic = topicOrCiencia(paper.conceptsRaw);
  // Tema "visual" para el banner — SIEMPRE devuelve uno de los 14 animados
  // (resolveTopicVisual excluye Ciencia del pool fallback porque no tiene
  // renderer en topic-anim.js). Así un paper de "Ciencia" genérica muestra
  // un eyebrow que dice "Ciencia" pero el banner animado usa un tema random
  // estable por paperId — nunca cae al HeroBanner DS1 viejo.
  const topicVisual = resolveTopicVisual(paper.conceptsRaw, paper.id);
  const topicColor = topic.color;
  const topicName = topic.name;
  const bannerBg = topicVisual.soft;

  // Viewport gating: mismo patrón que PaperCard — no enqueue-ar la traducción
  // hasta que la tile está cerca del viewport. En la vista grilla esto es
  // aún más importante porque pueden entrar 20+ tiles renderizadas en la
  // primera pintura.
  const [visibilityRef, isVisible] = useOnScreen<HTMLElement>('300px');

  const { title: titleEs } = useTranslated(paper, { enabled: isVisible });

  const { has, toggle } = useLibrary();
  const saved = has(paper.id);

  const { has: readHas, toggle: readToggle } = useReadPapers();
  const read = readHas(paper.id);

  // toast de feedback en cada acción. Estado leído
  // ANTES del toggle para que el copy refleje la transición correcta.
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
      ref={visibilityRef}
      className={`paper-card-tile${read ? ' is-read' : ''}`}
      onClick={onClick}
    >
      <div className="banner" style={{ background: bannerBg }}>
        <TopicBanner topicId={topicVisual.id} />
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
