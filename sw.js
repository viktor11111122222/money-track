const CACHE_NAME = 'money-track-v4';

const STATIC_ASSETS = [
  '/dashboard/style.css',
  '/dashboard/script.js',
  '/expenses/style.css',
  '/expenses/script.js',
  '/expenses/analytics.js',
  '/shared/style.css',
  '/shared/script.js',
  '/public/theme.css',
  '/public/theme-init.js',
  '/public/i18n.js',
  '/public/settings.js',
  '/public/auth-guard.js',
  '/public/account-avatar.js',
  '/public/avatar-default.svg',
  '/public/wallet-logo.jpg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // CRITICAL: Do NOT intercept navigation requests.
  // In Capacitor Android, SW fetch() for https://localhost/* is not intercepted
  // by the native shouldInterceptRequest handler, causing a ~20s TCP timeout
  // before every page navigation. Let the browser handle navigations natively.
  if (request.mode === 'navigate') return;

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
