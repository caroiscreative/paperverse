/**
 * /api/og — Imagen OG dinámica por paper (QA2 P2.3, 2026-04-22)
 * ==============================================================
 *
 * Vercel Edge Function que devuelve un PNG 1200×630 renderizado con
 * @vercel/og (Satori por debajo). La llama el middleware.ts para que
 * cada preview de paper tenga una imagen única: paleta del tópico
 * como fondo, título del paper en español, y el wordmark de Paperverse
 * en el pie.
 *
 * Querystring:
 *   title  — título del paper en español (max 180 chars, truncado por el
 *            middleware). Va como texto grande en el cuerpo de la imagen.
 *   topic  — topicId (ej. "ia", "clima", "neuro"). Determina la paleta
 *            de fondo y el eyebrow. Si es inválido o falta, cae a "ciencia".
 *
 * Output:
 *   PNG 1200×630, content-type image/png, cache 24h en edge + 7 días SWR.
 *
 * Nota sobre Satori
 * -----------------
 * Satori soporta un subset MUY limitado de CSS: flexbox, position, colors,
 * borders, fonts, basic shadows. NO soporta:
 *   - grid layout
 *   - @media queries
 *   - CSS custom properties (var())
 *   - clases CSS externas (todo inline)
 *   - transform 3D
 * Por eso todo el styling acá va en atributos `style` con objetos JS.
 *
 * El mark del logo va como SVG inline porque Satori sí renderiza SVG
 * (subset básico). Reutilizamos la geometría de public/assets/logo-mark.svg.
 */

import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

// ─────────────────────────────────────────────────────────────────────────
// Paleta (espejo de src/lib/topics.ts — si cambian los colores allá, acá
// también; el middleware.ts tiene la misma copia)
// ─────────────────────────────────────────────────────────────────────────

interface Topic {
  id: string;
  name: string;
  color: string;
  soft: string;
  deep: string;
}

const TOPICS: Record<string, Topic> = {
  ia:         { id: 'ia',         name: 'IA',            color: '#2E4BE0', soft: '#E0E6FF', deep: '#1E34B0' },
  clima:      { id: 'clima',      name: 'Clima',         color: '#1BA5B8', soft: '#CDEEF2', deep: '#0F7E8E' },
  neuro:      { id: 'neuro',      name: 'Neurociencia',  color: '#8B4FE0', soft: '#E8DCF9', deep: '#6A2FC0' },
  espacio:    { id: 'espacio',    name: 'Espacio',       color: '#F5B638', soft: '#FDEEC8', deep: '#C48A1A' },
  fisica:     { id: 'fisica',     name: 'Física',        color: '#F2542D', soft: '#FDE4DA', deep: '#C73F1D' },
  biologia:   { id: 'biologia',   name: 'Biología',      color: '#2E8B57', soft: '#D6EEDE', deep: '#1F6B3F' },
  medicina:   { id: 'medicina',   name: 'Medicina',      color: '#E03E8C', soft: '#FADCEA', deep: '#B32168' },
  energia:    { id: 'energia',    name: 'Energía',       color: '#E8572C', soft: '#FBE0D3', deep: '#B8401A' },
  materiales: { id: 'materiales', name: 'Materiales',    color: '#0E1116', soft: '#DADCE0', deep: '#2A2F38' },
  matematica: { id: 'matematica', name: 'Matemática',    color: '#3D6AE0', soft: '#D9E3FB', deep: '#254AB0' },
  psicologia: { id: 'psicologia', name: 'Psicología',    color: '#A35FD8', soft: '#ECDCF9', deep: '#7A3FB8' },
  ecologia:   { id: 'ecologia',   name: 'Ecología',      color: '#4FA068', soft: '#DFEEDF', deep: '#2F7040' },
  tecnologia: { id: 'tecnologia', name: 'Tecnología',    color: '#D89A2C', soft: '#F6E7C7', deep: '#A87818' },
  quimica:    { id: 'quimica',    name: 'Química',       color: '#E06AA8', soft: '#F9DCE8', deep: '#B34378' },
  ciencia:    { id: 'ciencia',    name: 'Ciencia',       color: '#5B6472', soft: '#E3E6EB', deep: '#3F4752' },
};

// Colores base (mismos tokens que el design system)
const INK = '#0E1116';
const PAPER = '#F4EEE1';
const ORANGE = '#F2542D';
const BLUE_MARK = '#2E4BE0';
const YELLOW_SUN = '#F5B638';

// ─────────────────────────────────────────────────────────────────────────
// Mark (logo de Paperverse) — SVG inline que Satori puede renderizar
// ─────────────────────────────────────────────────────────────────────────

/**
 * Dibuja el mark como SVG inline a `size` px. Reutilizamos la geometría
 * exacta de public/assets/logo-mark.svg — órbitas rotadas, núcleo ink,
 * sol amarillo. Satori rendera SVG nativo en el subset básico (circle,
 * ellipse, transform simple), y este mark está diseñado justamente para
 * caer dentro de ese subset.
 */
