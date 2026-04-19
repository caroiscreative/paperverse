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
    case 'ia':
    case 'tecnologia':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2.2" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
        </svg>
      );
    case 'clima':
      return (
        <svg {...common}>
          <path d="M7 18a4 4 0 1 1 1.3-7.8A6 6 0 0 1 20 12a3 3 0 0 1-1 5.8" />
        </svg>
      );
    case 'neuro':
    case 'psicologia':
      return (
        <svg {...common}>
          <path d="M8 4a3 3 0 0 0-3 3v2a3 3 0 0 0-1 5.5A3 3 0 0 0 7 20h2V4z" />
          <path d="M16 4a3 3 0 0 1 3 3v2a3 3 0 0 1 1 5.5A3 3 0 0 1 17 20h-2V4z" />
          <path d="M9 12h2M13 12h2M9 8h6M9 16h6" />
        </svg>
      );
    case 'espacio':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <ellipse cx="12" cy="12" rx="9" ry="3" transform="rotate(-20 12 12)" />
        </svg>
      );
    case 'biologia':
    case 'ecologia':
      return (
        <svg {...common}>
          <path d="M7 20c5-2 8-6 10-14M17 6C12 8 9 12 7 20" />
          <path d="M9 14c2 0 4 .5 6 2M11 10c2 0 4 .5 6 2" />
        </svg>
      );
    case 'fisica':
    case 'energia':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="12" rx="10" ry="4" />
          <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)" />
          <circle cx="12" cy="12" r="1.4" fill={color} stroke="none" />
        </svg>
      );
    case 'medicina':
      return (
        <svg {...common}>
          <path d="M10 3h4v5h5v4h-5v9h-4v-9H5V8h5z" />
        </svg>
      );
    case 'matematica':
      return (
        <svg {...common}>
          <path d="M5 6h14M5 12h14M5 18h14M9 4l-2 16M17 4l-2 16" />
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
