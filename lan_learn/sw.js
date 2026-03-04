// Service Worker for GTongue Learn PWA
// =====================================================================
// IMPORTANT: Bump CACHE_VERSION every time you deploy new files.
// This forces the SW to re-install, purge old caches, and fetch fresh.
// =====================================================================
const CACHE_VERSION = '2';  // <-- INCREMENT ON EVERY DEPLOYMENT
const CACHE_NAME   = 'gtongue-learn-v' + CACHE_VERSION;

const urlsToCache = [
  './',
  './index.html',
  './styles/style.css',
  './styles/learn-home.css',
  './styles/dialogue.css',
  './styles/login-modal.css',
  './js/App.js',
  './js/learn-home.js',
  './js/dialogue-data.js',
  './js/dialogue.js',
  './js/utils.js',
  './js/translation-service.js',
  './js/pwa-install.js',
  './js/login-modal.js',
  './manifest.json'
];

// Install event - cache resources and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell, version', CACHE_VERSION);
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[SW] Cache failed:', error);
      })
  );
  // Activate new SW immediately without waiting for old tabs to close
  self.skipWaiting();
});

// Activate event - clean up ALL old caches, then claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activated — version', CACHE_VERSION);
      // Take control of all open tabs immediately
      return self.clients.claim();
    })
  );
});

// =====================================================================
// Fetch Strategy: NETWORK-FIRST with cache fallback
//   - Always tries the network first so users get fresh content.
//   - Falls back to cache only when offline.
//   - Caches successful GET responses for offline use.
// =====================================================================
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Skip non-GET requests (POST, PUT, etc.)
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (CDNs, Google APIs, etc.)
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Got a fresh response from the network
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed — serve from cache (offline mode)
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If it's a page navigation, serve the cached index.html
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// Handle push notifications (optional for future use)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'gtongue-learn-notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('GTongue Learn', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

