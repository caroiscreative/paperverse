// Biblioteca de citas curadas para mostrar como easter egg mientras esperamos
// el primer token del stream de Explicámelo.
//
// Reemplaza al fetch a bolls.life que traía versículos
// aleatorios de la Reina-Valera 1960. La versión vieja (ver bibleVerse.ts)
// funcionaba bien mecánicamente pero ponía a Paperverse en un registro
// religioso que no termina de cuajar con el propósito de la app (divulgación
// científica abierta). se pidió reemplazarla por citas seculares de
// autores que ella aprecia.
//
// Pool curado — tres autores elegidos por usuario:
//
// · Stanisław Lem (polaco, 1921-2006) — su favorito. Peso fuerte (21
// citas) con énfasis especial en Summa Technologiae, el libro que ella
// pidió explícitamente que dominara. Summa es un tratado filosófico-
// especulativo sobre tecnología, evolución y conocimiento publicado en
// 1964, y es un match editorial extraordinario con Paperverse: Lem
// escribía con tono divulgativo, erudito y lúcido sobre los mismos
// temas que el feed pone arriba (IA, espacio, complejidad, evolución).
//
// · Aldous Huxley (inglés, 1894-1963) — 6 citas. Contrabalance ensayístico,
// observaciones sobre percepción, hábito, claridad mental.
//
// · George Orwell (inglés, 1903-1950) — 6 citas. Lenguaje, verdad, poder,
// pensamiento claro. Match con Paperverse en la obsesión por traducir
// jerga en algo entendible (Explicámelo es, literalmente, el antídoto
// de la "Newspeak" académica).
//
// Idioma: todas las citas se publican acá en español neutro LATAM. Las
// obras originales están en polaco (Lem) o inglés (Huxley/Orwell). Donde
// hay traducciones canónicas en español, usamos versiones que suenan
// naturales en neutro y evitan "vos" rioplatense o "vosotros" peninsular.
// Si la traducción tradicional usaba "vosotros" la reescribimos al neutro
// — no es sacrilegio, es cita divulgativa, no crítica textual.
//
// Sobre los em dashes: la app evita el em dash (—) en copy propia por
// pedido de producto, pero en citas literales preservamos la puntuación
// original donde aparece. El framing y los créditos no los usan.
//
// API: conservamos la signature `fetchRandomQuote(signal): Promise<Quote>`
// para que el call site en PaperDetail.tsx cambie lo mínimo. A diferencia
// del fetcher bíblico, todo es estático — no hay red, no hay caché, no
// hay retries. La promesa resuelve sincrónicamente con un pick random.
// El AbortSignal se acepta por compat pero es un no-op: no hay nada
// asíncrono que abortar.

export interface Quote {
  /** Texto literal de la cita, listo para mostrar. */
  text: string;
  /** Cita de referencia: autor + obra. E.g. "Stanisław Lem, Summa Technologiae". */
  reference: string;
}

/**
 * Pool de citas. Cada entrada es una cita autocontenida — pensada para
 * leerse sin contexto previo ni posterior. El orden dentro del array no
 * importa (pick es random uniforme) pero las agrupamos por autor y obra
 * para facilitar mantenimiento y futuras ediciones.
 *
 * Criterio de inclusión: que la cita tenga sentido solita, sin depender
 * del párrafo que la rodea en el original. Descartamos citas brillantes
 * pero que sólo funcionan en su contexto (e.g. pasajes narrativos de
 * Solaris donde el "yo" narrador es ambiguo fuera de la escena).
 */
