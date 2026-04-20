// Easter egg: versículo aleatorio para mostrar mientras el loader dice
// "Traduciendo a cristiano…". La idea es que, si de casualidad llegaste al
// último mensaje de la rotación (o sea, la espera se está estirando),
// aparezca algo chiquito para leer — una broma autoconsciente con el chiste
// del loader. usuario pidió: "Y hablando de cristiano, Dios dijo: [verso]".
//
// Estrategia — selección curada por calidad (no "random" puro):
// La primera implementación pegaba a /get-random-verse/ y mostraba
// cualquier cosa. Eso tiraba a veces fragmentos descontextualizados
// ("Y él respondió", "Entonces Jehová dijo a Moisés…") que fuera del
// capítulo no tienen sentido. usuario lo reportó: quería frases con
// significado completo, tipo proverbios.
//
// Ahora restringimos la fuente a LIBROS SAPIENCIALES — Proverbios,
// Eclesiastés, Salmos, Cantares, Santiago, 1 Corintios. Son libros cuyo
// estilo es aforístico: cada versículo tiende a parar en sí mismo, sin
// depender del anterior para tener sentido. Pickeamos un (libro,
// capítulo) random del pool, traemos el capítulo entero, y filtramos
// versículos que pasen un umbral de calidad antes de elegir uno.
//
// API: bolls.life — frontend de varias biblias, tiene Reina-Valera 1960
// (RV1960, la traducción clásica en español) y CORS abierto
// (access-control-allow-origin: *), así que se puede pegar desde el browser
// sin proxy.
//
// · GET /get-chapter/RV1960/{bookid}/{chapter}/ → [{ verse, text }, ...]
//
// Nota sobre el idioma: RV1960 usa "vosotros" y conjugaciones peninsulares
// (el Bible español clásico). usuario prefiere español neutro LATAM pero
// esto es texto bíblico literal — no lo reescribimos, es una cita. El copy
// que envuelve ("Y hablando de cristiano, Dios dijo:") sí va en neutro.

const TRANSLATION = 'RV1960';
const BASE = 'https://bolls.life';

interface ApiVerseInChapter {
  verse: number;
  text: string;
}

export interface BibleVerse {
  /** Cita lista para mostrar, e.g. "Proverbios 3:5". */
  reference: string;
  /** Texto del versículo, limpio de <br>, tags rebeldes y espacios dobles. */
  text: string;
}

/**
 * Pool curado de libros sapienciales (wisdom literature). Hardcodeamos
 * bookid y chapters para no depender de un lookup dinámico — estos libros
 * no cambian. El orden canónico de bolls.life sigue el estándar Protestante.
 *
 * Omitimos a propósito:
 * · Job: diálogos largos con contexto, versos sueltos pierden sentido.
 * · Isaías/Jeremías/Lamentaciones: profecía narrativa, muy situacional.
 * · Evangelios/Epístolas (excepto Santiago y 1 Co 13): narrativa o
 * argumento teológico, también depende del flujo.
 *
 * Elegimos libros donde los versículos son intencionalmente aforísticos
 * o poéticos autocontenidos — funcionan como "pensamiento del día".
 */
interface WisdomSource {
  bookid: number;
  name: string;
  chapters: number[]; // lista de capítulos habilitados (subset si no todos califican)
}

const WISDOM_POOL: WisdomSource[] = [
  // Proverbios — el libro más obvio de la sabiduría. 31 capítulos, casi todos
  // aforísticos. Los primeros 9 son poesía introductoria; del 10 en adelante
  // son colecciones de proverbios de dos versos cada uno.
  { bookid: 20, name: 'Proverbios', chapters: Array.from({ length: 31 }, (_, i) => i + 1) },

  // Eclesiastés — "vanidad de vanidades", reflexión filosófica. 12 capítulos,
  // todos dan versículos sueltos con peso.
  { bookid: 21, name: 'Eclesiastés', chapters: Array.from({ length: 12 }, (_, i) => i + 1) },

  // Salmos — 150 capítulos de poesía. Muy variado pero los versos sueltos
  // funcionan bien como cita. Excluimos algunos que son listados históricos
  // (78, 105, 106) donde los versos dependen del contexto narrativo.
  {
    bookid: 19,
    name: 'Salmos',
    chapters: Array.from({ length: 150 }, (_, i) => i + 1).filter(
      n => ![78, 105, 106, 107, 135, 136].includes(n),
    ),
  },

  // Cantares — poesía amorosa, 8 capítulos. Versos cortos evocativos.
  { bookid: 22, name: 'Cantares', chapters: Array.from({ length: 8 }, (_, i) => i + 1) },

  // Santiago — epístola práctica, 5 capítulos. Muy proverbial en tono.
  { bookid: 59, name: 'Santiago', chapters: Array.from({ length: 5 }, (_, i) => i + 1) },

  // 1 Corintios 13 — el capítulo del amor, autónomo y universalmente citado.
  { bookid: 46, name: '1 Corintios', chapters: [13] },
];

/** Limpia el texto del versículo para mostrarlo en una sola línea fluida. */
function cleanVerseText(raw: string, maxLen = 240): string {
  const clean = raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= maxLen) return clean;
  // Corta en el último espacio antes del límite para no partir palabras.
  const slice = clean.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxLen - 40 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[,;:.\s]+$/, '') + '…';
}

