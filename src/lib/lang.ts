import { useSyncExternalStore } from 'react';

export type LangId =
  | 'es'
  | 'en'
  | 'pt'
  | 'fr'
  | 'it'
  | 'de'
  | 'ja'
  | 'zh'
  | 'ko'
  | 'ru'
  | 'ar'
  | 'hi'
  | 'nl'
  | 'tr'
  | 'pl';

export interface LangDef {
  id: LangId;
  /** Native name as a human would write it in their own language. */
  label: string;
  /** Short ISO-ish code for compact UI (the ThemeDock trigger). */
  short: string;
  /** Name + directive we inject into the LLM system prompt. */
  promptName: string;
}

export const LANGS: ReadonlyArray<LangDef> = [
  { id: 'es', label: 'Español', short: 'ES', promptName: 'rioplatense Spanish (use "vos", not "tú")' },
  { id: 'en', label: 'English', short: 'EN', promptName: 'clear, conversational English' },
  { id: 'pt', label: 'Português', short: 'PT', promptName: 'Brazilian Portuguese' },
  { id: 'fr', label: 'Français', short: 'FR', promptName: 'French' },
  { id: 'it', label: 'Italiano', short: 'IT', promptName: 'Italian' },
  { id: 'de', label: 'Deutsch', short: 'DE', promptName: 'German' },
  { id: 'nl', label: 'Nederlands', short: 'NL', promptName: 'Dutch' },
  { id: 'pl', label: 'Polski', short: 'PL', promptName: 'Polish' },
  { id: 'ru', label: 'Русский', short: 'RU', promptName: 'Russian' },
  { id: 'tr', label: 'Türkçe', short: 'TR', promptName: 'Turkish' },
  { id: 'ar', label: 'العربية', short: 'AR', promptName: 'Modern Standard Arabic' },
  { id: 'hi', label: 'हिन्दी', short: 'HI', promptName: 'Hindi' },
  { id: 'ja', label: '日本語', short: 'JA', promptName: 'Japanese' },
  { id: 'ko', label: '한국어', short: 'KO', promptName: 'Korean' },
  { id: 'zh', label: '中文', short: 'ZH', promptName: 'Simplified Chinese' },
];

const LANG_STORAGE_KEY = 'pv_lang_v1';
const DEFAULT_LANG: LangId = 'es';

export function getLangDef(id: LangId): LangDef {
  return LANGS.find(l => l.id === id) ?? LANGS[0];
}

function readStoredLang(): LangId {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    if (raw && LANGS.some(l => l.id === raw)) return raw as LangId;
    return DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

let currentLang: LangId = readStoredLang();
let refreshVersion = 0;
const listeners = new Set<() => void>();

export function getLang(): LangId {
  return currentLang;
}

export function getRefreshVersion(): number {
  return refreshVersion;
}

let snapshotVersion = 0;
let currentSnapshot: { lang: LangId; version: number; tick: number } = {
  lang: currentLang,
  version: refreshVersion,
  tick: snapshotVersion,
};

function rebuildSnapshot(): void {
  snapshotVersion += 1;
  currentSnapshot = {
    lang: currentLang,
    version: refreshVersion,
    tick: snapshotVersion,
  };
}

function notify(): void {
  rebuildSnapshot();
  for (const fn of listeners) fn();
}

export function setLang(next: LangId): void {
  if (next === currentLang) return;
  currentLang = next;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, next);
  } catch {

  }
  if (typeof console !== 'undefined') {
    console.info('[lang] setLang →', next, `(listeners: ${listeners.size})`);
  }
  notify();
}

/** Forzar re-traducción sin cambiar idioma. Útil si Pollinations no respondió. */
export function bumpRefresh(): void {
  refreshVersion += 1;
  if (typeof console !== 'undefined') {
    console.info('[lang] bumpRefresh →', refreshVersion, `(listeners: ${listeners.size})`);
  }
  notify();
}

export function subscribeLang(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * React hook: lang, version, setLang, refresh. Cualquier componente que lo
 * use se re-renderiza cuando el idioma cambia o cuando alguien pulsa refresh.
 *
 * Implementación con `useSyncExternalStore` — el hook oficial de React 18
 * para suscribirse a stores externos. Resuelve un par de edge cases sutiles
 * que la combinación useState+useEffect tenía: concurrent rendering puede
 * ejecutar el render antes del primer efecto, dejando el estado leaked
 * detrás del módulo; y StrictMode (doble mount en dev) duplicaba listeners
 * brevemente. useSyncExternalStore garantiza que el snapshot siempre esté
 * fresco y la suscripción sea consistente con el commit.
 */
export function useLang() {
  const snap = useSyncExternalStore(subscribeLang, getSnapshot, getSnapshot);
  return {
    lang: snap.lang,
    version: snap.version,
    setLang,
    refresh: bumpRefresh,
    def: getLangDef(snap.lang),
  };
}

function getSnapshot() {
  return currentSnapshot;
}
