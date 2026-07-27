const CACHE_NAME = 'classkeep-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png'
];

// Install: cache static assets and skip waiting so the new SW activates quickly.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches and claim clients.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: navigation requests (HTML pages) go network-first so users always get
// the latest index.html and hashed JS/CSS bundles. Static assets fall back to cache.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request);
    })
  );
});

// Push: placeholder for future browser notifications.
self.addEventListener('push', (event) => {
  // eslint-disable-next-line no-console
  console.log('[ClassKeep SW] Push received:', event);

  let data = { title: 'ClassKeep', body: 'You have a new notification.' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    // Use defaults if payload parsing fails.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/android-chrome-192x192.png',
      badge: '/android-chrome-192x192.png',
    })
  );
});