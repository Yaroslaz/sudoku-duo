import '@mantine/core/styles.css';
import './styles.css';
import './interaction.css';
import './pairing-polish.css';
import './home-polish.css';
import './learning-polish.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const APP_VERSION = '1.1.0';
const SW_RELOAD_KEY = 'sudoku-duo-sw-reload-version';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let reloadingForUpdate = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) return;
    if (sessionStorage.getItem(SW_RELOAD_KEY) === APP_VERSION) return;
    reloadingForUpdate = true;
    sessionStorage.setItem(SW_RELOAD_KEY, APP_VERSION);
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`./sw.js?v=${APP_VERSION}`, { updateViaCache: 'none' })
      .then(async (registration) => {
        try {
          await registration.update();
        } catch {
          // Offline is a supported mode; keep the currently installed worker.
        }
      })
      .catch(() => undefined);
  });
}
