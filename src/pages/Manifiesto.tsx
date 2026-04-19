import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function Manifiesto() {
  const nav = useNavigate();

  return (
    <div className="detail-wrap">
      <button type="button" onClick={() => nav(-1)} className="back">
        <Icon name="arrow-left" size={13} /> Volver
      </button>

      <span className="eyebrow" style={{ color: 'var(--fg-3)' }}>
        Paperverse · manifiesto
      </span>

      <h1 style={{ maxWidth: 820 }}>
        Vivimos al borde de la innovación tecnológica más filosa.
      </h1>

      <div
        className="abstract-body"
        style={{
          maxWidth: 680,
          marginTop: 32,
          fontSize: 17,
          lineHeight: 1.75,
        }}
      >
        <p style={{ margin: '0 0 20px 0' }}>
          Y, sin embargo, los verdaderos héroes no son siempre los
          investigadores. Son los países que los sostienen, los institutos
          que los formaron, los nombres que firman al costado.
        </p>
        <p style={{ margin: '0 0 20px 0' }}>
          En Paperverse cambiamos el enfoque. Reconocemos a todos — países,
          institutos, investigadores — y leemos papers entre campos de la
          ciencia para hacer más fácil acercarse a lo que está pasando ahí
          afuera.
        </p>
        <p style={{ margin: '0 0 20px 0' }}>
          Lo hago por diversión. Lo hago por curiosa.
        </p>
        <p style={{ margin: '0 0 20px 0' }}>
          La verdad es que no quiero leer tecnicismos — no porque no los
          entienda, sino porque quiero digerirlos rápido, como leería una
          noticia vacía en una red social. Pero informándome de verdad.
        </p>
      </div>

      <div
        style={{
          marginTop: 64,
          paddingTop: 24,
          borderTop: '1px solid var(--border-1)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--fg-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span>caro is creative</span>
        <span style={{ color: 'var(--fg-4)', opacity: 0.5 }}>·</span>
        <a
          href="https://x.com/caroiscreativee"
          target="_blank"
          rel="noreferrer"
          style={{
            color: 'var(--fg-3)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          @caroiscreativee <Icon name="external" size={11} />
        </a>
      </div>
    </div>
  );
}
