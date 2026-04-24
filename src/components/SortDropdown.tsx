// SortDropdown — control de orden para Feed, Refs y Cites.
//
// Fase 4 redo: se pidió un botón secundario cuadrado
// que diga "Ordenar por" + chevron, igual en mobile y desktop. Antes el
// botón mostraba el label activo al lado ("Ordenar: Mayor impacto ▾") —
// ahora el valor activo vive SÓLO dentro del menú (checkmark sobre la
// opción elegida). Esto:
//   · Le da un hit-target cuadrado fijo, sin ancho variable según el
//     texto del orden elegido.
//   · Unifica mobile/desktop: el mismo botón funciona en ambos breakpoints
//     sin necesidad de truncar labels largos ("Título A → Z" no cabía en
//     360px al lado del eyebrow).
//   · Se comporta como los otros controles del DS (View toggle, Period)
//     que son botones cuadrados con ícono + label corto.
//
// Por qué no usamos <select> nativo:
//   · No podemos estilizar el dropdown con tokens del DS (cada browser
//     pinta sus propios triángulos/pixeles y el menu usa la fuente del
//     OS, no Instrument Serif ni Inter).
//   · Queremos hints descriptivos ("Citas normalizadas por campo (FWCI)")
//     debajo de algunos labels — un <select> no soporta eso.
//   · Cierra con click fuera / Escape / perder focus (aria-expanded,
//     aria-haspopup, role=listbox/option para a11y).
//
// Toggle snap: sin transition/fade — memoria del proyecto dice que en
// Paperverse los toggles cambian de estado al instante. Abrir/cerrar el
// menú tampoco anima.
//
// El caller controla el estado: pasa el `value` actual y un `onChange`
// que se dispara cuando el usuario elige otra opción. El componente NO
// toca URL ni localStorage — esa lógica vive en Feed.tsx, así este
// componente queda reutilizable (Biblioteca podría pedirle un sort
// propio mañana sin acoplarse a useSearchParams).

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import type { SortKey } from '../lib/openalex';

interface SortOption {
  key: SortKey;
  label: string;          // Texto del item del menú
  hint?: string;          // Subtítulo chico debajo del label, explicando qué hace (opcional)
  searchOnly?: boolean;   // Sólo aparece cuando hasSearch=true
}

// Orden del menú (fijado por Carolina, 2026-04-21):
//   1. Reciente y citado (default editorial)
//   2. Mayor impacto (FWCI)
//   3. Más citados
//   4. Menos citados
//   5. Más recientes
//   6. Más antiguos
//   7. Título A → Z
//   8. Título Z → A
// Relevancia queda al final, sólo visible cuando hay search.
const OPTIONS: SortOption[] = [
  { key: 'latest_cited', label: 'Reciente y citado', hint: 'Lo nuevo que ya pega' },
  { key: 'fwci_desc',    label: 'Mayor impacto',     hint: 'Citas normalizadas por campo (FWCI)' },
  { key: 'cites_desc',   label: 'Más citados' },
  { key: 'cites_asc',    label: 'Menos citados' },
  { key: 'date_desc',    label: 'Más recientes' },
  { key: 'date_asc',     label: 'Más antiguos' },
  { key: 'title_asc',    label: 'Título A → Z' },
  { key: 'title_desc',   label: 'Título Z → A' },
  { key: 'relevance',    label: 'Más relevantes', hint: 'Score de búsqueda', searchOnly: true },
];

interface Props {
  /** Sort actualmente aplicado. */
  value: SortKey;
  /** Disparado cuando el usuario elige otra opción. */
  onChange: (next: SortKey) => void;
  /** Si true, incluye "Relevancia" en el menú. Sólo pasa en modo search. */
  hasSearch: boolean;
}

export function SortDropdown({ value, onChange, hasSearch }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Lista de opciones visibles — filtramos las que son searchOnly cuando
  // no hay search. Esto evita que el usuario elija "Relevancia" en el feed
  // home y quede con un sort que silenciosamente cae al default.
  const visible = OPTIONS.filter(o => !o.searchOnly || hasSearch);

  // Ya no mostramos el label activo en el botón (Fase 4 redo). El valor
  // actual se comunica sólo dentro del menú con el checkmark sobre la
  // opción seleccionada. Si querés ver qué sort está aplicado, abrís el
  // menú — esto mantiene el botón con ancho fijo y estable.
  const activeLabel = visible.find(o => o.key === value)?.label;

  // Click afuera o Escape cierran el menú. Guardamos wrapRef en el wrapper
  // para que clicks dentro (button + menu) no disparen el close.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="pv-sort" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="pv-sort-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        // El title sí muestra el sort activo — es un tooltip al hover, no
        // compite con el label fijo del botón. Útil para usuarios que
        // quieren saber qué está aplicado sin abrir el menú.
        title={activeLabel ? `Orden actual: ${activeLabel}` : 'Cambiar el orden'}
      >
        <span className="pv-sort-label">Ordenar por</span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div
          className="pv-sort-menu"
          role="listbox"
          aria-label="Opciones de orden"
        >
          {visible.map(opt => {
            const selected = opt.key === value;
            return (
              <button
                key={opt.key}
                type="button"
                role="option"
                aria-selected={selected}
                className={`pv-sort-item ${selected ? 'selected' : ''}`}
                onClick={() => {
                  onChange(opt.key);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
              >
                <span className="pv-sort-item-main">
                  <span className="pv-sort-item-label">{opt.label}</span>
                  {opt.hint && <span className="pv-sort-item-hint">{opt.hint}</span>}
                </span>
                {selected && <Icon name="check" size={13} strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
