'use strict';

const CACHE_VERSION = 'momotus-runtime-20261023-catalog-preserved-1';
const CACHEABLE_TYPES = new Set(['style', 'script', 'image', 'font', 'worker']);
const DAY = 86400000;
const CACHE_POLICY = {
  images: { entries: 64, bytes: 40 * 1024 * 1024, itemBytes: 4 * 1024 * 1024, age: 28 * DAY },
  assets: { entries: 96, bytes: 24 * 1024 * 1024, itemBytes: 8 * 1024 * 1024, age: 28 * DAY },
  pages: { entries: 12, bytes: 2 * 1024 * 1024, itemBytes: 512 * 1024, age: 7 * DAY }
};
const META_CACHE = `${CACHE_VERSION}-meta`;
const activeCaches = new Set([META_CACHE, ...Object.keys(CACHE_POLICY).map(key => `${CACHE_VERSION}-${key}`)]);
let cacheWrites = Promise.resolve();
const bucketFor = request => request.destination === 'image' ? 'images'
  : request.mode === 'navigate' || request.destination === 'document' ? 'pages' : 'assets';
const cacheName = request => `${CACHE_VERSION}-${bucketFor(request)}`;

// Cuenta el cuerpo real con límite, incluso si el servidor omite Content-Length.
async function measuredBytes(response, limit) {
  const header = Number(response.headers.get('content-length'));
  if (header > limit) { response.body?.cancel().catch(() => {}); return null; }
  const reader = response.body?.getReader();
  if (!reader) return 0;
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return bytes;
      bytes += chunk.value.byteLength;
      if (bytes > limit) { reader.cancel().catch(() => {}); return null; }
    }
  } finally { reader.releaseLock(); }
}

async function trimCache(bucket, cache, metadata) {
  const policy = CACHE_POLICY[bucket], entries = [];
  for (const request of await cache.keys()) {
    const record = await metadata.match(request);
    const info = record ? await record.json().catch(() => null) : null;
    if (!info || Date.now() - info.time > policy.age) {
      await cache.delete(request);await metadata.delete(request);
    } else entries.push({ request, ...info });
  }
  let bytes = entries.reduce((total, entry) => total + entry.bytes, 0);
  entries.sort((a, b) => a.time - b.time);
  while (entries.length > policy.entries || bytes > policy.bytes) {
    const oldest = entries.shift();bytes -= oldest.bytes;
    await cache.delete(oldest.request);await metadata.delete(oldest.request);
  }
}

function putCached(request, response) {
  if (!response.ok || response.type === 'opaque' || request.cache === 'no-store'
      || /\bno-store\b/i.test(response.headers.get('cache-control') || '')) return Promise.resolve();
  const copy = response.clone(), bucket = bucketFor(request);
  const write = async () => {
    const bytes = await measuredBytes(copy.clone(), CACHE_POLICY[bucket].itemBytes);
    if (bytes === null) { copy.body?.cancel().catch(() => {}); return; }
    const cache = await caches.open(cacheName(request)), metadata = await caches.open(META_CACHE);
    await cache.put(request, copy);
    await metadata.put(request, new Response(JSON.stringify({ time: Date.now(), bytes }), {
      headers: { 'Content-Type': 'application/json' }
    }));
    await trimCache(bucket, cache, metadata);
  };
  // Las escrituras y la poda comparten cola; las descargas y la página no esperan.
  cacheWrites = cacheWrites.catch(() => {}).then(write).catch(() => {});
  return cacheWrites;
}

async function readCached(request, ignoreSearch = false) {
  const cache = await caches.open(cacheName(request));
  const key = ignoreSearch ? (await cache.keys(request, { ignoreSearch: true })).pop() : request;
  if (!key) return null;
  const response = await cache.match(key);
  if (!response) return null;
  const metadata = await caches.open(META_CACHE), record = await metadata.match(key);
  const info = record ? await record.json().catch(() => null) : null;
  if (!info || Date.now() - info.time > CACHE_POLICY[bucketFor(request)].age) return null;
  return response;
}

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('momotus-runtime-') && !activeCaches.has(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, event) {
  try {
    const response = await fetch(request);
    event.waitUntil(putCached(request, response));
    return response;
  } catch (error) {
    const cached = await readCached(request, true);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request, event) {
  const cached = await readCached(request);
  const network = fetch(request).then(response => {
    event.waitUntil(putCached(request, response));
    return response;
  }).catch(() => null);
  event.waitUntil(network.then(() => {}));
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || request.cache === 'no-store') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\/herramientas\/pliegos\/.*\.js$/.test(url.pathname)
      || /\/tienda\/js\/(configuracion|catalogo)\.js$/.test(url.pathname)
      || request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request, event));return;
  }
  if (CACHEABLE_TYPES.has(request.destination)) event.respondWith(staleWhileRevalidate(request, event));
});
