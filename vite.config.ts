import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const APP_VERSION = packageJson.version;

function offlineServiceWorker(): Plugin {
  return {
    name: 'sudoku-offline-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const generated = Object.keys(bundle).map((file) => `./${file}`);
      const staticFiles = [
        './',
        './index.html',
        './manifest.webmanifest',
        './icons/icon.svg',
        './icons/icon-192.png',
        './icons/icon-512.png',
        './icons/apple-touch-icon.png',
      ];
      const precache = [...new Set([...staticFiles, ...generated])];
      const buildId = Date.now().toString(36);
      const source = `
const APP_VERSION = '${APP_VERSION}';
const CACHE = 'sudoku-duo-v${APP_VERSION}-${buildId}';
const PRECACHE = ${JSON.stringify(precache)};
const FORCE_REFRESH_LEGACY_CLIENTS = APP_VERSION === '1.6.1';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async (url) => {
      const response = await fetch(url, { cache: 'reload' });
      if (response.ok) await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('sudoku-duo-') && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();

    if (FORCE_REFRESH_LEGACY_CLIENTS) {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(clients.map(async (client) => {
        if (!('navigate' in client)) return;
        try {
          await client.navigate(client.url);
        } catch {
          // A closed/background client can disappear while the worker activates.
        }
      }));
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'APP_VERSION', version: APP_VERSION });
    return;
  }
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const freshUrl = new URL(event.request.url);
        freshUrl.searchParams.set('__app_version', APP_VERSION);
        return await fetch(freshUrl.toString(), { cache: 'no-store' });
      } catch {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.endsWith('/manifest.webmanifest')) {
    event.respondWith((async () => {
      try {
        return await fetch(event.request, { cache: 'no-store' });
      } catch {
        return (await caches.match(event.request)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
      return response;
    })),
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: APP_VERSION }) });
    },
  };
}

export default defineConfig({
  plugins: [react(), offlineServiceWorker()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  server: {
    host: true,
  },
  build: {
    sourcemap: true,
  },
});
