const CACHE_NAME = 'ventos-de-oya-v3';
const ASSETS = [
    '/',
    '/css/style.css',
    '/js/main.js',
    '/js/config.js',
    '/js/auth.js',
    '/js/painelFilho.js',
    '/js/girasAvisos.js',
    '/js/faxina.js',
    '/js/financeiro.js'
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
            return clients.openWindow('/');
        })
    );
});