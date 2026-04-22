const CACHE_NAME = 'impactlink-v1';
const DYNAMIC_CACHE = 'impactlink-dynamic-v1';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js',
  // You'd typically add your bundled JS/CSS here, but since Vite hashes them, 
  // we rely on dynamic caching for the bundles unless we use Workbox.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Network First for API calls, Cache First for static assets
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // API calls
  if (requestUrl.pathname.startsWith('/api/')) {
    // Only cache GET requests. POST/PATCH mutations are handled locally
    // in components, but a full IndexedDB sync queue would intercept them here.
    if (event.request.method === 'GET') {
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            const resClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, resClone));
            return response;
          })
          .catch(() => caches.match(event.request))
      );
      return;
    }
  }

  // Static Assets (Cache First, fallback to Network)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      
      return fetch(event.request).then((response) => {
        // Cache dynamic UI assets
        if (event.request.method === 'GET' && !requestUrl.pathname.startsWith('/api/')) {
           const resClone = response.clone();
           caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, resClone));
        }
        return response;
      }).catch(() => {
        // If entirely offline and requesting root, return cached index
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
