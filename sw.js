const CACHE_NAME = 'ventos-de-oya-v4';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './shared/global.css',
    './shared/config.js',
    './shared/logo.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }))
        )
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('supabase.co')) return;
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

// Quando o filho clicar na notificação do telemóvel, abre o app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) client = clientList[i];
                }
                return client.focus();
            }
            return clients.openWindow('./');
        })
    );
});