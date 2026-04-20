// Helper chico para preservar el estado del feed cuando el usuario navega
// a otra vista (paper detail, biblioteca) y vuelve.
//
// Motivación : si el usuario estaba en
// "/?q=quantum" viendo resultados de búsqueda, clickeaba un paper y de
// /paper/:id apretaba el tab "Feed" o el logo del header, terminaba en
// "/" pelado — el query se evaporaba. Para volver a la búsqueda tenía
// que re-tipearlo. Lo mismo con filtros por citas ("/?cites=…",
// "/?citedBy=…"). La "Vuelta al feed" idealmente preserva el estado
// que el usuario dejó.
//
// Estrategia:
// · El Feed escribe su URL actual (pathname + search) en sessionStorage
// cada vez que cambia. Sólo guarda URLs que son realmente "feed
// state" — o sea, pathname === '/'. No queremos confundir "última
// página visitada" con "última vista del feed".
// · Cualquier consumidor que quiera "volver al feed" (tab Feed en el
// header, logo, botón de volver desde error states, etc.) puede
// llamar a `getLastFeedUrl()` y usar eso en lugar de '/' pelado.
// · Si no hay nada guardado (primer load, storage bloqueado), cae a
// '/' default — nunca se pierde la ruta base.
//
// Por qué sessionStorage y no localStorage: el estado del feed (query,
// filtros de citas) es contextual de la sesión, no de la identidad del
// usuario. Si abro una nueva tab o mañana abro la app, quiero arrancar
// limpio; no quiero heredar un "?cites=xyz" de la semana pasada.
// sessionStorage muere con la tab, que es exactamente lo que queremos.

const KEY = 'pv_last_feed_url_v1';

/**
 * Guarda la URL actual del feed para que un futuro "volver al feed"
 * aterrice acá en vez de en '/'. Sólo acepta paths que empiecen con
 * '/' (defensivo — evita escribir rutas raras por accidente).
 */
export function rememberFeedUrl(url: string): void {
  if (!url.startsWith('/')) return;
  try {
    sessionStorage.setItem(KEY, url);
  } catch {
    /* storage bloqueado — aceptamos la pérdida silenciosamente */
  }
}

/**
 * Lee la última URL del feed guardada. Si no hay nada guardado o el
 * storage está bloqueado, devuelve '/' para preservar la semántica de
 * "Feed tab → ir a la home del feed".
 */
export function getLastFeedUrl(): string {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw && raw.startsWith('/')) return raw;
  } catch {
    /* storage bloqueado — fallback a default */
  }
  return '/';
}

/**
 * Limpia la URL guardada. Útil si en algún flujo queremos forzar que
 * "Feed" abra limpio (ej. al borrar filtros con un chip "Empezar de
 * cero"). Hoy nadie lo usa pero lo dejamos exportado por simetría.
 */
export function clearFeedUrl(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* igual */
  }
}
