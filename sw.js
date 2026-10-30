'use strict';

const CACHE_VERSION = 'momotus-runtime-20261030-categories-1';
const CACHEABLE_TYPES = new Set(['style', 'script', 'image', 'font', 'worker']);
const DAY = 86400000;
const CACHE_POLICY = {
  images: { entries: 64, bytes: 40 * 1024 * 1024, itemBytes: 4 * 1024 * 1024, age: 28 * DAY },
  assets: { entries: 96, bytes: 24 * 1024 * 1024, itemBytes: 8 * 1024 * 1024, age: 28 * DAY },
  pages: { entries: 12, bytes: 2 * 1024 * 1024, itemBytes: 512 * 1024, age: 7 * DAY }
};
const OFFLINE_CACHE = `${CACHE_VERSION}-offline`, STAGING_CACHE = `${CACHE_VERSION}-offline-pending`;
const OFFLINE_LIMIT = 80 * 1024 * 1024;
const META_CACHE = `${CACHE_VERSION}-meta`;
const activeCaches = new Set([OFFLINE_CACHE, META_CACHE, ...Object.keys(CACHE_POLICY).map(key => `${CACHE_VERSION}-${key}`)]);
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
    const cached = await readCached(request, true) || await readOffline(request);
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
  return cached || (await network) || (await readOffline(request)) || Response.error();
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
  if (CACHEABLE_TYPES.has(request.destination) || /\/herramientas\/.*\.(?:json|webmanifest|ttf|otf|woff2?)$/.test(url.pathname)) event.respondWith(staleWhileRevalidate(request, event));
});

// An explicit user action prepares this bounded bundle. Nothing is precached on install.
let preparingOffline = false;
async function readOffline(request) {
  const cache=await caches.open(OFFLINE_CACHE);
  return (await cache.match(request,{ignoreSearch:true})) || null;
}
async function prepareOffline(port) {
  if(preparingOffline){port.postMessage({error:'Ya hay una preparación en curso en otra pestaña.'});return;}
  preparingOffline=true;const abort=new AbortController();let cancelled=false;
  port.onmessage=e=>{if(e.data?.type==='cancel'){cancelled=true;abort.abort();}};port.start();
  const base=new URL('./',self.location.href),urlFor=path=>new URL(path,base);
  try {
    const response=await fetch(urlFor('herramientas/offline-resources.json'),{cache:'no-store',signal:abort.signal});
    if(!response.ok)throw Error('No se encontró la lista de recursos. Actualizá los archivos del sitio.');
    const manifest=await response.json();
    if(manifest.version!=='20261030-categories-1'||!Array.isArray(manifest.files)||manifest.files.length>400)throw Error('Lista de recursos incompatible. Actualizá la página.');
    const paths=new Set();let estimate=0;
    for(const entry of manifest.files){
      const url=urlFor(entry.url);
      if(typeof entry.url!=='string'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||url.search||url.hash||!Number.isSafeInteger(entry.bytes)||entry.bytes<1||entry.bytes>8*1024*1024||paths.has(url.href))throw Error('Recurso sin conexión inválido.');
      paths.add(url.href);estimate+=entry.bytes;
    }
    if(estimate>OFFLINE_LIMIT)throw Error('La descarga supera el límite de 80 MiB.');
    await caches.delete(STAGING_CACHE);const staging=await caches.open(STAGING_CACHE);let bytes=0,done=0;
    for(const entry of manifest.files){
      if(cancelled)throw Error('Preparación cancelada.');
      const url=urlFor(entry.url),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000),cancel=()=>controller.abort();abort.signal.addEventListener('abort',cancel,{once:true});
      try{
        const res=await fetch(url,{cache:'no-store',signal:controller.signal});
        if(!res.ok||res.type==='opaque'||res.redirected)throw Error('No se pudo descargar '+entry.url+'. Volvé a intentar con conexión.');
        const size=await measuredBytes(res.clone(),8*1024*1024);
        if(size===null||bytes+size>OFFLINE_LIMIT)throw Error('La descarga supera el límite permitido.');
        bytes+=size;await staging.put(url,res);done++;port.postMessage({type:'progress',done,total:manifest.files.length,bytes});
      }finally{clearTimeout(timer);abort.signal.removeEventListener('abort',cancel);}
    }
    if(cancelled)throw Error('Preparación cancelada.');
    const cache=await caches.open(OFFLINE_CACHE);
    for(const request of await staging.keys())await cache.put(request,await staging.match(request));
    port.postMessage({type:'ready',total:done,bytes});
  }catch(e){port.postMessage({error:cancelled?'Preparación cancelada. Los archivos del proyecto se conservan.':e.message});}
  finally{await caches.delete(STAGING_CACHE);preparingOffline=false;port.close();}
}
self.addEventListener('message',event=>{
  if(event.data?.type==='MOMOTUS_OFFLINE_PREPARE'&&event.ports?.[0])event.waitUntil(prepareOffline(event.ports[0]));
});
