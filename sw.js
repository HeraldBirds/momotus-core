'use strict';

const CACHE_VERSION = 'momotus-runtime-20261007-inspector-responsive-1';
const CACHEABLE_TYPES = new Set(['style', 'script', 'image', 'font', 'worker']);

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('momotus-runtime-') && key !== CACHE_VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

const networkFirst = async request => {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
};

const staleWhileRevalidate = async (request, event) => {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const network = fetch(request).then(async response => {
    if (response.ok) await cache.put(request, response.clone()).catch(() => {});
    return response;
  }).catch(() => null);
  event.waitUntil(network.then(() => {}));
  if (cached) return cached;
  return (await network) || Response.error();
};

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\/tienda\/js\/(configuracion|catalogo)\.js$/.test(url.pathname)) {event.respondWith(networkFirst(request));return;}
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (CACHEABLE_TYPES.has(request.destination)) event.respondWith(staleWhileRevalidate(request, event));
});
