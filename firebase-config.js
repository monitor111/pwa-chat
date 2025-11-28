// firebase-config.js
// Импорты Firebase (modular SDK)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-analytics.js';

// Конфигурация Firebase для твоего проекта
export const firebaseConfig = {
  apiKey: "AIzaSyCgtqA5RLLZ-krtKyT9JZyL5Fe5PokHJco",
  authDomain: "pwa-chat-2e68d.firebaseapp.com",
  projectId: "pwa-chat-2e68d",
  storageBucket: "pwa-chat-2e68d.appspot.com",
  messagingSenderId: "215886265728",
  appId: "1:215886265728:web:241db59ba5cb073bc29565",
  measurementId: "G-KXJ53JW7BL"
};

// Инициализация Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);