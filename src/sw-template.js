/* Offline-first service worker. No network calls: the precache is installed
   once, then served from CacheStorage. Same-origin only. Previous caches are
   kept briefly so an older client can still load its own hashed assets during
   a deployment. Missing assets are never answered with the HTML shell. */
const CACHE_PREFIX = 'fallingsand-';
const CACHE = CACHE_PREFIX + '__CACHE_VERSION__';
const PRECACHE = __PRECACHE__;
const KEEP_PREVIOUS = 2;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        const old = keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE);
        const stale = old.slice(0, Math.max(0, old.length - KEEP_PREVIOUS));
        return Promise.all(stale.map((key) => caches.delete(key)));
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === 'navigate' || event.request.destination === 'document';
  if (isNavigation) {
    event.respondWith(
      caches.open(CACHE)
        .then((cache) => cache.match('./index.html'))
        .then((cached) => cached || caches.match('./index.html'))
        .then((cached) => cached || caches.match(event.request))
        .then((cached) => cached || new Response('Offline shell is unavailable.', { status: 503, headers: { 'Content-Type': 'text/plain' } }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cached) => cached || new Response('Asset is not in the offline cache.', { status: 404, headers: { 'Content-Type': 'text/plain' } }))
  );
});
