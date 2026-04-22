// Utilidades para el campo `language` de OpenAlex.
//
// OpenAlex devuelve el idioma del paper como código ISO 639-1 (dos letras,
// p.ej. "en", "zh", "de"). Para la UI lo queremos en español neutro y
// legible ("Inglés", "Chino", "Alemán") — ver , donde decidimos que
// el modo "original" del abstract muestre ambas versiones (texto original +
// etiqueta de idioma + traducción al español siempre).
//
// Convenciones:
// - En los pocos casos que no conocemos el código (paper con language: null
// o algún ISO raro) devolvemos "idioma desconocido" — preferimos la
// honestidad a mentir sobre el idioma.
// - "Inglés" con mayúscula inicial porque en la UI se muestra dentro de una
// etiqueta tipo badge ("ORIGINAL EN INGLÉS") y/o frase decorativa; no
// aparece en medio de una oración donde las normas del español pedirían
// minúscula.

const ISO_TO_ES: Record<string, string> = {
  en: 'Inglés',
  es: 'Español',
  pt: 'Portugués',
  fr: 'Francés',
  de: 'Alemán',
  it: 'Italiano',
  nl: 'Neerlandés',
  ru: 'Ruso',
  pl: 'Polaco',
  uk: 'Ucraniano',
  tr: 'Turco',
  ar: 'Árabe',
  he: 'Hebreo',
  fa: 'Persa',
  hi: 'Hindi',
  bn: 'Bengalí',
  ur: 'Urdu',
  zh: 'Chino',
  ja: 'Japonés',
  ko: 'Coreano',
  vi: 'Vietnamita',
  th: 'Tailandés',
  id: 'Indonesio',
  ms: 'Malayo',
  sv: 'Sueco',
  no: 'Noruego',
  da: 'Danés',
  fi: 'Finlandés',
  is: 'Islandés',
  cs: 'Checo',
  sk: 'Eslovaco',
  hu: 'Húngaro',
  ro: 'Rumano',
  bg: 'Búlgaro',
  sr: 'Serbio',
  hr: 'Croata',
  sl: 'Esloveno',
  el: 'Griego',
  la: 'Latín',
  ca: 'Catalán',
  eu: 'Euskera',
  gl: 'Gallego',
  af: 'Afrikáans',
  sw: 'Suajili',
};

/**
 * Devuelve el nombre del idioma en español, a partir del código ISO 639-1 que
 * OpenAlex reporta en el campo `language`. Si el código no está en la tabla
 * o viene `null`/`undefined`, devuelve "idioma desconocido".
 */
export function languageLabel(iso: string | null | undefined): string {
  if (!iso) return 'idioma desconocido';
  const key = iso.toLowerCase();
  return ISO_TO_ES[key] ?? 'idioma desconocido';
}

/**
 * Heurística rápida para detectar texto que CLARAMENTE no está en español.
 * No intenta clasificar todos los idiomas — solo busca señales fuertes de
 * "no es español" para poder dudar del campo `language` de OpenAlex cuando
 * éste reporta 'es' por error.
 *
 * Por qué existe: OpenAlex etiqueta ocasionalmente papers en portugués (a
 * veces también en italiano o catalán) como `language: 'es'`, probablemente
 * porque su detector se confunde entre lenguas romances cercanas. Sin este
 * cross-check, `isSpanish('es')` devuelve true para texto portugués → la UI
 * salta la traducción y el lector se queda con un abstract que no entiende
 * ("el lector llega y no entiende el paper").
 *
 * Estrategia: busca caracteres y palabras que existen en otras lenguas
 * romances pero NO en español (ç, ã, õ, "não", "também", "gli", "della",
 * etc.). Si encuentra suficientes, devuelve true. Es un detector de "negación
 * de español", no un identificador positivo de portugués/italiano/francés.
 *
 * Falsos negativos aceptables: si el abstract es muy corto (< 100 chars) o
 * si el portugués no usa ç/ã (raro pero posible), devolvemos false y caemos
 * al comportamiento legacy. Es preferible no traducir un texto ambiguo que
 * disparar una traducción innecesaria sobre algo que ya es español.
 *
 * Falsos positivos aceptables: un texto en español que casualmente cite una
 * frase portuguesa larga podría dispararlo. En ese caso, traduciríamos algo
 * que ya está en español → el usuario ve el abstract traducido al español
 * (que sigue siendo legible), no se rompe nada.
 */
