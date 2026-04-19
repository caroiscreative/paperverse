export type TopicId =
  | 'ia'
  | 'clima'
  | 'neuro'
  | 'espacio'
  | 'fisica'
  | 'biologia'
  | 'medicina'
  | 'energia'
  | 'materiales'
  | 'matematica'
  | 'psicologia'
  | 'ecologia'
  | 'tecnologia'
  | 'quimica';

export interface Topic {
  id: TopicId;
  name: string;
  /** OpenAlex concept IDs — OR'd together when filtering. */
  concepts: string[];
  /** Full topic color (used for chip accent + paper card dot). */
  color: string;
  /** Soft tint for tile backgrounds. */
  soft: string;
  /** Deep variant for hovered/active icon color. */
  deep: string;
  /** SVG file name (in /public/assets/). Fallback to illus-paper.svg. */
  illus: string;
}

/**
 * Order is meaningful — the "next topics" recommendation cycles in this order
 * so the user sees a predictable rhythm between themes.
 * PRD §6 Onboarding O-02 defines this canonical list.
 */
export const TOPICS: Topic[] = [
  { id: 'ia',         name: 'IA',            concepts: ['C154945302', 'C119857082'], color: '#2E4BE0', soft: '#E0E6FF', deep: '#1E34B0', illus: 'illus-ia.svg' },
  { id: 'clima',      name: 'Clima',         concepts: ['C132651083', 'C39432304'],  color: '#1BA5B8', soft: '#CDEEF2', deep: '#0F7E8E', illus: 'illus-clima.svg' },
  { id: 'neuro',      name: 'Neurociencia',  concepts: ['C169760540'],               color: '#8B4FE0', soft: '#E8DCF9', deep: '#6A2FC0', illus: 'illus-neuro.svg' },
  { id: 'espacio',    name: 'Espacio',       concepts: ['C1276947', 'C111368507'],   color: '#F5B638', soft: '#FDEEC8', deep: '#C48A1A', illus: 'illus-espacio.svg' },
  { id: 'fisica',     name: 'Física',        concepts: ['C121332964'],               color: '#F2542D', soft: '#FDE4DA', deep: '#C73F1D', illus: 'illus-fisica.svg' },
  { id: 'biologia',   name: 'Biología',      concepts: ['C86803240'],                color: '#2E8B57', soft: '#D6EEDE', deep: '#1F6B3F', illus: 'illus-biologia.svg' },
  { id: 'medicina',   name: 'Medicina',      concepts: ['C71924100'],                color: '#E03E8C', soft: '#FADCEA', deep: '#B32168', illus: 'illus-medicina.svg' },
  { id: 'energia',    name: 'Energía',       concepts: ['C172651191', 'C548081761'], color: '#F2542D', soft: '#FDE4DA', deep: '#C73F1D', illus: 'illus-fisica.svg' },
  { id: 'materiales', name: 'Materiales',    concepts: ['C192562407'],               color: '#1BA5B8', soft: '#CDEEF2', deep: '#0F7E8E', illus: 'illus-fisica.svg' },
  { id: 'matematica', name: 'Matemática',    concepts: ['C33923547'],                color: '#2E4BE0', soft: '#E0E6FF', deep: '#1E34B0', illus: 'illus-paper.svg' },
  { id: 'psicologia', name: 'Psicología',    concepts: ['C15744967'],                color: '#8B4FE0', soft: '#E8DCF9', deep: '#6A2FC0', illus: 'illus-neuro.svg' },
  { id: 'ecologia',   name: 'Ecología',      concepts: ['C18903297'],                color: '#2E8B57', soft: '#D6EEDE', deep: '#1F6B3F', illus: 'illus-biologia.svg' },
  { id: 'tecnologia', name: 'Tecnología',    concepts: ['C41008148', 'C127413603'],  color: '#2E4BE0', soft: '#E0E6FF', deep: '#1E34B0', illus: 'illus-ia.svg' },
  { id: 'quimica',    name: 'Química',       concepts: ['C185592680'],               color: '#E03E8C', soft: '#FADCEA', deep: '#B32168', illus: 'illus-paper.svg' },
];

export const TOPICS_BY_ID: Record<TopicId, Topic> = Object.fromEntries(
  TOPICS.map(t => [t.id, t])
) as Record<TopicId, Topic>;

/**
 * Picks `count` topics para la fila "Próximos temas" del PaperDetail. Excluye
 * el tema del paper actual (no tiene sentido sugerir "más IA" si estás en un
 * paper de IA) y mezcla el resto con un shuffle seedeado por paper.
 *
 * El seed garantiza que refrescar la misma página te da los mismos 4 temas
 * (estable, no flash) pero papers distintos muestran combinaciones distintas.
 * Antes esto devolvía siempre los 4 topics siguientes en orden fijo, así que
 * leer IA siempre mostraba Clima/Neuro/Espacio/Física — y nunca Biología,
 * Materiales, Química, etc. Con el shuffle, todos los temas rotan.
 */
export function nextTopicsFrom(
  currentTopicId: TopicId | null,
  count = 4,
  seed?: string,
): Topic[] {
  const pool = TOPICS.filter(t => t.id !== currentTopicId);

  if (!seed || pool.length === 0) return pool.slice(0, count);

  const rand = mulberry32(hashSeed(seed));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Given a paper's OpenAlex concepts, pick the topic that best represents it.
 * Returns null if nothing matches — caller should fall back to generic paper illus.
 *
 * Strategy: each paper's concepts come with a .score from OpenAlex (how strongly
 * the concept applies). We score every topic by the *highest* matching concept
 * score and pick the winner. This fixes the bug where a thermodynamics paper
 * with a weak "Computer science" tag would get labeled as IA just because IA
 * was listed first.
 */
export function topicForConcepts(
  openAlexConcepts: { id: string; display_name?: string; score?: number }[] | undefined
): Topic | null {
  if (!openAlexConcepts || openAlexConcepts.length === 0) return null;

  const pool = [...openAlexConcepts]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3)
    .filter(c => (c.score ?? 0) >= 0.25);

  let best: { topic: Topic; score: number } | null = null;
  for (const topic of TOPICS) {
    for (const c of pool) {
      const shortId = c.id.split('/').pop() ?? c.id;
      if (!topic.concepts.includes(shortId)) continue;
      const score = c.score ?? 0;
      if (!best || score > best.score) {
        best = { topic, score };
      }
    }
  }
  return best?.topic ?? null;
}
