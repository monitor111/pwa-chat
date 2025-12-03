// app.js
import { db } from './firebase-config.js';
import { ensureAuth, signOutUser } from './auth.js';
import {
  collection, doc, setDoc, query, orderBy, onSnapshot,
  serverTimestamp, addDoc
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

const IMGBB_API_KEY = '4eff2f3d0fac8f9a8824d3bdeca9d634';

const loader = document.getElementById('loader');
const main = document.getElementById('main');
const meDisplay = document.getElementById('meDisplay');
const usersCol = document.getElementById('usersCol');
const chatCol = document.getElementById('chatCol');
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

// Загрузка изображения на imgbb
async function uploadToImgbb(file) {
  const formData = new FormData();
  formData.append('image', file);
  
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    throw new Error('Ошибка загрузки на imgbb');
  }
  
  const data = await response.json();
  return data.data.url; // Возвращаем URL загруженного изображения
}

// Функция для переключения между списком и чатом на мобильных
function showChat() {
  usersCol.classList.add('hidden');
  chatCol.classList.add('active');
}

function showUsersList() {
  usersCol.classList.remove('hidden');
  chatCol.classList.remove('active');
}

// Открыть изображение на весь экран
function openImageFullscreen(imageUrl) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.9);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
  `;
  
  const img = document.createElement('img');
  img.src = imageUrl;
  img.style.cssText = `
    max-width: 90%;
    max-height: 90%;
    object-fit: contain;
  `;
  
  overlay.appendChild(img);
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

// ------------------ Инициализация пользователя ------------------
(async () => {
  await new Promise(resolve => {
    ensureAuth(user => {
      me = user;
      resolve(user);
    });
  });

  loader.style.display = 'none';
  main.style.display = '';
  meDisplay.innerText = localStorage.getItem('displayName') || me.displayName || ('User-' + me.uid.slice(-4));
  nameInput.value = localStorage.getItem('displayName') || '';

  startUsersListener();
  requestNotifications();
})();

// ------------------ Слушатель пользователей ------------------
function startUsersListener() {
  const usersColRef = collection(db, 'users');
  if (usersUnsub) usersUnsub();
  usersUnsub = onSnapshot(usersColRef, (snap) => {
    usersList.innerHTML = '';
    snap.docs.forEach(d => {
      const u = d.data();
      if (!u.uid || u.uid === me.uid) return;
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `<div class="flex-grow-1">
        <span class="status ${u.online ? 'online' : 'offline'}"></span>
        <strong>${escapeHtml(u.name||'User')}</strong>
        <div class="text-muted small">${u.online ? 'онлайн' : ('был(а): ' + (u.lastSeen ? new Date(u.lastSeen.seconds*1000).toLocaleString() : '—'))}</div>
      </div>
      <button class="btn btn-sm btn-primary startChatBtn" data-uid="${u.uid}" data-name="${escapeHtml(u.name||'User')}">💬</button>`;
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

  try {
    await setDoc(doc(db, 'users', me.uid), { name: nm, lastSeen: serverTimestamp(), online: true }, { merge: true });
    alert('Имя сохранено');
  } catch(e) { console.error(e); alert('Ошибка'); }
});

// ------------------ Выход ------------------
signoutBtn.addEventListener('click', async () => {
  await signOutUser();
  alert('Вы вышли. Обновите страницу для нового входа.');
});

// ------------------ Открыть чат ------------------
async function openChat(peerUid, peerName) {
  currentPeer = { uid: peerUid, name: peerName };
  currentChatId = uidPair(me.uid, peerUid);
  chatWith.innerText = peerName;
  chatHeader.classList.remove('d-none');
  composer.classList.remove('d-none');
  messagesDiv.innerHTML = '';
  
  // Показать чат на мобильных
  showChat();

  const messagesCol = collection(db, 'chats', currentChatId, 'messages');
  const q = query(messagesCol, orderBy('timestamp', 'asc'));
  if (messagesUnsub) messagesUnsub();
  messagesUnsub = onSnapshot(q, (snap) => {
    snap.docChanges().forEach(change => {
      const d = change.doc;
      if (change.type === 'added') {
        appendMessageToUI(d.id, d.data());
        if (d.data().from !== me.uid) {
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
  
  // Показать список пользователей на мобильных
  showUsersList();
});

// ------------------ Отправка сообщения ------------------
sendBtn.addEventListener('click', async () => { await sendMessage(); });
messageInput.addEventListener('keydown', async (e) => { if (e.key==='Enter') await sendMessage(); });
attachBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', async () => {
  const file = imageInput.files[0];
  if (!file) return;
  
  // Проверка типа файла
  if (!file.type.startsWith('image/')) {
    alert('Можно отправлять только изображения');
    imageInput.value = '';
    return;
  }
  
  // Проверка размера (максимум 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('Изображение слишком большое (макс. 5MB)');
    imageInput.value = '';
    return;
  }
  
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
    try {
      // Показываем индикатор загрузки
      sendBtn.disabled = true;
      sendBtn.textContent = '⏳';
      attachBtn.disabled = true;
      
      // Загружаем на imgbb
      imageUrl = await uploadToImgbb(file);
      
    } catch (e) {
      console.error('Ошибка загрузки изображения:', e);
      alert('Ошибка загрузки изображения. Попробуйте еще раз.');
      sendBtn.disabled = false;
      sendBtn.textContent = '➤';
      attachBtn.disabled = false;
      return;
    }
  }
  
  try {
    await addDoc(messagesRef, {
      from: me.uid,
      to: currentPeer.uid,
      text: text || null,
      image: imageUrl,
      timestamp: serverTimestamp()
    });
    messageInput.value = '';
  } catch(e) {
    console.error('Ошибка отправки:', e);
    alert('Ошибка отправки сообщения');
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = '➤';
    attachBtn.disabled = false;
  }
}

// ------------------ UI: добавить сообщение ------------------
function appendMessageToUI(id, data) {
  if (document.querySelector(`[data-id="${id}"]`)) return;
  const div = document.createElement('div');
  div.className = 'msg ' + ((data.from === me.uid) ? 'me' : 'them');
  div.dataset.id = id;
  const time = data.timestamp ? new Date(data.timestamp.seconds*1000).toLocaleTimeString() : '';
  const who = (data.from === me.uid) ? 'Вы' : escapeHtml(currentPeer ? currentPeer.name : '');
  const textHtml = data.text ? `<div>${escapeHtml(data.text)}</div>` : '';
  
  let imageHtml = '';
  if (data.image) {
    imageHtml = `<div style="margin-top:5px;">
      <img src="${data.image}" 
           alt="img" 
           style="max-width:100%; max-height:300px; border-radius:8px; cursor:pointer; display:block;" 
           onclick="window.openImageFullscreen('${data.image}')">
    </div>`;
  }
  
  div.innerHTML = `<div class="small text-muted">${who} · ${time}</div>${textHtml}${imageHtml}`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Делаем функцию глобальной для onclick
window.openImageFullscreen = openImageFullscreen;

// ------------------ Проверка активного чата ------------------
function isChatActiveWith(peerUid) {
  return currentPeer && currentPeer.uid === peerUid;
}

// ------------------ Уведомление ------------------
function showInAppNotification(title, messageData) {
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) {
        const body = messageData.text ? messageData.text : (messageData.image ? '📷 Фото' : '');
        reg.showNotification(title, {
          body,
          tag: currentChatId + '_' + Date.now(),
          renotify: false,
          data: { chatId: currentChatId, from: messageData.from }
        });
      } else {
        try { new Notification(title, { body: messageData.text || '📷 Фото' }); } catch(e){}
      }
    });
  }
}

// ------------------ Service Worker ------------------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').then(()=> console.log('SW ok')).catch(console.error);
}
navigator.serviceWorker.addEventListener('message', ()=>{});