import { useCallback, useEffect, useState } from 'react';
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
  }
}

/**
 * React hook providing read + mutation access to the "papers leídos" store.
 * Mirrors the shape of useLibrary for API consistency.
 */
export function useReadPapers() {
  const [entries, setEntries] = useState<ReadEntry[]>(readStore);

  useEffect(() => {
    function onStorage(ev: StorageEvent) {
      if (ev.key === STORAGE_KEY) setEntries(readStore());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const has = useCallback(
    (id: string) => entries.some(e => e.paper.id === id),
    [entries]
  );

  const mark = useCallback((paper: Paper) => {
    setEntries(prev => {
      if (prev.some(e => e.paper.id === paper.id)) return prev;
      const next = [{ paper, readAt: Date.now() }, ...prev];
      writeStore(next);
      return next;
    });
  }, []);

  const unmark = useCallback((id: string) => {
    setEntries(prev => {
      const next = prev.filter(e => e.paper.id !== id);
      writeStore(next);
      return next;
    });
  }, []);

  const toggle = useCallback(
    (paper: Paper) => {
      if (entries.some(e => e.paper.id === paper.id)) {
        unmark(paper.id);
      } else {
        mark(paper);
      }
    },
    [entries, mark, unmark]
  );

  return { entries, has, mark, unmark, toggle };
}
