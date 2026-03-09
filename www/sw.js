const CACHE_NAME = 'money-track-v1';

const STATIC_ASSETS = [
  '/dashboard/',
  '/dashboard/index.html',
  '/dashboard/style.css',
  '/dashboard/script.js',
  '/expenses/',
  '/expenses/index.html',
  '/expenses/style.css',
  '/expenses/script.js',
  '/expenses/analytics.js',
  '/shared/',
  '/shared/index.html',
  '/shared/style.css',
  '/shared/script.js',
  '/shared/settings.html',
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
  const url = new URL(request.url);

  // Always go to network for API calls (backend)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // For everything else: network first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
