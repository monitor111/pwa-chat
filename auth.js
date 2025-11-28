// auth.js
import { db } from './firebase-config.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Генерация уникального ID для устройства
function generateDeviceId() {
  return 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// Получение или создание ID устройства
function getDeviceId() {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

// Функция для обеспечения авторизации
export async function ensureAuth(onReady) {
  const deviceId = getDeviceId();
  const displayName = localStorage.getItem('displayName') || ('User-' + deviceId.slice(-4));
  
  // Создаем объект пользователя
  const user = {
    uid: deviceId,
    displayName: displayName
  };
  
  try {
    // Обновляем данные пользователя в Firestore
    await setDoc(doc(db, 'users', deviceId), {
      uid: deviceId,
      name: displayName,
      lastSeen: serverTimestamp(),
      online: true
    }, { merge: true });
    
    console.log('Пользователь авторизован:', displayName, deviceId);
  } catch (e) {
    console.error('Ошибка обновления Firestore:', e);
  }
  
  onReady(user);
}

// Функция для выхода пользователя
export async function signOutUser() {
  const deviceId = getDeviceId();
  
  try {
    await setDoc(doc(db, 'users', deviceId), {
      online: false,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error('Ошибка обновления Firestore при выходе:', e);
  }
  
  // Очищаем все данные
  localStorage.removeItem('deviceId');
  localStorage.removeItem('displayName');
}

// Функция для обновления статуса онлайн
export async function updateOnlineStatus(isOnline) {
  const deviceId = getDeviceId();
  
  try {
    await setDoc(doc(db, 'users', deviceId), {
      online: isOnline,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error('Ошибка обновления статуса:', e);
  }
}