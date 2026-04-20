import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { ToastRegion } from './components/ToastRegion';
import { Feed } from './pages/Feed';
import { PaperDetail } from './pages/PaperDetail';
import { Library } from './pages/Library';
import { Welcome } from './pages/Welcome';
import { Manifiesto } from './pages/Manifiesto';
import { DesignSystem } from './pages/DesignSystem';

/**
 * Resetea el scroll al top cada vez que cambia la ruta o la query string.
 * Por defecto React Router v6 *no* hace esto — si venís scrolleado leyendo
 * un paper y clickeás "Ver quién lo citó", la nueva vista aparecería con el
 * scroll heredado y te perderías el header de "Citado por X" y las primeras
 * cards. Esto también aplica al volver al feed, navegar entre feed/biblioteca,
 * y al cambiar de query de búsqueda.
 *
 * Excepción : si la ÚNICA diferencia entre el search
 * anterior y el actual es el parámetro `q` (search-as-you-type), no
 * reseteamos. Si lo hiciéramos, cada pulsación mientras el usuario tipea
 * dispararía un jump al top que haría perder el lugar donde estaba mirando
 * los resultados — especialmente molesto si el usuario refina el query
 * scrolleado a la mitad de la lista. Comparamos los params "sin q" y si
 * son equivalentes, skipeamos el scroll. Cualquier otro cambio (cites,
 * citedBy, pathname, incluso sumar un param nuevo) sigue disparando el
 * reset normal.
 */
function ScrollToTop() {
  const { pathname, search } = useLocation();
  const prevRef = useRef({ pathname, search });
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { pathname, search };

    // Mismo pathname + cambió sólo `q`: skip reset.
    if (prev.pathname === pathname) {
      const prevParams = new URLSearchParams(prev.search);
      const currParams = new URLSearchParams(search);
      prevParams.delete('q');
      currParams.delete('q');
      // Serializamos ambos para comparar contenido, no referencias. Si el
      // resto de los params quedan idénticos, el único cambio fue `q` y
      // preservamos el scroll.
      if (prevParams.toString() === currParams.toString()) return;
    }

    // instant: evita la animación suave que en Safari se siente laggy cuando
    // venís de una página muy scrolleada.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, search]);
  return null;
}

const ONBOARDED_KEY = 'pv_onboarded_v1';

function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return true; // If storage is disabled, don't trap the user in onboarding.
  }
}

/**
 * Feed route with a one-time welcome gate. If the user has never picked any
 * topics, show the Welcome picker instead of an empty feed.
 */
function FeedOrWelcome() {
  const loc = useLocation();
  // If there's a query / citation param, we're in "Buscar" mode and should
  // always render the feed — don't trap a deep link into onboarding.
  const hasWorkingParams = loc.search.length > 0;
  if (!hasOnboarded() && !hasWorkingParams) {
    return <Navigate to="/bienvenida" replace />;
  }
  return <Feed />;
}

export function App() {
  return (
    // future flags de React Router v6 → v7. Las
    // consolamos los warnings que aparecían en dev y, más importante,
    // nos suscribimos por adelantado al comportamiento que trae v7 para
    // que la migración futura sea un bump de versión sin sorpresas.
    //
    // · v7_startTransition: envuelve los state updates del router en
    // React.startTransition. Evita bloqueos del main thread en
    // navegaciones con Suspense y es no-op en este proyecto (no usamos
    // suspense-based data loading) pero nos asegura que si lo agregamos
    // después, el router ya se comporta como v7.
    // · v7_relativeSplatPath: cambia cómo resuelve paths relativos dentro
    // de rutas splat ("*"). En App.tsx montamos un splat-wrapper con el
    // shell (Header + Routes internas) y todas las rutas internas son
    // absolutas ("/", "/paper/:id", …), por lo que el cambio es neutral
    // para nosotros. Activarlo igual así no arrastramos el warning.
    //
    // Los otros flags de v7 (v7_fetcherPersist, v7_normalizeFormMethod,
    // v7_partialHydration, v7_skipActionErrorRevalidation) son exclusivos
    // del data router (createBrowserRouter), que no usamos: montamos
    // <BrowserRouter> + <Routes> clásicos. No aplican.
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ScrollToTop />
      {/* ToastRegion es global — vive fuera de <Routes> así persiste entre
          navegaciones. Si un toast se dispara durante un cambio de ruta
          (ej. "Guardado en biblioteca" al clickear save desde el feed),
          sigue visible cuando el usuario entra al detail. */}
      <ToastRegion />
      <Routes>
        {/* Welcome has its own full-screen layout and should NOT show the header. */}
        <Route path="/bienvenida" element={<Welcome />} />

        {/* Everything else lives under the header + app shell. */}
        <Route
          path="*"
          element={
            <div className="app">
              <Header />
              {/* ThemeDock eliminado : el toggle de tema
                  vive en el meta-row del sidebar del Feed — tres bloques
                  hermanos ("¿Qué es Paperverse?", "Creado por", "Tema").
                  El dock flotante se sacó tanto en mobile como en desktop
                  por decisión de producto: ya no lo necesitamos como barra
                  separada. El componente ThemeDock.tsx sigue en el repo
                  por si volviera en otra forma, pero no se renderiza. */}
              <Routes>
                <Route path="/" element={<FeedOrWelcome />} />
                <Route path="/paper/:id" element={<PaperDetail />} />
                <Route path="/biblioteca" element={<Library />} />
                <Route path="/manifiesto" element={<Manifiesto />} />
                <Route path="/design-system" element={<DesignSystem />} />
                {/* /colophon se mergeó adentro de /manifiesto — redirigimos
                    los deep links viejos para no romper anchors compartidos. */}
                <Route path="/colophon" element={<Navigate to="/manifiesto" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
