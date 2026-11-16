const CACHE = 'blackjack-v3.0';

const ASSETS = [
  './',
  './index.html',
  './poker.html',
  './tactica.html',
  './pulso.html',
  './slots.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/cards.css',
  './css/styles.css',
  './css/chooser.css',
  './css/poker.css',
  './css/slots.css',
  './css/slots-themes.css',
  './js/sound.js',
  './js/core/storage.js',
  './js/core/cards.js',
  './js/core/money.js',
  './js/core/prefs.js',
  './js/core/wallet.js',
  './js/core/gestures.js',
  './js/core/chips.js',
  './js/core/ui.js',
  './js/games/blackjack/engine.js',
  './js/games/blackjack/controller.js',
  './js/games/poker/engine.js',
  './js/games/poker/controller.js',
  './js/games/slots/controller.js',
  './js/games/slots/core/config.js',
  './js/games/slots/core/grid.js',
  './js/games/slots/core/evaluate.js',
  './js/games/slots/core/tumble.js',
  './js/games/slots/core/spin.js',
  './js/games/slots/games/tactica.js',
  './js/games/slots/games/pulso.js',
  './js/games/slots/games/tactica.art.js',
  './js/games/slots/games/pulso.art.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    const fallback = url.pathname.endsWith('poker.html')
      ? './poker.html'
      : url.pathname.endsWith('tactica.html')
        ? './tactica.html'
        : url.pathname.endsWith('pulso.html')
          ? './pulso.html'
          : './index.html';
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(fallback))),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});