function looksLikeNotSpanish(text: string): boolean {
  if (!text || text.length < 100) return false;
  const sample = text.slice(0, 2000).toLowerCase();

  // Caracteres exclusivos de portugués (ç, ã, õ). Español nunca los usa —
  // Spanish usa "z"/"c" donde portugués usa "ç", y nunca tildes nasales.
  // Con 3+ apariciones ya tenemos confianza alta.
  const ptChars = (sample.match(/[çãõ]/g) ?? []).length;
  if (ptChars >= 3) return true;

  // Palabras función portuguesas que no existen en español.
  // "não" / "nao" — la negación más común; cualquier abstract científico la
  // contiene si es portugués.
  if (/\bn[aã]o\b/.test(sample)) return true;
  // "são", "também", "estão", "porém", "muito" — al menos 2 distintas para
  // evitar falsos positivos por una palabra suelta cited de otro idioma.
  const ptWords = (sample.match(/\b(s[aã]o|tamb[eé]m|est[aã]o|por[eé]m|muito|atrav[eé]s)\b/g) ?? []).length;
  if (ptWords >= 2) return true;

  // Marcadores fuertes de italiano. "gli", "della", "delle", "degli",
  // "sulla" no existen en español. Incluimos también elisiones únicas del
  // italiano ("dell'", "sull'", "nell'", "all'") que en español no existen.
  const itWords = (sample.match(/\b(gli|della|delle|dello|degli|sulla|sullo|sugli|sulle|nella|nello|nelle|negli)\b/g) ?? []).length;
  if (itWords >= 3) return true;
  if (/\b(dell|sull|nell|all|quell)'/.test(sample)) return true;

  // Marcadores fuertes de francés. "œ" es exclusivo del francés. Las
  // palabras "les", "des", "nous", "vous", "cette" pueden aparecer aisladas
  // en español por préstamo, así que pedimos al menos 4.
  if (/œ/.test(sample)) return true;
  const frWords = (sample.match(/\b(les|des|nous|vous|cette|notre|votre|leurs)\b/g) ?? []).length;
  if (frWords >= 4) return true;

  // Caso raro pero posible: OpenAlex marca un abstract en inglés como 'es'.
  // Palabras función inglesas de altísima frecuencia que no existen en
  // español. Con 6 distintas el texto es muy probablemente inglés — es casi
  // imposible acumular ese nivel por citas sueltas en un abstract en español.
  const enWords = (sample.match(/\b(the|and|of|in|to|is|was|were|that|this|with|for|on|are|which|from|we|by|as|have|been|not|or|but|has)\b/g) ?? []).length;
  if (enWords >= 6) return true;

  return false;
}

/**
 * `true` si el idioma original ya es español — en ese caso no tiene sentido
 * "traducir" el abstract, y la UI puede omitir la sección de traducción o
 * mostrar el abstract directo con una nota "original en español".
 *
 * Cuando se pasa `text` (opcional, pero recomendado), cruzamos lo que dice
 * OpenAlex con una heurística rápida sobre el contenido. OpenAlex a veces
 * reporta `'es'` para papers que en realidad están en portugués/italiano/
 * francés — sin este cross-check, la UI no traduciría y el lector quedaría
 * varado en un idioma que no entiende. Si el texto contradice el ISO,
 * preferimos disparar la traducción (mejor traducir de más que dejar al
 * lector sin opciones).
 *
 * Sin `text`, mantiene el comportamiento legacy (confiar en OpenAlex).
 */
export function isSpanish(
  iso: string | null | undefined,
  text?: string | null
): boolean {
  if (!iso) return false;
  if (iso.toLowerCase() !== 'es') return false;
  // OpenAlex dice "es", pero verificamos con el texto si lo tenemos.
  if (text && looksLikeNotSpanish(text)) return false;
  return true;
}