function Mark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Fondo paper + borde ink */}
      <circle cx={48} cy={48} r={44} fill={PAPER} />
      <circle cx={48} cy={48} r={44} fill="none" stroke={INK} strokeWidth={2.5} />
      {/* Órbita azul */}
      <ellipse cx={48} cy={48} rx={42} ry={15} fill="none" stroke={BLUE_MARK} strokeWidth={2.5} transform="rotate(-22 48 48)" />
      {/* Órbita naranja punteada (70% opacity) */}
      <ellipse cx={48} cy={48} rx={42} ry={15} fill="none" stroke={ORANGE} strokeWidth={2} strokeDasharray="2 6" transform="rotate(28 48 48)" opacity={0.7} />
      {/* Núcleo ink */}
      <circle cx={48} cy={48} r={7} fill={INK} />
      {/* Sol amarillo */}
      <circle cx={48} cy={48} r={3} fill={YELLOW_SUN} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────

export default async function handler(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawTitle = searchParams.get('title') ?? 'Paperverse';
    const topicId = (searchParams.get('topic') ?? 'ciencia').toLowerCase();
    const topic = TOPICS[topicId] ?? TOPICS.ciencia;

    // Límite de caracteres: si el título es muy largo, Satori lo apila en
    // muchas líneas y chocan con el footer. Cortamos a 180 y confiamos en
    // que el middleware ya truncó con elipsis si venía más largo.
    const title = rawTitle.length > 200 ? rawTitle.slice(0, 199) + '…' : rawTitle;

    // Cargamos Fraunces desde /public/fonts. Es el archivo variable completo
    // (4 ejes: opsz, wght, SOFT, WONK) — Satori desde v0.10+ renderiza
    // variable fonts usando los valores por default de cada eje. Para
    // Fraunces eso es opsz=9 y wght=400, que es exactamente lo que el
    // browser usa para renderizar el wordmark (match con el sitio).
    //
    // Si en el futuro necesitamos otro weight/opsz, conviene subsetear a
    // una instancia estática con fonttools o pedir a Google Fonts un
    // static compilado. Por ahora default = coherente con el browser.
    const fontUrl = new URL('/fonts/Fraunces.ttf', request.url);
    const fontData = await fetch(fontUrl).then(r => {
      if (!r.ok) throw new Error(`font fetch ${r.status}`);
      return r.arrayBuffer();
    });

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: topic.soft,
            // Padding generoso — queremos mucho aire alrededor del texto
            // para que se sienta editorial. 80px es ~6.7% del ancho, coherente
            // con márgenes del design system.
            padding: '80px',
            fontFamily: 'Fraunces',
            position: 'relative',
          }}
        >
          {/* Eyebrow — nombre del tópico en deep color, all caps, pequeño.
              Funciona como metadato "esto es un paper de X" antes del título. */}
          <div
            style={{
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: topic.deep,
              marginBottom: 32,
            }}
          >
            {topic.name}
          </div>

          {/* Título del paper — grande, INK, sentence-case. Es el gancho
              principal del preview. Ajustamos font-size según la longitud
              aproximada del título para evitar que títulos largos se corten
              o queden diminutos. */}
          <div
            style={{
              fontSize: fontSizeForTitle(title.length),
              fontWeight: 400,
              lineHeight: 1.1,
              color: INK,
              // flex:1 para que el título ocupe todo el espacio vertical
              // disponible; el footer va pegado abajo.
              flex: 1,
              // `display: -webkit-box` + line-clamp no está soportado en
              // Satori — en vez confiamos en el line-height y truncamos
              // por tamaño de fuente dinámico.
              display: 'flex',
              alignItems: 'flex-start',
              maxHeight: 380,
              overflow: 'hidden',
            }}
          >
            {title}
          </div>

          {/* Footer: mark + wordmark "Paperverse." — pequeño, ink.
              Es nuestra firma consistente para que el usuario reconozca la
              fuente del link aunque el resto del diseño varíe por tema. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginTop: 40,
            }}
          >
            <Mark size={56} />
            <div
              style={{
                fontSize: 40,
                fontWeight: 400,
                color: INK,
                display: 'flex',
                alignItems: 'baseline',
              }}
            >
              Paperverse
              <span style={{ color: ORANGE }}>.</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: 'Fraunces',
            data: fontData,
            style: 'normal',
            weight: 400,
          },
        ],
        headers: {
          // Cache idéntico al del middleware — imagen + HTML comparten TTL
          // para que nunca se desincronicen.
          'cache-control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (err) {
    // Si falla la generación (font 404, Satori roto, etc.) devolvemos 500
    // con el mensaje. El middleware ya apunta el og:image a esta URL, así
    // que un error acá significa que los crawlers van a ver el preview
    // sin imagen. No ideal pero no bloquea el resto del preview (título y
    // descripción siguen válidos).
    const message = err instanceof Error ? err.message : 'unknown error';
    return new Response(`og error: ${message}`, { status: 500 });
  }
}

/**
 * Decide font-size basado en la longitud aproximada del título.
 * Títulos científicos varían mucho: desde "ChatGPT" (7 chars) hasta
 * cosas de 160 chars. Ajustamos para que ocupen ~70-85% del ancho útil
 * sin cortarse.
 *
 * Valores calibrados empíricamente contra Satori rendering de Fraunces:
 *   - < 40 chars:  96pt  (títulos cortos impactantes)
 *   - < 80 chars:  80pt  (títulos medios, el caso más común)
 *   - < 120 chars: 64pt  (títulos largos)
 *   - 120+ chars:  52pt  (extra largos, raros pero existen)
 */
function fontSizeForTitle(len: number): number {
  if (len < 40) return 96;
  if (len < 80) return 80;
  if (len < 120) return 64;
  return 52;
}
