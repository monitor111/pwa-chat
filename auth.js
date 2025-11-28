// auth.js
import { db } from './firebase-config.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Генерация уникального ID для устройства
function generateDeviceId() {
  return 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// Сохранение deviceId в cookie (переживет очистку кеша)
function saveDeviceIdToCookie(deviceId) {
  // Cookie будет жить 10 лет
  const expires = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `deviceId=${deviceId}; expires=${expires}; path=/; SameSite=Strict`;
}

// Получение deviceId из cookie
function getDeviceIdFromCookie() {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'deviceId') return value;
  }
  return null;
}

// Получение или создание ID устройства
function getDeviceId() {
  // Сначала пробуем localStorage
  let deviceId = localStorage.getItem('deviceId');
  
  // Если нет в localStorage - пробуем cookie
  if (!deviceId) {
    deviceId = getDeviceIdFromCookie();
    if (deviceId) {
      // Восстанавливаем в localStorage
      localStorage.setItem('deviceId', deviceId);
      console.log('deviceId восстановлен из cookie:', deviceId);
    }
  }
  
  // Если нигде нет - создаем новый
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem('deviceId', deviceId);
    saveDeviceIdToCookie(deviceId);
    console.log('Создан новый deviceId:', deviceId);
  } else {
    // Убеждаемся что везде сохранено
    saveDeviceIdToCookie(deviceId);
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
  // Удаляем cookie
  document.cookie = 'deviceId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
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