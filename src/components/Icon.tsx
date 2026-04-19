import type { SVGProps } from 'react';

type IconName =
  | 'bookmark'
  | 'bookmark-filled'
  | 'search'
  | 'sparkle'
  | 'arrow-left'
  | 'arrow-right'
  | 'share'
  | 'external'
  | 'x'
  | 'upvote'
  | 'trending'
  | 'loader'
  | 'dice'
  | 'calendar'
  | 'sun'
  | 'moon'
  | 'user'
  | 'users'
  | 'check'
  | 'check-filled'
  | 'baby'
  | 'guitar'
  | 'microscope'
  | 'list'
  | 'grid'
  | 'plus'
  | 'refresh';

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.75,
  stroke = 'currentColor',
  fill = 'none',
  ...rest
}: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill,
    stroke,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...rest,
  };

  switch (name) {
    case 'bookmark':
      return (
        <svg {...common}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'bookmark-filled':
      return (
        <svg {...common} fill="currentColor">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg {...common}>
          <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        </svg>
      );
    case 'arrow-left':
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    case 'arrow-right':
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case 'share':
      return (
        <svg {...common}>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4" />
          <path d="m15.4 6.5-6.8 4" />
        </svg>
      );
    case 'external':
      return (
        <svg {...common}>
          <path d="M15 3h6v6" />
          <path d="M10 14 21 3" />
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      );
    case 'upvote':
      return (
        <svg {...common}>
          <path d="M12 4l8 10h-5v6h-6v-6H4z" />
        </svg>
      );
    case 'trending':
      return (
        <svg {...common}>
          <path d="m3 17 6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </svg>
      );
    case 'loader':
      return (
        <svg {...common} style={{ animation: 'pv-spin 1s linear infinite' }}>
          <path d="M12 2v4" />
          <path d="m16.24 7.76 2.83-2.83" />
          <path d="M18 12h4" />
          <path d="m16.24 16.24 2.83 2.83" />
          <path d="M12 18v4" />
          <path d="m7.76 16.24-2.83 2.83" />
          <path d="M6 12H2" />
          <path d="m7.76 7.76-2.83-2.83" />
        </svg>
      );
    case 'dice':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8" cy="8" r="1.2" fill="currentColor" />
          <circle cx="16" cy="8" r="1.2" fill="currentColor" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
          <circle cx="8" cy="16" r="1.2" fill="currentColor" />
          <circle cx="16" cy="16" r="1.2" fill="currentColor" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="1" />
          <path d="M3 10h18" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...common}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      );
    case 'check-filled':
      return (
        <svg {...common} strokeWidth={2.75}>
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      );
    case 'baby':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="9" cy="11" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="15" cy="11" r="0.9" fill="currentColor" stroke="none" />
          <path d="M9.5 15c.8.8 1.8 1.2 2.5 1.2s1.7-.4 2.5-1.2" />
          <path d="M12 8.5V6" />
        </svg>
      );
    case 'guitar':
      return (
        <svg {...common}>
          <path d="m11.9 12.1 4.514-4.514" />
          <path d="M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 17.828 7h1.344a2 2 0 0 0 1.414-.586L21.7 5.3a1 1 0 0 0 0-1.4z" />
          <path d="m6 16 2 2" />
          <path d="M8.2 9.9C8.7 8.8 9.8 8 11 8c2.8 0 5 2.2 5 5 0 1.2-.8 2.3-1.9 2.8l-.9.4A2 2 0 0 0 12 18a4 4 0 0 1-4 4c-3.3 0-6-2.7-6-6a4 4 0 0 1 4-4 2 2 0 0 0 1.8-1.2z" />
          <circle cx="11.5" cy="12.5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'microscope':
      return (
        <svg {...common}>
          <path d="M6 21h12" />
          <path d="M9 18h6" />
          <path d="M12 18v-3" />
          <path d="M8 15h8" />
          <path d="M10 15a4 4 0 0 0 7-3" />
          <path d="M13 4l3 1-1 3-3-1z" />
          <path d="M14.5 8l2 2" />
        </svg>
      );
    case 'list':
      return (
        <svg {...common}>
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3 6h.01" />
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
        </svg>
      );
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      );
    default:
      return null;
  }
}
