import { reconstructAbstract } from './abstract';
import { TOPICS, topicForConcepts, type Topic } from './topics';

const POLITE = import.meta.env.VITE_POLITE_MAILTO ?? 'paperverse@example.com';
const BASE = 'https://api.openalex.org';

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
  open_access?: { is_oa: boolean; oa_url?: string | null };
  cited_by_count?: number;
  authorships: OpenAlexAuthorship[];
  concepts?: OpenAlexConcept[];
  abstract_inverted_index?: Record<string, number[]> | null;
  referenced_works?: string[];
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
  conceptsRaw: OpenAlexConcept[];
}

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
    conceptsRaw: w.concepts ?? [],
  };
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return 'Autores desconocidos';
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  if (authors.length === 3) return `${authors[0]}, ${authors[1]} & ${authors[2]}`;
  return `${authors[0]}, ${authors[1]} & ${authors.length - 2} más`;
}

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

export interface FeedOptions {
  topics: Topic[];
  /** How many papers to fetch. */
  limit?: number;
  /** Days back for publication_date filter. */
  daysBack?: number;
}

/** Feed: recent papers in the user's selected topics, sorted by citation count. */
export async function fetchFeed({
  topics,
  limit = 24,
  daysBack = 60,
}: FeedOptions): Promise<Paper[]> {
  const filters: string[] = [`from_publication_date:${cutoffDate(daysBack)}`];
  const cf = conceptFilter(topics);
  if (cf) filters.push(cf);
  filters.push('has_abstract:true');
  filters.push('type:article');
  filters.push('primary_location.source.type:journal');
  filters.push('has_doi:true');

  const isSubset = topics.length > 0 && topics.length < TOPICS.length;
  const perPage = Math.min(isSubset ? limit * 3 : limit, 200);

  const qs = buildQuery({
    filter: filters.join(','),
    sort: 'cited_by_count:desc',
    per_page: perPage,
    select:
      'id,doi,title,display_name,publication_date,publication_year,type,open_access,cited_by_count,authorships,concepts,abstract_inverted_index,referenced_works,primary_location,best_oa_location',
  });

  const data = await fetchJSON<WorksResponse>(`${BASE}/works?${qs}`);
  const papers = data.results.map(normalize);

  if (!isSubset) return papers.slice(0, limit);

  const allowed = new Set(topics.map(t => t.id));
  const strictlyMatching = papers.filter(p => {
    const t = topicForConcepts(p.conceptsRaw);
    return !!t && allowed.has(t.id);
  });
  return (strictlyMatching.length > 0 ? strictlyMatching : papers).slice(0, limit);
}

/** Full-text search. Honors topic filter if a subset of topics is provided. */
export async function searchPapers(
  query: string,
  opts: { limit?: number; topics?: Topic[] } = {}
): Promise<Paper[]> {
  if (!query.trim()) return [];
  const limit = opts.limit ?? 25;
  const filters: string[] = ['has_abstract:true'];
  if (opts.topics && opts.topics.length > 0) {
    const cf = conceptFilter(opts.topics);
    if (cf) filters.push(cf);
  }
  const qs = buildQuery({
    search: query,
    per_page: limit,
    filter: filters.join(','),
    sort: 'relevance_score:desc',
    select:
      'id,doi,title,display_name,publication_date,publication_year,type,open_access,cited_by_count,authorships,concepts,abstract_inverted_index,referenced_works,primary_location,best_oa_location',
  });
  const data = await fetchJSON<WorksResponse>(`${BASE}/works?${qs}`);
  return data.results.map(normalize);
}

/** Single paper by short ID. */
export async function fetchPaper(id: string): Promise<Paper> {
  const shortIdClean = id.replace(/^W/, 'W');
  const qs = buildQuery({
    select:
      'id,doi,title,display_name,publication_date,publication_year,type,open_access,cited_by_count,authorships,concepts,abstract_inverted_index,referenced_works,primary_location,best_oa_location',
  });
  const w = await fetchJSON<OpenAlexWork>(`${BASE}/works/${shortIdClean}?${qs}`);
  return normalize(w);
}

/** Papers that this paper cites (its references). */
export async function fetchReferences(paper: Paper, limit = 30): Promise<Paper[]> {
  if (paper.referencedWorks.length === 0) return [];
  const ids = paper.referencedWorks.slice(0, limit).join('|');
  const qs = buildQuery({
    filter: `ids.openalex:${ids}`,
    per_page: limit,
    sort: 'cited_by_count:desc',
    select:
      'id,doi,title,display_name,publication_date,publication_year,type,open_access,cited_by_count,authorships,concepts,abstract_inverted_index,referenced_works,primary_location,best_oa_location',
  });
  const data = await fetchJSON<WorksResponse>(`${BASE}/works?${qs}`);
  return data.results.map(normalize);
}

/** Papers that cite this paper (its citers). */
export async function fetchCitedBy(paper: Paper, limit = 12): Promise<Paper[]> {
  const qs = buildQuery({
    filter: `cites:${paper.id}`,
    sort: 'cited_by_count:desc',
    per_page: limit,
    select:
      'id,doi,title,display_name,publication_date,publication_year,type,open_access,cited_by_count,authorships,concepts,abstract_inverted_index,referenced_works,primary_location,best_oa_location',
  });
  const data = await fetchJSON<WorksResponse>(`${BASE}/works?${qs}`);
  return data.results.map(normalize);
}

/**
 * Random paper for the "Dato random" button. Uses OpenAlex's `sample=N&seed`
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
  const seed = Math.floor(Math.random() * 1_000_000);
  const qs = buildQuery({
    filter: filters.join(','),
    sample: 1,
    seed,
    per_page: 1,
    select:
      'id,doi,title,display_name,publication_date,publication_year,type,open_access,cited_by_count,authorships,concepts,abstract_inverted_index,referenced_works,primary_location,best_oa_location',
  });
  const data = await fetchJSON<WorksResponse>(`${BASE}/works?${qs}`);
  return data.results[0] ? normalize(data.results[0]) : null;
}

/** "Similar papers": same top concepts, different paper. */
export async function fetchSimilar(paper: Paper, limit = 8): Promise<Paper[]> {
  const topConcepts = [...paper.conceptsRaw]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(c => c.id.split('/').pop()!)
    .filter(Boolean);
  if (topConcepts.length === 0) return [];

  const qs = buildQuery({
    filter: `concepts.id:${topConcepts.join('|')},has_abstract:true,type:article`,
    sort: 'cited_by_count:desc',
    per_page: limit + 1,          // +1 so we can drop the current paper
    select:
      'id,doi,title,display_name,publication_date,publication_year,type,open_access,cited_by_count,authorships,concepts,abstract_inverted_index,referenced_works,primary_location,best_oa_location',
  });
  const data = await fetchJSON<WorksResponse>(`${BASE}/works?${qs}`);
  return data.results.map(normalize).filter(p => p.id !== paper.id).slice(0, limit);
}
