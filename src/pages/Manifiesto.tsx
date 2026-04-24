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

import { useForm, ValidationError } from '@formspree/react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useDocumentTitle } from '../lib/useDocumentTitle';

/**
 * URL del link de donación. Cuando arme la cuenta de Ko-fi
 * (o Buy Me a Coffee, o GitHub Sponsors — da igual la plataforma), va acá.
 *
 * Si es null, la columna de "Invitame un café" queda oculta y sólo se ve
 * la caja de sugerencias. Así podemos mergear el componente antes de que
 * exista la cuenta de donaciones sin mostrar un botón que apunta a un
 * link placeholder.
 */
const SUPPORT_URL: string | null = 'https://ko-fi.com/caroiscreative';
const SUPPORT_LABEL = 'Invitame un café';

/**
 * ID del form de Formspree donde caen las sugerencias. Lo configura
 * en formspree.io; el endpoint final es
 * `https://formspree.io/f/<FORM_ID>`.
 *
 * Migramos de `mailto:` a Formspree para NO exponer el mail
 * personal en el HTML público. Trade-offs:
 *   + el email no aparece en el DOM — los scrapers de spam no lo levantan
 *   + funciona sin que el usuario tenga cliente de mail configurado
 *   + incluye dashboard y notificaciones de Formspree para revisar el
 *     historial de sugerencias
 *   - dependemos de un SaaS externo (el tier gratis aguanta 50 envíos/mes)
 *   - el mensaje hace pass-through por la infra de Formspree antes de
 *     llegar al inbox configurado en la cuenta
 */
