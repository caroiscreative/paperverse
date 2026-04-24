import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { useLibrary } from '../lib/library';
import { useReadPapers } from '../lib/read';
import { getLastFeedUrl } from '../lib/feedReturn';

export function Header() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const { entries } = useLibrary();
  const { has: readHas } = useReadPapers();

  // el contador de "Biblioteca" en el header antes
  // mostraba la cantidad TOTAL de papers guardados (leídos + no leídos).
  // Eso se desincronizaba con la Biblioteca misma, que separa "Para leer"
  // (activos) de "Archivo · leídos" (históricos). El badge del nav debería
  // comunicar "cuántos me esperan" — o sea, el número que importa para
  // decidir si entrar o no. Ahora cuenta sólo los pendientes (saved AND
  // not yet marked as read). Los leídos siguen contándose dentro de la
  // página, pero no engrosan el contador del header.
  const pendingCount = entries.filter(e => !readHas(e.paper.id)).length;

  // Overlay del buscador en mobile. El form inline del header está oculto
  // por CSS en <640px; acá controlamos un panel fijo que desciende debajo
  // del header cuando el usuario toca la lupa.
  const [searchOpen, setSearchOpen] = useState(false);
  const overlayInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus al abrir + cerrar con Esc. Usamos un solo useEffect para
  // ambas cosas porque dependen del mismo estado y conviven bien. Hook
  // siempre antes de cualquier early return (regla del proyecto).
  useEffect(() => {
    if (!searchOpen) return;
    // Focus diferido: si enfocamos en el mismo tick, el browser a veces
    // se come el foco por el re-render del panel.
    const id = window.setTimeout(() => overlayInputRef.current?.focus(), 10);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [searchOpen]);

  // Cerrar el overlay al navegar (ej. submitear y saltar al feed con el query).
  useEffect(() => {
    setSearchOpen(false);
  }, [loc.pathname, loc.search]);

  // Search-as-you-type (QA 3.1, 2026-04-20).
  // Antes el buscador requería Enter para disparar — el QA heurístico
  // (Nielsen H1 + Ley de Jakob) marcó que usuarios esperan búsqueda en vivo
  // en apps modernas y el requisito de "confirmá con Enter" pasaba inadvertido.
  // Ahora, 350ms después de la última tecla, navegamos automáticamente a
  // `/?q=<query>` con `replace: true` para no llenar el history con cada
  // pulsación (si no, pulsar Back después de escribir "quantum" te haría
  // retroceder letra por letra: "quantu", "quant", "quan", …).
  //
  // Condiciones de guarda:
  //   · Sólo disparamos si el trim del query local difiere del query en la URL
  //     actual (evita navigates redundantes y loops de re-render).
  //   · Si el query queda vacío Y estábamos en una URL con ?q=..., volvemos a
  //     `/`. Si estamos en otra ruta (biblioteca, detail) NO forzamos navegación
  //     — el input vacío en esas pantallas es el estado default y no debería
  //     secuestrar al usuario.
  //   · Mantenemos el submit onSubmit del form para usuarios que igual prefieren
  //     Enter (Ley de Fitts aplicada al teclado: el gesto de confirmar sigue
  //     funcionando si lo querés).
  //
  // El cleanup del setTimeout en el return evita disparar navigates con queries
  // obsoletos si el user sigue escribiendo rápido: cada nueva pulsación mata
  // al timer anterior y lanza uno fresco.
  useEffect(() => {
    const trimmed = q.trim();
    const currentUrlQ = params.get('q') ?? '';
    if (trimmed === currentUrlQ) return;
    const id = window.setTimeout(() => {
      if (trimmed) {
        nav(`/?q=${encodeURIComponent(trimmed)}`, { replace: true });
      } else if (currentUrlQ) {
        nav('/', { replace: true });
      }
    }, 350);
    return () => window.clearTimeout(id);
  }, [q, params, nav]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) {
      nav(`/?q=${encodeURIComponent(trimmed)}`);
    } else {
      nav('/');
    }
  };

  // Two tabs — the search bar is always visible, so a dedicated "Buscar" tab
  // is redundant. Feed covers both the default state and active queries.
  //   Feed       → /
  //   Biblioteca → /biblioteca
  const isLibrary = loc.pathname.startsWith('/biblioteca');
  const isFeed = !isLibrary;

  // The content column width changes per route (Feed/Library at 1180 vs.
  // PaperDetail/Manifiesto/DesignSystem at 760). Tag the header so CSS can
  // match the active width and keep the nav visually aligned with the page
  // body. Manifiesto y /design-system también caen acá: comparten el shell
  // `detail-wrap` del paper detail y su navegación debe ser sólo logo + tabs
  // (sin buscador), porque el contenido es editorial y el buscador distraería
  // del eje de lectura.
  const isDetail =
    /^\/paper\//.test(loc.pathname) ||
    loc.pathname.startsWith('/manifiesto') ||
    loc.pathname.startsWith('/design-system');
  const variantClass = isDetail ? 'pv-header--narrow' : '';

  return (
    <>
      <header className={`pv-header ${variantClass}`.trim()}>
        <div className="pv-header-inner">
          {/* el logo antes tenía alt="" (decorativo) porque
              el wordmark "Paperverse." al lado ya transmitía la marca. Pero
              ese wordmark está oculto en mobile (CSS display:none a ≤639px),
              y ahí el logo queda como único identificador visual del brand.
              Además, todo el <div> es clickable con role="button" y su job es
              "volver a la home" — screen readers necesitan saber eso. Ahora:
              el <img> trae alt descriptivo, y el contenedor tiene aria-label
              explicando la acción ("Ir al inicio — Paperverse"). En pantallas
              grandes el wordmark sigue siendo el label visual; el alt/aria
              son redundantes pero no hacen ruido porque ambos dicen lo mismo. */}
          <div
            className="brand"
            // antes era nav('/'), lo que perdía el
            // estado de búsqueda del feed si el usuario había clickeado un
            // paper con ?q= activo. Ahora consumimos getLastFeedUrl() para
            // volver al último feed visto (con query, con filtro de citas,
            // etc.). Si no hay nada guardado, cae a '/' default.
            onClick={() => nav(getLastFeedUrl())}
            role="button"
            tabIndex={0}
            aria-label="Ir al inicio — Paperverse"
          >
            {/* Revert: se pidió volver al logo completo
                `logo-mark.svg` en el header. La variante small existe en
                /design-system para contextos ≤32px, pero la identidad
                "canónica" (planeta + órbita punteada + core gold) vive acá. */}
            <img src="/assets/logo-mark.svg" alt="Paperverse" />
            <span className="wordmark" aria-hidden="true">
              Paperverse<span className="dot">.</span>
            </span>
          </div>

          {/* Search is hidden on the detail page — with the paper in focus, the
              navigation is just logo + tabs. Users go back to the feed to search. */}
          {!isDetail && (
            <form onSubmit={submit} className="search">
              <Icon name="search" size={15} />
              <input
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscá un tema, autor o paper"
                aria-label="Buscar papers"
              />
            </form>
          )}

          <nav aria-label="Principal">
            <button
              type="button"
              onClick={() => {
                // antes hacíamos nav('/') pelado
                // y limpiábamos `q`, lo que tiraba el estado de búsqueda
                // del feed al volver desde paper detail. Ahora usamos
                // getLastFeedUrl() para restaurar el último estado del
                // feed (query, filtros por citas, etc.). Sincronizamos
                // el input local del buscador con el q de esa URL para
                // que lo que se ve en el campo coincida con lo que se
                // filtra. Si no hay URL guardada, getLastFeedUrl()
                // devuelve '/' y el input queda limpio.
                const target = getLastFeedUrl();
                try {
                  const urlParams = new URLSearchParams(target.split('?')[1] ?? '');
                  setQ(urlParams.get('q') ?? '');
                } catch {
                  setQ('');
                }
                nav(target);
              }}
              className={isFeed ? 'active' : ''}
            >
              Feed
            </button>
            <button
              type="button"
              onClick={() => nav('/biblioteca')}
              className={isLibrary ? 'active' : ''}
            >
              Biblioteca
              {pendingCount > 0 && (
                <span
                  className="count"
                  aria-label={`${pendingCount} ${pendingCount === 1 ? 'paper pendiente' : 'papers pendientes'} de leer`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
            {/* Theme toggle moved out of the header and into <ThemeDock /> — a
                floating pill docked to the middle-left of the viewport. Kept
                the brand/tabs row focused on navigation only. */}
          </nav>

          {/* Ícono lupa — SOLO visible en mobile (<640px) vía CSS.
              Tapearlo abre el overlay con el input full-width. Renderizamos
              siempre el botón pero el CSS lo esconde en desktop/tablet porque
              el form inline ya está ahí. En páginas de detalle también se
              oculta porque la variante `--narrow` no tiene espacio para un
              tercer slot en la fila — al intentar incluirlo el header hace
              overflow horizontal. Desde el detail el usuario vuelve al feed
              (botón "< Volver") para buscar.

              Comportamiento del header:
                · Overlay cerrado → lupa (abrir).
                · Overlay abierto → X (cerrar). Sólo cierra; no manda.
              El botón de "enviar" (avioncito azul con borde ink) vive
              ADENTRO del overlay al lado del input, no acá. Carolina
              pidió esa separación explícita: la lupa/X es navegación de
              UI (mostrar/ocultar el panel), el avioncito es la acción
              sobre el contenido (mandar la búsqueda). */}
          {!isDetail && (
            <button
              type="button"
              className="search-icon"
              aria-label={searchOpen ? 'Cerrar búsqueda' : 'Abrir búsqueda'}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen(v => !v)}
            >
              <Icon name={searchOpen ? 'x' : 'search'} size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Overlay del buscador en mobile. Sale afuera del <header> porque se
          posiciona como fixed debajo de él — no necesita heredar el grid
          interno. Solo se renderiza cuando searchOpen es true (mobile).
          El CSS lo hace responsive: en desktop queda oculto porque el botón
          lupa está display:none.

          Estructura actual: input + botón avioncito al lado.
          Antes había una X de cerrar acá, que era redundante con la X del
          header ("aquí hay dos equis" ). La X quedó sólo arriba;
          acá ahora vive el botón PRIMARIO del overlay: avioncito de papel
          en cobalto con borde ink. Es el type="submit" del form, así que
          tanto Enter en el input como el tap sobre el avioncito disparan
          la búsqueda. Esta división es importante: la X es "cerrar el
          panel", el avioncito es "mandar la búsqueda" — dos acciones
          distintas con dos afordancias distintas. */}
      {searchOpen && !isDetail && (
        <div className="search-overlay" role="dialog" aria-label="Buscar papers">
          <form onSubmit={submit} className="search">
            <Icon name="search" size={15} />
            <input
              ref={overlayInputRef}
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscá un tema, autor o paper"
              aria-label="Buscar papers"
            />
          </form>
          <button
            type="button"
            className="send-btn"
            onClick={() => {
              // Replica la misma lógica que submit() — no usamos type="submit"
              // adentro del form porque el botón vive FUERA del <form> (está
              // como hermano, no como hijo). Si lo metiéramos adentro sí
              // funcionaría type="submit", pero el layout horizontal input +
              // botón es más limpio si son hermanos con el contenedor flex.
              const trimmed = q.trim();
              if (trimmed) {
                nav(`/?q=${encodeURIComponent(trimmed)}`);
              } else {
                nav('/');
              }
            }}
            aria-label="Enviar búsqueda"
            title="Enviar búsqueda"
            disabled={!q.trim()}
          >
            <Icon name="send" size={16} />
          </button>
        </div>
      )}
    </>
  );
}
