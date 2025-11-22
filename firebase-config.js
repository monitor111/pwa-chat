// firebase-config.js

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
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db, analytics };
