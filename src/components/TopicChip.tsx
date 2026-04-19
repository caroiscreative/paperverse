import type { Topic } from '../lib/topics';
import { TopicIcon } from './TopicIcon';

interface Props {
  topic: Topic;
  active?: boolean;
  onClick?: () => void;
}

/**
 * TopicChip — selector de tema del sidebar y Welcome.
 *
 * El "tile" (el cuadradito de color al lado del texto) SIEMPRE muestra la
 * identidad DS del tema: `topic.soft` como fondo + `topic.deep` para el
 * icono. Antes ghosteábamos el tile cuando el chip estaba activo
 * (tileBg = cream transparente, icon = topic.soft), lo cual funcionaba en
 * light mode sobre fondo ink pero en dark mode sobre fondo cream dejaba
 * al tile invisible y al icono lavado — los chips activos perdían la
 * identidad de tema. Ahora el tile no se toca: el color del chip (cream
 * en dark, ink en light) lleva la señal de "seleccionado" y el tile
 * lleva la señal de "qué tema es".
 */
export function TopicChip({ topic, active, onClick }: Props) {
  return (
    <button
      className={`topic-chip ${active ? 'active' : ''}`}
      onClick={onClick}
      type="button"
    >
      <span className="tico" style={{ background: topic.soft }}>
        <TopicIcon topicId={topic.id} color={topic.deep} />
      </span>
      {topic.name}
    </button>
  );
}
