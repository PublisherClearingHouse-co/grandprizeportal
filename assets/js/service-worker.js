// service-worker.js – for push notifications
self.addEventListener('install', function(e) {
    e.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', function(e) {
    e.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(e) {
    const data = e.data ? e.data.json() : { title: 'PCH Update', body: 'You have a new notification' };
    const options = {
        body: data.body || 'Check your account for updates.',
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        vibrate: [200, 100, 200],
        data: { url: data.url || '/user.html' }
    };
    e.waitUntil(
        self.registration.showNotification(data.title || 'PCH Winners Portal', options)
    );
});

self.addEventListener('notificationclick', function(e) {
    e.notification.close();
    e.waitUntil(
        clients.openWindow(e.notification.data.url || '/user.html')
    );
});