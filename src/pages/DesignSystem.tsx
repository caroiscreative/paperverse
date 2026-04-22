// Design System — página standalone que muestra los pilares visuales del proyecto:
// las 3 tipografías, la paleta base (crema/tinta/cobalto/noche) y los 14 temas
// con sus tres superficies (chip, ilustración 300px, animación del hero).
//
// La razón de existir de esta página: cada tema vive en TRES lugares distintos
// (topics.ts → chip + ilustración; topic-anim.js → animación del hero). Si un
// hex diverge entre los archivos, el tema se ve roto. Esta vista es la verificación
// visual permanente de esa regla — si las dos visuales de un tema lucen distintas,
// algo se rompió.
//
// Se entra desde /manifiesto vía un link al pie del bloque "Design" del colophon,
// y se navega de vuelta con el back. Comparte shell con PaperDetail/Manifiesto
// (.detail-wrap a 760px, header narrow sin buscador) — antes era 1080 con grid
// de 3 cols pero rompía el patrón editorial del resto del app.

import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { TOPICS } from '../lib/topics';
import { TopicBanner } from '../components/TopicBanner';
import { useDocumentTitle } from '../lib/useDocumentTitle';

/**
 * Elige color de texto sobre un fondo dado. Usamos luminancia rápida (sRGB,
 * sin gamma para no complicar) — los swatches son tres por tema, basta con
 * decidir entre tinta/crema. Threshold 0.55 funciona bien para los 14 hues
 * porque ningún color de la paleta cae justo en la zona ambigua.
 */
function textOn(bg: string): string {
  const n = parseInt(bg.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? '#0E1116' : '#FAF5EC';
}

const sectionStyle: React.CSSProperties = { marginTop: 72 };
const sectionNumStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--fg-3)',
  marginBottom: 6,
};
const sectionH2Style: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 36,
  lineHeight: 1.1,
  letterSpacing: '-0.015em',
  margin: '0 0 10px 0',
  fontWeight: 400,
};
const sectionLeadStyle: React.CSSProperties = {
  fontSize: 15,
  color: 'var(--fg-2)',
  maxWidth: 640,
  margin: '0 0 28px 0',
};

/** Label mono que se posa arriba-izquierda en las celdas de ilus/animación. */
const labelOnCell: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  left: 8,
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--fg-3)',
  background: 'rgba(250,245,236,0.82)',
  padding: '3px 6px',
  borderRadius: 3,
  backdropFilter: 'blur(4px)',
  pointerEvents: 'none',
};

