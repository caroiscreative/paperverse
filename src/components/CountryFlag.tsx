// Country flags via flagcdn.com — free CDN that serves ISO-3166 flags as SVG
// at every possible ISO code. Replaces the hand-drawn set from before, which
// only covered ~30 countries and fell through to an ugly ink-square-with-
// letters for everything else (usuario flagged this: papers from Morocco,
// Iran, Peru, Vietnam, etc. showed "MA", "IR", "PE", "VN" instead of a
// flag). flagcdn.com covers every country OpenAlex ever returns.
//
// Fallback chain: if the image fails to load (offline, CDN blocked, or an
// invalid ISO code slips through), we render the ink-square-with-letters so
// the user at least sees *something* that identifies the country. The cream
// placeholder (no code at all) preserves the original bug-avoidance behavior:
// never render an invisible cream square on a cream card.
//
// Size: fixed 16×11 container with object-fit: cover so every flag occupies
// the same footprint in the byline/meta row regardless of its native aspect
// ratio (most flags are 3:2 or 2:1 — cover crops a sliver, never distorts).

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

  // No code at all: cream placeholder with a dash.
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
