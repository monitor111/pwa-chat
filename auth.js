// auth.js
import { auth, db } from './firebase-config.js';
import { signInAnonymously, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

// Функция для обеспечения авторизации
export function ensureAuth(onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
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
      signInAnonymously(auth).catch(console.error);
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
  await signOut(auth).catch(console.error);
}
