import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

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
      const cacheVersion = Date.now().toString(36);
      const source = `
const CACHE = 'sudoku-duo-${cacheVersion}';
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
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
    },
  };
}

export default defineConfig({
  plugins: [react(), offlineServiceWorker()],
  base: './',
  server: {
    host: true,
  },
  build: {
    sourcemap: true,
  },
});
