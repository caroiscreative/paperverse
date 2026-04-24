// Typed client for the OpenAlex public API.
// https://api.openalex.org/works
//
// OpenAlex is free, no auth, 100k req/day with polite pool (mailto).
// Set VITE_POLITE_MAILTO in env to identify yourself and get priority.

import { reconstructAbstract } from './abstract';
import { TOPICS, topicForConcepts, type Topic } from './topics';

const POLITE = import.meta.env.VITE_POLITE_MAILTO ?? 'paperverse@example.com';
const BASE = 'https://api.openalex.org';

// ————————————————————————————————————————————————————————
// Raw API shapes (only the fields we actually read)
// ————————————————————————————————————————————————————————

export interface OpenAlexConcept {
  id: string;               // URL: https://openalex.org/C154945302
  display_name: string;
  level: number;
  score: number;
}

export interface OpenAlexAuthor {
  id: string;
  display_name: string;
  orcid?: string | null;
}

export interface OpenAlexInstitution {
  id: string;
  display_name: string;
  country_code?: string | null;
}

export interface OpenAlexAuthorship {
  author: OpenAlexAuthor;
  institutions: OpenAlexInstitution[];
  countries?: string[];
}

export interface OpenAlexWork {
  id: string;                                // URL
  doi?: string | null;
  title?: string | null;
  display_name: string;
  publication_date?: string | null;
  publication_year?: number | null;
  type?: string | null;
  // OpenAlex devuelve el idioma original como ISO 639-1 (p.ej. "en", "de", "zh").
  // Lo usamos en PaperDetail para etiquetar el abstract original con su idioma
  // antes de ofrecer la traducción al español.
  language?: string | null;
  open_access?: { is_oa: boolean; oa_url?: string | null };
  cited_by_count?: number;
  authorships: OpenAlexAuthorship[];
  concepts?: OpenAlexConcept[];
  abstract_inverted_index?: Record<string, number[]> | null;
  referenced_works?: string[];
  // IDs de papers que OpenAlex considera "relacionados" por embedding semántico
  // de título+abstract. Señal por-paper (no por-categoría) — es lo que usamos en
  // fetchSimilar para romper la repetición que generaba el matcheo por conceptos
  // solamente. Cada paper tiene hasta ~10-20 IDs acá.
  // Docs: https://docs.openalex.org/api-entities/works/work-object#related_works
  related_works?: string[];
  primary_location?: {
    source?: { display_name?: string | null } | null;
    landing_page_url?: string | null;
  } | null;
  best_oa_location?: { landing_page_url?: string | null; pdf_url?: string | null } | null;
}

interface WorksResponse {
  results: OpenAlexWork[];
  meta?: { count: number; per_page: number; page: number };
}

// ————————————————————————————————————————————————————————
// Normalized shape used across the UI
// ————————————————————————————————————————————————————————

export interface Paper {
  id: string;                  // short form: "W4400123456"
  fullId: string;              // full URL
  title: string;
  abstract: string | null;     // reconstructed
  authorsLine: string;         // "Alice B., Carlos C. & 3 more"
  primaryAuthor: string;
  institution: string;
  countryCode: string;         // ISO-2, uppercase, or ''
  year: number | null;
  publicationDate: string | null;
  journal: string;
  doi: string | null;
  url: string;                 // best URL for "Leer paper completo"
  openAccess: boolean;
  citedByCount: number;
  referencedWorks: string[];   // short ids, e.g., ["W123", "W456"]
  /** IDs de "papers relacionados" pre-computados por OpenAlex (embedding semántico
   *  de título+abstract). Usamos esto como señal PRIMARIA en fetchSimilar porque
   *  es específica del paper, no de la categoría — rompe la repetición que
   *  producía matchear sólo por conceptos. Hasta ~20 IDs. */
  relatedWorks: string[];
  conceptsRaw: OpenAlexConcept[];
  // ISO 639-1 del idioma original del paper según OpenAlex. Puede ser null si
  // el índice no lo resolvió. La UI lo traduce a nombre humano en español
  // (ver languageLabel en src/lib/language.ts) para el tag "Original en …".
  language: string | null;
}

// ————————————————————————————————————————————————————————
// Utilities
// ————————————————————————————————————————————————————————

