// Lightweight toast system — .
//
// Problema que resuelve: al clickear "Guardar" o "Marcar como leído" el
// estado visual del botón cambia (ícono se llena / se vacía) pero no hay
// confirmación verbal de la acción. En devices chicos o cuando el tap
// queda fuera del foco visual del usuario (porque está leyendo el título),
// se pierde el feedback y el usuario duda si realmente guardó el paper.
//
// Diseño deliberado:
// · Singleton store con event bus — cualquier componente puede disparar
// un toast sin prop drilling. La alternativa (Context Provider) agregaba
// jerarquía innecesaria para un efecto tan puntual.
// · Una cola con una sola posición visible: si aparece otro toast antes
// de que el anterior expire, el nuevo pisa al viejo. Paperverse no
// tiene acciones en ráfaga que ameriten un stack.
// · Sin animación de entrada (consistente con la regla "toggles sin
// animación" del proyecto). Snap in, snap out.
// · Auto-dismiss en 2.2s — suficiente para leer "Guardado en biblioteca"
// sin convertir el toast en ruido persistente.
// · API pública: el hook devuelve { toast, show } para consumidor. El
// registro global <ToastRegion /> se monta una vez en App.tsx y
// escucha el store. Los componentes disparan con show(msg, variant).

import { useEffect, useState } from 'react';

export type ToastVariant = 'success' | 'info' | 'error';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

type Listener = (t: Toast | null) => void;

let currentToast: Toast | null = null;
let dismissTimer: number | null = null;
let nextId = 1;
const listeners = new Set<Listener>();

function emit(t: Toast | null) {
  currentToast = t;
  for (const l of listeners) l(t);
}

export function showToast(message: string, variant: ToastVariant = 'success') {
  // Cancelamos cualquier timer pendiente: si el usuario guarda un paper y
  // 500ms después lo des-guarda, queremos que el toast del segundo estado
  // se muestre los 2.2s completos, no los 1.7s que le quedaban al primero.
  if (dismissTimer !== null) {
    window.clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  const toast: Toast = { id: nextId++, message, variant };
  emit(toast);
  dismissTimer = window.setTimeout(() => {
    emit(null);
    dismissTimer = null;
  }, 2200);
}

/**
 * Hook para consumir el toast actual. Usado sólo por <ToastRegion />; los
 * disparadores (botones) deben llamar a `showToast()` directamente, sin
 * pasar por el hook — así evitamos re-renderizar componentes que sólo
 * necesitan emitir.
 */
export function useCurrentToast(): Toast | null {
  const [toast, setToast] = useState<Toast | null>(currentToast);
  useEffect(() => {
    listeners.add(setToast);
    return () => {
      listeners.delete(setToast);
    };
  }, []);
  return toast;
}
