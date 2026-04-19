import { useEffect, useRef, useState } from 'react';

export function useOnScreen<T extends Element>(
  rootMargin = '300px'
): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [isVisible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const obs = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect(); // sticky: una sola vez
            return;
          }
        }
      },
      { rootMargin }
    );
    obs.observe(el);

    return () => obs.disconnect();
  }, [rootMargin]);

  return [ref, isVisible];
}
