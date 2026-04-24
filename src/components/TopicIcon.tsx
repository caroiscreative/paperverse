import type { TopicId } from '../lib/topics';

interface Props {
  topicId: TopicId | null;
  color?: string;
  size?: number;
}

/**
 * Topic glyph — 1 SVG por tema, renderizado en chip y places donde haga
 * falta la bandera visual del tema.
 *
 * Pase de normalización 2026-04-23 (Carolina): cada ícono pinta dentro de
 * una CAJA DE CONTENIDO 3-21 (20×20 útil centrada en el viewBox 24×24, ~12%
 * de padding). Antes cada uno pintaba en una zona distinta — desde un
 * círculo minúsculo r=4 (8/24 = 33% del cuadro) hasta elipses rx=10 que
 * llegaban a los bordes (83%). A 16px eso se traducía en glifos con
 * "peso visual" radicalmente distinto aunque el contenedor fuera igual.
 *
 * Con la caja 3-21:
 *   · Todos los íconos ocupan aproximadamente la misma masa visual.
 *   · Stroke unificado a 1.75 para que filled y outline tengan peso similar.
 *   · Filled icons (bolt, cross, book páginas, brain) usan áreas equivalentes
 *     al bounding box de los outline para que no se sientan más "gordos".
 *
 * Default size es 16px — matchea el CSS (.topic-chip .tico svg) que fuerza
 * 16 en el chip. El prop `size` sigue disponible por si algún día
 * renderizamos el ícono fuera del chip (p.ej. breadcrumbs, tabs).
 */
