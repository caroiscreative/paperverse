// "Leído" store, localStorage-backed.
//
// Separate from the library (bookmarks) because the two signals are
// independent — you can read a paper without saving it, and you can save a
// paper to read later without having read it yet.
//
// We denormalize the full Paper (like useLibrary does) so the Biblioteca
// archive section can render "cosas que ya leí" without re-fetching from
// OpenAlex on every visit.
//
// Arquitectura : se migró al mismo patrón de store
// module-level que useLibrary. Antes cada `useReadPapers()` mantenía su
// propio `useState`, y el contador "pendientes" del Header dependía
// simultáneamente de useLibrary + useReadPapers — si alguno de los dos no
// se actualizaba en sync, el badge mostraba un número viejo. Ahora todos
// los consumers leen del mismo store compartido vía useSyncExternalStore.

import { useSyncExternalStore } from 'react';
import type { Paper } from './openalex';

const STORAGE_KEY = 'pv_read_v1';

export interface ReadEntry {
  paper: Paper;
  readAt: number; // epoch ms
}

function readStore(): ReadEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ReadEntry =>
        e && typeof e === 'object' && e.paper && typeof e.paper.id === 'string' &&
        typeof e.readAt === 'number'
    );
  } catch {
    return [];
  }
}

function writeStore(entries: ReadEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Silent fail — quota / disabled storage. Next visit just restarts.
  }
}

// ─── Store module-level ───────────────────────────────────────────────────

let currentEntries: ReadEntry[] = readStore();

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

function getSnapshot(): ReadEntry[] {
  return currentEntries;
}

function setEntries(next: ReadEntry[]) {
  if (next === currentEntries) return;
  currentEntries = next;
  writeStore(next);
  notify();
}

function arraysEquivalent(a: ReadEntry[], b: ReadEntry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].paper.id !== b[i].paper.id) return false;
  }
  return true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    const incoming = readStore();
    if (arraysEquivalent(incoming, currentEntries)) return;
    currentEntries = incoming;
    notify();
  });
}

// ─── Mutaciones imperativas ───────────────────────────────────────────────

function markPaper(paper: Paper): void {
  const prev = currentEntries;
  if (prev.some(e => e.paper.id === paper.id)) return;
  setEntries([{ paper, readAt: Date.now() }, ...prev]);
}

function unmarkPaper(id: string): void {
  const prev = currentEntries;
  const next = prev.filter(e => e.paper.id !== id);
  if (next.length === prev.length) return;
  setEntries(next);
}

function togglePaper(paper: Paper): void {
  if (currentEntries.some(e => e.paper.id === paper.id)) {
    unmarkPaper(paper.id);
  } else {
    markPaper(paper);
  }
}

function hasPaper(id: string): boolean {
  return currentEntries.some(e => e.paper.id === id);
}

// ─── Bulk import (QA2 #68, ) ────────────────────────────────────
// Espejo de `importLibraryEntries` en library.ts — misma lógica, distinto
// shape. Respetamos el `readAt` original del archivo (no estampamos
// Date.now()) para que el orden "leídos recientemente" del archivo del
// usuario sobreviva a una migración entre navegadores. Merge con local:
// si el id ya existe lo saltamos; el timestamp local gana.
export function importReadEntries(incoming: ReadEntry[]): { added: number; skipped: number } {
  const prev = currentEntries;
  const existingIds = new Set(prev.map(e => e.paper.id));
  let added = 0;
  let skipped = 0;
  const toAdd: ReadEntry[] = [];

  for (const entry of incoming) {
    if (!entry || typeof entry !== 'object') continue;
    if (!entry.paper || typeof entry.paper.id !== 'string') continue;
    if (existingIds.has(entry.paper.id)) {
      skipped++;
      continue;
    }
    const readAt = typeof entry.readAt === 'number' ? entry.readAt : Date.now();
    toAdd.push({ paper: entry.paper, readAt });
    existingIds.add(entry.paper.id);
    added++;
  }

  if (added === 0) return { added: 0, skipped };

  toAdd.sort((a, b) => b.readAt - a.readAt);
  setEntries([...toAdd, ...prev]);
  return { added, skipped };
}

// ─── Public React API ─────────────────────────────────────────────────────

/**
 * Hook de React. Lee el store compartido de "papers leídos" y expone
 * mutaciones. Todos los consumers quedan sincronizados automáticamente:
 * marcar un paper como leído en cualquier vista (PaperCard, Biblioteca,
 * PaperDetail) actualiza el badge "pendientes" del Header en el mismo
 * tick. Mirrors la shape de useLibrary por consistencia de API.
 */
export function useReadPapers() {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    entries,
    has: hasPaper,
    mark: markPaper,
    unmark: unmarkPaper,
    toggle: togglePaper,
  };
}
