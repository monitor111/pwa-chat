import { db } from './firebase-config.js';
import { collection, addDoc, setDoc, doc, getDocs, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const AUTH_KEY = 'pwa_chat_user';

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.loadUser();
    }

    loadUser() {
        const userData = localStorage.getItem(AUTH_KEY);
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }
    }

    async login(username) {
        if (!username || username.trim() === '') {
            throw new Error('Необходимо ввести имя');
        }

        this.currentUser = {
            id: this.generateUserId(),
            name: username.trim(),
            loginTime: Date.now()
        };

        // Сохраняем локально
        localStorage.setItem(AUTH_KEY, JSON.stringify(this.currentUser));

        // Сохраняем в Firebase коллекцию users
        const userRef = doc(db, 'users', this.currentUser.id);
        await setDoc(userRef, {
            name: this.currentUser.name,
            loginTime: this.currentUser.loginTime,
            online: true
        });

        return this.currentUser;
    }

    async logout() {
        if (this.currentUser) {
            // Удаляем из Firebase (или можно ставить online=false)
            const userRef = doc(db, 'users', this.currentUser.id);
            await deleteDoc(userRef);
        }
        this.currentUser = null;
        localStorage.removeItem(AUTH_KEY);
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Получаем всех авторизованных пользователей, кроме себя
    async getAllUsers() {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const users = [];
        usersSnapshot.forEach(docSnap => {
            const user = docSnap.data();
            user.id = docSnap.id;
            if (!this.currentUser || user.id !== this.currentUser.id) {
                users.push(user);
            }
        });
        return users;
    }
}

const authManager = new AuthManager();
export { authManager };
