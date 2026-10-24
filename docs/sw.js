/* GhostQuest service worker: keeps the game working offline.
   Bump VERSION whenever you publish new files so phones pick them up. */
const VERSION = 'gq-v3';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'assets/world.jpg', 'assets/wordmark.png', 'assets/logo.jpg', 'assets/icon.jpg', 'icons/icon-192.png', 'icons/icon-512.png'];
const AI = 'gq-ai-v1', TILES = 'gq-tiles-v1', TILE_LIMIT = 300; /* only tiles the player has actually looked at; no bulk downloading */

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== TILES && k !== AI) await caches.delete(k);
    await self.clients.claim();
  })());
});
async function trim(cache) { const keys = await cache.keys(); for (let i = 0; i < keys.length - TILE_LIMIT; i++) await cache.delete(keys[i]); }
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith((async () => {
      const cache = await caches.open(TILES), hit = await cache.match(req);
      try { const res = await fetch(req); if (res && (res.ok || res.type === 'opaque')) { cache.put(req, res.clone()); trim(cache); } return res; }
      catch (err) { return hit || Response.error(); }
    })());
    return;
  }
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'storage.googleapis.com') {
    e.respondWith((async () => {
      const cache = await caches.open(AI), hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('index.html', copy)); } return res; }).catch(() => caches.match('index.html').then((r) => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque') && (url.origin === location.origin || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com'))) {
      const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy));
    }
    return res;
  }).catch(() => hit)));
});
