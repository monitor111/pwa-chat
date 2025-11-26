const CACHE = 'chat-pwa-v1';
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './auth.js',
  './firebase-config.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // простая cache-first стратегия для статики
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

self.addEventListener('notificationclick', (e) => {
  const data = e.notification.data || {};
  e.notification.close();
  // фокусируем/открываем приложение
  e.waitUntil(clients.matchAll({type:'window'}).then(list => {
    for (const client of list) {
      if (client.url && 'focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow('/');
  }));
});
