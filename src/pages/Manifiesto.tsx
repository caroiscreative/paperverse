// Manifiesto — página "por qué existe Paperverse", firmada por la autora.
// No es un landing: se entra desde el sidebar (o por URL directa) y se lee
// de un tirón, como se lee un texto editorial corto. Usa el mismo shell
// visual del PaperDetail (detail-wrap) para no romper el lenguaje del app.
//
// Antes teníamos DOS páginas editoriales cortas (/manifiesto y /colophon)
// y dos links separados en el sidebar. Era demasiado para lo que cada una
// tenía adentro — el manifiesto son 4 párrafos y el colophon son 2 columnas
// de metadata. Ahora las fusionamos en una sola página: primero el "por qué"
// (manifiesto) y al final el "con qué" (colophon) como bloque técnico. Un
// solo link en el sidebar, un solo scroll para leer toda la historia.

import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useDocumentTitle } from '../lib/useDocumentTitle';

interface Row {
  label: string;
  value: string;
  href?: string;
}

// El bloque de colophon vive acá ahora en vez de en una página aparte.
// Lista de piezas técnicas que sostienen el proyecto, dividido en "Design"
// (lo que se ve: tipos, iconos) y "Engineer" (lo que hace que funcione:
// framework, build, APIs). El par "Design/Engineer" hace eco del handle de
// la autora (caro is creative) y del espíritu "design engineer" del proyecto.
const DESIGN: Row[] = [
  { label: 'Display', value: 'Instrument Serif', href: 'https://fonts.google.com/specimen/Instrument+Serif' },
  { label: 'Sans', value: 'Inter', href: 'https://rsms.me/inter/' },
  { label: 'Mono', value: 'JetBrains Mono', href: 'https://www.jetbrains.com/lp/mono/' },
  { label: 'Iconos', value: 'Set propio · SVG' },
];

