// Onboarding / Welcome screen.
//
// Shown the very first time the user lands in Paperverse (no `pv_onboarded_v1`
// flag in localStorage, no topics picked). Para salir hay que elegir al menos
// 3 temas y presionar "Empezar" — ese mínimo garantiza que el feed día-1 se
// sienta variado. No hay tope máximo: si querés todo, elegí todo.
//
// Layout (vertical, stack, de arriba a abajo):
//   1. Logo grande (wordmark: isotipo + "Paperverse.")
//   2. Tagline editorial: "La ciencia real, para curiosos reales."
//   3. Título — "Elegí tres temas para empezar."
//   4. Descripción
//   5. Grilla de chips (topics) — sin límite superior
//   6. Contador en su propia línea ("2 de 3 temas" / "5 temas seleccionados")
//   7. Botón "Empezar" en otra línea
//
// After onboarding we persist:
//   · pv_topics_v1        → the selected topic ids (used by Feed)
//   · pv_onboarded_v1     → marker so we don't show this screen again

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOPICS_ALPHABETICAL, type TopicId } from '../lib/topics';
import { TopicChip } from '../components/TopicChip';
import { Icon } from '../components/Icon';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const TOPIC_STORAGE_KEY = 'pv_topics_v1';
const ONBOARDED_KEY = 'pv_onboarded_v1';
const MIN_TOPICS = 3;

export function Welcome() {
  const nav = useNavigate();
  const [selected, setSelected] = useState<TopicId[]>([]);
  // tab title "Bienvenida — Paperverse". Aunque la
  // ruta sea /bienvenida y el usuario normalmente cierra el onboarding en
  // minutos, cuando duda y abre otras pestañas mientras piensa qué temas
  // elegir, la pestaña debe reconocerse por nombre.
  useDocumentTitle('Bienvenida');

  const toggle = (id: TopicId) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const canContinue = selected.length >= MIN_TOPICS;

  const finish = () => {
    if (!canContinue) return;
    try {
      localStorage.setItem(TOPIC_STORAGE_KEY, JSON.stringify(selected));
      localStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      /* ignore */
    }
    nav('/');
  };

  return (
    <div className="onb">
      <div className="onb-card">
        {/* Logo grande (wordmark). Lleva el isotipo + "Paperverse."
            ya integrados, así que no hace falta duplicar el nombre en
            un h1 aparte. El SVG original tiene viewBox 480x120 (ratio
            4:1); acá lo servimos en ~220px de ancho en desktop, con
            reglas responsivas en kit.css para bajar a ~160px en mobile. */}
        <img
          src="/assets/logo-wordmark.svg"
          alt="Paperverse"
          className="onb-logo"
        />

        {/* Tagline editorial debajo del logo. Antes vivía en el eyebrow
            arriba del h1; al mover el logo a la cima perdía función, así
            que lo llevamos acá como subtítulo del producto. */}
        <div className="onb-tagline">La ciencia real, para curiosos reales.</div>

        <h1>Elegí tus temas para empezar.</h1>
        <p className="lead">
          Te armamos un feed de papers recientes en los temas que te importan.
          Elegí al menos {MIN_TOPICS} — podés sumar todos los que quieras y
          cambiarlos cuando quieras.
        </p>

        <div className="topics">
          {TOPICS_ALPHABETICAL.map(t => (
            <TopicChip
              key={t.id}
              topic={t}
              active={selected.includes(t.id)}
              onClick={() => toggle(t.id)}
            />
          ))}
        </div>

        {/* Contador en su propia línea — antes iba inline al lado del
            botón; quedaba apretado y la jerarquía no era clara. */}
        <div className="onb-count">
          {selected.length < MIN_TOPICS
            ? `${selected.length} de ${MIN_TOPICS} temas`
            : `${selected.length} ${selected.length === 1 ? 'tema seleccionado' : 'temas seleccionados'}`}
        </div>

        {/* Botón en línea separada — centrado, ancho acotado. */}
        <div className="onb-action">
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
