// Topic-specific animated banner for the hero card.
//
// Thin React wrapper around the DS2 vanilla IIFE at /public/topic-anim.js
// (window.mountTopicAnim). Each of the 14 topics gets its own animated SVG —
// planets for "espacio", neurons for "neuro", a flask for "química", etc.
// Respects `prefers-reduced-motion` via the DS2 CSS (topic-anim.css).
//
// The previous HeroBanner.tsx painted a single generic cosmos scene tinted
// with the topic color; DS2 replaces that with per-topic motifs.

import { useEffect, useRef } from 'react';
import type { TopicId } from '../lib/topics';

interface Props {
  topicId: TopicId;
  variant?: 'desktop' | 'mobile';
}

export function TopicBanner({ topicId, variant = 'desktop' }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // mountTopicAnim is attached by /topic-anim.js. If the script hasn't
    // loaded yet (or failed), bail quietly — the container stays empty and
    // the hero just shows the card chrome without a scene. No crash.
    const mount = window.mountTopicAnim;
    if (typeof mount === 'function') {
      mount(el, topicId, variant);
    }
  }, [topicId, variant]);

  // .ta-stage class is added by mountTopicAnim; we declare it here too so the
  // container has correct sizing on first paint (prevents a flash of 0×0).
  return <div ref={ref} className="ta-stage" data-variant={variant} />;
}
