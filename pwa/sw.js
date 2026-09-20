// Service worker for the Fixture Lookup PWA.
//
// SHELL_CACHE holds the static app shell (versioned — bump SHELL_VERSION
// when index.html/styles.css/app.js/manifest/icons change).
// DATA_CACHE holds data.json and photos. It's refreshed (not wiped) on every
// install: data.json is always re-fetched from network when possible, photos
// are added as needed, and entries for photos no longer referenced by the
// current data.json are pruned so storage doesn't grow unbounded.
const SHELL_VERSION = 'v1';
const SHELL_CACHE = `fixtures-shell-${SHELL_VERSION}`;
const DATA_CACHE = 'fixtures-data';

const SHELL_FILES = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

async function refreshDataCache() {
  const cache = await caches.open(DATA_CACHE);

  const dataRes = await fetch('data.json', { cache: 'no-cache' });
  if (!dataRes.ok) return;
  const data = await dataRes.clone().json();
  await cache.put('data.json', dataRes);

  const wantedPaths = new Set(data.lights.flatMap((l) => l.photos.map((p) => p.path)));

  await Promise.all(
    [...wantedPaths].map(async (path) => {
      const existing = await cache.match(path);
      if (existing) return;
      try {
        const res = await fetch(path);
        if (res.ok) await cache.put(path, res);
      } catch {
        // Offline during install with a photo not yet cached — will be
        // picked up by the runtime fetch handler once reachable.
      }
    })
  );

  // Prune photos that are no longer referenced.
  const scopePathPrefix = new URL(self.registration.scope).pathname;
  const keys = await cache.keys();
  await Promise.all(
    keys.map(async (req) => {
      const scopePath = new URL(req.url).pathname.slice(scopePathPrefix.length);
      if (scopePath.startsWith('photos/') && !wantedPaths.has(scopePath)) {
        await cache.delete(req);
      }
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shellCache = await caches.open(SHELL_CACHE);
      await shellCache.addAll(SHELL_FILES);
      await refreshDataCache().catch((err) => console.error('data cache refresh failed', err));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('fixtures-shell-') && name !== SHELL_CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const scopePath = url.pathname.slice(new URL(self.registration.scope).pathname.length);

  if (scopePath === 'data.json') {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  event.respondWith(cacheFirst(request, scopePath.startsWith('photos/') ? DATA_CACHE : SHELL_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const shellFallback = await caches.match('index.html');
    if (shellFallback) return shellFallback;
    throw err;
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request, { cache: 'no-cache' });
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('offline and no cached data.json');
  }
}
