import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';

interface Row {
  label: string;
  value: string;
  href?: string;
}

const TIPOGRAFIA: Row[] = [
  { label: 'Display', value: 'Instrument Serif', href: 'https://fonts.google.com/specimen/Instrument+Serif' },
  { label: 'Sans', value: 'Inter', href: 'https://rsms.me/inter/' },
  { label: 'Mono', value: 'JetBrains Mono', href: 'https://www.jetbrains.com/lp/mono/' },
  { label: 'Iconos', value: 'Set propio · SVG' },
];

const MAQUINA: Row[] = [
  { label: 'Framework', value: 'React 18', href: 'https://react.dev' },
  { label: 'Build', value: 'Vite 5', href: 'https://vitejs.dev' },
  { label: 'Lenguaje', value: 'TypeScript', href: 'https://www.typescriptlang.org' },
  { label: 'Ruteo', value: 'React Router v6', href: 'https://reactrouter.com' },
  { label: 'Papers', value: 'OpenAlex API', href: 'https://openalex.org' },
  { label: 'IA editorial', value: 'Pollinations', href: 'https://pollinations.ai' },
];

function RowList({ rows }: { rows: Row[] }) {
  return (
    <dl style={{ margin: 0, padding: 0 }}>
      {rows.map((r, i) => (
        <div
          key={r.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 16,
            padding: '14px 0',
            borderTop: i === 0 ? '1px solid var(--border-1)' : 'none',
            borderBottom: '1px solid var(--border-1)',
          }}
        >
          <dt
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--fg-4)',
            }}
          >
            {r.label}
          </dt>
          <dd style={{ margin: 0, fontSize: 15, color: 'var(--fg-1)', textAlign: 'right' }}>
            {r.href ? (
              <a
                href={r.href}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--fg-1)',
                  textDecoration: 'none',
                  borderBottom: '1px solid var(--border-2)',
                  paddingBottom: 1,
                }}
              >
                {r.value}
              </a>
            ) : (
              r.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Colophon() {
  const nav = useNavigate();

  return (
    <div className="detail-wrap">
      <button type="button" onClick={() => nav(-1)} className="back">
        <Icon name="arrow-left" size={13} /> Volver
      </button>

      <span className="eyebrow" style={{ color: 'var(--fg-3)' }}>
        Paperverse · colophon
      </span>

      <h1 style={{ maxWidth: 820 }}>
        Con qué está hecho este lugar.
      </h1>

      <p
        style={{
          maxWidth: 620,
          marginTop: 24,
          fontSize: 17,
          lineHeight: 1.65,
          color: 'var(--fg-2)',
        }}
      >
        Paperverse es un proyecto pequeño de una sola persona. Acá la lista
        honesta de las piezas que lo sostienen — tipos, frameworks, APIs y
        decisiones técnicas que hicieron posible leer ciencia sin tecnicismos.
      </p>

      <div
        style={{
          marginTop: 48,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 48,
        }}
      >
        <section>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              margin: '0 0 16px 0',
              color: 'var(--fg-1)',
            }}
          >
            Tipografía
          </h2>
          <RowList rows={TIPOGRAFIA} />
        </section>

        <section>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              margin: '0 0 16px 0',
              color: 'var(--fg-1)',
            }}
          >
            Máquina
          </h2>
          <RowList rows={MAQUINA} />
        </section>
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
