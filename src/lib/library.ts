import { useCallback, useEffect, useState } from 'react';
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
  }
}

/**
 * React hook providing read + mutation access to the library store.
 * Syncs across tabs via the `storage` event.
 */
export function useLibrary() {
  const [entries, setEntries] = useState<LibraryEntry[]>(readStore);

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

  const save = useCallback((paper: Paper) => {
    setEntries(prev => {
      if (prev.some(e => e.paper.id === paper.id)) return prev;
      const next = [{ paper, savedAt: Date.now() }, ...prev];
      writeStore(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setEntries(prev => {
      const next = prev.filter(e => e.paper.id !== id);
      writeStore(next);
      return next;
    });
  }, []);

  const toggle = useCallback(
    (paper: Paper) => {
      if (entries.some(e => e.paper.id === paper.id)) {
        remove(paper.id);
      } else {
        save(paper);
      }
    },
    [entries, save, remove]
  );

  return { entries, has, save, remove, toggle };
}