function shortId(urlOrId: string): string {
  return urlOrId.split('/').pop() ?? urlOrId;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  parts.push(`mailto=${encodeURIComponent(POLITE)}`);
  return parts.join('&');
}

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) {
    throw new Error(`OpenAlex ${r.status}: ${r.statusText} — ${url}`);
  }
  return r.json() as Promise<T>;
}

function normalize(w: OpenAlexWork): Paper {
  const authors = w.authorships.map(a => a.author.display_name);
  const primaryAuthor = authors[0] ?? 'Autores desconocidos';
  const first = w.authorships[0];
  const inst = first?.institutions[0];
  const countryCode =
    (inst?.country_code || first?.countries?.[0] || '').toUpperCase();
  const doi = w.doi ? w.doi.replace('https://doi.org/', '') : null;

  return {
    id: shortId(w.id),
    fullId: w.id,
    title: (w.title ?? w.display_name ?? '(sin título)').trim(),
    abstract: reconstructAbstract(w.abstract_inverted_index),
    authorsLine: formatAuthors(authors),
    primaryAuthor,
    institution: inst?.display_name ?? 'Institución no indicada',
    countryCode,
    year: w.publication_year ?? null,
    publicationDate: w.publication_date ?? null,
    journal: w.primary_location?.source?.display_name ?? 'Preprint',
    doi,
    url:
      w.best_oa_location?.landing_page_url ||
      w.primary_location?.landing_page_url ||
      (doi ? `https://doi.org/${doi}` : w.id),
    openAccess: !!w.open_access?.is_oa,
    citedByCount: w.cited_by_count ?? 0,
    referencedWorks: (w.referenced_works ?? []).map(shortId),
    relatedWorks: (w.related_works ?? []).map(shortId),
    conceptsRaw: w.concepts ?? [],
    language: w.language ?? null,
  };
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return 'Autores desconocidos';
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  if (authors.length === 3) return `${authors[0]}, ${authors[1]} & ${authors[2]}`;
  return `${authors[0]}, ${authors[1]} & ${authors.length - 2} más`;
}

// ————————————————————————————————————————————————————————
// Query helpers
// ————————————————————————————————————————————————————————

/** Date for "publication_date:>" filter, default last 60 days. */
function cutoffDate(daysBack = 60): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

function conceptFilter(topics: Topic[]): string {
  const ids = topics.flatMap(t => t.concepts);
  if (ids.length === 0) return '';
  return `concepts.id:${ids.join('|')}`;
}

// ————————————————————————————————————————————————————————
// Sort (2026-04-21, Fase 4 — sort-by en Feed/Refs/Cites)
// ————————————————————————————————————————————————————————
//
// Todo el feed, las referencias y las citas comparten el mismo menú
// "Ordenar por" y la misma URL param ?sort=<SortKey>. La clave viaja
// entre vistas (Feed → Refs → Cites → Feed) gracias a feedReturn.ts
// que guarda la URL completa para el botón Feed del header.
//
// El nombre de cada SortKey es semántico (qué significa para el usuario)
// más que técnico (cómo se lo pasamos a OpenAlex). Así si mañana OpenAlex
// cambia una API o queremos swapear un combo, el contrato con el resto
// del frontend no se rompe.

export type SortKey =
  | 'latest_cited'  // combo publication_date:desc,cited_by_count:desc — DEFAULT del Feed
  | 'cites_desc'    // más citados primero
  | 'cites_asc'     // menos citados primero (útil para encontrar papers frescos/desatendidos)
  | 'date_desc'     // más recientes primero
  | 'date_asc'      // más viejos primero (útil en refs para ver la genealogía)
  | 'title_asc'     // A → Z
  | 'title_desc'    // Z → A
  | 'fwci_desc'     // impacto normalizado por campo — lo más relevante "de verdad"
  | 'relevance';    // sólo válido con search; fallback silencioso a latest_cited si no hay query

/**
 * Traduce una SortKey semántica al parámetro `sort=` que entiende OpenAlex.
 * `hasSearch` controla el único caso especial: `relevance_score` sólo es
 * válido cuando la request incluye `search=...`. Si alguien pide sort por
 * relevancia fuera de un search, devolvemos el default (latest_cited) en
 * vez de tirar un 400 de OpenAlex.
 */
