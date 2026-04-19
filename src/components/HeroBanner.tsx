interface Props {
  color: string;
}

export function HeroBanner({ color }: Props) {
  return (
    <svg viewBox="0 0 800 170" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="hb-bg" cx="70%" cy="40%" r="80%">
          <stop offset="0%" stopColor="#1C2138" />
          <stop offset="100%" stopColor="#0B1020" />
        </radialGradient>
      </defs>
      <rect width="800" height="170" fill="url(#hb-bg)" />
      <g fill="#F4EEE1">
        <circle className="twinkle" cx="60" cy="30" r="1" />
        <circle className="twinkle a" cx="140" cy="70" r="1.2" />
        <circle className="twinkle b" cx="220" cy="20" r="0.9" />
        <circle className="twinkle" cx="320" cy="110" r="1" />
        <circle className="twinkle c" cx="400" cy="40" r="1.3" />
        <circle className="twinkle a" cx="500" cy="130" r="1.1" />
        <circle className="twinkle b" cx="680" cy="30" r="1" />
        <circle className="twinkle" cx="740" cy="80" r="1.2" />
      </g>
      <ellipse cx="640" cy="85" rx="180" ry="24" fill="none" stroke="#F4EEE1" strokeOpacity="0.28" strokeWidth="1" transform="rotate(-12 640 85)" />
      <g className="orbit-slow" style={{ transformOrigin: '640px 85px' }}>
        <ellipse cx="640" cy="85" rx="140" ry="140" fill="none" stroke={color} strokeOpacity="0.32" strokeWidth="1" />
        <circle cx="780" cy="85" r="4.5" fill={color} />
      </g>
      <g className="orbit-fast" style={{ transformOrigin: '640px 85px' }}>
        <ellipse cx="640" cy="85" rx="96" ry="96" fill="none" stroke={color} strokeOpacity="0.24" strokeWidth="1" />
        <circle cx="640" cy="-11" r="3" fill="#F4EEE1" />
      </g>
      <g className="planet-wob" style={{ transformOrigin: '640px 85px' }}>
        <circle cx="640" cy="85" r="46" fill={color} />
        <path d="M598 85 Q640 55 682 85 Q640 115 598 85 Z" fill="#0E1116" opacity="0.18" />
        <circle cx="624" cy="72" r="6" fill="#0E1116" opacity="0.15" />
        <circle cx="654" cy="96" r="4" fill="#0E1116" opacity="0.12" />
      </g>
      <g opacity="0.55">
        <circle cx="80" cy="135" r="44" fill={color} opacity="0.18" />
        <circle cx="160" cy="105" r="30" fill={color} opacity="0.12" />
      </g>
    </svg>
  );
}
