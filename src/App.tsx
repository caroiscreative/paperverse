import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { ThemeDock } from './components/ThemeDock';
import { Feed } from './pages/Feed';
import { PaperDetail } from './pages/PaperDetail';
import { Library } from './pages/Library';
import { Welcome } from './pages/Welcome';
import { Manifiesto } from './pages/Manifiesto';
import { Colophon } from './pages/Colophon';

/**
 * Resetea el scroll al top cada vez que cambia la ruta o la query string.
 * Por defecto React Router v6 *no* hace esto — si venís scrolleado leyendo
 * un paper y clickeás "Ver quién lo citó", la nueva vista aparecería con el
 * scroll heredado y te perderías el header de "Citado por X" y las primeras
 * cards. Esto también aplica al volver al feed, navegar entre feed/biblioteca,
 * y al cambiar de query de búsqueda.
 */
function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
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
  const hasWorkingParams = loc.search.length > 0;
  if (!hasOnboarded() && !hasWorkingParams) {
    return <Navigate to="/bienvenida" replace />;
  }
  return <Feed />;
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {}
        <Route path="/bienvenida" element={<Welcome />} />

        {}
        <Route
          path="*"
          element={
            <div className="app">
              <Header />
              <ThemeDock />
              <Routes>
                <Route path="/" element={<FeedOrWelcome />} />
                <Route path="/paper/:id" element={<PaperDetail />} />
                <Route path="/biblioteca" element={<Library />} />
                <Route path="/manifiesto" element={<Manifiesto />} />
                <Route path="/colophon" element={<Colophon />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