export function buildSortParam(sort: SortKey, hasSearch: boolean): string {
  switch (sort) {
    case 'latest_cited':
      return 'publication_date:desc,cited_by_count:desc';
    case 'cites_desc':
      return 'cited_by_count:desc';
    case 'cites_asc':
      return 'cited_by_count:asc';
    case 'date_desc':
      return 'publication_date:desc';
    case 'date_asc':
      return 'publication_date:asc';
    case 'title_asc':
      return 'display_name:asc';
    case 'title_desc':
      return 'display_name:desc';
    case 'fwci_desc':
      return 'fwci:desc';
    case 'relevance':
      return hasSearch ? 'relevance_score:desc' : 'publication_date:desc,cited_by_count:desc';
  }
}

/** Whitelist guard para sanitizar el URL param antes de usarlo. */
export function isSortKey(x: string | null | undefined): x is SortKey {
  return (
    x === 'latest_cited' || x === 'cites_desc' || x === 'cites_asc' ||
    x === 'date_desc' || x === 'date_asc' ||
    x === 'title_asc' || x === 'title_desc' ||
    x === 'fwci_desc' || x === 'relevance'
  );
}

export const DEFAULT_SORT: SortKey = 'latest_cited';

// ————————————————————————————————————————————————————————
// Shared select — campos de OpenAlex que pedimos en cada request. Centralizado
// para no tener el string duplicado 8 veces y olvidarnos de sumar un campo en
// un endpoint cuando lo agregamos en otro (bug real: `related_works` agregado
// al tipo pero olvidado en fetchPaper hasta una review posterior).
// ————————————————————————————————————————————————————————

const WORK_SELECT =
  'id,doi,title,display_name,publication_date,publication_year,type,language,' +
  'open_access,cited_by_count,authorships,concepts,abstract_inverted_index,' +
  'referenced_works,related_works,primary_location,best_oa_location';

// ————————————————————————————————————————————————————————
// Public API
// ————————————————————————————————————————————————————————

export interface FeedOptions {
  topics: Topic[];
  /** How many papers to fetch. */
  limit?: number;
  /** Days back for publication_date filter. */
  daysBack?: number;
  /** Orden del feed. Default: `latest_cited` (fecha desc, citas desc). */
  sort?: SortKey;
}

/** Feed: recent papers in the user's selected topics. */
export async function fetchFeed({
  topics,
  limit = 24,
  daysBack = 60,
  sort = DEFAULT_SORT,
}: FeedOptions): Promise<Paper[]> {
  const filters: string[] = [`from_publication_date:${cutoffDate(daysBack)}`];
  const cf = conceptFilter(topics);
  if (cf) filters.push(cf);
  // Only papers with abstracts — otherwise Explicámelo has nothing to translate.
  filters.push('has_abstract:true');
  filters.push('type:article');
  // Require a real peer-reviewed journal source. This is what keeps Zenodo/arXiv
  // re-deposits from polluting the feed with "1993 paper uploaded as v3 in 2026"
  // ghosts. Trade-off: some legit preprints won't show up — acceptable for a
  // trust-first MVP.
  filters.push('primary_location.source.type:journal');
  filters.push('has_doi:true');

  // If the user picked a proper subset of topics we over-fetch and then post-filter
  // so the paper's *best-scoring* topic actually matches. Without this, OpenAlex
  // happily returns a psychology-primary paper under a Neurociencia filter just
  // because it has neuroscience as a 0.15-score tag — and then topicForConcepts
  // labels the card "Psicología", which reads as a bug to the user.
  const isSubset = topics.length > 0 && topics.length < TOPICS.length;
  const perPage = Math.min(isSubset ? limit * 3 : limit, 200);

  const qs = buildQuery({
    filter: filters.join(','),
    // hasSearch=false: en el feed no hay query de búsqueda, así que si
    // alguien pasa sort='relevance' el builder cae a latest_cited solo.
    sort: buildSortParam(sort, false),
    per_page: perPage,
    select: WORK_SELECT,
  });

  const data = await fetchJSON<WorksResponse>(`${BASE}/works?${qs}`);
  const papers = data.results.map(normalize);

  if (!isSubset) return papers.slice(0, limit);

  const allowed = new Set(topics.map(t => t.id));
  const strictlyMatching = papers.filter(p => {
    const t = topicForConcepts(p.conceptsRaw);
    return !!t && allowed.has(t.id);
  });
  // Safety net: if over-aggressive filtering empties the feed, fall back to the
  // concept-level match instead of showing "Vacío por ahora".
  return (strictlyMatching.length > 0 ? strictlyMatching : papers).slice(0, limit);
}

