import '@mantine/core/styles.css';
import './styles.css';
import './interaction.css';
import './pairing-polish.css';
import './home-polish.css';
import './learning-polish.css';
import './input-fixes.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const APP_VERSION = __APP_VERSION__;
const SW_RELOAD_KEY = 'sudoku-duo-sw-reload-version';
const APP_SCOPE_MARKER = '/sudoku-duo/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

async function removeSudokuCaches() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith('sudoku-duo-')).map((key) => caches.delete(key)));
}

async function hardRefreshToVersion(version: string) {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) => registration.scope.includes(APP_SCOPE_MARKER))
      .map((registration) => registration.unregister()),
  );
  await removeSudokuCaches();
  sessionStorage.removeItem(SW_RELOAD_KEY);

  const url = new URL(window.location.href);
  url.searchParams.set('v', version);
  url.searchParams.set('fresh', Date.now().toString(36));
  window.location.replace(url.toString());
}

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
    void fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<{ version?: string }> : null)
      .then((data) => {
        if (data?.version && data.version !== APP_VERSION) return hardRefreshToVersion(data.version);
        return undefined;
      })
      .catch(() => undefined);

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
