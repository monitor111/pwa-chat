// auth.js
import { db } from './firebase-config.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Создание отпечатка браузера/устройства
async function createFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('fingerprint', 2, 2);
  const canvasHash = canvas.toDataURL().slice(-50);
  
  const fingerprint = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvas: canvasHash
  };
  
  const fingerprintString = JSON.stringify(fingerprint);
  
  // Простой hash
  let hash = 0;
  for (let i = 0; i < fingerprintString.length; i++) {
    const char = fingerprintString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return 'device_' + Math.abs(hash).toString(36);
}

// Получение или создание ID устройства
async function getDeviceId() {
  // Проверяем localStorage
  let deviceId = localStorage.getItem('deviceId');
  
  if (!deviceId) {
    // Создаем fingerprint устройства
    deviceId = await createFingerprint();
    localStorage.setItem('deviceId', deviceId);
    
    // Дублируем в cookie
    const expires = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `deviceId=${deviceId}; expires=${expires}; path=/; SameSite=Strict`;
    
    console.log('Создан deviceId на основе fingerprint:', deviceId);
  }
  
  return deviceId;
}

// Функция для обеспечения авторизации
export async function ensureAuth(onReady) {
  const deviceId = await getDeviceId();
  
  // Если имя не сохранено - используем временное
  let displayName = localStorage.getItem('displayName');
  
  if (!displayName) {
    displayName = 'User-' + deviceId.slice(-4);
    // Автоматически сохраняем временное имя
    localStorage.setItem('displayName', displayName);
  }
  
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
  const deviceId = await getDeviceId();
  
  try {
    await setDoc(doc(db, 'users', deviceId), {
      online: false,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error('Ошибка обновления Firestore при выходе:', e);
  }
  
  // НЕ очищаем deviceId - только displayName если нужен полный выход
  localStorage.removeItem('displayName');
}

// Функция для обновления статуса онлайн
export async function updateOnlineStatus(isOnline) {
  const deviceId = await getDeviceId();
  
  try {
    await setDoc(doc(db, 'users', deviceId), {
      online: isOnline,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error('Ошибка обновления статуса:', e);
  }
}