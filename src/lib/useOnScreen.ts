// Hook: devuelve un ref + un booleano que pasa a true la primera vez que el
// elemento entra al viewport. Es sticky — no vuelve a false cuando sale de
// pantalla, porque en nuestro caso (gatear traducciones) queremos que una
// card que fue vista mantenga su estado "translated".
//
// Se usa en PaperCard y PaperCardTile para no enqueue-ar 150 traducciones al
// cargar el feed — sólo las cards visibles (o casi visibles, gracias al
// rootMargin) disparan el fetch de Pollinations. Es el mayor cambio en la
// optimización: reduce la cola en ~80–95% según cuánto se scrollee el feed.
//
// rootMargin '300px' = prefetch: empezamos a traducir cuando la card está a
// 300px de entrar al viewport. Así la traducción suele estar lista antes de
// que el usuario la vea de verdad y no aparece el parpadeo título-inglés →
// título-español.

import { useEffect, useRef, useState } from 'react';

export function useOnScreen<T extends Element>(
  rootMargin = '300px'
): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [isVisible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // SSR / browsers muy viejos: hacer bypass directo a "visible" para que
    // la app no se rompa. Paperverse corre en Vite y es SPA, pero nunca
    // está de más.
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
