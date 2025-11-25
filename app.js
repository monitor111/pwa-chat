import { db } from './firebase-config.js';
import { authManager } from './auth.js';
import { 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';

const HIDDEN_MESSAGES_KEY = 'pwa_chat_hidden_messages';

class ChatApp {
    constructor() {
        this.messagesContainer = document.getElementById('messages-container');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.clearChatBtn = document.getElementById('clear-chat-btn');
        this.authContainer = document.getElementById('auth-container');
        this.chatContainer = document.getElementById('chat-container');
        this.usernameInput = document.getElementById('username-input');
        this.loginBtn = document.getElementById('login-btn');
        this.logoutBtn = document.getElementById('logout-btn');
        this.userNameDisplay = document.getElementById('user-name');
        this.notificationBanner = document.getElementById('notification-banner');
        this.enableNotificationsBtn = document.getElementById('enable-notifications-btn');
        
        this.unsubscribe = null;
        this.hiddenMessages = new Set(this.loadHiddenMessages());
        this.isFirstLoad = true;
        this.audioContext = null;

        this.messaging = getMessaging();
        this.fcmToken = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.checkAuth();
        this.setupPWA();
        await this.setupFCM();
    }

    // FCM: запрос токена и обработка сообщений на переднем плане
    async setupFCM() {
        try {
            const token = await getToken(this.messaging, { vapidKey: 'BPqRYsN3C1UsOhkysflGXTzQR6ZviYRjBKpuNDw4k1wgckjFeEE4uVQiDJsnlmLyDFrOUAaXIBsnAGBCvf8ffEA' });
            if (token) {
                console.log('FCM токен получен:', token);
                this.fcmToken = token;
            } else {
                console.warn('FCM токен не получен. Разрешите уведомления.');
            }

            onMessage(this.messaging, (payload) => {
                console.log('Сообщение на переднем плане:', payload);
                this.playNotificationSound({ userName: payload.notification.title, text: payload.notification.body });
            });
        } catch (error) {
            console.error('Ошибка FCM:', error);
        }
    }

    checkNotificationPermission() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                this.notificationBanner.classList.remove('d-none');
            } else if (Notification.permission === 'denied') {
                this.notificationBanner.classList.remove('d-none');
                this.notificationBanner.querySelector('.alert').innerHTML = `
                    <strong>⚠️ Уведомления заблокированы!</strong><br>
                    Разрешите уведомления в настройках браузера/телефона для получения звука когда приложение закрыто.
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                `;
            }
        }
    }

    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    console.log('Уведомления разрешены!');
                    this.notificationBanner.classList.add('d-none');
                    new Notification('Уведомления включены! 🎉', {
                        body: 'Теперь вы будете получать звук даже когда приложение закрыто',
                        icon: 'icons/icon-192x192.png'
                    });
                    // После разрешения - получаем токен FCM
                    await this.setupFCM();
                } else {
                    alert('Уведомления не разрешены. Включите их в настройках браузера.');
                }
            } catch (error) {
                console.error('Ошибка запроса уведомлений:', error);
            }
        }
    }

    playBeep() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.2);
    }

    setupEventListeners() {
        this.loginBtn.addEventListener('click', () => this.handleLogin());
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });

        this.logoutBtn.addEventListener('click', () => this.handleLogout());
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        this.clearChatBtn.addEventListener('click', () => this.clearLocalChat());
        this.enableNotificationsBtn.addEventListener('click', () => this.requestNotificationPermission());
    }

    checkAuth() {
        if (authManager.isLoggedIn()) {
            this.showChat();
        } else {
            this.showAuth();
        }
    }

    handleLogin() {
        const username = this.usernameInput.value.trim();
        if (!username) {
            alert('Пожалуйста, введите ваше имя');
            return;
        }
        try {
            authManager.login(username);
            this.showChat();
        } catch (error) {
            alert(error.message);
        }
    }

    handleLogout() {
        if (this.unsubscribe) this.unsubscribe();
        authManager.logout();
        this.hiddenMessages.clear();
        localStorage.removeItem(HIDDEN_MESSAGES_KEY);
        this.isFirstLoad = true;
        this.showAuth();
    }

    showAuth() {
        this.authContainer.classList.remove('d-none');
        this.chatContainer.classList.add('d-none');
        this.usernameInput.value = '';
        this.usernameInput.focus();
    }

    showChat() {
        this.authContainer.classList.add('d-none');
        this.chatContainer.classList.remove('d-none');
        const user = authManager.getCurrentUser();
        this.userNameDisplay.textContent = user.name;
        this.checkNotificationPermission();
        this.listenToMessages();
        this.messageInput.focus();
    }

    async sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text) return;
        const user = authManager.getCurrentUser();
        try {
            await addDoc(collection(db, 'messages'), {
                text: text,
                userId: user.id,
                userName: user.name,
                timestamp: serverTimestamp()
            });
            this.messageInput.value = '';
            this.messageInput.focus();
        } catch (error) {
            console.error('Ошибка отправки:', error);
            alert('Не удалось отправить сообщение. Проверьте подключение.');
        }
    }

    listenToMessages() {
        const q = query(collection(db, 'messages'), orderBy('timestamp', 'asc'));
        this.unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const messageData = change.doc.data();
                    const messageId = change.doc.id;
                    const user = authManager.getCurrentUser();
                    if (!this.hiddenMessages.has(messageId)) {
                        this.displayMessage({ id: messageId, ...messageData });
                        if (!this.isFirstLoad && messageData.userId !== user.id) {
                            this.playNotificationSound(messageData);
                        }
                    }
                }
            });
            if (this.isFirstLoad) this.isFirstLoad = false;
            this.scrollToBottom();
        }, (error) => {
            console.error('Ошибка получения сообщений:', error);
        });
    }

    playNotificationSound(messageData) {
        try {
            this.playBeep();
            setTimeout(() => this.playBeep(), 300);
            setTimeout(() => this.playBeep(), 600);
            if ('vibrate' in navigator) navigator.vibrate([200, 150, 200, 150, 200]);
            this.showSystemNotification(messageData);
        } catch (error) {
            console.error('Ошибка воспроизведения звука:', error);
        }
    }

    showSystemNotification(messageData) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('💬 ' + messageData.userName, {
                body: messageData.text,
                icon: 'icons/icon-192x192.png',
                badge: 'icons/icon-192x192.png',
                tag: 'chat-message',
                requireInteraction: false,
                vibrate: [200, 150, 200, 150, 200],
                silent: false
            });
            notification.onclick = () => { window.focus(); notification.close(); };
            setTimeout(() => notification.close(), 7000);
        }
    }

    displayMessage(message) {
        const user = authManager.getCurrentUser();
        const isOwnMessage = message.userId === user.id;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwnMessage ? 'own' : 'other'}`;
        messageDiv.dataset.messageId = message.id;

        if (!isOwnMessage) {
            const senderDiv = document.createElement('div');
            senderDiv.className = 'message-sender';
            senderDiv.textContent = message.userName;
            messageDiv.appendChild(senderDiv);
        }

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = message.text;
        messageDiv.appendChild(textDiv);

        if (message.timestamp) {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            const date = message.timestamp.toDate();
            timeDiv.textContent = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            messageDiv.appendChild(timeDiv);
        }

        this.messagesContainer.appendChild(messageDiv);
    }

    clearLocalChat() {
        if (!confirm('Очистить историю чата на этом устройстве?')) return;
        const messages = this.messagesContainer.querySelectorAll('.message');
        messages.forEach(msg => {
            const messageId = msg.dataset.messageId;
            if (messageId) this.hiddenMessages.add(messageId);
            msg.remove();
        });
        this.saveHiddenMessages();
    }

    loadHiddenMessages() {
        const stored = localStorage.getItem(HIDDEN_MESSAGES_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    saveHiddenMessages() {
        localStorage.setItem(HIDDEN_MESSAGES_KEY, JSON.stringify([...this.hiddenMessages]));
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    setupPWA() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js')
                .then(() => console.log('Service Worker зарегистрирован'))
                .catch(err => console.error('Ошибка Service Worker:', err));
        }

        let deferredPrompt;
        const installPrompt = document.getElementById('install-prompt');
        const installBtn = document.getElementById('install-btn');

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installPrompt.classList.remove('d-none');
        });

        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                deferredPrompt = null;
                installPrompt.classList.add('d-none');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});

