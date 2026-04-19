import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useTheme } from '../lib/theme';
import { LANGS, useLang } from '../lib/lang';
import { clearTranslationCache } from '../lib/translate';

export function ThemeDock() {
  const { theme, setTheme } = useTheme();
  const { lang, def, setLang, refresh } = useLang();
  const [langOpen, setLangOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!langOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLangOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [langOpen]);

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

      {}

      <div ref={popRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className={`pv-theme-dock-btn${langOpen ? ' on' : ''}`}
          onClick={() => setLangOpen(v => !v)}
          aria-haspopup="listbox"
          aria-expanded={langOpen}
          aria-label={`Idioma: ${def.label}`}
          title={`Idioma: ${def.label}`}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            letterSpacing: '0.08em',
            fontWeight: 600,
            borderTop: '1px solid var(--border-1)',
          }}
        >
          {def.short}
        </button>

        {langOpen && (
          <div
            role="listbox"
            aria-label="Seleccionar idioma"
            style={{
              position: 'absolute',
              left: 'calc(100% + 10px)',
              top: 0,
              width: 200,
              maxHeight: 340,
              overflowY: 'auto',
              background: 'var(--bg-1)',
              border: '1px solid var(--border-1)',
              borderRadius: 10,
              boxShadow: '0 8px 24px -12px rgba(0,0,0,0.28)',
              padding: 6,
              zIndex: 50,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--fg-4)',
                padding: '8px 10px 4px',
              }}
            >
              Idioma · traducción IA
            </div>
            {LANGS.map(l => {
              const active = l.id === lang;
              return (
                <button
                  key={l.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setLang(l.id);
                    setLangOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '8px 10px',
                    border: 0,
                    borderRadius: 6,
                    background: active ? 'var(--bg-2)' : 'transparent',
                    color: active ? 'var(--fg-1)' : 'var(--fg-2)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: 'var(--font-sans)',
                    textAlign: 'left',
                  }}
                >
                  <span>{l.label}</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.1em',
                      color: 'var(--fg-4)',
                    }}
                  >
                    {l.short}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {}
      <button
        type="button"
        className="pv-theme-dock-btn"
        onClick={() => {
          clearTranslationCache();
          refresh();
        }}
        aria-label="Recargar traducciones"
        title="Recargar traducciones"
        style={{ borderTop: '1px solid var(--border-1)' }}
      >
        <Icon name="refresh" size={14} />
      </button>
    </div>
  );
}
