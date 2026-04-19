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
    const mount = window.mountTopicAnim;
    if (typeof mount === 'function') {
      mount(el, topicId, variant);
    }
  }, [topicId, variant]);

  return <div ref={ref} className="ta-stage" data-variant={variant} />;
}
