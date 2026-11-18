// Islamic Art Prints Service Worker for Offline & PWA App Installation
const CACHE_NAME = 'islamic-art-prints-v2';
const ASSETS = [
  './',
  './index.html',
  './invoices.html',
  './manifest.json',
  './static/icon-192.png',
  './static/icon-512.png',
  './static/logo_opt.png',
  './static/signature_opt.png',
  './static/images_data.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    }).catch(() => caches.match('./index.html'))
  );
});
