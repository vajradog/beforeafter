/**
 * Service Worker for Before/After Pro
 * Strategy: Network-first with cache fallback for offline support.
 * Bumping CACHE_VERSION forces old caches to be purged on activation.
 */
const CACHE_VERSION = 2;
const CACHE_NAME = `ba-pro-v${CACHE_VERSION}`;
const BASE = '/beforeafter/';

/**
 * URLs to precache on install.
 * These are the critical assets needed for the app shell.
 */
const PRECACHE_URLS = [
  BASE,
  BASE + 'favicon.svg',
  BASE + 'icon-192.svg',
];

// Install: precache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('ba-pro-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first with cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Skip chrome-extension and other non-http schemes
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // If no cache, return a minimal offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match(BASE);
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