/** Full-text search. Honors topic filter if a subset of topics is provided. */
export async function searchPapers(
  query: string,
  opts: { limit?: number; topics?: Topic[]; daysBack?: number; sort?: SortKey } = {}
): Promise<Paper[]> {
  if (!query.trim()) return [];
  const limit = opts.limit ?? 25;
  // Relevance-first default: sólo exigimos abstract (Explicámelo lo necesita) y
  // ordenamos por relevance_score salvo que el usuario pida lo contrario en el
  // dropdown. Filtrar más agresivo mata recall — un buscador que no encuentra
  // "transformers" clásico es peor que uno con ruido.
  const filters: string[] = ['has_abstract:true'];
  // Optional time window — si el usuario tiene la perilla de Período en
  // "6 meses", respetamos eso también en search (antes el buscador era global
  // sin filtro temporal, lo que hacía que el control de Período se viera
  // pero no hiciera nada). mantener filtros visibles y vigentes en
  // modo búsqueda. No default — si no se pasa, la búsqueda es global como antes.
  if (typeof opts.daysBack === 'number' && opts.daysBack > 0) {
    filters.push(`from_publication_date:${cutoffDate(opts.daysBack)}`);
  }
  // When the user has a proper subset of topics active, scope search to them so
  // picking "Materiales" doesn't return medicine + seismology + tech.
  if (opts.topics && opts.topics.length > 0) {
    const cf = conceptFilter(opts.topics);
    if (cf) filters.push(cf);
  }
  // En modo search el default conceptual es 'relevance' — el que busca quiere
  // lo más pertinente al query, no lo más nuevo. Pero si el dropdown dice
  // "Más citados", respetamos.
  const sortKey = opts.sort ?? 'relevance';
  const qs = buildQuery({
    search: query,
    per_page: limit,
    filter: filters.join(','),
    sort: buildSortParam(sortKey, true),
    select: WORK_SELECT,
  });
  const data = await fetchJSON<WorksResponse>(`${BASE}/works?${qs}`);
  return data.results.map(normalize);
}

/** Single paper by short ID. */
export async function fetchPaper(id: string): Promise<Paper> {
  const shortIdClean = id.replace(/^W/, 'W');
  const qs = buildQuery({
    select: WORK_SELECT,
  });
  const w = await fetchJSON<OpenAlexWork>(`${BASE}/works/${shortIdClean}?${qs}`);
  return normalize(w);
}

/** Papers that this paper cites (its references). */
export async function fetchReferences(
  paper: Paper,
  limit = 30,
  sort: SortKey = DEFAULT_SORT,
): Promise<Paper[]> {
  if (paper.referencedWorks.length === 0) return [];
  // OpenAlex works endpoint accepts ids.openalex as a filter for batch-by-ID lookup.
  // `openalex_id` is NOT a valid field — it silently returned wrong results.
  // Docs: https://docs.openalex.org/api-entities/works/filter-works#ids.openalex
  const ids = paper.referencedWorks.slice(0, limit).join('|');
  const qs = buildQuery({
    filter: `ids.openalex:${ids}`,
    per_page: limit,
    // hasSearch=false en refs/cites: no hay query de búsqueda. 'relevance'
    // caería automáticamente a latest_cited.
    sort: buildSortParam(sort, false),
    select: WORK_SELECT,
  });
  const data = await fetchJSON<WorksResponse>(`${BASE}/works?${qs}`);
  return data.results.map(normalize);
}

/** Papers that cite this paper (its citers). */
export async function fetchCitedBy(
  paper: Paper,
  limit = 12,
  sort: SortKey = DEFAULT_SORT,
): Promise<Paper[]> {
  const qs = buildQuery({
    filter: `cites:${paper.id}`,
    sort: buildSortParam(sort, false),
    per_page: limit,
    select: WORK_SELECT,
  });
  const data = await fetchJSON<WorksResponse>(`${BASE}/works?${qs}`);
  return data.results.map(normalize);
}

