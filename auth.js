// auth.js
import { auth, db } from './firebase-config.js';
import { signInAnonymously, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Функция для обеспечения авторизации
export function ensureAuth(onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Сохраняем UID в localStorage при первом входе
      if (!localStorage.getItem('savedUID')) {
        localStorage.setItem('savedUID', user.uid);
      }
      
      const displayName = localStorage.getItem('displayName') || ('User-' + user.uid.slice(-4));
      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: displayName,
          lastSeen: serverTimestamp(),
          online: true
        }, { merge: true });
      } catch (e) {
        console.error('Ошибка обновления Firestore:', e);
      }
      onReady(user);
    } else {
      // Проверяем, есть ли сохраненный пользователь
      const savedUID = localStorage.getItem('savedUID');
      const savedDisplayName = localStorage.getItem('displayName');
      
      // Если есть сохраненные данные, НЕ создаем нового пользователя
      // Просто ждем, пока Firebase Auth восстановит сессию
      if (savedUID && savedDisplayName) {
        console.log('Ожидание восстановления сессии для:', savedDisplayName);
        // Firebase Auth автоматически восстановит сессию при следующем onAuthStateChanged
      } else {
        // Только если это ПЕРВЫЙ заход - создаем анонимного пользователя
        signInAnonymously(auth).catch(console.error);
      }
    }
  });
}

// Функция для выхода пользователя
export async function signOutUser() {
  const user = auth.currentUser;
  if (user) {
    try {
      await setDoc(doc(db, 'users', user.uid), {
        online: false,
        lastSeen: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('Ошибка обновления Firestore при выходе:', e);
    }
  }
  
  // Очищаем сохраненные данные при выходе
  localStorage.removeItem('savedUID');
  localStorage.removeItem('displayName');
  
  await signOut(auth).catch(console.error);
}