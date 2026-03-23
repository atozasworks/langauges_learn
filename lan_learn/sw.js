// Service Worker for GTongue Learn PWA
const CACHE_NAME = 'gtongue-learn-v3';
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles/style.css',
  './styles/learn-home.css',
  './styles/dialogue.css',
  './js/App.js',
  './js/learn-home.js',
  './js/dialogue-data.js',
  './js/dialogue.js',
  './js/utils.js',
  './js/translation-service.js',
  './js/pwa-install.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Cache files one-by-one so one failure does not break SW install.
    await Promise.all(
      PRECACHE_URLS.map(async (url) => {
        try {
          await cache.add(url);
        } catch (error) {
          console.warn('[SW] Precache failed for:', url, error);
        }
      })
    );
  })());

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.map((name) => {
        if (name !== CACHE_NAME) {
          return caches.delete(name);
        }
        return Promise.resolve();
      })
    );

    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    // Fallback for offline navigation.
    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('./index.html');
      if (offlinePage) {
        return offlinePage;
      }
    }

    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok && request.method === 'GET' && request.url.startsWith(self.location.origin)) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Let external requests pass through.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never cache auth/API endpoints.
  if (url.pathname.includes('/auth/')) {
    return;
  }

  // Always fetch documents fresh first.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets: return cached quickly and refresh in background.
  event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'gtongue-learn-notification',
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification('GTongue Learn', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./'));
});