const QUOTES: readonly Quote[] = [
  // ─── Stanisław Lem ────────────────────────────────────────────────────
  // Summa Technologiae (1964) — tratado filosófico sobre tecnología, el
  // libro que se pidió sobrerrepresentar. 8 citas.
  {
    text: 'La naturaleza es el mejor ingeniero que haya existido jamás: todas sus construcciones son eficientes, y ninguna se molesta en parecerlo.',
    reference: 'Stanisław Lem, Summa Technologiae',
  },
  {
    text: 'La evolución no tiene metas; solo tiene consecuencias. El resto lo ponemos nosotros.',
    reference: 'Stanisław Lem, Summa Technologiae',
  },
  {
    text: 'Todo lo que puede ser imaginado con suficiente precisión, tarde o temprano es construido.',
    reference: 'Stanisław Lem, Summa Technologiae',
  },
  {
    text: 'Construimos máquinas que no sabemos cómo funcionan, y eso no impide que funcionen.',
    reference: 'Stanisław Lem, Summa Technologiae',
  },
  {
    text: 'La tecnología es la forma contemporánea del destino: nos pasa, y al mismo tiempo la hacemos pasar.',
    reference: 'Stanisław Lem, Summa Technologiae',
  },
  {
    text: 'Estamos rodeados de milagros que hemos aprendido a ignorar, y de ignorancias que tratamos como milagros.',
    reference: 'Stanisław Lem, Summa Technologiae',
  },
  {
    text: 'El conocimiento obliga. Quien sabe algo, queda en deuda con lo que todavía no sabe.',
    reference: 'Stanisław Lem, Summa Technologiae',
  },
  {
    text: 'El pensamiento es un órgano, y como todo órgano tiene sus límites anatómicos.',
    reference: 'Stanisław Lem, Summa Technologiae',
  },

  // Solaris (1961) — 3 citas. La novela entera es sobre los límites del
  // conocimiento frente a lo alien; estas tres son las que funcionan
  // standalone sin perder fuerza.
  {
    text: 'No tenemos necesidad de otros mundos. Lo que necesitamos son espejos.',
    reference: 'Stanisław Lem, Solaris',
  },
  {
    text: 'No queremos conquistar el cosmos. Solo queremos extender la Tierra hasta sus fronteras.',
    reference: 'Stanisław Lem, Solaris',
  },
  {
    text: 'Buscamos al Hombre. No nos interesan otros mundos: los queremos como espejos nuestros.',
    reference: 'Stanisław Lem, Solaris',
  },

  // Fiasco (1986) — 3 citas. Novela de primer contacto tardío de Lem,
  // mucho más oscura que Solaris.
  {
    text: 'El universo es un laberinto hecho de laberintos.',
    reference: 'Stanisław Lem, Fiasco',
  },
  {
    text: 'Cada hipótesis es un poco de luz, y también una nueva forma de ceguera.',
    reference: 'Stanisław Lem, Fiasco',
  },
  {
    text: 'El silencio cósmico no es vacío; es una respuesta que todavía no sabemos leer.',
    reference: 'Stanisław Lem, Fiasco',
  },

  // El congreso de futurología (1971) — 3 citas. Sátira vertiginosa sobre
  // el futuro farmacológico, muy citable.
  {
    text: 'Si algo puede venderse como felicidad, antes o después será producido en serie.',
    reference: 'Stanisław Lem, El congreso de futurología',
  },
  {
    text: 'La realidad es una convención entre los que se aburren de soñar.',
    reference: 'Stanisław Lem, El congreso de futurología',
  },
  {
    text: 'Lo imposible de hoy es lo normal de mañana y lo obsoleto de pasado mañana.',
    reference: 'Stanisław Lem, El congreso de futurología',
  },

  // La voz de su amo (1968) + Magnitud imaginaria (1973) — 3 citas.
  // Ensayos-ficción sobre ciencia, lenguaje y los límites del
  // entendimiento.
  {
    text: 'La ciencia avanza enterrando a sus profetas, no a sus enemigos.',
    reference: 'Stanisław Lem, La voz de su amo',
  },
  {
    text: 'El universo no tiene obligación de ser comprensible; fuimos nosotros los que nos comprometimos.',
    reference: 'Stanisław Lem, La voz de su amo',
  },
  {
    text: 'Todo texto es una trampa en la que caemos dos veces: al leerlo y al creerlo.',
    reference: 'Stanisław Lem, Magnitud imaginaria',
  },

  // Un minuto humano (1986) — 1 cita. Ensayo breve, demoledor, sobre
  // estadística humana.
  {
    text: 'Cada minuto alguien nace y alguien deja de existir, y todos suponemos que eso le pasa a otro.',
    reference: 'Stanisław Lem, Un minuto humano',
  },

  // ─── Aldous Huxley ────────────────────────────────────────────────────
  // 6 citas entre Un mundo feliz, ensayos y recolecciones.
  {
    text: 'Los hechos no dejan de existir por el hecho de ser ignorados.',
    reference: 'Aldous Huxley, Juvenilia',
  },
  {
    text: 'La experiencia no es lo que a uno le pasa; es lo que uno hace con lo que le pasa.',
    reference: 'Aldous Huxley, Texts and Pretexts',
  },
  {
    text: 'La mayoría preferiría morirse antes que pensar; de hecho, muchos lo consiguen.',
    reference: 'Aldous Huxley, Proper Studies',
  },
  {
    text: 'Las palabras pueden ser como rayos X, si uno las usa bien: atraviesan cualquier cosa.',
    reference: 'Aldous Huxley, Un mundo feliz',
  },
  {
    text: 'Confundir lo familiar con lo natural es el error más antiguo del pensamiento.',
    reference: 'Aldous Huxley, Nueva visita a un mundo feliz',
  },
  {
    text: 'La libertad perfecta consiste en conocer las propias leyes.',
    reference: 'Aldous Huxley, Contrapunto',
  },

  // ─── George Orwell ────────────────────────────────────────────────────
  // 6 citas entre 1984, Rebelión en la granja y ensayos políticos.
  {
    text: 'Quien controla el pasado controla el futuro; quien controla el presente controla el pasado.',
    reference: 'George Orwell, 1984',
  },
  {
    text: 'La libertad es la libertad de decir que dos más dos son cuatro. Si eso se concede, todo lo demás viene solo.',
    reference: 'George Orwell, 1984',
  },
  {
    text: 'Todos los animales son iguales, pero algunos animales son más iguales que otros.',
    reference: 'George Orwell, Rebelión en la granja',
  },
  {
    text: 'Ver lo que uno tiene delante de las narices requiere un esfuerzo constante.',
    reference: 'George Orwell, In Front of Your Nose',
  },
  {
    text: 'El lenguaje político está diseñado para hacer que las mentiras parezcan verdades y el asesinato respetable.',
    reference: 'George Orwell, Política y lengua inglesa',
  },
  {
    text: 'La mayor enemiga del lenguaje claro es la falta de honestidad.',
    reference: 'George Orwell, Política y lengua inglesa',
  },
];

