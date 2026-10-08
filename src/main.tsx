import '@mantine/core/styles.css';
import './styles.css';
import './interaction.css';
import './pairing-polish.css';
import './home-polish.css';
import './learning-polish.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const APP_VERSION = __APP_VERSION__;
const SW_RELOAD_KEY = 'sudoku-duo-sw-reload-version';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let reloadingForUpdate = false;

  const reloadForNewWorker = () => {
    if (reloadingForUpdate) return;
    if (sessionStorage.getItem(SW_RELOAD_KEY) === APP_VERSION) return;
    reloadingForUpdate = true;
    sessionStorage.setItem(SW_RELOAD_KEY, APP_VERSION);
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', reloadForNewWorker);

  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    navigator.serviceWorker.getRegistration().then((registration) => registration?.update()).catch(() => undefined);
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`./sw.js?v=${APP_VERSION}`, { updateViaCache: 'none' })
      .then(async (registration) => {
        const activateWaitingWorker = () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' });

        activateWaitingWorker();

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') activateWaitingWorker();
          });
        });

        try {
          await registration.update();
          activateWaitingWorker();
        } catch {
          // Offline is a supported mode; keep the currently installed worker.
        }
      })
      .catch(() => undefined);
  });
}