export function DesignSystem() {
  const nav = useNavigate();
  // tab title "Design system — Paperverse".
  useDocumentTitle('Design system');

  return (
    // Usa el shell editorial estándar (760px) — mismo patrón que PaperDetail
    // y Manifiesto. Header se muestra en variante "narrow" sin buscador.
    <div className="detail-wrap">
      <button type="button" onClick={() => nav(-1)} className="back">
        <Icon name="arrow-left" size={13} /> Volver
      </button>

      <span className="eyebrow" style={{ color: 'var(--fg-3)' }}>
        Sistema de diseño
      </span>

      <h1 style={{ maxWidth: 820 }}>
        La ciencia real, <em style={{ color: 'var(--pv-cobalto)' }}>para curiosos reales.</em>
      </h1>

      <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--fg-2)', maxWidth: 640, margin: 0 }}>
        Una paleta pequeña, una tipografía editorial, y catorce temas con
        identidad propia. Tres superficies por tema —chip, ilustración,
        animación— hablan el mismo color.
      </p>

      {/* ============================================================
          01 / Tipografía
          ============================================================ */}
      <section style={sectionStyle}>
        <div style={sectionNumStyle}>01 / Tipografía</div>
        <h2 style={sectionH2Style}>Tres tipos, tres funciones.</h2>
        <p style={sectionLeadStyle}>
          <strong>Instrument Serif</strong> para titular como editorial.{' '}
          <strong>Inter</strong> para leer sin fricción.{' '}
          <strong>JetBrains Mono</strong> para lo técnico: DOIs, números,
          etiquetas y rótulos.
        </p>

        <TypeRow label="Instrument Serif" subtitle="Display · editorial">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 42, lineHeight: 1.1, letterSpacing: '-0.015em' }}>
            La ciencia real,{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--pv-cobalto)' }}>
              para curiosos reales.
            </em>
          </span>
        </TypeRow>

        <TypeRow label="Inter" subtitle="Sans · body + UI">
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--fg-2)' }}>
            Un buscador editorial de papers científicos que pesa dos megabytes,
            corre en tu navegador y vive en tu biblioteca local.
          </span>
        </TypeRow>

        <TypeRow label="JetBrains Mono" subtitle="Mono · metadata">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.04em' }}>
            DOI 10.1038/s41586-024-07123-2 · Citado 1,204 veces · ES · OpenAlex
          </span>
        </TypeRow>
      </section>

      {/* ============================================================
          02 / Paleta base — claro + oscuro, todos los grises
          ============================================================
          Antes esta sección mostraba 8 swatches mezclando light y dark en
          una sola grilla. se pidió separarlos y
          completar la paleta: agregar el ink-faint (#8A91A0) que faltaba,
          las variantes noche (soft/deep) que solo vivían en el CSS, y
          los grises dark-mode (#F4F1E8 → #5F5C52) que se activan cuando
          .pv-dark está presente. Los swatches dark se renderizan con hex
          hardcodeado porque queremos verlos siempre, sin depender del
          tema activo del usuario. */}
      <section style={sectionStyle}>
        <div style={sectionNumStyle}>02 / Paleta</div>
        <h2 style={sectionH2Style}>Crema y tinta de día, noche y cobalto de noche.</h2>
        <p style={sectionLeadStyle}>
          El fondo es crema cálida, no blanco. El texto es tinta con
          subtono azul, no negro puro. El acento es{' '}
          <strong>cobalto</strong>: el azul científico de la app. En modo
          oscuro todo se invierte sobre un azul profundo (noche), con
          crema desaturada para el texto y un cobalto más luminoso para
          que el acento se siga leyendo.
        </p>

        {/* ----- Modo claro ----- */}
        <PaletteGroup label="Modo claro">
          <Swatch bg="#FAF5EC" name="Crema" hex="#FAF5EC" use="Fondo canvas" />
          <Swatch bg="#FDFAF2" name="Crema soft" hex="#FDFAF2" use="Superficies elevadas" />
          <Swatch bg="#F2EADB" name="Crema deep" hex="#F2EADB" use="Divisores, hundidos" />
          <Swatch bg="#0E1116" name="Tinta" hex="#0E1116" use="Texto primario · fg-1" />
          <Swatch bg="#2A2F3A" name="Tinta soft" hex="#2A2F3A" use="Texto secundario · fg-2" />
          <Swatch bg="#5A6170" name="Tinta mute" hex="#5A6170" use="Meta, rótulos · fg-3" />
          <Swatch bg="#8A91A0" name="Tinta faint" hex="#8A91A0" use="Deshabilitado, placeholder · fg-4" />
          <Swatch bg="#2E4BE0" name="Cobalto" hex="#2E4BE0" use="Acento hero, links, primary" />
          <Swatch bg="#1E34B0" name="Cobalto deep" hex="#1E34B0" use="Hover del primary" />
          <Swatch bg="#E0E6FF" name="Cobalto soft" hex="#E0E6FF" use="Chips, backgrounds de énfasis" />
        </PaletteGroup>

        {/* ----- Modo oscuro ----- */}
        <PaletteGroup label="Modo oscuro">
          <Swatch bg="#0B1020" name="Noche" hex="#0B1020" use="Fondo canvas" />
          <Swatch bg="#141A2E" name="Noche soft" hex="#141A2E" use="Superficies elevadas" />
          <Swatch bg="#070B18" name="Noche deep" hex="#070B18" use="Divisores, hundidos" />
          <Swatch bg="#F4F1E8" name="Crema dark" hex="#F4F1E8" use="Texto primario · fg-1" />
          <Swatch bg="#C7C2B0" name="Gris 2" hex="#C7C2B0" use="Texto secundario · fg-2" />
          <Swatch bg="#8C8878" name="Gris 3" hex="#8C8878" use="Meta, rótulos · fg-3" />
          <Swatch bg="#5F5C52" name="Gris 4" hex="#5F5C52" use="Deshabilitado, placeholder · fg-4" />
          <Swatch bg="#6D8AFF" name="Cobalto dark" hex="#6D8AFF" use="Acento en dark mode" />
          <Swatch bg="#1A2250" name="Cobalto soft dark" hex="#1A2250" use="Chips, backgrounds en dark" />
        </PaletteGroup>
      </section>

      {/* ============================================================
          03 / Colores de tema — acentos editoriales del sistema
          ============================================================
          Estos seis colores son la base cromática de los 14 temas
          editoriales de Paperverse. Cada uno tiene tres variantes
          (soft/color/deep) en modo claro, y una versión re-balanceada
          en modo oscuro con soft más profundo (para dark chips) y
          color más luminoso (para que siga leyendo sobre noche).
          Se usan como acentos en ilustraciones, chips de tema,
          animaciones del hero y categorías del feed — NUNCA como
          fondos de página ni texto primario. */}
      <section style={sectionStyle}>
        <div style={sectionNumStyle}>03 / Colores de tema</div>
        <h2 style={sectionH2Style}>Seis acentos que dan identidad.</h2>
        <p style={sectionLeadStyle}>
          Magma para lo caliente y físico. Sol para lo espacial.
          Clorofila para lo vivo. Sinapsis para la mente.
          Océano para el clima y el agua. Rosa para la salud.
          Cada uno tiene una variante suave, una media y una profunda:
          la suave para chips y fondos, la media para el acento fuerte,
          la profunda para estados activos o hover.
        </p>

        {/* ----- Modo claro ----- */}
        <PaletteGroup label="Modo claro">
          <AccentTrio name="Magma" use="Física · Energía" soft="#FDE4DA" color="#F2542D" deep="#C73F1D" />
          <AccentTrio name="Sol" use="Espacio · Astronomía" soft="#FDEEC8" color="#F5B638" deep="#C48A1A" />
          <AccentTrio name="Clorofila" use="Biología · Ecología" soft="#D6EEDE" color="#2E8B57" deep="#1F6B3F" />
          <AccentTrio name="Sinapsis" use="Neurociencia · Psicología" soft="#E8DCF9" color="#8B4FE0" deep="#6A2FC0" />
          <AccentTrio name="Océano" use="Clima · Oceanografía" soft="#CDEEF2" color="#1BA5B8" deep="#0F7E8E" />
          <AccentTrio name="Rosa" use="Medicina · Salud" soft="#FADCEA" color="#E03E8C" deep="#B32168" />
        </PaletteGroup>

        {/* ----- Modo oscuro ----- */}
        {/* En dark mode el -soft pasa a ser un tono profundo (chip bg sobre
            noche) y el color base sube en luminosidad para mantener
            contraste. El -deep del light mode no se usa en dark; el
            "color" dark ya es lo suficientemente luminoso como acento. */}
        <PaletteGroup label="Modo oscuro">
          <AccentTrioDark name="Magma" soft="#3A1A12" color="#FF8360" />
          <AccentTrioDark name="Sol" soft="#3A2810" color="#FFD066" />
          <AccentTrioDark name="Clorofila" soft="#12341F" color="#5FC88A" />
          <AccentTrioDark name="Sinapsis" soft="#2A1548" color="#B68CFF" />
          <AccentTrioDark name="Océano" soft="#0E3338" color="#5DD6E4" />
          <AccentTrioDark name="Rosa" soft="#3A112A" color="#FF7AB4" />
        </PaletteGroup>
      </section>

      {/* ============================================================
          04 / Tokens semánticos — significado antes que tema
          ============================================================
          Estos tokens remapean a colores de tema pero su USO es
          semántico, no editorial: success=clorofila porque "verde
          significa hecho", no porque sea biología. El estado "leído"
          del paper usa --pv-success, aunque visualmente coincida con
          el tema Biología. Si mañana cambiamos clorofila por otro
          verde, success lo sigue automáticamente. */}
      <section style={sectionStyle}>
        <div style={sectionNumStyle}>04 / Tokens semánticos</div>
        <h2 style={sectionH2Style}>Cuatro estados, un lenguaje.</h2>
        <p style={sectionLeadStyle}>
          Los tokens semánticos son alias con significado. Separan la
          intención (éxito, advertencia, peligro, información) del color
          concreto que los representa hoy. Así, "leído" siempre se pinta
          con <code>--pv-success</code>, aunque el verde cambie un día:
          el significado no se mueve.
        </p>

        <PaletteGroup label="Estados">
          <SemanticSwatch name="Success" token="--pv-success" alias="→ clorofila" hex="#2E8B57" use="Leído, completado, validado" />
          <SemanticSwatch name="Warning" token="--pv-warning" alias="→ sol" hex="#F5B638" use="Advertencia, precaución" />
          <SemanticSwatch name="Danger" token="--pv-danger" alias="→ magma" hex="#F2542D" use="Error, destructivo, borrar" />
          <SemanticSwatch name="Info" token="--pv-info" alias="→ cobalto" hex="#2E4BE0" use="Link, pista, ayuda contextual" />
        </PaletteGroup>
      </section>

      {/* ============================================================
          05 / Temas — las dos superficies visuales
          ============================================================ */}
      <section style={sectionStyle}>
        <div style={sectionNumStyle}>05 / Temas</div>
        <h2 style={sectionH2Style}>Catorce temas, un color cada uno.</h2>
        <p style={sectionLeadStyle}>
          Cada tema vive en tres superficies: el <strong>chip</strong> del
          selector, la <strong>ilustración 300px</strong> que corona la
          lectura, y la <strong>animación</strong> del hero del feed. Las
          tres tienen que decir el mismo color. Si divergen, el tema se rompe.
        </p>

        {/* Filas verticales: header (chip + nombre + paleta) arriba, pareja
            visual (ilustración + animación) en 2 columnas abajo. El layout
            editorial a 760 no soporta 3 columnas horizontales sin apretar. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {TOPICS.map(t => (
            <article
              key={t.id}
              style={{
                background: 'var(--bg-surface, #FDFAF2)',
                border: '1px solid var(--border-1)',
                borderRadius: 6,
                padding: 16,
              }}
            >
              {/* Header: chip icon + nombre + paleta (soft / color / deep) */}
              <header
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  flexWrap: 'wrap',
                  marginBottom: 14,
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: t.soft,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: t.color,
                      display: 'block',
                    }}
                  />
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 22,
                    fontWeight: 400,
                    letterSpacing: '-0.01em',
                    marginRight: 'auto',
                  }}
                >
                  {t.name}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['soft', 'color', 'deep'] as const).map(k => {
                    const hex = t[k];
                    return (
                      <span
                        key={k}
                        style={{
                          minWidth: 78,
                          height: 26,
                          padding: '0 8px',
                          borderRadius: 4,
                          background: hex,
                          color: textOn(hex),
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid rgba(14,17,22,0.05)',
                        }}
                      >
                        {hex}
                      </span>
                    );
                  })}
                </div>
              </header>

              {/* Pareja visual: ilustración 300 + animación en 2 columnas.
                  A 760 queda ~348px por lado después de padding y gap. */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                }}
              >
                {/* Ilustración 300px — object-fit contain para no cropear */}
                <figure
                  style={{
                    margin: 0,
                    height: 240,
                    borderRadius: 4,
                    overflow: 'hidden',
                    border: '1px solid var(--border-1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-surface, #FDFAF2)',
                    position: 'relative',
                  }}
                >
                  <img
                    src={`/assets/${t.illus}`}
                    alt={`${t.name} · ilustración 300px`}
                    loading="lazy"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                  <figcaption style={labelOnCell}>Ilustración · 300px</figcaption>
                </figure>

                {/* Animación — montada por TopicBanner (vanilla IIFE) */}
                <figure
                  style={{
                    margin: 0,
                    position: 'relative',
                    borderRadius: 4,
                    overflow: 'hidden',
                    height: 240,
                    border: '1px solid var(--border-1)',
                  }}
                >
                  <TopicBanner topicId={t.id} variant="desktop" />
                  <figcaption style={labelOnCell}>Animación · hero</figcaption>
                </figure>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ============================================================
          Crédito al pie — hecho con Claude Design
          ============================================================ */}
      <div
        style={{
          marginTop: 56,
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
        <span>Sistema de diseño · Paperverse</span>
        <span style={{ color: 'var(--fg-4)', opacity: 0.5 }}>·</span>
        <span>
          Hecho con{' '}
          <a
            href="https://claude.com"
            target="_blank"
            rel="noreferrer"
            style={{
              color: 'var(--fg-3)',
              textDecoration: 'none',
              borderBottom: '1px solid var(--border-2, rgba(14,17,22,0.2))',
              paddingBottom: 1,
            }}
          >
            Claude
          </a>
        </span>
      </div>
    </div>
  );
}

