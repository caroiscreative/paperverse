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
 * `true` si el idioma original ya es español — en ese caso no tiene sentido
 * "traducir" el abstract, y la UI puede omitir la sección de traducción o
 * mostrar el abstract directo con una nota "original en español".
 */
export function isSpanish(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return iso.toLowerCase() === 'es';
}
