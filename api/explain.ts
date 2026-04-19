export const config = {
  runtime: 'edge',
};

const MODEL = process.env.PV_EXPLAIN_MODEL ?? 'claude-haiku-4-5-20251001';
const ALLOWED_ORIGIN = process.env.PV_ALLOWED_ORIGIN ?? '*';

const SYSTEM_PROMPT = `Sos un editor científico que escribe para lectores curiosos pero sin formación técnica.
Traducís abstracts de papers al español rioplatense, claro y directo.

Reglas:
- Escribí en voz activa, oraciones cortas. Nivel: alguien con secundaria terminada.
- Usá "vos" (no "tú"). Tono cercano pero serio, nunca infantil.
- Conservá los números importantes (porcentajes, tamaños de muestra, años).
- Si hay jerga imprescindible, explicala una vez entre paréntesis la primera vez.
- NO inventes hallazgos que no estén en el abstract. Si algo es ambiguo, decilo ("según los autores…", "no queda claro si…").
- 2-4 párrafos cortos. Sin listas ni bullets.
- No empieces con "Este paper…" ni "Los autores…". Empezá por el hallazgo o la pregunta.
- Terminá con una línea sobre la limitación más relevante si el abstract la menciona.
- No uses emoji. No uses markdown. Solo prosa.`;

function cors(resp: Response): Response {
  resp.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  resp.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  resp.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return resp;
}

function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return cors(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
    })
  );
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** Bump the version prefix (v1 → v2) to invalidate every cached explanation. */
const CACHE_PREFIX = 'pv:explain:v1';
/** 90 days — abstracts are static, this is just a safety net. */
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 90;

function cacheKey(paperId: string): string {
  return `${CACHE_PREFIX}:${paperId}`;
}

async function cacheGet(paperId: string): Promise<string | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(cacheKey(paperId))}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { result: string | null };
    return data.result ?? null;
  } catch {
    return null;
  }
}

async function cacheSet(paperId: string, value: string): Promise<void> {
  if (!REDIS_URL || !REDIS_TOKEN) return;
  try {
    await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([['SET', cacheKey(paperId), value, 'EX', String(CACHE_TTL_SECONDS)]]),
    });
  } catch {
  }
}

const BUCKET = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;   // 1 hour
const LIMIT = 30;                   // per IP per window

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = BUCKET.get(ip);
  if (!entry || entry.resetAt < now) {
    BUCKET.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

interface ReqBody {
  paperId?: string;
  title?: string;
  abstract?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: 'Server misconfigured: ANTHROPIC_API_KEY missing' });

  const ip =
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  if (rateLimited(ip)) {
    return json(429, { error: 'Demasiadas explicaciones seguidas. Probá en un rato.' });
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return json(400, { error: 'Body must be JSON' });
  }
  const paperId = (body.paperId ?? '').trim();
  const title = (body.title ?? '').trim();
  const abstract = (body.abstract ?? '').trim();

  if (!paperId || !title || !abstract) {
    return json(400, { error: 'paperId, title y abstract son obligatorios' });
  }
  if (abstract.length > 8000) {
    return json(400, { error: 'Abstract demasiado largo (máx 8000 caracteres)' });
  }

  const cached = await cacheGet(paperId);
  if (cached) {
    return json(
      200,
      { explanation: cached, cached: true },
      { 'x-pv-cache': 'hit' }
    );
  }

  const cacheStatus = REDIS_URL && REDIS_TOKEN ? 'miss' : 'skip';

  const userPrompt = `Título del paper: ${title}

Abstract original:
${abstract}

Traducilo al español rioplatense claro siguiendo las reglas del sistema.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        temperature: 0.4,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => r.statusText);
      return json(502, { error: `Upstream: ${r.status} ${errText.slice(0, 200)}` });
    }

    const data = (await r.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const explanation =
      data.content
        ?.filter(c => c.type === 'text')
        .map(c => c.text ?? '')
        .join('\n')
        .trim() ?? '';

    if (!explanation) {
      return json(502, { error: 'El modelo no devolvió texto.' });
    }

    void cacheSet(paperId, explanation);

    return json(
      200,
      { explanation, cached: false },
      { 'x-pv-cache': cacheStatus }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown upstream failure';
    return json(502, { error: msg });
  }
}
