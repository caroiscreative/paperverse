// Bloque placeholder que ocupa el espacio del título/lede mientras Pollinations
// todavía no devolvió la traducción.
//
// Por qué existe (Ataque 3, ): antes, mientras la traducción estaba
// en vuelo, la card mostraba el título ORIGINAL en idioma foráneo (francés,
// portugués, malayo, chino…) y después swappeaba al español cuando llegaba la
// respuesta. Ese flash era feo — especialmente en idiomas que usuario no lee.
// La promesa editorial de Paperverse es "todo en español al scrollear", así
// que preferimos mostrar nada (un bloque gris neutro) antes que texto ilegible
// por 1–2 segundos.
//
// Decisión de estilo:
// · Mismo look que los skeletons grandes del LoadingState del Feed: fill
// `var(--bg-sunken)`, borderRadius 2, sin animación shimmer. En Paperverse
// los estados transicionan instant-snap (ver memory/feedback_toggle_animations.md)
// y un shimmer barriendo sería ruido extra de movimiento.
// · Altura matchea la line-height real del título/lede al que reemplaza,
// así el swap de skeleton → texto real no "salta" el layout.

import type { CSSProperties } from 'react';

interface Props {
  /**
   * Alto del bloque en px. Debe matchear el line-height del texto al que
   * reemplaza. Title card: ~22px. Lede card: ~18px. Title hero: ~40px.
   */
  height: number;
  /** Ancho como porcentaje o "100%". Default 90%. */
  width?: string;
  /** Margin bottom en px — útil para espaciar varias líneas apiladas. */
  marginBottom?: number;
  /** Estilos extra (p.ej. marginTop). */
  style?: CSSProperties;
}

export function SkeletonLine({ height, width = '90%', marginBottom = 0, style }: Props) {
  return (
    <div
      aria-hidden="true"
      style={{
        height,
        width,
        background: 'var(--bg-sunken)',
        borderRadius: 2,
        marginBottom,
        ...style,
      }}
    />
  );
}

/**
 * Stack de 2 líneas para el título del feed. Altura y ancho matchean la
 * tipografía de `.paper-card h3.title` / `.paper-card-tile h3.title`. Dos
 * líneas son suficientes: los títulos editoriales de Paperverse están topeados
 * en 90 chars (~50–70 óptimos) y rara vez superan 2 líneas.
 */
export function TitleSkeleton() {
  return (
    <div aria-label="Cargando traducción…" role="status" style={{ marginTop: 4 }}>
      <SkeletonLine height={20} width="92%" marginBottom={6} />
      <SkeletonLine height={20} width="68%" />
    </div>
  );
}

/**
 * Stack de 2 líneas para el lede. Más finito que el título — el lede usa
 * `.lede` (fg-2, peso regular, ~15px).
 */
export function LedeSkeleton() {
  return (
    <div aria-hidden="true" style={{ marginTop: 10 }}>
      <SkeletonLine height={13} width="95%" marginBottom={6} />
      <SkeletonLine height={13} width="80%" />
    </div>
  );
}

/**
 * Variante hero — título grande (h1). Se usa en HeroPaperCard donde la
 * tipografía es mucho mayor (display serif ~32–36px).
 */
export function HeroTitleSkeleton() {
  return (
    <div aria-label="Cargando traducción…" role="status" style={{ marginTop: 4 }}>
      <SkeletonLine height={34} width="90%" marginBottom={8} />
      <SkeletonLine height={34} width="65%" />
    </div>
  );
}

export function HeroLedeSkeleton() {
  return (
    <div aria-hidden="true" style={{ marginTop: 14 }}>
      <SkeletonLine height={16} width="96%" marginBottom={7} />
      <SkeletonLine height={16} width="82%" />
    </div>
  );
}