/**
 * Heurística de "calidad" del versículo como cita standalone.
 *
 * Reglas (todas deben pasar):
 * 1. Longitud razonable: 60 ≤ len ≤ 260. Los <60 son demasiado cortos
 * para que aporten ("Jehová es mi pastor" está bien, pero "Así lo
 * hizo" no). Los >260 se muestran truncados y pierden el cierre.
 * 2. Empieza con mayúscula (incluye acentos Á É Í Ó Ú y Ñ). Si empieza
 * con minúscula, es continuación del verso anterior.
 * 3. Termina con puntuación terminal (. ? !) o `…` si lo vamos a truncar
 * nosotros. Si termina en coma o punto y coma, está cortado.
 * 4. NO empieza con conectores típicos de verso no-autónomo en RV1960:
 * "Y", "Entonces", "Mas", "Pero", "Porque", "Así que", "Por lo cual",
 * "Por tanto", "En aquel día". Estos casi siempre requieren contexto
 * del verso anterior.
 */
function isQualityVerse(text: string): boolean {
  const t = text.trim();
  if (t.length < 60 || t.length > 260) return false;
  if (!/^[A-ZÁÉÍÓÚÑ¿¡]/.test(t)) return false;
  if (!/[.!?…]$/.test(t)) return false;
  const badStarts = [
    'Y ',
    'Entonces ',
    'Mas ',
    'Pero ',
    'Porque ',
    'Así que ',
    'Por lo cual ',
    'Por tanto ',
    'En aquel día',
    'En aquellos días',
    'Él ',
    'Ellos ',
  ];
  if (badStarts.some(s => t.startsWith(s))) return false;
  return true;
}

// Caché de capítulos ya traídos (bookid:chapter → lista de versos). Si en
// la sesión tocamos el mismo capítulo dos veces, no vale la pena pegarle
// de nuevo a la API.
const chapterCache = new Map<string, ApiVerseInChapter[]>();

async function fetchChapter(
  bookid: number,
  chapter: number,
  signal?: AbortSignal,
): Promise<ApiVerseInChapter[]> {
  const key = `${bookid}:${chapter}`;
  const cached = chapterCache.get(key);
  if (cached) return cached;

  const url = `${BASE}/get-chapter/${TRANSLATION}/${bookid}/${chapter}/`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`bolls.life chapter ${r.status}`);
  const data: ApiVerseInChapter[] = await r.json();
  chapterCache.set(key, data);
  return data;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Trae un versículo de calidad del pool sapiencial de la Reina-Valera 1960.
 *
 * Estrategia de intentos:
 * 1. Pick (libro, capítulo) random del pool.
 * 2. Trae el capítulo completo (con caché).
 * 3. Filtra versos que pasen isQualityVerse.
 * 4. Si el filtrado no queda vacío, picka uno y listo.
 * 5. Si quedó vacío (capítulo raro donde ninguno califica), reintenta
 * con otro (libro, capítulo). Máx 4 reintentos.
 * 6. Si después de 4 reintentos nada pasó el filtro, relajamos las
 * reglas: aceptamos cualquier verso del último capítulo que tenga
 * al menos longitud razonable (>=40). Mejor mostrar algo mediocre
 * que fallar el easter egg.
 *
 * Lanza sólo si el fetch del chapter falla en TODOS los intentos — el
 * caller (PaperDetail) lo ignora silenciosamente.
 */
export async function fetchRandomVerse(signal?: AbortSignal): Promise<BibleVerse> {
  const MAX_ATTEMPTS = 4;
  let lastChapter: ApiVerseInChapter[] = [];
  let lastSource: WisdomSource | null = null;
  let lastChapterNum = 0;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const source = pickRandom(WISDOM_POOL);
    const chapterNum = pickRandom(source.chapters);
    let chapter: ApiVerseInChapter[];
    try {
      chapter = await fetchChapter(source.bookid, chapterNum, signal);
    } catch {
      // Un capítulo pifió — intentamos con otro en el siguiente loop.
      continue;
    }
    lastChapter = chapter;
    lastSource = source;
    lastChapterNum = chapterNum;

    const cleaned = chapter
      .map(v => ({ verse: v.verse, text: cleanVerseText(v.text) }))
      .filter(v => isQualityVerse(v.text));

    if (cleaned.length > 0) {
      const pick = pickRandom(cleaned);
      return {
        reference: `${source.name} ${chapterNum}:${pick.verse}`,
        text: pick.text,
      };
    }
    // Ninguno pasó el filtro — loop y probamos otro capítulo.
  }

  // Fallback: ningún intento pasó el filtro de calidad. Usamos el último
  // capítulo exitoso y aceptamos cualquier verso "no-patético" (>=40 chars).
  // Si ni eso tenemos, tomamos el más largo disponible.
  if (lastSource && lastChapter.length > 0) {
    const cleaned = lastChapter.map(v => ({
      verse: v.verse,
      text: cleanVerseText(v.text),
    }));
    const decent = cleaned.filter(v => v.text.length >= 40);
    const pick =
      decent.length > 0
        ? pickRandom(decent)
        : cleaned.reduce((a, b) => (b.text.length > a.text.length ? b : a));
    return {
      reference: `${lastSource.name} ${lastChapterNum}:${pick.verse}`,
      text: pick.text,
    };
  }

  throw new Error('No se pudo traer un versículo de calidad');
}
