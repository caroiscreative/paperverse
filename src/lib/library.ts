// Bookmarked-papers store, localStorage-backed.
//
// No auth in Paperverse — so "mi biblioteca" lives entirely in the browser.
// Papers are persisted denormalized (the full Paper object) so the Library
// page can render without re-fetching OpenAlex. The trade-off: snapshots go
// stale (e.g., cited_by_count drifts), but correctness of a saved reference
// list is more important than freshness here.
//
// An optional `savedAt` timestamp is kept so we can sort "recientes primero"
// y eventualmente mostrar un "guardado hace 3 días" si hace falta.
//
// Arquitectura : se reescribió el hook, que antes era
// un `useState` privado por componente. El problema: cada llamada a
// `useLibrary()` tenía su propia copia del estado; cuando el usuario guardaba
// un paper desde la vista de referencias (mode=cites), el Header — que
// también usa `useLibrary()` para el badge "Biblioteca · N" — no se enteraba
// del cambio hasta que se re-montara. Ahora el estado es un store
// module-level único compartido por todos los consumidores vía
// `useSyncExternalStore`, y cualquier mutación dispara re-render coordinado
// en todas las instancias.
//
// La clave de localStorage y el evento `storage` cross-tab siguen siendo
// los mismos — sólo cambió la plumbing interna.

import { useSyncExternalStore } from 'react';
import type { Paper } from './openalex';

const STORAGE_KEY = 'pv_library_v1';

export interface LibraryEntry {
  paper: Paper;
  savedAt: number; // epoch ms
}

function readStore(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Shape-guard: descartamos cualquier entrada que no parezca LibraryEntry.
    return parsed.filter(
      (e): e is LibraryEntry =>
        e && typeof e === 'object' && e.paper && typeof e.paper.id === 'string'
    );
  } catch {
    return [];
  }
}

function writeStore(entries: LibraryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota excedida o storage deshabilitado — fail silencioso, el usuario
    // simplemente pierde persistencia en esta sesión.
  }
}

// ─── Store module-level ───────────────────────────────────────────────────
// `currentEntries` es la única fuente de verdad. Mutamos a través de
// `setEntries` que, además de actualizar la variable y localStorage,
// notifica a todos los subscribers para que re-rendericen.

let currentEntries: LibraryEntry[] = readStore();

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

function getSnapshot(): LibraryEntry[] {
  return currentEntries;
}

function setEntries(next: LibraryEntry[]) {
  // Referencial: si el caller pasó el mismo array, no hacemos nada. Los
  // updaters más adelante siempre crean un array nuevo, pero esto protege
  // contra setEntries redundantes.
  if (next === currentEntries) return;
  currentEntries = next;
  writeStore(next);
  notify();
}

// Cross-tab sync. El evento `storage` sólo dispara en tabs que NO originaron
// el write, así que si el usuario tiene Paperverse abierto en dos tabs y
// guarda un paper en una, la otra se actualiza por acá sin recargar.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    // Releemos del storage en vez de parsear e.newValue directo — es más
    // simple y protege contra valores raros/corruptos.
    const incoming = readStore();
    // Evitamos notificar si el array es equivalente (mismo length + mismos
    // ids en mismo orden). Comparación barata para el caso común.
    if (arraysEquivalent(incoming, currentEntries)) return;
    currentEntries = incoming;
    notify();
  });
}

function arraysEquivalent(a: LibraryEntry[], b: LibraryEntry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].paper.id !== b[i].paper.id) return false;
  }
  return true;
}

// ─── Mutaciones imperativas (usables dentro o fuera de componentes) ───────

function savePaper(paper: Paper): void {
  const prev = currentEntries;
  if (prev.some(e => e.paper.id === paper.id)) return;
  setEntries([{ paper, savedAt: Date.now() }, ...prev]);
}

function removePaper(id: string): void {
  const prev = currentEntries;
  const next = prev.filter(e => e.paper.id !== id);
  if (next.length === prev.length) return; // no-op si no existía
  setEntries(next);
}

function togglePaper(paper: Paper): void {
  if (currentEntries.some(e => e.paper.id === paper.id)) {
    removePaper(paper.id);
  } else {
    savePaper(paper);
  }
}

function hasPaper(id: string): boolean {
  return currentEntries.some(e => e.paper.id === id);
}

// ─── Bulk import (QA2 #68, ) ────────────────────────────────────
// Usado por el botón "Importar JSON" de la Biblioteca. A diferencia de
// `savePaper`, que siempre estampa `Date.now()`, acá respetamos el `savedAt`
// original que vino en el archivo — es lo que hace útil al import como
// "mudanza entre navegadores": el usuario conserva el orden cronológico de
// cuándo guardó cada paper, no queda todo apelotonado con la fecha del
// import.
//
// Estrategia de merge: si un id ya existe en el store local, NO lo pisamos —
// el timestamp local gana. Razón: el caso típico de uso es un usuario que
// importa su biblioteca en una máquina nueva (store vacío → todo es "added")
// o vuelve a importar para reconciliar pérdidas parciales (lo que sobrevivió
// localmente es autoritativo). Evitar el overwrite también elide la pregunta
// incómoda de "¿y si el JSON es más viejo que lo que tengo?".
//
// Devuelve un recuento para el toast ("Importamos 12 · 3 ya estaban").
export function importLibraryEntries(incoming: LibraryEntry[]): { added: number; skipped: number } {
  const prev = currentEntries;
  const existingIds = new Set(prev.map(e => e.paper.id));
  let added = 0;
  let skipped = 0;
  const toAdd: LibraryEntry[] = [];

  for (const entry of incoming) {
    // Shape-guard defensivo: si el archivo viene corrupto o de otra versión,
    // descartamos entradas que no cumplan el contrato mínimo.
    if (!entry || typeof entry !== 'object') continue;
    if (!entry.paper || typeof entry.paper.id !== 'string') continue;
    if (existingIds.has(entry.paper.id)) {
      skipped++;
      continue;
    }
    // Si el JSON viene sin `savedAt` (ej. export antiguo o malformado),
    // caemos al tiempo actual: sigue siendo más útil que perder la entrada.
    const savedAt = typeof entry.savedAt === 'number' ? entry.savedAt : Date.now();
    toAdd.push({ paper: entry.paper, savedAt });
    existingIds.add(entry.paper.id);
    added++;
  }

  if (added === 0) return { added: 0, skipped };

  // Orden final: los importados nuevos van primero por su savedAt descendente
  // (más recientes arriba), y después los que ya estaban. Esto preserva la
  // semántica "recientes primero" aunque el usuario importe un archivo muy
  // viejo — los papers guardados hoy localmente siguen arriba.
  toAdd.sort((a, b) => b.savedAt - a.savedAt);
  setEntries([...toAdd, ...prev]);
  return { added, skipped };
}

// ─── Public React API ─────────────────────────────────────────────────────

/**
 * Hook de React. Lee el store compartido y expone mutaciones. Todos los
 * consumidores quedan en sync automáticamente — si uno guarda un paper
 * desde la vista de referencias, el contador del Header se actualiza en
 * el mismo tick.
 */
export function useLibrary() {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    entries,
    has: hasPaper,
    save: savePaper,
    remove: removePaper,
    toggle: togglePaper,
  };
}