/**
 * Random paper for the "Paper al azar" button. Uses OpenAlex's `sample=N&seed`
 * to pull a single semi-random well-cited paper across the user's topics.
 * We require has_abstract + high citation threshold so the surprise is worth
 * the click — a random obscure paper with 0 citations is noise, not delight.
 */
export async function fetchRandomPaper(opts: { topics?: Topic[] } = {}): Promise<Paper | null> {
  const filters: string[] = [
    'has_abstract:true',
    'type:article',
    'cited_by_count:>50',
  ];
  if (opts.topics && opts.topics.length > 0) {
    const cf = conceptFilter(opts.topics);
    if (cf) filters.push(cf);
  }
  // Changing the seed on every call is what makes consecutive clicks feel
  // random — without it, `sample=1` returns the same paper for the same query.
  const seed = Math.floor(Math.random() * 1_000_000);
  const qs = buildQuery({
    filter: filters.join(','),
    sample: 1,
    seed,
    per_page: 1,
    select: WORK_SELECT,
  });
  const data = await fetchJSON<WorksResponse>(`${BASE}/works?${qs}`);
  return data.results[0] ? normalize(data.results[0]) : null;
}

/**
 * "Papers similares" — la fila que se ve al final del PaperDetail.
 *
 * Rediseño 2026-04-23 (Carolina): el algoritmo viejo matcheaba sólo por los
 * top 3 conceptos (OR) y ordenaba por citas. Problemas que generaba:
 *   · Repetición por categoría: dos papers de IA comparten los mismos top
 *     conceptos → misma lista de similares → la fila se siente idéntica
 *     paper a paper.
 *   · Sesgo a clásicos: ordenar por citas siempre traía los mismos papers
 *     viejos de 1990 con 50k citas, no lo actualmente relevante.
 *   · Sin variedad: podía traer 4 papers del mismo autor.
 *   · Profundidad de match ignorada: compartir 1 concepto valía igual que
 *     compartir los 3.
 *
 * Nuevo algoritmo: multi-señal + scoring cliente-side + dedup por autor.
 *
 * Fuentes (en paralelo, 2 round-trips):
 *   (A) `related_works`: lista por-paper que OpenAlex pre-computa con
 *       embeddings semánticos de título + abstract. Es la señal más fuerte
 *       porque es ESPECÍFICA DEL PAPER — dos papers distintos de la misma
 *       categoría tienen related_works distintos. Fixes la repetición.
 *   (B) Concept-match amplio (mismo OR de top 3 conceptos que antes, pero
 *       traemos 25 candidatos en vez de 8). Sirve para cubrir casos donde
 *       related_works viene vacío (preprints) y para enriquecer el pool.
 *
 * Scoring: cada candidato se puntúa por:
 *   +100  si está en related_works del paper actual
 *   +20   por cada concepto top-3 compartido (max +60 si comparte los 3)
 *   +10   si es de los últimos 5 años (recencia sobre clásicos)
 *   +5    si 5-10 años
 *   +5    si tiene abstract (calidad editorial)
 *   +3    si tiene ≥ 10 citas (piso de relevancia, no sesgo a top citados)
 *   −30   si comparte primer autor con el paper actual (evita autobombo)
 *
 * Dedup final: máximo 1 paper por primer autor → variedad garantizada.
 *
 * Si no hay ninguna señal (paper sin conceptos y sin related_works),
 * devolvemos array vacío y el PaperDetail esconde la sección.
 */
