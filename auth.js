// auth.js
import { auth, db } from './firebase-config.js';
import { signInAnonymously, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

const AUTH_KEY = 'pwa_chat_user';

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.loadUser();
        this.ensureFirebaseAuth();
    }

    // Загружаем пользователя из localStorage
    loadUser() {
        const userData = localStorage.getItem(AUTH_KEY);
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }
    }

    // Проверяем Firebase Auth
    ensureFirebaseAuth() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Если локальный пользователь не установлен, создаём
                if (!this.currentUser) {
                    const displayName = 'User-' + user.uid.slice(-4);
                    this.currentUser = {
                        id: user.uid,
                        name: displayName,
                        loginTime: Date.now()
                    };
                    localStorage.setItem(AUTH_KEY, JSON.stringify(this.currentUser));
                }

                // Обновляем документ пользователя в Firestore
                try {
                    await setDoc(doc(db, 'users', user.uid), {
                        uid: user.uid,
                        name: this.currentUser.name,
                        lastSeen: serverTimestamp(),
                        online: true
                    }, { merge: true });
                } catch (e) {
                    console.error('Ошибка обновления Firestore:', e);
                }
            } else {
                // Входим анонимно, если нет пользователя
                signInAnonymously(auth).catch(console.error);
            }
        });
    }

    login(username) {
        if (!username || username.trim() === '') {
            throw new Error('Необходимо ввести имя');
        }

        const user = auth.currentUser;
        if (user) {
            this.currentUser = {
                id: user.uid,
                name: username.trim(),
                loginTime: Date.now()
            };
            localStorage.setItem(AUTH_KEY, JSON.stringify(this.currentUser));

            // Обновляем Firestore
            setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                name: username.trim(),
                lastSeen: serverTimestamp(),
                online: true
            }, { merge: true }).catch(console.error);
        }

        return this.currentUser;
    }

    logout() {
        const user = auth.currentUser;
        if (user) {
            setDoc(doc(db, 'users', user.uid), { online: false, lastSeen: serverTimestamp() }, { merge: true })
                .catch(console.error);
        }
        this.currentUser = null;
        localStorage.removeItem(AUTH_KEY);
        signOut(auth).catch(console.error);
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }
}

const authManager = new AuthManager();
export { authManager };
