import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOPICS, type TopicId } from '../lib/topics';
import { TopicChip } from '../components/TopicChip';
import { Icon } from '../components/Icon';

const TOPIC_STORAGE_KEY = 'pv_topics_v1';
const ONBOARDED_KEY = 'pv_onboarded_v1';
const MIN_TOPICS = 3;

export function Welcome() {
  const nav = useNavigate();
  const [selected, setSelected] = useState<TopicId[]>([]);

  const toggle = (id: TopicId) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const canContinue = selected.length >= MIN_TOPICS;

  const finish = () => {
    if (!canContinue) return;
    try {
      localStorage.setItem(TOPIC_STORAGE_KEY, JSON.stringify(selected));
      localStorage.setItem(ONBOARDED_KEY, '1');
    } catch {

    }
    nav('/');
  };

  return (
    <div className="onb">
      <div className="onb-card">
        <div className="eye">Paperverse · La ciencia real, para curiosos reales</div>
        <h1>Elegí tres temas para empezar.</h1>
        <p className="lead">
          Te armamos un feed de papers recientes en los temas que te importan. Podés cambiarlos cuando quieras.
        </p>

        <div className="topics">
          {TOPICS.map(t => (
            <TopicChip
              key={t.id}
              topic={t}
              active={selected.includes(t.id)}
              onClick={() => toggle(t.id)}
            />
          ))}
        </div>

        <div className="next">
          <span className="count">
            {selected.length < MIN_TOPICS
              ? `${selected.length} de ${MIN_TOPICS} temas`
              : `${selected.length} temas seleccionados`}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={finish}
            disabled={!canContinue}
            style={{ opacity: canContinue ? 1 : 0.55, cursor: canContinue ? 'pointer' : 'not-allowed' }}
          >
            Empezar <Icon name="arrow-right" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
