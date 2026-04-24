// Floating theme dock — small vertical pill anchored to the middle-left edge
// of the viewport. Contiene dos cosas:
//   · Toggle claro/oscuro (sol/luna)
//   · Atajo al Manifiesto (ícono de papel)
//
// Por qué acá y no en el Header: el Header ya compite por atención entre
// Feed / Biblioteca / Buscar. Meter el tema acá deja esa barra limpia y
// agrupa las "preferencias de lectura" (cómo se ve, atajo al texto editorial)
// en un mismo dock persistente, visible desde cualquier página.
//
// Nota histórica: antes este dock tenía un selector de 15 idiomas. Lo quitamos
// porque Paperverse quedó definido como single-language (español neutro LATAM)
// — el multi-idioma agregaba complejidad (cache por idioma, prompts por idioma,
// rate limits multiplicados) sin un caso de uso real para Carolina, que lee
// en español.
//
// Y antes del file-text había un botón de refresh para forzar re-traducir
// títulos cuando Pollinations se colgaba. Lo sacamos porque (a) la cache se
// auto-recupera al recargar la página y (b) el dock necesitaba un atajo al
// Manifiesto: ese link estaba en el sidebar del Feed, pero ahí solo se veía
// desde una página. Acá es global.

import { Link, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { useTheme } from '../lib/theme';

export function ThemeDock() {
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const onManifiesto = location.pathname === '/manifiesto';

  return (
    <div className="pv-theme-dock" role="group" aria-label="Preferencias de lectura">
      <button
        type="button"
        className={`pv-theme-dock-btn${theme === 'light' ? ' on' : ''}`}
        onClick={() => setTheme('light')}
        aria-pressed={theme === 'light'}
        aria-label="Modo claro"
        title="Modo claro"
      >
        <Icon name="sun" size={16} />
      </button>
      <button
        type="button"
        className={`pv-theme-dock-btn${theme === 'dark' ? ' on' : ''}`}
        onClick={() => setTheme('dark')}
        aria-pressed={theme === 'dark'}
        aria-label="Modo oscuro"
        title="Modo oscuro"
      >
        <Icon name="moon" size={16} />
      </button>

      {/* Manifiesto — atajo persistente al texto editorial. Va en el mismo
          stack que los toggles de tema, sin separador: el dock es chiquito y
          una línea extra fragmentaba más de lo que ayudaba. El icono
          (papel vs sol/luna) ya hace evidente que es otra cosa. */}
      <Link
        to="/manifiesto"
        className={`pv-theme-dock-btn${onManifiesto ? ' on' : ''}`}
        aria-label="Manifiesto"
        title="Manifiesto"
      >
        <Icon name="file-text" size={14} />
      </Link>
    </div>
  );
}
