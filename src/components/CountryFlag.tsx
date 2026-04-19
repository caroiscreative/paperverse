import { useState, type CSSProperties } from 'react';

const DISPLAY_W = 16;
const DISPLAY_H = 11;

const FRAME_STYLE: CSSProperties = {
  display: 'inline-block',
  width: DISPLAY_W,
  height: DISPLAY_H,
  verticalAlign: 'middle',
  border: '0.5px solid rgba(14,17,22,0.25)',
  boxSizing: 'border-box',
  objectFit: 'cover',
  borderRadius: 1,
  background: '#D8D0BE',
};

export function CountryFlag({ code, title }: { code?: string; title?: string }) {
  const [broken, setBroken] = useState(false);
  const lower = (code ?? '').toLowerCase();
  const valid = /^[a-z]{2}$/.test(lower);

  if (!valid || broken) {
    return <Fallback code={code} title={title} />;
  }

  return (
    <img
      src={`https://flagcdn.com/${lower}.svg`}
      alt={title ?? lower.toUpperCase()}
      title={title}
      style={FRAME_STYLE}
      onError={() => setBroken(true)}
      loading="lazy"
      decoding="async"
    />
  );
}

/**
 * Last-resort fallback: ink square with the 2-letter ISO code, or a cream
 * placeholder if we have nothing at all. Never an invisible cream-on-cream.
 */
function Fallback({ code, title }: { code?: string; title?: string }) {
  const upper = (code ?? '').toUpperCase();
  const common = {
    width: DISPLAY_W,
    height: DISPLAY_H,
    viewBox: '0 0 16 11',
    xmlns: 'http://www.w3.org/2000/svg',
  };
  const frame = (
    <rect
      x="0.25"
      y="0.25"
      width="15.5"
      height="10.5"
      fill="none"
      stroke="rgba(14,17,22,0.25)"
      strokeWidth="0.5"
    />
  );

  if (upper.length === 2) {
    return (
      <svg {...common} aria-label={title}>
        <rect width="16" height="11" fill="#0E1116" />
        <text
          x="8"
          y="7.5"
          textAnchor="middle"
          fontSize="5.5"
          fontWeight="600"
          fontFamily="'IBM Plex Mono', monospace"
          fill="#F4EEDD"
          letterSpacing="0.3"
        >
          {upper}
        </text>
        {frame}
      </svg>
    );
  }

  return (
    <svg {...common} aria-label={title}>
      <rect width="16" height="11" fill="#D8D0BE" />
      <path
        d="M3 5.5 h10"
        stroke="#0E1116"
        strokeWidth="0.6"
        opacity="0.35"
      />
      {frame}
    </svg>
  );
}
