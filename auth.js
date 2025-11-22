import { db } from './firebase-config.js';

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

    login(username) {
        if (!username || username.trim() === '') {
            throw new Error('Необходимо ввести имя');
        }

        this.currentUser = {
            id: this.generateUserId(),
            name: username.trim(),
            loginTime: Date.now()
        };

        localStorage.setItem(AUTH_KEY, JSON.stringify(this.currentUser));
        return this.currentUser;
    }

    logout() {
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
}

const authManager = new AuthManager();
export { authManager };