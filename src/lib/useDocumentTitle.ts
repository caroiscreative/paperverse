// Hook para manejar `document.title` de forma declarativa desde cada página.
//
// antes el título de la pestaña era SIEMPRE "Paperverse —
// La ciencia real, para curiosos reales" (el que vive en index.html) sin
// importar dónde estuviera el usuario. Problema:
//
//   · Si alguien tiene 5 pestañas abiertas leyendo distintos papers, todas
//     se llaman igual. Imposible volver a una pestaña específica sin hacer
//     switch-click una por una.
//   · Para un usuario recurrente que bookmarkeó /biblioteca, el bookmark
//     queda guardado como "Paperverse — La ciencia real…" en vez de
//     "Biblioteca — Paperverse". Menos útil cuando tiene 30 bookmarks.
//   · Historial del navegador (Cmd+Y / ctrl+H) queda ilegible: 20 entradas
//     con el mismo string.
//
// Convención que elegimos:
//   · Home/feed sin búsqueda → "Paperverse — La ciencia real, para curiosos reales"
//     (mantenemos el default de index.html — es el landing, la face del proyecto)
//   · Feed con búsqueda activa → "{query} — Paperverse"
//     (patrón Google: el query primero, la marca después, sufijo estable para
//     que la pestaña se pueda reconocer aunque el query sea largo y se trunque)
//   · PaperDetail → "{título ES del paper} — Paperverse"
//   · Otras páginas nombradas → "{seccion} — Paperverse"
//
// Implementación: hook que corre en useEffect, aplica el título, y al
// desmontar lo restaura al default. El restore es importante: si el usuario
// navega de /biblioteca a /, sin cleanup el título se quedaría pegado en
// "Biblioteca — Paperverse" hasta que algo lo reescriba. Preferimos que el
// default siempre gane cuando no hay un owner activo.

import { useEffect } from 'react';

const DEFAULT_TITLE = 'Paperverse — La ciencia real, para curiosos reales';
const SUFFIX = ' — Paperverse';
const MAX_LEAD = 60; // Chrome y Firefox truncan alrededor de 60-70 chars en la tab

/**
 * Sets document.title to `{lead} — Paperverse` while mounted. On unmount
 * restores the default landing title so navegación entre rutas nunca deja
 * colgada una etiqueta vieja.
 *
 * @param lead — la parte "a la izquierda del em dash". Se trunca a ~60 chars
 *               agregando "…". Pasar `null` o `''` usa el default directamente
 *               (útil para el feed home sin búsqueda activa).
 */
export function useDocumentTitle(lead: string | null | undefined) {
  useEffect(() => {
    const clean = (lead ?? '').trim();
    if (!clean) {
      // Sin lead → restauramos el default. Útil para la Home.
      document.title = DEFAULT_TITLE;
      return;
      // No registramos cleanup: si este mismo hook corre con otro lead
      // después, el useEffect siguiente se encarga de pisarlo.
    }

    // Truncado suave con ellipsis, pero sin cortar a media palabra si se puede
    // evitar. Si el string es corto no hace nada; si no, busca el último espacio
    // antes del límite.
    let trimmed = clean;
    if (trimmed.length > MAX_LEAD) {
      const cut = trimmed.lastIndexOf(' ', MAX_LEAD);
      trimmed = (cut > MAX_LEAD - 15 ? trimmed.slice(0, cut) : trimmed.slice(0, MAX_LEAD)) + '…';
    }

    document.title = trimmed + SUFFIX;

    return () => {
      // Cleanup → restauramos el default. Si otra página monta después, su
      // useEffect correrá después del unmount y pisará esto de inmediato. Si
      // ninguna página setea título (caso raro), al menos quedamos en el
      // landing title y no en la basura de la ruta anterior.
      document.title = DEFAULT_TITLE;
    };
  }, [lead]);
}
