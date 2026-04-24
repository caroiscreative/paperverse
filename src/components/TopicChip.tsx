import type { CSSProperties } from 'react';
import type { Topic } from '../lib/topics';
import { Icon } from './Icon';
import { TopicIcon } from './TopicIcon';

interface Props {
  topic: Topic;
  active?: boolean;
  onClick?: () => void;
}

/**
 * TopicChip — selector de tema del sidebar y Welcome.
 *
 * Fase 3.2 redo. La dirección que quedó firme:
 *   - chip SIN bordes, border-radius 0
 *   - fondo inactivo = topic.soft (el color de la categoría)
 *   - activo = fondo ink + cream + check icon + font-weight 700
 *
 * Cómo lo inyectamos sin hardcodear colores en CSS: pasamos topic.soft
 * como CSS custom property `--chip-bg` en el inline style del botón. El
 * CSS usa `background: var(--chip-bg, fallback)`. Esto evita una regla
 * por tópico y respeta el CSS central.
 *
 * Sobre el tile interno (.tico):
 *   En inactivo, el tile comparte color soft con el chip, así que se
 *   fusiona visualmente y sólo el ícono topic.deep queda a la vista. El
 *   chip ENTERO opera como el "stamp de color" del tópico.
 *   En activo, el chip pasa a ink y el tile reaparece como cuadradito
 *   soft, preservando la identidad del tópico incluso cuando está
 *   seleccionado. No perdemos señal de "qué tema es" al activarlo.
 *
 * Accesibilidad (WCAG 1.4.1 — Use of Color):
 *   El estado seleccionado no puede depender SOLO de color. Mantenemos
 *   los tres indicadores redundantes: (1) ícono ✓ al final del label,
 *   (2) aria-pressed para lectores de pantalla, (3) font-weight 700 vs
 *   600 del inactivo. Sacamos los bordes pero el flip cream/ink +
 *   check + peso cubren el requisito.
 */
export function TopicChip({ topic, active, onClick }: Props) {
  // CSS custom property para el fondo inactivo. En estado activo la regla
  // `.topic-chip.active` sobreescribe el background con var(--pv-ink) y
  // el --chip-bg queda "durmiendo" hasta que el chip vuelva a inactivo.
  const chipStyle = { '--chip-bg': topic.soft } as CSSProperties;
  return (
    <button
      className={`topic-chip ${active ? 'active' : ''}`}
      onClick={onClick}
      type="button"
      aria-pressed={active ?? false}
      style={chipStyle}
    >
      <span className="tico" style={{ background: topic.soft }}>
        <TopicIcon topicId={topic.id} color={topic.deep} />
      </span>
      <span className="topic-chip-label">{topic.name}</span>
      {active && (
        <Icon
          name="check"
          size={13}
          strokeWidth={2.5}
          aria-hidden="true"
          style={{ flexShrink: 0, marginLeft: 2 }}
        />
      )}
    </button>
  );
}