const FORMSPREE_FORM_ID = 'xykllvzd';

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

  // Hook de Formspree. Maneja internamente:
  //   · submitting  → true mientras la request está en vuelo
  //   · succeeded   → true después de que Formspree confirmó la recepción
  //   · errors      → errores de validación del lado servidor
  //
  // `handleSubmit` va directo al `onSubmit` del <form>. Hace POST a
  // https://formspree.io/f/<id> con los campos del form (FormData), previene
  // el default del submit, y actualiza el state. No necesitamos estado
  // local propio — el hook maneja todo.
  const [formState, handleFormSubmit] = useForm(FORMSPREE_FORM_ID);

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
              // Fix dark mode: antes usábamos var(--bg-1, #FAF5E6)
              // pero --bg-1 nunca fue un token real del sistema, así que
              // siempre caía al fallback crema — en dark mode los 3 tiles
              // quedaban como parches crema sobre el canvas navy. Ahora
              // usamos --bg-surface, que sí está definido en ambos temas
              // (pv-cream-soft en light, pv-night-soft en dark) y da el
              // mismo comportamiento relativo: un tono más claro que el
              // canvas, delimitado por el hairline del grid.
              background: 'var(--bg-surface)',
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

      {/* Sumate — apoyar + sugerencias. Va después
          del bloque de principios (Libre/Privado/Sin techo) porque es el
          paso natural de "entender el proyecto" → "sumarte a él". Antes
          del Colophon porque pertenece al "por qué" relacional (vínculo
          lector-autora), no al "con qué" técnico.

          Dos columnas en desktop, una en mobile. La columna izquierda
          (SUPPORT) es conditional-render: mientras SUPPORT_URL sea null,
          la columna no se muestra y el form de sugerencias ocupa el ancho
          completo. En cuanto arme la cuenta de Ko-fi (u otra),
          setea la URL arriba y la columna aparece sola. */}
      <div
        style={{
          marginTop: 80,
          paddingTop: 48,
          borderTop: '1px solid var(--border-1)',
        }}
      >
        <span className="eyebrow" style={{ color: 'var(--fg-3)' }}>
          Sumate
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
          Si te sirve, ayudá a que siga creciendo.
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
          Paperverse es gratis y open source. {SUPPORT_URL ? 'Si te resulta útil, podés apoyarme con un cafecito para empezar a pagar los modelos de IA que traducen los papers: hoy son gratuitos y a veces pueden resultar lentos. ' : ''}
          Y si tenés una idea, una crítica o encontraste algo que no anda,
          contámela acá abajo. Leo todos los mensajes.
        </p>

        <p
          style={{
            maxWidth: 620,
            marginTop: 12,
            fontSize: 16,
            lineHeight: 1.65,
            color: 'var(--fg-2)',
            fontStyle: 'italic',
          }}
        >
          - Caro.
        </p>

        <div
          style={{
            marginTop: 40,
            display: 'grid',
            gridTemplateColumns: SUPPORT_URL
              ? 'repeat(auto-fit, minmax(260px, 1fr))'
              : '1fr',
            gap: 48,
          }}
        >
          {/* Apoyar — se renderiza sólo si hay URL configurada */}
          {SUPPORT_URL && (
            <section>
              <span
                className="eyebrow"
                style={{ color: 'var(--fg-3)', display: 'block', marginBottom: 10 }}
              >
                Apoyar
              </span>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: 'var(--fg-2)',
                  margin: '0 0 20px 0',
                }}
              >
                Cada aporte me ayuda a mejorar la experiencia para todos y así mantengo el proyecto vivo.
              </p>
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ textDecoration: 'none' }}
              >
                {SUPPORT_LABEL} <Icon name="external" size={13} />
              </a>
            </section>
          )}

          {/* Sugerencias — siempre visible. Usa Formspree (endpoint
              https://formspree.io/f/xykllvzd) en vez de mailto: así el
              email personal no queda expuesto en el HTML del sitio. */}
          <section>
            <span
              className="eyebrow"
              style={{ color: 'var(--fg-3)', display: 'block', marginBottom: 10 }}
            >
              Sugerencias
            </span>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--fg-2)',
                margin: '0 0 16px 0',
              }}
            >
              Ideas, bugs, cosas que te molestan, features que te gustaría
              ver. Todo sirve.
            </p>

            {formState.succeeded ? (
              // Mensaje de confirmación. No volvemos al form
              // después de enviar — queremos que el usuario sienta que el
              // mensaje llegó. Si quiere mandar otro, puede recargar la
              // página. Mantener el form visible post-success empuja a
              // "renviar" el mismo mensaje múltiples veces.
              <div
                style={{
                  padding: '20px 18px',
                  border: '1px solid var(--border-1)',
                  background: 'var(--bg-surface)',
                  color: 'var(--fg-1)',
                }}
              >
                <span
                  className="eyebrow"
                  style={{
                    color: 'var(--pv-clorofila-deep, #2E8B57)',
                    display: 'block',
                    marginBottom: 8,
                  }}
                >
                  Recibido
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: 'var(--fg-2)',
                  }}
                >
                  Gracias por tomarte el tiempo de escribir. Leo todo —
                  puede tardar un poco en responder, pero tu mensaje no
                  se pierde.
                </p>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit}>
                <label htmlFor="suggestion-box" className="pv-sr-only">
                  Tu sugerencia para Paperverse
                </label>
                <textarea
                  id="suggestion-box"
                  name="message"
                  placeholder="Contame…"
                  rows={5}
                  required
                  minLength={1}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: 12,
                    border: '1px solid var(--border-1)',
                    borderRadius: 0,
                    background: 'var(--bg-surface)',
                    color: 'var(--fg-1)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 15,
                    lineHeight: 1.55,
                    resize: 'vertical',
                    marginBottom: 12,
                  }}
                />

                {/* Campo oculto `_subject` — Formspree lo usa como subject
                    del mail que llega a la inbox de Carolina. Así las
                    sugerencias se distinguen del ruido del resto del
                    inbox sin que el usuario tenga que pensarlo. */}
                <input
                  type="hidden"
                  name="_subject"
                  value="Sugerencia para Paperverse"
                />

                {/* Honeypot anti-spam. Campo oculto al usuario humano via
                    `pv-sr-only` + `tabIndex={-1}` + `autoComplete="off"`.
                    Los bots rellenan todos los campos del form
                    automáticamente; Formspree reconoce `_gotcha` como
                    honeypot y descarta los envíos donde viene con valor.
                    Gratis, zero-maintenance, para volumen de Paperverse
                    alcanza. */}
                <input
                  type="text"
                  name="_gotcha"
                  className="pv-sr-only"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                {/* ValidationError renderiza el error devuelto por
                    Formspree para un campo específico. Si no hay error,
                    no pinta nada (es null-safe). */}
                <ValidationError
                  field="message"
                  errors={formState.errors}
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: 13,
                    color: 'var(--pv-error, #C73F1D)',
                  }}
                />

                <button
                  type="submit"
                  disabled={formState.submitting}
                  className="btn btn-primary"
                >
                  {formState.submitting ? 'Enviando…' : 'Enviar sugerencia'}
                </button>

                {/* Error genérico a nivel del form — cuando Formspree
                    rechaza el envío por razones que no son de campo
                    (rate limit, honeypot positivo, etc.). En esos casos
                    no queremos mostrar nada técnico, sólo "algo no
                    anduvo, probá de nuevo". */}
                <ValidationError
                  errors={formState.errors}
                  style={{
                    display: 'block',
                    marginTop: 12,
                    fontSize: 13,
                    color: 'var(--pv-error, #C73F1D)',
                  }}
                />

                <p
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: 'var(--fg-4)',
                  }}
                >
                  Las sugerencias son completamente anónimas.
                </p>
              </form>
            )}
          </section>
        </div>
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
              className="btn btn-secondary"
              style={{ marginTop: 18, textDecoration: 'none' }}
            >
              Ver sistema de diseño <Icon name="arrow-right" size={13} />
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