export function TopicIcon({ topicId, color = '#0E1116', size = 16 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (topicId) {
    // IA — red de 3 nodos triangular. Nodos reagrandados (r=2.2) y líneas
    // un toque más gruesas para que la red no se disuelva a 16px.
    case 'ia':
      return (
        <svg {...common}>
          <circle cx="6" cy="8" r="2.2" />
          <circle cx="18" cy="8" r="2.2" />
          <circle cx="12" cy="18" r="2.2" />
          <path d="M8.2 8h7.6M7.2 9.8l3.6 6.8M16.8 9.8l-3.6 6.8" />
        </svg>
      );
    // Tecnología — microchip con pines. Reencuadrado dentro de 3-21 para que
    // los pines no toquen el borde del viewBox; ligero ensanche del cuadrado
    // interno para que sea visible a 16px.
    case 'tecnologia':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="1" />
          <rect x="9.5" y="9.5" width="5" height="5" />
          {/* Pines: arriba, abajo, izq, der — separación pareja */}
          <path d="M9 6V4M12 6V4M15 6V4M9 20v-2M12 20v-2M15 20v-2M4 9h2M4 12h2M4 15h2M20 9h-2M20 12h-2M20 15h-2" />
        </svg>
      );
    // Clima — nube re-centrada verticalmente. Antes sólo usaba y=10-18, se
    // veía chiquita en la parte baja del tile. Ahora la nube crece de y=6 a
    // y=18 (12 de alto, ~60% del viewbox) y cubre horizontalmente de x=3 a
    // x=21 — simétrica, peso equilibrado.
    case 'clima':
      return (
        <svg {...common}>
          <path d="M6 17a4 4 0 1 1 1.2-7.8A5.5 5.5 0 0 1 18 11.5a3.3 3.3 0 0 1 .4 6.5z" />
        </svg>
      );
    // Neurociencia — sinapsis. Reemplaza al
    // cerebro de 2 hemisferios que no dialogaba con la animación hero
    // ni con la ilustración 300px. Ahora los 3 elementos (chip + illus +
    // animación) hablan el mismo motif: transferencia química entre
    // dos neuronas.
    //
    // A 16px el único modo de comunicar "sinapsis" sin perder legibilidad
    // es la versión mínima: 2 bulbos (pre y post) + 3 neurotransmisores
    // cruzando el cleft entre ellos. Los bulbos son outlined (stroke del
    // tema, sin fill) para no dominar; los puntitos van filled (también
    // stroke=none) para que lean como "sustancia" en movimiento.
    case 'neuro':
      return (
        <svg {...common}>
          {/* Pre-synaptic bulb */}
          <circle cx="6" cy="12" r="3.8" />
          {/* Post-synaptic bulb */}
          <circle cx="18" cy="12" r="3.8" />
          {/* Neurotransmisores cruzando el cleft */}
          <circle cx="10.5" cy="11" r="0.9" fill={color} stroke="none" />
          <circle cx="12" cy="13" r="0.9" fill={color} stroke="none" />
          <circle cx="13.5" cy="11" r="0.9" fill={color} stroke="none" />
        </svg>
      );
    // Psicología — cabeza de perfil con cerebro filled adentro. Carolina
    // pidió explícitamente que el cerebro esté en bold/filled para que se
    // distinga del perfil de la cabeza. La cabeza usa el stroke del tema,
    // el cerebro es un relleno sólido del mismo color.
    case 'psicologia':
      return (
        <svg {...common}>
          <path d="M4 12c0-4.5 3.5-8 8-8 4 0 7 2.5 7 6 0 3-2 5-4.5 5.5L14 18v3H7v-3.5C5 16.5 4 15 4 12z" />
          <g fill={color} stroke="none">
            <path d="M8 10c0-1.1.9-2 2-2 .55 0 1.05.22 1.4.58A2 2 0 0 1 15 10c0 .36-.1.7-.27.98.54.32.77.9.77 1.52 0 .83-.67 1.5-1.5 1.5-.47 0-.88-.22-1.15-.55-.27.33-.68.55-1.15.55-.47 0-.88-.22-1.15-.55-.27.33-.68.55-1.15.55-.83 0-1.5-.67-1.5-1.5 0-.62.23-1.2.77-1.52A2 2 0 0 1 8 10z" />
          </g>
        </svg>
      );
    // Espacio — planeta con anillo. Anillo engrosado (ry=4 en vez de 3) para
    // que no se lea como hairline a 16px. El planeta sigue siendo un círculo
    // r=3.6 en el centro — proporción Saturno.
    case 'espacio':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.6" />
          <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-20 12 12)" />
        </svg>
      );
    // Biología — doble hélice de ADN. Reemplaza la
    // oruga que había antes: la ilustración 300px (illus-biologia.svg) es
    // una doble hélice con base pairs, y la oruga no se sentía parte de
    // la misma familia visual.
    //
    // Dos hebras en forma de S-curve, cada una con 3 medias vueltas, que
    // se cruzan en los puntos de inflexión (y=6.5, 12, 17.5 aprox).
    // Simplificado a mano de la ilustración 300px para que lea a 16px
    // — con menos vueltas que el original, pero el motivo "dos curvas
    // que se entrelazan + barras base" queda claro.
    //
    // Los 2 rungs horizontales van en y=9 y y=15 — los puntos donde las
    // hebras están en x=8 y x=16 respectivamente (separación máxima),
    // así los barras conectan visiblemente las dos hebras. Poner rungs
    // en los cruces (y=6.5, 12, 17.5) no tendría sentido: ahí las hebras
    // están en el mismo x y la barra quedaría "comiéndose" el cruce.
    case 'biologia':
      return (
        <svg {...common}>
          <path d="M8 4 Q 14 6.5 8 9 Q 2 12 8 15 Q 14 17.5 8 20" />
          <path d="M16 4 Q 10 6.5 16 9 Q 22 12 16 15 Q 10 17.5 16 20" />
          <path d="M9 9h6M9 15h6" />
        </svg>
      );
    // Ecología — hoja con vena central y venas laterales. Sin cambios, ya
    // estaba bien anclada.
    case 'ecologia':
      return (
        <svg {...common}>
          <path d="M4 20C6 10 12 4 20 3c-1 9-7 16-16 17z" />
          <path d="M4 20l9-9" />
          <path d="M9 14l2-1M11 11l2-1M13 9l2-1" />
        </svg>
      );
    // Física — átomo clásico de 3 órbitas. Sin cambios — es el glifo más
    // icónico del set y ya está bien anclado.
    case 'fisica':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="12" rx="10" ry="4" />
          <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)" />
          <circle cx="12" cy="12" r="1.4" fill={color} stroke="none" />
        </svg>
      );
    // Energía — rayo relleno. Reescalado al cuadro 4-20 para que matchee la
    // masa visual de la cruz de Medicina (ambos son filled, tienen que
    // pesar lo mismo). Antes el bolt se iba de y=2 a y=22, más "ancho" que
    // todo lo demás.
    case 'energia':
      return (
        <svg {...common}>
          <path d="M13 3L5 13h5l-2 8 9-11h-5z" fill={color} strokeLinejoin="round" />
        </svg>
      );
    // Medicina — cruz suiza filled. Keep — la geometría original ya estaba
    // bien centrada y con proporciones de bandera suiza correctas.
    case 'medicina':
      return (
        <svg {...common}>
          <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" fill={color} stroke="none" />
        </svg>
      );
    // Matemática — π en itálica serif. fontSize bajado de 20 a 17 porque a
    // 16px el 20 hacía que la π casi tocara los bordes del tile; con 17 queda
    // proporcional al resto. Baseline subido (y=17.5) para centrarlo
    // ópticamente con los glifos geométricos (la π tiene x-height "alta"
    // visualmente por el trazo superior).
    case 'matematica':
      return (
        <svg {...common}>
          <text
            x="12"
            y="17.5"
            textAnchor="middle"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontStyle="italic"
            fontSize="17"
            fontWeight={500}
            fill={color}
            stroke="none"
          >
            π
          </text>
        </svg>
      );
    // Materiales — cubo isométrico. Sin cambios; ya anclado bien.
    case 'materiales':
      return (
        <svg {...common}>
          <path d="M12 3L3 8v8l9 5 9-5V8z" />
          <path d="M3 8l9 5 9-5M12 13v8" />
        </svg>
      );
    // Química — matraz con cuello angosto. Sin cambios geométricos pero
    // ajuste de las líneas del cuello para que sea más reconocible a 16px.
    case 'quimica':
      return (
        <svg {...common}>
          <path d="M9 3v5.5L4 20h16L15 8.5V3M8 3h8" />
        </svg>
      );
    // Ciencia (general) — libro abierto. Antes era un círculo r=4 placeholder
    // que se veía como una manchita sin carácter. El libro abierto:
    //   (a) conecta con la identidad editorial de Paperverse ("papers →
    //       lectura"),
    //   (b) es distintivo de los otros 14 íconos (ninguno es un libro),
    //   (c) es el único tema "genérico" del set — usar un glifo universal
    //       de conocimiento/lectura se lee correcto sin colisionar con
    //       subtemas específicos.
    // Dos páginas con un lomo central + líneas de texto para que se lea como
    // "libro abierto" y no como "dos rectángulos paralelos".
    default:
      return (
        <svg {...common}>
          {/* Páginas izquierda y derecha, unidas en la columna central */}
          <path d="M4 5.5c3-1 5-1 8 .5 3-1.5 5-1.5 8-.5v13c-3-1-5-1-8 .5-3-1.5-5-1.5-8-.5z" />
          <path d="M12 6v13" />
          {/* Líneas de texto */}
          <path d="M6.5 9h3.5M6.5 11.5h3.5M14 9h3.5M14 11.5h3.5" />
        </svg>
      );
  }
}
