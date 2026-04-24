// The 14 official Paperverse topics (from PRD O-02).
// Each topic maps to one or more OpenAlex concept IDs, plus a color/illustration
// from the design system.
//
// Concept IDs come from OpenAlex's concept knowledge graph.
// Reference: https://docs.openalex.org/api-entities/concepts

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
  | 'quimica'
  // "ciencia": agregado como tema general para papers que
  // no clasifican cleanly en ninguno de los 14 específicos. Antes era un
  // string-fallback ("topic?.name ?? 'Ciencia'") y los papers sin tema
  // matcheado se pintaban sin el tratamiento visual completo (sin tinta
  // de fondo, sin ilustración de marca). Ahora Ciencia es un Topic de
  // primera clase: tiene color, soft, deep, illus — hereda todas las
  // mejoras que las demás categorías tenían. También aparece como chip
  // en los filtros de temas para que el usuario pueda elegir ver
  // "ciencia general" explícitamente.
  | 'ciencia';

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
  // Los 7 temas "secundarios" comparten familia de color con los 7 primeros
  // (energia↔fisica rojo, materiales↔clima teal, etc.) pero cada uno tiene
  // su propio tono para distinguirse — antes heredaban literal el mismo hex
  // y quedaban indistinguibles del primario. La paleta acá tiene que coincidir
  // 1:1 con public/topic-anim.js (que es donde viven las animaciones del hero):
  // si divergen, chip + ilustración 300px + animación se ven en tres colores
  // distintos por tema, que es exactamente el bug que se flaggeó en
  // tecnología. Regla: si tocás un color acá, espejá el cambio en topic-anim.js.
  { id: 'energia',    name: 'Energía',       concepts: ['C172651191', 'C548081761'], color: '#E8572C', soft: '#FBE0D3', deep: '#B8401A', illus: 'illus-energia.svg' },
  { id: 'materiales', name: 'Materiales',    concepts: ['C192562407'],               color: '#0E1116', soft: '#DADCE0', deep: '#2A2F38', illus: 'illus-materiales.svg' },
  { id: 'matematica', name: 'Matemática',    concepts: ['C33923547'],                color: '#3D6AE0', soft: '#D9E3FB', deep: '#254AB0', illus: 'illus-matematica.svg' },
  { id: 'psicologia', name: 'Psicología',    concepts: ['C15744967'],                color: '#A35FD8', soft: '#ECDCF9', deep: '#7A3FB8', illus: 'illus-psicologia.svg' },
  { id: 'ecologia',   name: 'Ecología',      concepts: ['C18903297'],                color: '#4FA068', soft: '#DFEEDF', deep: '#2F7040', illus: 'illus-ecologia.svg' },
  { id: 'tecnologia', name: 'Tecnología',    concepts: ['C41008148', 'C127413603'],  color: '#D89A2C', soft: '#F6E7C7', deep: '#A87818', illus: 'illus-tecnologia.svg' },
  { id: 'quimica',    name: 'Química',       concepts: ['C185592680'],               color: '#E06AA8', soft: '#F9DCE8', deep: '#B34378', illus: 'illus-quimica.svg' },
  // "Ciencia": tema general para papers que no clasifican cleanly
  // en ninguno de los 14 anteriores. Antes era un string-fallback literal
  // ("topic?.name ?? 'Ciencia'") que dejaba a esos papers sin el tratamiento
  // visual completo: sin tinta de fondo en el thumbnail, sin ilustración de
  // marca, sin aparecer como chip filtrable. Ahora es un Topic de primera
  // clase con su propia paleta slate neutral (evita competir cromáticamente
  // con los 14 específicos) y reutiliza illus-paper.svg como ícono "genérico".
  // Conceptos: Sociology, Geology, Geography — disciplinas amplias que no
  // están cubiertas por los temas específicos y suelen aparecer en papers
  // interdisciplinarios o de ciencias sociales que deberían caer en "Ciencia
  // general" en vez de ser clasificados incorrectamente en uno de los 14.
  { id: 'ciencia',    name: 'Ciencia',       concepts: ['C144024400', 'C127313418', 'C205649164'], color: '#5B6472', soft: '#E3E6EB', deep: '#3F4752', illus: 'illus-paper.svg' },
];

export const TOPICS_BY_ID: Record<TopicId, Topic> = Object.fromEntries(
  TOPICS.map(t => [t.id, t])
) as Record<TopicId, Topic>;