/* ===== helpers locales ===== */

function TypeRow({
  label,
  subtitle,
  children,
}: {
  label: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        gap: 18,
        padding: '22px 0',
        borderTop: '1px solid var(--border-1)',
        alignItems: 'baseline',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--fg-3)',
        }}
      >
        {label}
        <small
          style={{
            display: 'block',
            marginTop: 4,
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--fg-4)',
            textTransform: 'none',
          }}
        >
          {subtitle}
        </small>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Swatch({
  bg,
  name,
  hex,
  use,
}: {
  bg: string;
  name: string;
  hex: string;
  use: string;
}) {
  // Para los swatches oscuros (Tinta, Cobalto, Noche) la zona meta debajo
  // del chip queda en el color oscuro y el texto pasa a crema. Así no
  // tenemos un bloque blanco sobre tinta que rompe el ritmo visual.
  const isDark = textOn(bg) === '#FAF5EC';
  return (
    <div
      style={{
        border: '1px solid var(--border-1)',
        borderRadius: 4,
        overflow: 'hidden',
        background: isDark ? bg : 'var(--bg-surface, #FDFAF2)',
        color: isDark ? '#FAF5EC' : 'inherit',
      }}
    >
      <div
        style={{
          height: 104,
          background: bg,
          borderBottom: '1px solid rgba(14,17,22,0.06)',
        }}
      />
      <div
        style={{
          padding: '10px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: isDark ? '#FAF5EC' : 'var(--fg-1)',
          }}
        >
          {name}
        </span>{' '}
        ·{' '}
        <span style={{ color: isDark ? 'rgba(250,245,236,0.7)' : 'var(--fg-3)' }}>
          {hex}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 4,
            color: isDark ? 'rgba(250,245,236,0.6)' : 'var(--fg-4)',
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            letterSpacing: 0,
            textTransform: 'none',
          }}
        >
          {use}
        </span>
      </div>
    </div>
  );
}

