import { useCurrentToast } from '../lib/toast';

/**
 * Región global de toasts. Vive una vez en App.tsx, debajo del <Header />
 * y hermana de <Routes />. Renderiza el toast activo (si hay) en una
 * posición fixed al pie del viewport, centrada horizontalmente. Sin
 * animación de entrada (regla de UI del proyecto: toggles y feedback
 * instantáneos) — snap in / snap out.
 *
 * role="status" + aria-live="polite" hace que los screen readers
 * anuncien el mensaje cuando aparece, pero sin interrumpir lo que
 * el usuario esté leyendo. Fixed bottom center es la ubicación
 * estándar (MD3, HIG): queda fuera del camino del cursor pero
 * visible en el campo periférico.
 */
export function ToastRegion() {
  const toast = useCurrentToast();
  if (!toast) return null;
  return (
    <div
      className={`pv-toast pv-toast--${toast.variant}`}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}
