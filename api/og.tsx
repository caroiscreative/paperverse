/**
 * /api/og — Dynamic per-paper OG image
 * ======================================
 *
 * Vercel Edge Function that returns a 1200×630 PNG rendered with
 * @vercel/og (Satori under the hood). Called by middleware.ts so every
 * paper preview gets a unique image: topic palette as background,
 * translated paper title, and the Paperverse wordmark in the footer.
 *
 * Querystring:
 *   title  — paper title in Spanish (max 180 chars, truncated by the
 *            middleware). Renders as the large body text.
 *   topic  — topicId (e.g. "ia", "clima", "neuro"). Determines the
 *            background palette and eyebrow. If invalid or missing,
 *            falls back to "ciencia".
 *
 * Output:
 *   1200×630 PNG, content-type image/png, cache 24h at the edge + 7d SWR.
 *
 * Satori note
 * -----------
 * Satori supports a VERY limited CSS subset: flexbox, position, colors,
 * borders, fonts, basic shadows. It does NOT support:
 *   - grid layout
 *   - @media queries
 *   - CSS custom properties (var())
 *   - external CSS classes (everything inline)
 *   - 3D transforms
 * That's why all styling here uses inline `style` objects.
 *
 * The logo mark is inline SVG because Satori renders SVG (basic subset).
 * Geometry is copied from public/assets/logo-mark.svg.
 */

import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

// ─────────────────────────────────────────────────────────────────────────
// Palette (mirror of src/lib/topics.ts — if colors change there, update
// here too; middleware.ts has the same copy)
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

// Base tokens (same as the design system)
const INK = '#0E1116';
const PAPER = '#F4EEE1';
const ORANGE = '#F2542D';
const BLUE_MARK = '#2E4BE0';
const YELLOW_SUN = '#F5B638';

// ─────────────────────────────────────────────────────────────────────────
// Mark (Paperverse logo) — inline SVG that Satori can render
// ─────────────────────────────────────────────────────────────────────────

/**
 * Draws the mark as inline SVG at `size` px. Reuses the exact geometry
 * of public/assets/logo-mark.svg — rotated orbits, ink nucleus, yellow
 * sun. Satori renders SVG in its basic subset (circle, ellipse, simple
 * transform), and this mark was designed to fall within that subset.
 */
function Mark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Paper fill + ink border */}
      <circle cx={48} cy={48} r={44} fill={PAPER} />
      <circle cx={48} cy={48} r={44} fill="none" stroke={INK} strokeWidth={2.5} />
      {/* Blue orbit */}
      <ellipse cx={48} cy={48} rx={42} ry={15} fill="none" stroke={BLUE_MARK} strokeWidth={2.5} transform="rotate(-22 48 48)" />
      {/* Dashed orange orbit (70% opacity) */}
      <ellipse cx={48} cy={48} rx={42} ry={15} fill="none" stroke={ORANGE} strokeWidth={2} strokeDasharray="2 6" transform="rotate(28 48 48)" opacity={0.7} />
      {/* Ink nucleus */}
      <circle cx={48} cy={48} r={7} fill={INK} />
      {/* Yellow sun */}
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

    // Char limit: if the title is too long, Satori stacks it across many
    // lines and collides with the footer. Cap at 200 and trust the
    // middleware already truncated with ellipsis if longer.
    const title = rawTitle.length > 200 ? rawTitle.slice(0, 199) + '…' : rawTitle;

    // Load Fraunces from /public/fonts. This is the full variable font
    // (4 axes: opsz, wght, SOFT, WONK) — Satori since v0.10+ renders
    // variable fonts using each axis default. For Fraunces that's
    // opsz=9 and wght=400, exactly what the browser uses for the
    // wordmark (matches the site).
    //
    // If we ever need a different weight/opsz, we should subset to a
    // static instance with fonttools or request a Google Fonts static.
    // For now: default = coherent with browser render.
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
            // Generous padding — we want plenty of air around the text
            // so it reads editorial. 80px ≈ 6.7% of width, coherent
            // with design system margins.
            padding: '80px',
            fontFamily: 'Fraunces',
            position: 'relative',
          }}
        >
          {/* Eyebrow — topic name in deep color, all caps, small.
              Functions as metadata: "this is a paper about X" before
              the title. */}
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

          {/* Paper title — large, INK, sentence case. This is the
              main hook. Font size adjusts with length so long titles
              don't get cut off or become tiny. */}
          <div
            style={{
              fontSize: fontSizeForTitle(title.length),
              fontWeight: 400,
              lineHeight: 1.1,
              color: INK,
              // flex:1 so the title fills remaining vertical space;
              // the footer sticks to the bottom.
              flex: 1,
              // `display: -webkit-box` + line-clamp isn't supported in
              // Satori — we rely on line-height + dynamic font size
              // instead.
              display: 'flex',
              alignItems: 'flex-start',
              maxHeight: 380,
              overflow: 'hidden',
            }}
          >
            {title}
          </div>

          {/* Footer: mark + "Paperverse." wordmark — small, ink.
              Consistent signature so users recognize the link source
              across varying topic palettes. */}
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
          // Same cache as the middleware — image + HTML share TTL so
          // they never desync.
          'cache-control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (err) {
    // If rendering fails (font 404, Satori broken, etc.) return 500
    // with the message. The middleware already points og:image here,
    // so an error means the crawler will see a preview without image.
    // Not ideal but doesn't block title + description.
    const message = err instanceof Error ? err.message : 'unknown error';
    return new Response(`og error: ${message}`, { status: 500 });
  }
}

/**
 * Pick font-size based on approximate title length. Scientific titles
 * vary a lot: from "ChatGPT" (7 chars) to 160-char monsters. We tune
 * so titles fill ~70-85% of the usable width without overflowing.
 *
 * Values tuned empirically against Satori rendering of Fraunces:
 *   - < 40 chars:  96pt  (short punchy titles)
 *   - < 80 chars:  80pt  (medium titles, the common case)
 *   - < 120 chars: 64pt  (long titles)
 *   - 120+ chars:  52pt  (extra long, rare but exist)
 */
function fontSizeForTitle(len: number): number {
  if (len < 40) return 96;
  if (len < 80) return 80;
  if (len < 120) return 64;
  return 52;
}