/**
 * Agrupa swatches bajo un label tipo "Modo claro" / "Modo oscuro". Mantiene el
 * mismo ritmo tipográfico que labels de otras secciones (mono 11px, uppercase,
 * letter-spacing amplio). Grilla auto-fit igual que la paleta original.
 */
function PaletteGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--fg-3)',
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Trío de variantes de un color de tema (soft / color / deep) en modo claro.
 * Las tres pinceladas viven en la misma fila visual: izquierda la suave (chip
 * background), centro el color base (acento fuerte), derecha la profunda
 * (hover/active). Debajo, mono con el nombre del tema y su uso editorial.
 */
function AccentTrio({
  name,
  use,
  soft,
  color,
  deep,
}: {
  name: string;
  use: string;
  soft: string;
  color: string;
  deep: string;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border-1)',
        borderRadius: 4,
        overflow: 'hidden',
        background: 'var(--bg-surface, #FDFAF2)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: 92 }}>
        <ChipCol bg={soft} hex={soft} label="soft" />
        <ChipCol bg={color} hex={color} label="color" />
        <ChipCol bg={deep} hex={deep} label="deep" />
      </div>
      <div
        style={{
          padding: '10px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--fg-1)',
          }}
        >
          {name}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 4,
            color: 'var(--fg-4)',
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            letterSpacing: 0,
            textTransform: 'none',
          }}
        >
          {use}
        </span>
      </div>
    </div>
  );
}

