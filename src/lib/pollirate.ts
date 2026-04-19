const MAX_PARALLEL = 1;
let active = 0;

type QueueEntry = {
  resolve: () => void;
  reject: (err: unknown) => void;
  cancelled: boolean;
};

const queueHigh: QueueEntry[] = [];
const queueLow: QueueEntry[] = [];

let cooldownUntil = 0;
let cooldownExp = 0; // 0, 1, 2, ... — exp backoff exponent

/** Marca un 429 desde el fetch layer. Pausa la cola `2 * 2^exp` segundos. */
export function markRateLimited(): number {
  const delayMs = Math.min(20_000, 2_000 * Math.pow(2, cooldownExp));
  cooldownExp = Math.min(cooldownExp + 1, 3);
  cooldownUntil = Math.max(cooldownUntil, Date.now() + delayMs);
  console.info(`[pollirate] rate-limited → cooldown ${delayMs}ms`);
  return delayMs;
}

/** Cuando una request sale bien, reseteamos el backoff. */
export function markRequestOk(): void {
  if (cooldownExp > 0) {
    console.info('[pollirate] request ok → reset backoff');
  }
  cooldownExp = 0;
}

/**
 * Saca la próxima entrada pendiente de las colas respetando prioridad.
 * Saltea las que fueron canceladas mientras estaban esperando — el que
 * cancela ya hizo reject() por su cuenta vía el listener de 'abort'.
 */
function pickNext(): QueueEntry | null {
  while (queueHigh.length) {
    const e = queueHigh.shift()!;
    if (!e.cancelled) return e;
  }
  while (queueLow.length) {
    const e = queueLow.shift()!;
    if (!e.cancelled) return e;
  }
  return null;
}

async function acquire(priority: 'high' | 'low', signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  const waitMs = cooldownUntil - Date.now();
  if (waitMs > 0) {
    await sleep(waitMs, signal);
  }
  if (active < MAX_PARALLEL) {
    active++;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const entry: QueueEntry = { resolve, reject, cancelled: false };
    if (priority === 'high') queueHigh.push(entry);
    else queueLow.push(entry);

    if (signal) {
      const onAbort = () => {
        entry.cancelled = true;
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

async function release(): Promise<void> {
  const waitMs = cooldownUntil - Date.now();
  if (waitMs > 0) {
    await sleep(waitMs).catch(() => {});
  }
  const next = pickNext();
  if (next) {
    next.resolve();
    return;
  }
  active--;
}

export interface SlotOptions {
  /** high = jumps feed requests; low = default for bulk feed. */
  priority?: 'high' | 'low';
  /** Aborts the queued wait OR the in-flight work. */
  signal?: AbortSignal;
}

/** Run an async thunk under the shared concurrency slot. */
export async function withPollinationsSlot<T>(
  fn: () => Promise<T>,
  options: SlotOptions = {}
): Promise<T> {
  const { priority = 'low', signal } = options;
  await acquire(priority, signal);
  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return await fn();
  } finally {
    release().catch(() => {});
  }
}

export interface FetchOptions {
  /**
   * AbortSignal que aplica tanto al fetch en sí como al retry de 429. Típico
   * caller: un AbortController con setTimeout(ms). Si se dispara mientras
   * estamos en el backoff del 429, el próximo fetch ya sale cancelado.
   */
  signal?: AbortSignal;
}

/**
 * Fetch con retry en 429 + backoff global. Antes era un solo retry de 300ms,
 * pero con el feed pidiendo 10–20 traducciones al cambiar idioma eso no
 * alcanzaba: la segunda request caía en la misma ventana de rate-limit.
 *
 * Ahora: hasta 3 intentos. Si hay 429, llamamos a `markRateLimited()` que
 * pausa toda la cola (backoff exponencial 2s/4s/8s), esperamos ese delay, y
 * reintentamos. Cuando una request sale ok, `markRequestOk()` resetea el
 * exponente — así después de una ráfaga mala volvemos rápido al ritmo normal.
 *
 * El signal del caller (timeout global de 15s) sigue siendo la red de
 * seguridad: si los 3 intentos + backoffs no caben en el presupuesto, la
 * request se aborta y cae al fallback pre-limpiado.
 */
export async function fetchPollinations(
  url: string,
  init: RequestInit,
  options: FetchOptions = {}
): Promise<Response> {
  const { signal } = options;
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const r = await fetch(url, { ...init, signal });
    if (r.status !== 429) {
      markRequestOk();
      return r;
    }
    if (attempt === MAX_ATTEMPTS) {
      markRateLimited();
      return r; // devolvemos el 429 para que el caller muestre el error
    }
    const delayMs = markRateLimited();
    await sleep(delayMs, signal);
  }
  throw new Error('unreachable');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Turn a raw Pollinations error into a short, human-readable Spanish line.
 * Nunca queremos mostrar el JSON crudo (IP, queue counts, deprecation
 * notices) — lee como roto y filtra ruido.
 */
export function friendlyPollinationsError(status: number, text: string): string {
  if (status === 429) {
    return 'Pollinations está saturado ahora mismo. Probá de nuevo en un minuto.';
  }
  if (status >= 500) {
    return 'Pollinations está caído. Probá de nuevo en un rato.';
  }
  if (status === 403) {
    return 'Pollinations bloqueó el pedido. Esperá un rato y volvé.';
  }
  const short = text
    .replace(/[\{\}"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return short ? `Falló (${status}): ${short}` : `Falló (${status}).`;
}

/**
 * Helper para el caller que necesita un AbortSignal con timeout. Devuelve
 * un objeto con `signal` + `cleanup()` para limpiar el timer cuando termina
 * la operación (evita fugar timers).
 */
export function timeoutSignal(ms: number, parent?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  let onParentAbort: (() => void) | null = null;
  if (parent) {
    if (parent.aborted) {
      ctrl.abort();
    } else {
      onParentAbort = () => ctrl.abort();
      parent.addEventListener('abort', onParentAbort, { once: true });
    }
  }
  return {
    signal: ctrl.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (parent && onParentAbort) parent.removeEventListener('abort', onParentAbort);
    },
  };
}

/** True si el error fue por AbortController (timeout o cancel). */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