const ENGINEER: Row[] = [
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

export function Manifiesto() {
  const nav = useNavigate();
  // tab title "Manifiesto — Paperverse".
  useDocumentTitle('Manifiesto');

  return (
    <div className="detail-wrap">
      <button type="button" onClick={() => nav(-1)} className="back">
        <Icon name="arrow-left" size={13} /> Volver
      </button>

      <span className="eyebrow" style={{ color: 'var(--fg-3)' }}>
        Manifiesto
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
          Y, sin embargo, se les da el crédito a las empresas por el
          avance de sus investigadores, borrando del mapa el merecido
          mérito de su hazaña.
        </p>
        <p style={{ margin: '0 0 20px 0' }}>
          En Paperverse el crédito vuelve a donde nació: al investigador.
          Leemos papers entre campos de la ciencia para que sea más fácil
          acercarse a lo que está pasando ahí afuera, y para que detrás de
          cada descubrimiento se vea la firma de quien lo hizo.
        </p>
        <p style={{ margin: '0 0 20px 0' }}>
          Lo hago por diversión. Lo hago por curiosa.
        </p>
        <p style={{ margin: '0 0 20px 0' }}>
          La verdad es que no quiero leer tecnicismos. No porque no los
          entienda, sino porque quiero digerirlos rápido, como leería una
          noticia vacía en una red social. Pero informándome de verdad.
        </p>
      </div>

      {/* Bloque "principios" — cómo funciona técnicamente para mantener el
          espíritu editorial. Va antes del colophon porque pertenece al
          "por qué" (decisiones), no al "con qué" (piezas). Tres tarjetas
          chicas, mismo lenguaje mono+display que el resto, sin íconos
          gritones. Truco de layout: el contenedor tiene bg = var(--border-1)
          y las cards tienen bg = var(--bg-1), con gap 1px. Eso dibuja
          hairlines entre cells sin importar si hay 3 columnas (desktop) o
          1 (mobile) — no hay que elegir entre border-left o border-top. */}
      <div
        style={{
          marginTop: 56,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 1,
          background: 'var(--border-1)',
          border: '1px solid var(--border-1)',
        }}
      >
        {[
          {
            label: 'Libre',
            body:
              'Código abierto bajo licencia MIT. Cualquiera puede leerlo, copiarlo o mejorarlo. No hay versión paga ni funciones escondidas.',
          },
          {
            label: 'Privado',
            body:
              'No hay cuenta, ni login, ni analytics. Todo lo que lees se queda en tu navegador. La IA que te explica los papers responde desde tu propia conexión a internet (tu IP), no desde la mía.',
          },
          {
            label: 'Sin techo',
            body:
              'Nadie paga la cuenta de nadie. Cada lector consulta a los modelos de IA abiertos al público desde su propia conexión (su IP), así que Paperverse puede crecer sin romperse y sin cobrarle a nadie.',
          },
        ].map(p => (
          <div
            key={p.label}
            style={{
              padding: '24px 20px',
              background: 'var(--bg-1, #FAF5E6)',
            }}
          >
            <span
              className="eyebrow"
              style={{ color: 'var(--fg-3)', display: 'block', marginBottom: 10 }}
            >
              {p.label}
            </span>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--fg-2)',
              }}
            >
              {p.body}
            </p>
          </div>
        ))}
      </div>

      {/* Colophon inline — "con qué está hecho". Va después del manifiesto
          porque es el detrás de escena: primero se lee el porqué, después
          se ven las piezas. Separador visual fuerte (borde superior + gap
          grande) para que no se sienta como continuación del texto. */}
      <div
        style={{
          marginTop: 80,
          paddingTop: 48,
          borderTop: '1px solid var(--border-1)',
        }}
      >
        <span className="eyebrow" style={{ color: 'var(--fg-3)' }}>
          Colophon
        </span>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 32,
            lineHeight: 1.15,
            margin: '6px 0 0 0',
            fontWeight: 400,
            maxWidth: 820,
          }}
        >
          Con qué está hecho este lugar.
        </h2>

        <p
          style={{
            maxWidth: 620,
            marginTop: 20,
            fontSize: 16,
            lineHeight: 1.65,
            color: 'var(--fg-2)',
          }}
        >
          Paperverse es un proyecto pequeño de una sola persona. Acá la lista
          honesta de las piezas que lo sostienen: tipos, frameworks, APIs y
          decisiones técnicas que hicieron posible leer ciencia sin
          tecnicismos.
        </p>

        <div
          style={{
            marginTop: 40,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 48,
          }}
        >
          <section>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                margin: '0 0 16px 0',
                color: 'var(--fg-1)',
                fontWeight: 400,
              }}
            >
              Design
            </h3>
            <RowList rows={DESIGN} />
            {/* Link al sistema de diseño completo — tipografías, paleta base y
                los 14 temas con sus 3 superficies (chip, ilustración 300px,
                animación). Va acá adentro del colophon "Design" porque es
                exactamente eso: la capa visual del proyecto, expuesta. */}
            <a
              href="/design-system"
              onClick={e => {
                e.preventDefault();
                nav('/design-system');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 18,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--fg-3)',
                textDecoration: 'none',
                borderBottom: '1px solid var(--border-2)',
                paddingBottom: 2,
              }}
            >
              Ver sistema de diseño <Icon name="arrow-right" size={11} />
            </a>
          </section>

          <section>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                margin: '0 0 16px 0',
                color: 'var(--fg-1)',
                fontWeight: 400,
              }}
            >
              Engineer
            </h3>
            <RowList rows={ENGINEER} />
          </section>
        </div>
      </div>

      {/* Footer editorial mínimo: firma por X + licencia. "MIT · open source"
          hace eco del repo público de GitHub sin tener que linkearlo —
          cualquiera que quiera el código lo busca por el handle. Se removió
          el span "caro is creative" porque el link ya lo comunica. */}
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
        <span style={{ color: 'var(--fg-4)', opacity: 0.5 }}>·</span>
        <span>Licencia MIT · open source</span>
      </div>
    </div>
  );
}
