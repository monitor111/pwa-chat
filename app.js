// app.js
import { auth, db, storage } from './firebase-config.js';
import { authManager } from './auth.js';
import {
  collection, doc, setDoc, getDocs, query, orderBy, onSnapshot,
  where, serverTimestamp, addDoc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js';

const loader = document.getElementById('loader');
const main = document.getElementById('main');
const meDisplay = document.getElementById('meDisplay');
const usersList = document.getElementById('usersList');
const nameInput = document.getElementById('nameInput');
const saveNameBtn = document.getElementById('saveNameBtn');
const signoutBtn = document.getElementById('signoutBtn');

const messagesDiv = document.getElementById('messages');
const chatHeader = document.getElementById('chatHeader');
const chatWith = document.getElementById('chatWith');
const backBtn = document.getElementById('backBtn');
const composer = document.getElementById('composer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const clearLocalBtn = document.getElementById('clearLocalBtn');
const imageInput = document.getElementById('imageInput');
const attachBtn = document.getElementById('attachBtn');
const notifySound = document.getElementById('notifySound');

let me = null;
let usersUnsub = null;
let messagesUnsub = null;
let currentChatId = null;
let currentPeer = null;

// ------------------ Утилиты ------------------
function escapeHtml(str='') {
  return String(str).replaceAll('&','&amp;')
    .replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
}

function uidPair(a, b) {
  return [a,b].sort().join('_');
}

function playNotify() {
  try { notifySound.play().catch(()=>{}); } catch(e){}
  if (navigator.vibrate) navigator.vibrate([100,40,100]);
}

async function requestNotifications() {
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch(e) {}
  }
}

// ------------------ Инициализация пользователя ------------------
(async () => {
  me = authManager.getCurrentUser();
  if (!me) {
    // ждём пока Firebase создаст анонимного пользователя
    const waitForUser = () => new Promise(resolve => {
      const interval = setInterval(() => {
        const u = authManager.getCurrentUser();
        if (u) { clearInterval(interval); resolve(u); }
      }, 100);
    });
    me = await waitForUser();
  }

  loader.style.display = 'none';
  main.style.display = '';
  meDisplay.innerText = localStorage.getItem('displayName') || me.name || ('User-' + me.id.slice(-4));
  nameInput.value = localStorage.getItem('displayName') || '';

  startUsersListener();
  requestNotifications();
})();

// ------------------ Слушатель пользователей ------------------
function startUsersListener() {
  const usersCol = collection(db, 'users');
  if (usersUnsub) usersUnsub();
  usersUnsub = onSnapshot(usersCol, (snap) => {
    usersList.innerHTML = '';
    snap.docs.forEach(d => {
      const u = d.data();
      if (!u.uid || u.uid === (authManager.getCurrentUser() && authManager.getCurrentUser().id)) return;
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `<div>
        <span class="status ${u.online ? 'online' : 'offline'}"></span>
        <strong>${escapeHtml(u.name||'User')}</strong>
        <div class="text-muted small">${u.online ? 'online' : ('last: ' + (u.lastSeen ? new Date(u.lastSeen.seconds*1000).toLocaleString() : '—'))}</div>
      </div>
      <div><button class="btn btn-sm btn-primary startChatBtn" data-uid="${u.uid}" data-name="${escapeHtml(u.name||'User')}">Чат</button></div>`;
      usersList.appendChild(li);
    });

    document.querySelectorAll('.startChatBtn').forEach(btn=>{
      btn.addEventListener('click', () => {
        const uid = btn.dataset.uid;
        const name = btn.dataset.name;
        openChat(uid, name);
      });
    });
  });
}

// ------------------ Сохранение имени ------------------
saveNameBtn.addEventListener('click', async () => {
  const nm = (nameInput.value || '').trim();
  if (!nm) return alert('Введите имя');
  localStorage.setItem('displayName', nm);
  meDisplay.innerText = nm;

  const user = authManager.getCurrentUser();
  if (user) {
    try {
      await setDoc(doc(db, 'users', user.id), { name: nm, lastSeen: serverTimestamp(), online: true }, { merge: true });
      alert('Имя сохранено');
    } catch(e) { console.error(e); alert('Ошибка'); }
  }
});

// ------------------ Выход ------------------
signoutBtn.addEventListener('click', async () => {
  authManager.logout();
  localStorage.removeItem('displayName');
  location.reload();
});

// ------------------ Открыть чат ------------------
async function openChat(peerUid, peerName) {
  currentPeer = { uid: peerUid, name: peerName };
  currentChatId = uidPair(authManager.getCurrentUser().id, peerUid);
  chatWith.innerText = peerName;
  chatHeader.classList.remove('d-none');
  composer.classList.remove('d-none');
  messagesDiv.innerHTML = '';

  const messagesCol = collection(db, 'chats', currentChatId, 'messages');
  const q = query(messagesCol, orderBy('timestamp', 'asc'));
  if (messagesUnsub) messagesUnsub();
  messagesUnsub = onSnapshot(q, (snap) => {
    snap.docChanges().forEach(change => {
      const d = change.doc;
      if (change.type === 'added') {
        appendMessageToUI(d.id, d.data());
        if (d.data().from !== authManager.getCurrentUser().id) {
          if (!isChatActiveWith(peerUid)) {
            showInAppNotification(peerName, d.data());
            playNotify();
          }
        }
      }
    });
  });
}

// ------------------ Вернуться к списку ------------------
backBtn.addEventListener('click', () => {
  currentChatId = null;
  currentPeer = null;
  if (messagesUnsub) messagesUnsub();
  chatHeader.classList.add('d-none');
  composer.classList.add('d-none');
  messagesDiv.innerHTML = '';
});

// ------------------ Отправка сообщения ------------------
sendBtn.addEventListener('click', async () => { await sendMessage(); });
messageInput.addEventListener('keydown', async (e) => { if (e.key==='Enter') await sendMessage(); });
attachBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', async () => {
  const file = imageInput.files[0];
  if (!file) return;
  await sendMessage(file);
  imageInput.value = '';
});
clearLocalBtn.addEventListener('click', () => { messagesDiv.innerHTML = ''; });

