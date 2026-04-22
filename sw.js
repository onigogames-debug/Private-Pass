const CACHE_NAME = 'private-pass-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './crypto.js',
  './manifest.json',
  './icon.svg',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://unpkg.com/@phosphor-icons/web'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use cache.addAll but ignore partial failures like cors resources 
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.log('SW Cache error:', url, err)))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Fallback to network if not in cache
      return response || fetch(event.request);
    })
  );
});