export async function fetchSimilar(paper: Paper, limit = 8): Promise<Paper[]> {
  const topConcepts = [...paper.conceptsRaw]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(c => c.id.split('/').pop()!)
    .filter(Boolean);

  // Sin ninguna señal → no hay forma honesta de encontrar similares.
  if (topConcepts.length === 0 && paper.relatedWorks.length === 0) return [];

  // Normalizamos related_works a short IDs (ya vienen así del normalize, pero
  // defensive en caso de que en el futuro el tipo cambie).
  const relatedIds = paper.relatedWorks.slice(0, 20);

  // Queries en paralelo, nombradas para no confundirlas. Cada una cae a []
  // en error (no en reject) así si una falla la otra sigue — mejor tener 6
  // resultados que 0.
  const relatedPromise: Promise<Paper[]> =
    relatedIds.length > 0
      ? fetchJSON<WorksResponse>(
          `${BASE}/works?${buildQuery({
            // Batch por IDs: `ids.openalex` con separador | hace OR.
            filter: `ids.openalex:${relatedIds.join('|')},has_abstract:true,type:article`,
            per_page: relatedIds.length,
            select: WORK_SELECT,
          })}`,
        )
          .then(d => d.results.map(normalize))
          .catch(() => [])
      : Promise.resolve([]);

  const conceptPromise: Promise<Paper[]> =
    topConcepts.length > 0
      ? fetchJSON<WorksResponse>(
          `${BASE}/works?${buildQuery({
            // Pool amplio por conceptos — over-fetch (25) para darle al
            // re-scoring cliente-side margen de decisión. El sort por citas
            // es sólo para elegir CANDIDATOS; el orden final al usuario lo
            // calcula la fórmula de abajo, no este sort.
            filter: `concepts.id:${topConcepts.join('|')},has_abstract:true,type:article`,
            sort: 'cited_by_count:desc',
            per_page: 25,
            select: WORK_SELECT,
          })}`,
        )
          .then(d => d.results.map(normalize))
          .catch(() => [])
      : Promise.resolve([]);

  const [relatedPapers, conceptPapers] = await Promise.all([
    relatedPromise,
    conceptPromise,
  ]);

  // Merge dedupeando por id. Set para O(1) "está en related_works" abajo.
  const relatedSet = new Set(relatedIds);
  const myTopConceptSet = new Set(topConcepts);
  const byId = new Map<string, Paper>();
  for (const p of [...relatedPapers, ...conceptPapers]) {
    if (p.id === paper.id) continue; // nunca el paper actual
    if (!byId.has(p.id)) byId.set(p.id, p);
  }

  const currentYear = new Date().getFullYear();
  const sourceAuthor = paper.primaryAuthor;

  // Score + sort. Mantenemos el paper en la tupla para acceso posterior
  // (primaryAuthor para dedup final) sin re-computar nada.
  const scored = Array.from(byId.values()).map(p => {
    let s = 0;

    if (relatedSet.has(p.id)) s += 100;

    // Overlap de conceptos top-3: contamos cuántos de MIS top 3 aparecen en
    // el set completo de conceptos del candidato (no hace falta que sean top
    // del candidato — si lo tiene aunque sea débil, cuenta como señal).
    const overlap = p.conceptsRaw.reduce((acc, c) => {
      const id = c.id.split('/').pop() ?? c.id;
      return acc + (myTopConceptSet.has(id) ? 1 : 0);
    }, 0);
    s += overlap * 20;

    const y = p.year ?? 0;
    const yearsAgo = y > 0 ? currentYear - y : 999;
    if (yearsAgo <= 5) s += 10;
    else if (yearsAgo <= 10) s += 5;

    if (p.abstract) s += 5;
    if (p.citedByCount >= 10) s += 3;

    // Penalizar autor-eco: el lector buscando "similares" no quiere 4 papers
    // del mismo autor que escribió éste. No lo eliminamos completamente
    // (puede ser legítimamente el único match semántico), sólo lo bajamos.
    if (
      sourceAuthor &&
      sourceAuthor !== 'Autores desconocidos' &&
      p.primaryAuthor === sourceAuthor
    ) {
      s -= 30;
    }

    return { paper: p, score: s };
  });

  scored.sort((a, b) => b.score - a.score);

  // Dedup por primer autor: máximo 1 paper por autor. Garantiza variedad
  // en la fila — antes podías ver 3 papers seguidos del mismo Smith J. W.
  const seenAuthors = new Set<string>();
  const final: Paper[] = [];
  for (const { paper: p } of scored) {
    if (final.length >= limit) break;
    const author = p.primaryAuthor;
    // Autores desconocidos los dejamos pasar — es rare pero no lo queremos
    // colapsar a 1 sólo.
    if (author && author !== 'Autores desconocidos') {
      if (seenAuthors.has(author)) continue;
      seenAuthors.add(author);
    }
    final.push(p);
  }
  return final;
}