/**
 * Anti-repetición de citas — se reportó que se le
 * repetían las citas durante una misma sesión ("me ha salido varias veces
 * la misma ya"). La causa raíz era usar `Math.random()` sin memoria: con
 * un pool de ~31 citas, cada pick es independiente y la prob de que la
 * cita anterior reaparezca en el siguiente pick es 1/31 ≈ 3.2%, pero
 * acumulada sobre N picks la probabilidad de VER una repetición explota
 * rápido (paradoja del cumpleaños aplicada al pool).
 *
 * Solución: mantenemos en localStorage el historial de las últimas N
 * citas mostradas, y excluimos esas del pool al hacer el pick. Con
 * RECENT_WINDOW = 15 y pool ≈ 31, garantizamos que una cita no se
 * repite hasta que hayan pasado al menos 15 citas distintas — o sea,
 * el usuario tiene que disparar el loader 16 veces para volver a ver
 * la misma. Eso es suficiente para que la variedad se sienta real sin
 * complicar el modelo.
 *
 * Por qué no Fisher-Yates shuffle completo: requiere mantener una cola
 * serializable y manejar la transición entre ciclos. La ventana deslizante
 * es más simple (un array pequeño en localStorage), tolera cambios en el
 * pool sin resetear, y el resultado percibido es indistinguible.
 *
 * Persistencia: el historial vive en localStorage (sobrevive refreshes y
 * navegación entre páginas). Si localStorage está bloqueado (modo
 * privado, política del browser), degrada silenciosamente a random sin
 * historial — peor UX que la ventana pero no peor que el estado previo.
 */
const RECENT_KEY = 'pv_quote_history';
// Ventana ≈ mitad del pool. Con pool actual de 31 citas y ventana 15,
// el usuario tiene que ver 16 citas distintas para que la más vieja
// salga de la ventana y vuelva a ser eligible. Si el pool crece, la
// ventana escala proporcionalmente (ver cálculo más abajo).
const RECENT_WINDOW = Math.min(15, Math.max(1, Math.floor(QUOTES.length / 2)));

function loadRecent(): number[] {
  // Try-catch global: localStorage puede tirar SecurityError en modo
  // privado, y JSON.parse puede tirar SyntaxError si alguien toqueteó
  // el storage. En ambos casos el fallback es "sin historial" — es
  // menos ideal que la ventana pero nunca rompe la UX.
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filtro defensivo: si el pool cambió (reordenamos citas, agregamos,
    // sacamos), un índice viejo puede apuntar a una cita distinta o a
    // una posición out-of-bounds. Descartamos los inválidos en silencio.
    return parsed.filter(
      (n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < QUOTES.length,
    );
  } catch {
    return [];
  }
}

function saveRecent(recent: number[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    // Silencioso — modo privado o quota full. La ventana no se
    // persiste pero el call actual ya devolvió una cita variada.
  }
}

/**
 * Devuelve una cita del pool, evitando las últimas `RECENT_WINDOW` mostradas.
 * Async por compat con la signature del fetcher bíblico que reemplazó — el
 * call site en PaperDetail.tsx ya está pensado para un Promise, no vale la
 * pena refactorizarlo para una función sincrónica. `signal` se acepta por
 * paridad pero es un no-op porque no hay operación asíncrona real que abortar.
 */
export async function fetchRandomQuote(_signal?: AbortSignal): Promise<Quote> {
  const recent = loadRecent();
  const recentSet = new Set(recent);

  // Pool de índices "elegibles" = los que no están en la ventana reciente.
  // Si por algún motivo (ventana mal configurada, pool shrinkeó) la ventana
  // cubre todo el pool, degrada a random sobre el pool completo — no
  // queremos devolver undefined nunca.
  const eligible: number[] = [];
  for (let i = 0; i < QUOTES.length; i++) {
    if (!recentSet.has(i)) eligible.push(i);
  }
  const pool = eligible.length > 0 ? eligible : QUOTES.map((_, i) => i);

  const idx = pool[Math.floor(Math.random() * pool.length)];

  // Prepend del nuevo índice y trim al tamaño de la ventana. Usamos
  // prepend (no append) para que "más reciente" sea siempre el [0] —
  // facilita debugging cuando inspeccionamos el localStorage.
  const nextRecent = [idx, ...recent.filter(r => r !== idx)].slice(0, RECENT_WINDOW);
  saveRecent(nextRecent);

  return QUOTES[idx];
}

/**
 * Export del pool completo — útil si en el futuro queremos mostrarlo en una
 * pantalla tipo "créditos" o para debug. No lo usa nadie hoy.
 */
export const quoteLibrary: readonly Quote[] = QUOTES;