async function sendMessage(file=null) {
  const text = (messageInput.value || '').trim();
  if (!currentChatId) return alert('Выберите пользователя для чата');
  if (!text && !file) return;
  const messagesRef = collection(db, 'chats', currentChatId, 'messages');
  let imageUrl = null;
  if (file) {
    const path = `chat_images/${currentChatId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    imageUrl = await getDownloadURL(storageRef);
  }
  try {
    await addDoc(messagesRef, {
      from: authManager.getCurrentUser().id,
      to: currentPeer.uid,
      text: text || null,
      image: imageUrl,
      timestamp: serverTimestamp()
    });
    messageInput.value = '';
  } catch(e) {
    console.error(e);
    alert('Ошибка отправки');
  }
}

// ------------------ UI: добавить сообщение ------------------
function appendMessageToUI(id, data) {
  if (document.querySelector(`[data-id="${id}"]`)) return;
  const div = document.createElement('div');
  div.className = 'msg ' + ((data.from === authManager.getCurrentUser().id) ? 'me' : 'them');
  div.dataset.id = id;
  const time = data.timestamp ? new Date(data.timestamp.seconds*1000).toLocaleTimeString() : '';
  const who = (data.from === authManager.getCurrentUser().id) ? 'Вы' : escapeHtml(currentPeer ? currentPeer.name : '');
  const textHtml = data.text ? `<div>${escapeHtml(data.text)}</div>` : '';
  const imageHtml = data.image ? `<div><img src="${escapeHtml(data.image)}" alt="img"></div>` : '';
  div.innerHTML = `<div class="small text-muted">${who} · ${time}</div>${textHtml}${imageHtml}`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ------------------ Проверка активного чата ------------------
function isChatActiveWith(peerUid) {
  return currentPeer && currentPeer.uid === peerUid;
}

// ------------------ Уведомление ------------------
function showInAppNotification(title, messageData) {
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) {
        const body = messageData.text ? messageData.text : (messageData.image ? 'Фото' : '');
        reg.showNotification(title, {
          body,
          tag: currentChatId + '_' + Date.now(),
          renotify: false,
          data: { chatId: currentChatId, from: messageData.from }
        });
      } else {
        try { new Notification(title, { body: messageData.text || 'Фото' }); } catch(e){}
      }
    });
  }
}

// ------------------ Service Worker ------------------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').then(()=> console.log('SW ok')).catch(console.error);
}
navigator.serviceWorker.addEventListener('message', ()=>{});
