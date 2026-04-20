// Light/dark theme store. Escribe una clase `pv-dark` al <html> — el
// design system (colors_and_type.css) swappa las CSS variables bajo esa
// clase. El estado se persiste en localStorage así sobrevive al reload.
//
// No auto-seguimos `prefers-color-scheme`: el canvas crema de Paperverse
// es core de la marca, así que queremos que el usuario opte-in a la
// variante "cosmic night" en vez de adivinar su gusto por el OS.
//
// Arquitectura : se reescribió de un hook con
// useState privado a un *store externo* consumido vía
// `useSyncExternalStore`. Razones del cambio:
//
// 1) Sync entre instancias. Antes, cada `useTheme()` tenía su propio
// useState. Si en algún momento montábamos dos toggles al mismo
// tiempo (sidebar del Feed + algún control en Header en mobile),
// uno cambiaba el tema pero el otro seguía mostrando el label
// viejo hasta que su propio re-render lo alineara. Ahora todos
// los subscribers leen del mismo `currentTheme` module-level, así
// que cualquier setTheme dispara un re-render coordinado en todos
// los lugares donde se lo lee.
//
// 2) FOUC en first paint. El bootstrap inline en index.html ya aplica
// la clase `pv-dark` al <html> antes de que React monte — eso
// solucionó el flash de canvas crema en usuarios de modo oscuro.
// Pero la inicialización del useState en el hook corría ya con el
// valor correcto porque lee directo de localStorage. Mantenemos
// consistencia: el bootstrap y el store comparten la misma
// clave (`pv_theme_v1`); si cambiamos una, hay que cambiar la
// otra también (ver nota en index.html).
//
// 3) Cross-tab sync. Subscribímonos al evento `storage` del window
// para que si el usuario tiene Paperverse abierto en dos tabs y
// cambia el tema en una, la otra se actualice sin refresh. El
// `storage` event sólo dispara entre tabs de la misma origin,
// no dentro de la misma tab que originó el write — por eso
// seguimos llamando a `notify()` explícitamente desde `setTheme`.

import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'pv_theme_v1';

/** Lee el tema persistido. Siempre devuelve un valor válido. */
function readTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'dark' ? 'dark' : 'light';
  } catch {
    // storage bloqueado → default light. No forzamos dark aunque el usuario
    // lo haya pedido en otra sesión: si no podemos leer, no podemos recordar.
    return 'light';
  }
}

/** Aplica la clase `pv-dark` al <html>, sin tocar otras clases. */
function applyToDom(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('pv-dark');
  } else {
    root.classList.remove('pv-dark');
  }
}

// ─── Store module-level ───────────────────────────────────────────────────
// `currentTheme` es la única fuente de verdad. Todos los hooks y callbacks
// lo leen a través de `getSnapshot`. La lista de listeners se notifica
// después de cada cambio.

let currentTheme: Theme = readTheme();
// Ya aplicamos la clase al <html> sincrónicamente en index.html antes de
// que React monte, pero re-aplicarla acá es barato y cubre el caso de
// que alguien haya modificado la clase fuera del store (ej. un script de
// debug). Mantener el DOM alineado con `currentTheme` es invariante.
applyToDom(currentTheme);

const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  return currentTheme;
}

/**
 * Setter canónico del store. Idempotente: si el tema ya es el pedido,
 * no hace nada (no notifica ni re-escribe storage). Esto evita re-renders
 * en cascada cuando algo dispara setTheme con el valor actual.
 */
function setThemeInternal(next: Theme) {
  if (next === currentTheme) return;
  currentTheme = next;
  applyToDom(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage bloqueado — seguimos con el cambio en memoria, pero no persiste */
  }
  notify();
}

// Cross-tab sync. Cuando otra tab escribe a localStorage, browser dispara
// `storage` event en todas las otras tabs de la misma origin. Si el cambio
// fue a nuestra clave, espejamos el estado. Sólo escuchamos una vez por
// módulo — no hace falta cleanup porque el módulo vive toda la sesión.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    const incoming = e.newValue === 'dark' ? 'dark' : 'light';
    // Reusamos setThemeInternal para el trabajo común (DOM + notify).
    // No re-escribimos storage porque el valor ya vino de ahí.
    if (incoming === currentTheme) return;
    currentTheme = incoming;
    applyToDom(incoming);
    notify();
  });
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Hook de React para leer y setear el tema. Todos los consumidores que
 * llamen a `useTheme` comparten el mismo store, así que siempre quedan
 * en sync entre sí sin prop-drilling ni context.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    theme,
    toggle: () => setThemeInternal(theme === 'dark' ? 'light' : 'dark'),
    setTheme: setThemeInternal,
  };
}

/**
 * Acceso imperativo al tema actual — útil para lugares fuera del árbol
 * React (ej. un script de setup o un logger) que necesiten saber el tema
 * sin suscribirse a cambios. No es para usar dentro de componentes
 * (usá `useTheme`): leerlo así no triggerea re-render.
 */
export function getTheme(): Theme {
  return currentTheme;
}

/**
 * Setter imperativo — equivalente al `setTheme` que devuelve `useTheme`,
 * pero utilizable fuera de componentes. Rara vez hace falta.
 */
export function setTheme(next: Theme) {
  setThemeInternal(next);
}