/**
 * Misma data que TOPICS pero ordenada alfabéticamente por `name` (español,
 * con localeCompare — respeta acentos y Ñ). Lo usamos en los listados de
 * chips (Feed sidebar, Welcome onboarding, DesignSystem showcase) donde
 * el usuario está escaneando la lista para elegir un tema y el orden
 * alfabético es lo esperado.
 *
 * NO reemplaza a TOPICS: `nextTopicsFrom()` y `resolveTopicVisual()`
 * siguen dependiendo del orden canónico editorial (primarios → secundarios
 * → Ciencia) porque eso controla la secuencia de recomendaciones en
 * PaperDetail. El orden canónico es semántico, el alfabético es UX.
 */
export const TOPICS_ALPHABETICAL: Topic[] = [...TOPICS].sort((a, b) =>
  a.name.localeCompare(b.name, 'es'),
);

/**
 * Fondo del thumb de un paper — siempre `topic.soft` del tema.
 *
 * Historia: antes esta función rotaba 3 tintas derivadas del soft (la base,
 * una "cálida" con 18% color, una "sobria" con 10% ink) según un hash del
 * paperId, con la idea de dar "variedad de arte por categoría" en feeds
 * filtrados a 1-2 temas. En la práctica eso generaba
 * una sensación de inconsistencia: dos papers de IA se veían con fondos
 * distintos, la lectura "este es el color de IA" se diluía. Simplificamos
 * a un fondo estable por tema — si queremos variedad más adelante, lo
 * hacemos con diferentes ilustraciones (no con tintas del fondo).
 *
 * Mantenemos la firma `(topic, paperId)` por back-compat con los callers,
 * aunque `paperId` ya no se use. Si algún día nadie lo pasa, podemos
 * deprecarla y usar `topic.soft` directo.
 */
export function thumbTintForPaper(topic: Topic, _paperId: string): string {
  return topic.soft;
}

// QA2 P2.3 rollback — `thumbTransformForPaper` se eliminó porque
// las ilustraciones rotadas/espejadas "se veían extrañísimas" (palabras de
// Carolina). La idea original era generar ritmo visual rotando ±5° y
// espejando horizontalmente los SVG de cada paper, pero en la práctica las
// cards quedaban inclinadas de forma inconsistente y el flip horizontal
// rompía elementos con direccionalidad sutil (ej. el gradiente de
// illus-fisica). La variación cromática por paper (thumbTintForPaper)
// sigue viva porque eso sí funciona — es sólo la transform geométrica la
// que sacamos. Si algún día queremos retomar variación de ilustración,
// la solución correcta es generar SVGs alternativos por tema en vez de
// transformar el mismo SVG.

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

  // Sin seed (o pool vacío) devolvemos los primeros — fallback determinista.
  if (!seed || pool.length === 0) return pool.slice(0, count);

  // Fisher-Yates con PRNG seedeado: mismo seed → misma salida, pero cambia
  // con el paperId. Usamos mulberry32, que es suficiente para shuffle.
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
/**
 * Como `topicForConcepts` pero nunca devuelve null. Si la clasificación falla
 * (scores débiles / sin match), cae a un tema deterministicamente elegido por
 * hash del paperId. Se usa *sólo* para decidir qué animación DS2 pintar en el
 * banner — la clasificación "honesta" para el eyebrow/texto sigue usando
 * topicForConcepts (que puede seguir devolviendo null → topicOrCiencia lo
 * traduce al Topic "ciencia").
 *
 * Motivo: antes, cuando topicForConcepts devolvía null, PaperCardTile/HeroPaperCard
 * caían a HeroBanner (la escena cósmica DS1 vieja). se pidió que el DS2 se
 * vea siempre — entonces forzamos una elección visual aunque el clasificador
 * no esté convencido.
 *
 * Update 2026-04-20: Ciencia ya tiene su propio renderer DS2
 * (paper llenándose + sello aprobado) en public/topic-anim.js, así que
 * dejamos de excluirla del flujo. Ahora:
 *   - Si `topicForConcepts` matchea un tema específico (incluyendo Ciencia
 *     cuando los conceptos Sociology/Geology/Geography ganan), lo usamos tal
 *     cual — la animación correspondiente existe.
 *   - Si no hay match, seguimos cayendo a un tema hasheado por paperId.
 *     Dejamos Ciencia EN el pool de fallback para que papers sin clasificar
 *     también puedan aterrizar en la animación "paper genérico" que le da
 *     coherencia narrativa a un paper "sin tema fuerte".
 */
