// =============================================
// SERVICE-WORKER.JS – PWA Lifecycle
// =============================================

const CACHE_NAME = 'pch-portal-v2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/user.html',
    '/admin.html',
    '/assets/css/style.css',
    '/assets/js/app.js',
    '/assets/js/user.js',
    '/assets/js/admin.js',
    '/assets/js/service-worker.js',
    '/manifest.json'
];

// ---- Install ----
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// ---- Activate ----
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// ---- Fetch ----
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip API/data requests (dynamic content)
    if (url.pathname.includes('/api/') || url.pathname.includes('/data/')) return;

    // Skip sensitive pages (user/admin dashboards) – they need fresh data
    if (url.pathname.includes('user.html') || url.pathname.includes('admin.html')) {
        event.respondWith(fetch(request));
        return;
    }

    // For static assets, try cache first, fallback to network
    event.respondWith(
        caches.match(request)
            .then(response => {
                if (response) return response;
                return fetch(request).then(fetchResponse => {
                    // Cache the fetched response for future
                    const clone = fetchResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    return fetchResponse;
                });
            })
            .catch(() => {
                // Offline fallback
                if (url.pathname.endsWith('.html')) {
                    return caches.match('/index.html');
                }
                return new Response('Offline', { status: 503 });
            })
    );
});

// ---- Update check ----
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
