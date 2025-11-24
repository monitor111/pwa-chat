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
        
        this.unsubscribe = null;
        this.hiddenMessages = new Set(this.loadHiddenMessages());
        this.isFirstLoad = true; // Флаг для первой загрузки
        
        // Создаём звук уведомления
        this.notificationSound = this.createNotificationSound();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
        this.setupPWA();
    }

    // Создание звука уведомления
    createNotificationSound() {
        // Создаём AudioContext для генерации звука
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        return () => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Настройки звука (приятный "дзинь")
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        };
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
        if (this.unsubscribe) {
            this.unsubscribe();
        }
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
                        this.displayMessage({
                            id: messageId,
                            ...messageData
                        });
                        
                        // Воспроизводим звук ТОЛЬКО для чужих сообщений и НЕ при первой загрузке
                        if (!this.isFirstLoad && messageData.userId !== user.id) {
                            this.playNotificationSound();
                        }
                    }
                }
            });
            
            // После первой загрузки отключаем флаг
            if (this.isFirstLoad) {
                this.isFirstLoad = false;
            }
            
            this.scrollToBottom();
        }, (error) => {
            console.error('Ошибка получения сообщений:', error);
        });
    }

    // Воспроизведение звука с вибрацией
    playNotificationSound() {
        try {
            // Звук
            this.notificationSound();
            
            // Вибрация на Android (короткая)
            if ('vibrate' in navigator) {
                navigator.vibrate(200); // 200ms вибрация
            }
            
            // Можно также показать системное уведомление (если разрешено)
            this.showNotification();
        } catch (error) {
            console.error('Ошибка воспроизведения звука:', error);
        }
    }

    // Показ системного уведомления
    async showNotification() {
        if ('Notification' in window && Notification.permission === 'granted') {
            // Уведомление уже разрешено - показываем
            // (будет работать только если приложение в фоне)
        } else if ('Notification' in window && Notification.permission === 'default') {
            // Запрашиваем разрешение один раз
            await Notification.requestPermission();
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
            timeDiv.textContent = date.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            messageDiv.appendChild(timeDiv);
        }
        
        this.messagesContainer.appendChild(messageDiv);
    }

    clearLocalChat() {
        if (!confirm('Очистить историю чата на этом устройстве? (Другие пользователи по-прежнему увидят все сообщения)')) {
            return;
        }

        const messages = this.messagesContainer.querySelectorAll('.message');
        messages.forEach(msg => {
            const messageId = msg.dataset.messageId;
            if (messageId) {
                this.hiddenMessages.add(messageId);
            }
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