export function resolveTopicVisual(
  openAlexConcepts: { id: string; display_name?: string; score?: number }[] | undefined,
  paperId: string,
): Topic {
  const matched = topicForConcepts(openAlexConcepts);
  if (matched) return matched;
  const idx = hashSeed(paperId) % TOPICS.length;
  return TOPICS[idx];
}

/**
 * Como `topicForConcepts` pero devuelve el Topic "ciencia" en vez de null
 * cuando no hay match. Usar en callers que antes hacían
 * `topic?.name ?? 'Ciencia'` o `topic?.illus ?? 'illus-paper.svg'`: ahora
 * `topicOrCiencia(concepts)` devuelve un Topic completo con todas las
 * propiedades (name/illus/color/soft/deep) y los callers pueden dropear el
 * null-check. Así Ciencia hereda el mismo tratamiento visual que el resto
 * (tinta de fondo, ilustración de marca, chip uniforme).
 *
 * No reemplaza a topicForConcepts — hay lugares que todavía necesitan saber
 * si la clasificación fue "honesta" (ej. para el filtro por tema en Feed,
 * que debería no matchear a papers genéricos de Ciencia a menos que el
 * usuario explícitamente filtre por Ciencia).
 */
export function topicOrCiencia(
  openAlexConcepts: { id: string; display_name?: string; score?: number }[] | undefined
): Topic {
  return topicForConcepts(openAlexConcepts) ?? TOPICS_BY_ID.ciencia;
}

export function topicForConcepts(
  openAlexConcepts: { id: string; display_name?: string; score?: number }[] | undefined
): Topic | null {
  if (!openAlexConcepts || openAlexConcepts.length === 0) return null;

  // Only consider the top 3 concepts by score. OpenAlex returns a long tail of
  // weak signals — si dejamos votar a cada tag, un paper de termodinámica con
  // un tag vestigial de "Computer science" termina etiquetado como IA.
  //
  // dos mejoras de precisión:
  //   1. Subimos el threshold mínimo de 0.25 → 0.35. OpenAlex usa scores 0-1
  //      y los tags "de relleno" suelen caer por debajo de 0.3. Con 0.25
  //      aceptábamos matches borderline que arrastraban papers al tema
  //      equivocado (ej. un paper de neurociencia con C.S. 0.27 terminaba
  //      en IA). Con 0.35 exigimos que el concepto sea una seña fuerte.
  //   2. Position weighting: el concepto #1 por score domina sobre los
  //      secundarios con un multiplicador. Antes, si el #1 y el #2 eran
  //      de temas distintos pero tenían scores cercanos, el empate se
  //      rompía por el orden de TOPICS (determinista pero arbitrario).
  //      Ahora el #1 pesa 1.0x, el #2 0.7x y el #3 0.5x, así el tema
  //      dominante del paper gana de forma previsible.
  //   3. Accumulation: un paper con DOS conceptos del mismo tema (ej.
  //      C154945302 y C119857082 ambos en IA) debería quedar en ese
  //      tema con más confianza que uno con un solo match. Sumamos los
  //      scores ponderados por tema en vez de tomar el máximo, así el
  //      match múltiple gana al match único en casos ambiguos.
  const pool = [...openAlexConcepts]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3)
    .filter(c => (c.score ?? 0) >= 0.35);

  // Mapa { topicId → score acumulado }. No inicializamos entradas vacías:
  // los temas que no matchean quedan fuera del mapa y no compiten.
  const topicScores = new Map<TopicId, number>();
  const positionWeights = [1.0, 0.7, 0.5];

  pool.forEach((c, idx) => {
    const weight = positionWeights[idx] ?? 0.5;
    const shortId = c.id.split('/').pop() ?? c.id;
    for (const topic of TOPICS) {
      if (!topic.concepts.includes(shortId)) continue;
      const weightedScore = (c.score ?? 0) * weight;
      topicScores.set(topic.id, (topicScores.get(topic.id) ?? 0) + weightedScore);
    }
  });

  if (topicScores.size === 0) return null;

  // Ganador: mayor score acumulado. Ties se resuelven por el orden de TOPICS
  // (determinista); el ciclo `for` itera en orden de inserción del Map y
  // preservamos el primer tema que alcanzó el máximo.
  let bestId: TopicId | null = null;
  let bestScore = -Infinity;
  for (const [id, score] of topicScores) {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId ? TOPICS_BY_ID[bestId] : null;
}
