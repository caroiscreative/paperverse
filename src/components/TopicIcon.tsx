import type { TopicId } from '../lib/topics';

interface Props {
  topicId: TopicId | null;
  color?: string;
  size?: number;
}

/**
 * Small SVG glyph per topic — sized 13px by default. Tied to the topic color
 * so it reads as a semantic color marker, not a decorative icon.
 */
export function TopicIcon({ topicId, color = '#0E1116', size = 13 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (topicId) {
    // IA — red de 3 nodos conectados. Separada de tecnología a pedido: cada
    // tema tiene su propio motif ahora. "Red" = forma canónica de IA moderna.
    case 'ia':
      return (
        <svg {...common}>
          <circle cx="6" cy="7" r="2" />
          <circle cx="18" cy="7" r="2" />
          <circle cx="12" cy="18" r="2" />
          <path d="M8 7h8M7.5 8.8l3.2 7.4M16.5 8.8l-3.2 7.4" />
        </svg>
      );
    // Tecnología — microchip con pines. Icono industrial clásico.
    case 'tecnologia':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="1" />
          <rect x="9.5" y="9.5" width="5" height="5" />
          <path d="M9 6V4M12 6V4M15 6V4M9 20v-2M12 20v-2M15 20v-2M4 9h2M4 12h2M4 15h2M20 9h-2M20 12h-2M20 15h-2" />
        </svg>
      );
    case 'clima':
      return (
        <svg {...common}>
          <path d="M7 18a4 4 0 1 1 1.3-7.8A6 6 0 0 1 20 12a3 3 0 0 1-1 5.8" />
        </svg>
      );
    case 'neuro':
      return (
        <svg {...common}>
          <path d="M8 4a3 3 0 0 0-3 3v2a3 3 0 0 0-1 5.5A3 3 0 0 0 7 20h2V4z" />
          <path d="M16 4a3 3 0 0 1 3 3v2a3 3 0 0 1 1 5.5A3 3 0 0 1 17 20h-2V4z" />
          <path d="M9 12h2M13 12h2M9 8h6M9 16h6" />
        </svg>
      );
    // Psicología — cabeza en outline con el cerebro relleno dentro. usuario
    // pidió que el cerebro esté en bold/filled para que se distinga de la
    // silueta de la cabeza.
    case 'psicologia':
      return (
        <svg {...common}>
          {/* Perfil de cabeza mirando a la derecha */}
          <path d="M4 12c0-4.5 3.5-8 8-8 4 0 7 2.5 7 6 0 3-2 5-4.5 5.5L14 18v3H7v-3.5C5 16.5 4 15 4 12z" />
          {/* Cerebro filled — dos lóbulos con surco central */}
          <g fill={color} stroke="none">
            <path d="M8 10c0-1.1.9-2 2-2 .55 0 1.05.22 1.4.58A2 2 0 0 1 15 10c0 .36-.1.7-.27.98.54.32.77.9.77 1.52 0 .83-.67 1.5-1.5 1.5-.47 0-.88-.22-1.15-.55-.27.33-.68.55-1.15.55-.47 0-.88-.22-1.15-.55-.27.33-.68.55-1.15.55-.83 0-1.5-.67-1.5-1.5 0-.62.23-1.2.77-1.52A2 2 0 0 1 8 10z" />
          </g>
        </svg>
      );
    case 'espacio':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <ellipse cx="12" cy="12" rx="9" ry="3" transform="rotate(-20 12 12)" />
        </svg>
      );
    // Biología — oruga: 4 segmentos + ojo + antena + patitas. Signo
    // universal "vida" sin entrar en dobles hélices (eso es más medicina/DNA).
    case 'biologia':
      return (
        <svg {...common}>
          <circle cx="5.5" cy="14" r="1.9" />
          <circle cx="10" cy="13.5" r="2.3" />
          <circle cx="15" cy="13" r="2.7" />
          <circle cx="19.5" cy="12.5" r="2.3" />
          <circle cx="20.8" cy="11.7" r="0.55" fill={color} stroke="none" />
          <path d="M21.5 10l1.3-2.3" />
          <path d="M5 16l-0.4 2M9.5 15.5l-0.4 2M14.5 15l-0.4 2M19 14.5l-0.4 2" />
        </svg>
      );
    // Ecología — hoja con vena central + venas laterales + tallo. Más legible
    // que las dos líneas onduladas anteriores.
    case 'ecologia':
      return (
        <svg {...common}>
          <path d="M4 20C6 10 12 4 20 3c-1 9-7 16-16 17z" />
          <path d="M4 20l9-9" />
          <path d="M9 14l2-1M11 11l2-1M13 9l2-1" />
        </svg>
      );
    case 'fisica':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="12" rx="10" ry="4" />
          <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)" />
          <circle cx="12" cy="12" r="1.4" fill={color} stroke="none" />
        </svg>
      );
    // Energía — rayo relleno, forma clásica tipo bolt.
    case 'energia':
      return (
        <svg {...common}>
          <path d="M13 2L4 14h6l-2 8 10-12h-6z" fill={color} strokeLinejoin="round" />
        </svg>
      );
    // Medicina — cruz suiza: brazo ancho, relleno sólido. Proporciones estilo
    // bandera suiza (arm-width ≈ 1/3 del total, brazos iguales).
    case 'medicina':
      return (
        <svg {...common}>
          <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" fill={color} stroke="none" />
        </svg>
      );
    // Matemática — letra π en itálica serif. Usa <text> porque recrear π
    // con paths se ve mal a 13px. fill + no-stroke para que no se engrose.
    case 'matematica':
      return (
        <svg {...common}>
          <text
            x="12"
            y="19"
            textAnchor="middle"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontStyle="italic"
            fontSize="20"
            fontWeight={500}
            fill={color}
            stroke="none"
          >
            π
          </text>
        </svg>
      );
    case 'materiales':
      return (
        <svg {...common}>
          <path d="M12 3L3 8v8l9 5 9-5V8z" />
          <path d="M3 8l9 5 9-5M12 13v8" />
        </svg>
      );
    case 'quimica':
      return (
        <svg {...common}>
          <path d="M9 3v5.5L4 20h16L15 8.5V3M8 3h8" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
  }
}
