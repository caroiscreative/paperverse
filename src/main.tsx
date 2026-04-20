import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

// Silenciar AbortErrors no atrapados. AbortError es por definición benigno:
// alguien (timeout de traducción, card que salió de viewport, usuario que
// navegó) pidió cancelar una operación en vuelo. Chrome loguea esos rejects
// como "Uncaught (in promise) AbortError" aunque tengamos catches río abajo,
// porque a veces el signal se propaga a un fetch interno del que ya nadie
// estaba awaitando — el listener del abort sigue disparando el reject,
// pero no hay consumer. Este handler intercepta esos casos y hace
// preventDefault() solo para errores que matchean AbortError por name, sin
// tocar ningún otro error real (bugs, network genuinos, parse errors).
window.addEventListener('unhandledrejection', event => {
  const reason = event.reason;
  const isAbort =
    reason instanceof DOMException && reason.name === 'AbortError';
  if (isAbort) {
    event.preventDefault();
  }
});

const container = document.getElementById('root');
if (!container) throw new Error('No root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