/**
 * Versión dark del AccentTrio. Solo dos columnas porque en dark mode no
 * existe -deep (no se usa, el color base ya es lo bastante luminoso). El
 * label del fondo se renderiza en cream porque la celda completa vive
 * sobre superficies oscuras simuladas.
 */
function AccentTrioDark({
  name,
  soft,
  color,
}: {
  name: string;
  soft: string;
  color: string;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border-1)',
        borderRadius: 4,
        overflow: 'hidden',
        background: '#0B1020',
        color: '#F4F1E8',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: 92 }}>
        <ChipCol bg={soft} hex={soft} label="soft (dark)" />
        <ChipCol bg={color} hex={color} label="color (dark)" />
      </div>
      <div
        style={{
          padding: '10px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#F4F1E8',
          }}
        >
          {name}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 4,
            color: 'rgba(244,241,232,0.6)',
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            letterSpacing: 0,
            textTransform: 'none',
          }}
        >
          Sobre noche profunda
        </span>
      </div>
    </div>
  );
}

/**
 * Una columna de un trío de tema: pinta el bloque de color y debajo
 * un label mono microscópico (soft/color/deep) + el hex en mono. El
 * texto se decide por luminancia con textOn() para que siempre lea.
 */
function ChipCol({ bg, hex, label }: { bg: string; hex: string; label: string }) {
  const fg = textOn(bg);
  return (
    <div
      style={{
        background: bg,
        color: fg,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 8,
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        borderRight: '1px solid rgba(14,17,22,0.05)',
      }}
    >
      <span style={{ opacity: 0.75 }}>{label}</span>
      <span>{hex}</span>
    </div>
  );
}

/**
 * Swatch para tokens semánticos — incluye el alias de mapeo
 * (ej. "→ clorofila") para dejar explícito que el token semántico
 * apunta a un color del sistema, no es un valor independiente.
 */
function SemanticSwatch({
  name,
  token,
  alias,
  hex,
  use,
}: {
  name: string;
  token: string;
  alias: string;
  hex: string;
  use: string;
}) {
  const fg = textOn(hex);
  return (
    <div
      style={{
        border: '1px solid var(--border-1)',
        borderRadius: 4,
        overflow: 'hidden',
        background: 'var(--bg-surface, #FDFAF2)',
      }}
    >
      <div
        style={{
          height: 92,
          background: hex,
          color: fg,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ opacity: 0.85 }}>{token}</span>
        <span>{hex}</span>
      </div>
      <div
        style={{
          padding: '10px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--fg-1)',
          }}
        >
          {name}
        </span>{' '}
        ·{' '}
        <span style={{ color: 'var(--fg-3)' }}>{alias}</span>
        <span
          style={{
            display: 'block',
            marginTop: 4,
            color: 'var(--fg-4)',
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            letterSpacing: 0,
            textTransform: 'none',
          }}
        >
          {use}
        </span>
      </div>
    </div>
  );
}

