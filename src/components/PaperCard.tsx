import type { Paper } from '../lib/openalex';
import { topicOrCiencia, thumbTintForPaper } from '../lib/topics';
import { Byline } from './Byline';
import { Icon } from './Icon';
import { useLibrary } from '../lib/library';
import { useReadPapers } from '../lib/read';
import { showToast } from '../lib/toast';
import { useTranslated } from '../lib/translate';
import { useOnScreen } from '../lib/useOnScreen';

interface Props {
  paper: Paper;
  onClick?: () => void;
  /** Compact variant drops the illustration + byline. Used in recommendation rails. */
  variant?: 'full' | 'compact';
}

export function PaperCard({ paper, onClick, variant = 'full' }: Props) {
  // "ciencia" : ahora Ciencia es un Topic real, así que usamos
  // `topicOrCiencia` que devuelve un Topic completo siempre (nunca null).
  // Antes teníamos 4 fallbacks literales dispersos (color/name/illus/soft)
  // que se iban desincronizando cuando tocábamos uno — ahora un solo call
  // devuelve todo coherente.
  const topic = topicOrCiencia(paper.conceptsRaw);
  const dotColor = topic.color;
  const topicName = topic.name;
  const illus = topic.illus;

  // Viewport gating: sólo disparamos la traducción de Pollinations cuando
  // la card se acerca al viewport (IntersectionObserver con rootMargin
  // 300px). Antes TODAS las cards del feed (60-150) firaban al montar y
  // la cola se volvía una fila eterna de 1-por-IP. Ahora sólo las que el
  // usuario realmente va a ver se enqueue-an. La traducción cacheada sigue
  // apareciendo sincrónico incluso si no está en pantalla, así que no hay
  // flash cuando se vuelve a renderizar.
  const [visibilityRef, isVisible] = useOnScreen<HTMLElement>('300px');

  // Editorial Spanish title + lede. Falls back to the pre-cleaned original
  // while the translation is in flight, so the feed never shows blanks or
  // flickers. See src/lib/translate.ts for the caching + Pollinations call.
  const { title: titleEs, lede: ledeEs } = useTranslated(paper, { enabled: isVisible });
  const lede = ledeEs || null;

  const { has, toggle } = useLibrary();
  const saved = has(paper.id);

  const { has: readHas, toggle: readToggle } = useReadPapers();
  const read = readHas(paper.id);

  // Bookmark / read clicks need to stop propagation so they don't also
  // navigate into the paper detail. That would immediately undo the "toggle
  // from the list" micro-interaction that makes these feel snappy.
  // además del toggle, disparamos un toast para que
  // el usuario tenga feedback verbal además del cambio visual del ícono.
  // Leemos el estado ANTES de togglear — después el flag ya cambió y el
  // texto del toast saldría invertido.
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
          {/* Meta del compact card: autor en sans (mismo lenguaje que el
              byline editorial del PaperDetail — "Gaosheng Wu, Tongyin Li &
              4 más"), y el contador de citas en mono Sentence-case (igual
              que la meta-rail del detalle: "Citado 23.473 veces"). Antes
              estaba todo en mayúsculas mono estilo eyebrow, pero se leía
              como catálogo frío; el autor merece el peso humano del sans. */}
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
      {/* Variedad de arte por paper (): 3 tintas derivadas del color
          del tema, rotadas por hash del paperId. Genera ritmo cromático
          dentro de la lista sin salirse de la familia del tema. Papers sin
          match específico caen a Ciencia (slate neutral) — también con las
          3 tintas rotadas, así mantienen el mismo tratamiento visual que
          el resto.

          antes acá también aplicábamos una
          transform (rotaciones/flip) al SVG por paper, pero se veía
          "extrañísimo" cuando un paper venía inclinado 5° random y los
          bordes del ícono chocaban contra el fondo. Eliminado. */}
      <div
        className="thumb"
        style={{ background: thumbTintForPaper(topic, paper.id) }}
      >
        <img src={`/assets/${illus}`} alt="" />
      </div>
      <div className="paper-body">
        <span className="eyebrow">
          <span className="dot" style={{ background: dotColor }} />
          {topicName} · {paper.journal} · {paper.year ?? '—'}
          {/* "Abierto" — antes era "acceso abierto" (dos palabras) y se
              partía en dos líneas porque el " · " y las palabras quedaban
              sueltas como nodos independientes y el browser rompía donde
              quisiera. Ahora: una sola palabra + white-space:nowrap en el
              wrapper, que mete " · abierto" como bloque indivisible. Si
              no entra en la línea, baja entero — no se parte. El color
              verde clorofila ya comunica "disponible / libre" sin que
              haga falta decir "acceso". */}
          {paper.openAccess && (
            <span
              style={{
                color: 'var(--pv-clorofila-deep)',
                whiteSpace: 'nowrap',
              }}
              title="Este paper es de acceso abierto — podés leer el PDF completo sin pagar ni loguearte en ninguna institución"
            >
              {' · abierto'}
            </span>
          )}
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
