// service-worker.js

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

// Конфигурация Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCgtqA5RLLZ-krtKyT9JZ5Fe5PokHJco",
  authDomain: "pwa-chat-2e68d.firebaseapp.com",
  projectId: "pwa-chat-2e68d",
  storageBucket: "pwa-chat-2e68d.firebasestorage.app",
  messagingSenderId: "215886265728",
  appId: "1:215886265728:web:3eb6a908ca8d4a00c29565",
  measurementId: "G-RCFPNRCPTS"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);

// Получаем messaging
const messaging = firebase.messaging();

// Кеширование PWA
const CACHE_NAME = 'pwa-chat-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/auth.js',
  '/firebase-config.js',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// Установка и кеширование
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Активация и удаление старых кешей
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Обработка fetch
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Обработка сообщений в фоне через FCM
messaging.onBackgroundMessage(payload => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'icons/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
