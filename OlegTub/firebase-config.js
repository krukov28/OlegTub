import { initializeApp } from "firebase/app";
import { 
    getFirestore, 
    collection, addDoc, getDocs, getDoc,
    query, orderBy, where, doc,
    updateDoc, arrayUnion, arrayRemove, deleteDoc, onSnapshot
} from "firebase/firestore";

// ========== FIREBASE КОНФИГ ==========
const firebaseConfig = {
    apiKey: "AIzaSyDuJfaJAvigdDsCkeLoHpM3QG30YANa5tU",
    authDomain: "olegtub-69d16.firebaseapp.com",
    projectId: "olegtub-69d16",
    storageBucket: "olegtub-69d16.firebasestorage.app",
    messagingSenderId: "899139233363",
    appId: "1:899139233363:web:d18229151ec65c5cd4c8a6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ========== ПЕРЕМЕННЫЕ ==========
let currentUser = null;
let currentPanel = 'home';
let allPosts = [];
let unsubscribe = null;
let currentFile = null;
let currentFileType = null;

// ========== РЕГИСТРАЦИЯ / ВХОД ==========
async function registerUser(username, name, password) {
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) throw new Error("Логин уже занят");
    
    await setDoc(userRef, {
        username: username,
        name: name,
        password: password,
        createdAt: new Date().toISOString()
    });
    return { username, name };
}

async function loginUser(username, password) {
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("Пользователь не найден");
    if (userSnap.data().password !== password) throw new Error("Неверный пароль");
    return { username, name: userSnap.data().name };
}

// ========== ЗАГРУЗКА НА FREEIMAGE.HOST ==========
async function uploadToFreeImage(file) {
    const formData = new FormData();
    formData.append('source', file);
    formData.append('type', 'file');
    formData.append('key', '6d207e02198a847aa98d0a2a901485a5');
    
    const response = await fetch('https://freeimage.host/api/1/upload', {
        method: 'POST',
        body: formData
    });
    const data = await response.json();
    if (data.status_code === 200) return data.image.url;
    throw new Error('Ошибка загрузки');
}

// ========== ПОСТЫ ==========
async function getAllPosts() {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp?.toDate() || new Date() }));
}

async function addPost(text, mediaUrl, mediaType) {
    if (!text?.trim() && !mediaUrl) throw new Error("Добавьте текст или медиа");
    await addDoc(collection(db, "posts"), {
        author: currentUser.name,
        authorUsername: currentUser.username,
        text: text?.trim() || "",
        timestamp: new Date(),
        userId: currentUser.username,
        likes: [],
        likesCount: 0,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null
    });
}

async function deletePost(postId) {
    const postRef = doc(db, "posts", postId);
    const snap = await getDoc(postRef);
    if (snap.data().userId !== currentUser.username) throw new Error("Не ваше");
    await deleteDoc(postRef);
}

async function toggleLike(postId) {
    const ref = doc(db, "posts", postId);
    const snap = await getDoc(ref);
    const has = snap.data().likes?.includes(currentUser.username);
    if (has) {
        await updateDoc(ref, { likes: arrayRemove(currentUser.username), likesCount: snap.data().likesCount - 1 });
    } else {
        await updateDoc(ref, { likes: arrayUnion(currentUser.username), likesCount: (snap.data().likesCount || 0) + 1 });
    }
}

async function getUserPosts() {
    const q = query(collection(db, "posts"), where("userId", "==", currentUser.username), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp?.toDate() || new Date() }));
}

// ========== UI ФУНКЦИИ ==========
function formatDate(date) {
    if (!date) return "только что";
    const diff = Math.floor((new Date() - date) / 60000);
    if (diff < 1) return "только что";
    if (diff < 60) return `${diff} мин назад`;
    if (diff < 1440) return `${Math.floor(diff / 60)} ч назад`;
    return `${Math.floor(diff / 1440)} дн назад`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

function renderMedia(url, type) {
    if (!url) return '';
    if (type === 'image') return `<div class="post-media"><img src="${url}" loading="lazy" onclick="window.open('${url}','_blank')"></div>`;
    if (type === 'video') return `<div class="post-media"><video src="${url}" controls preload="metadata"></video></div>`;
    return '';
}

function renderFeed() {
    const container = document.getElementById('postsContainer');
    if (!allPosts.length) {
        container.innerHTML = '<div class="empty-feed">📭 Нет постов. Создайте первый!</div>';
        return;
    }
    container.innerHTML = allPosts.map(post => `
        <div class="post-card">
            <div class="post-author">
                <div class="avatar">${escapeHtml((post.author || 'A')[0].toUpperCase())}</div>
                <div>
                    <div class="author-name">${escapeHtml(post.author)}</div>
                    <div class="post-date">${formatDate(post.timestamp)}</div>
                </div>
                ${post.userId === currentUser.username ? `<button class="delete-post-btn" data-id="${post.id}"><i class="fas fa-trash"></i></button>` : ''}
            </div>
            <div class="post-text">${escapeHtml(post.text)}</div>
            ${renderMedia(post.mediaUrl, post.mediaType)}
            <div class="post-actions">
                <span class="like-btn" data-id="${post.id}">
                    <i class="${post.likes?.includes(currentUser.username) ? 'fas fa-heart' : 'far fa-heart'}" style="${post.likes?.includes(currentUser.username) ? 'color:#e74c3c' : ''}"></i>
                    <span>${post.likesCount || 0}</span>
                </span>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.like-btn').forEach(btn => btn.onclick = () => toggleLike(btn.dataset.id));
    document.querySelectorAll('.delete-post-btn').forEach(btn => btn.onclick = async () => { if(confirm('Удалить?')) { await deletePost(btn.dataset.id); } });
}

async function updateProfile() {
    document.getElementById('profileName').innerText = currentUser.name;
    document.getElementById('profileAvatar').innerText = currentUser.name[0].toUpperCase();
    document.getElementById('userPostCount').innerText = (await getUserPosts()).length;
    
    const userPosts = await getUserPosts();
    const container = document.getElementById('userPostsContainer');
    if (!userPosts.length) { container.innerHTML = '<div class="empty-feed">У вас пока нет постов</div>'; return; }
    container.innerHTML = userPosts.map(post => `
        <div class="post-card">
            <div class="post-author">
                <div class="avatar">${escapeHtml((post.author || 'A')[0].toUpperCase())}</div>
                <div>
                    <div class="author-name">${escapeHtml(post.author)}</div>
                    <div class="post-date">${formatDate(post.timestamp)}</div>
                </div>
                <button class="delete-post-btn" data-id="${post.id}"><i class="fas fa-trash"></i></button>
            </div>
            <div class="post-text">${escapeHtml(post.text)}</div>
            ${renderMedia(post.mediaUrl, post.mediaType)}
        </div>
    `).join('');
    document.querySelectorAll('#userPostsContainer .delete-post-btn').forEach(btn => btn.onclick = async () => { if(confirm('Удалить?')) { await deletePost(btn.dataset.id); await updateProfile(); } });
}

async function searchPosts(query) {
    const container = document.getElementById('searchResultsContainer');
    if (!query.trim()) { container.innerHTML = '<div class="empty-feed">Введите текст поиска</div>'; return; }
    const results = allPosts.filter(p => p.author.toLowerCase().includes(query.toLowerCase()) || p.text.toLowerCase().includes(query.toLowerCase()));
    if (!results.length) { container.innerHTML = '<div class="empty-feed">Ничего не найдено</div>'; return; }
    container.innerHTML = results.map(p => `<div class="search-result-item"><strong>${escapeHtml(p.author)}</strong><br>${escapeHtml(p.text.substring(0, 100))}</div>`).join('');
}

// ========== МОДАЛКА ==========
const modal = document.getElementById('createModal');
const postText = document.getElementById('postText');
const fileInput = document.getElementById('fileInput');
const photoBtn = document.getElementById('photoBtn');
const videoBtn = document.getElementById('videoBtn');
const removeMediaBtn = document.getElementById('removeMediaBtn');
const mediaPreview = document.getElementById('mediaPreview');

photoBtn.onclick = () => { fileInput.accept = 'image/*'; fileInput.click(); };
videoBtn.onclick = () => { fileInput.accept = 'video/*'; fileInput.click(); };

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    currentFile = file;
    currentFileType = file.type.startsWith('image/') ? 'image' : 'video';
    const url = URL.createObjectURL(file);
    mediaPreview.innerHTML = currentFileType === 'image' ? `<img src="${url}">` : `<video src="${url}" controls></video>`;
    mediaPreview.style.display = 'block';
    removeMediaBtn.style.display = 'inline-block';
};

removeMediaBtn.onclick = () => {
    currentFile = null;
    currentFileType = null;
    mediaPreview.innerHTML = '';
    mediaPreview.style.display = 'none';
    removeMediaBtn.style.display = 'none';
    fileInput.value = '';
};

async function submitPost() {
    const text = postText.value;
    if (!text?.trim() && !currentFile) { alert("Напишите текст или добавьте фото/видео"); return; }
    
    let mediaUrl = null;
    if (currentFile) {
        document.getElementById('confirmPostBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
        try {
            mediaUrl = await uploadToFreeImage(currentFile);
        } catch(e) { alert("Ошибка: " + e.message); document.getElementById('confirmPostBtn').innerHTML = 'Опубликовать'; return; }
    }
    await addPost(text, mediaUrl, currentFileType);
    closeModal();
    document.getElementById('confirmPostBtn').innerHTML = 'Опубликовать';
    postText.value = '';
    removeMediaBtn.click();
}

function openModal() { modal.classList.add('active'); postText.value = ''; removeMediaBtn.click(); }
function closeModal() { modal.classList.remove('active'); }

// ========== НАВИГАЦИЯ ==========
function setPanel(panel) {
    document.getElementById('feedPanel').classList.add('hide');
    document.getElementById('searchPanel').classList.add('hide');
    document.getElementById('profilePanel').classList.add('hide');
    if (panel === 'home') { document.getElementById('feedPanel').classList.remove('hide'); renderFeed(); }
    if (panel === 'search') { document.getElementById('searchPanel').classList.remove('hide'); const inp = document.getElementById('searchInput'); inp.oninput = (e) => searchPosts(e.target.value); }
    if (panel === 'profile') { document.getElementById('profilePanel').classList.remove('hide'); updateProfile(); }
    currentPanel = panel;
    [navHome, navSearch, navProfile].forEach(b => b.classList.remove('active'));
    if (panel === 'home') navHome.classList.add('active');
    if (panel === 'search') navSearch.classList.add('active');
    if (panel === 'profile') navProfile.classList.add('active');
}

// ========== АВТОРИЗАЦИЯ ==========
function showAuthScreen() {
    document.getElementById('authScreen').style.display = 'block';
    document.getElementById('appScreen').style.display = 'none';
    if (unsubscribe) unsubscribe();
}

function showAppScreen(user) {
    currentUser = user;
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'flex';
    
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    unsubscribe = onSnapshot(q, (snap) => {
        allPosts = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp?.toDate() || new Date() }));
        if (currentPanel === 'home') renderFeed();
        if (currentPanel === 'profile') updateProfile();
    });
    setPanel('home');
}

// Обработчики авторизации
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authError = document.getElementById('authError');
const authSuccess = document.getElementById('authSuccess');

function clearMessages() { authError.innerText = ''; authSuccess.innerText = ''; }

document.getElementById('showRegisterBtn').onclick = () => { loginForm.style.display = 'none'; registerForm.style.display = 'block'; clearMessages(); };
document.getElementById('backToLoginBtn').onclick = () => { loginForm.style.display = 'block'; registerForm.style.display = 'none'; clearMessages(); };

document.getElementById('loginBtn').onclick = async () => {
    const username = document.getElementById('loginName').value.trim();
    const password = document.getElementById('loginPassword').value;
    clearMessages();
    if (!username || !password) { authError.innerText = "Заполните все поля"; return; }
    try {
        const user = await loginUser(username, password);
        authSuccess.innerText = "Вход выполнен!";
        setTimeout(() => showAppScreen(user), 1000);
    } catch (err) { authError.innerText = err.message; }
};

document.getElementById('registerBtn').onclick = async () => {
    const name = document.getElementById('regName').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    clearMessages();
    if (!name || !username || !password) { authError.innerText = "Заполните все поля"; return; }
    if (password.length < 4) { authError.innerText = "Пароль должен быть не менее 4 символов"; return; }
    try {
        const user = await registerUser(username, name, password);
        authSuccess.innerText = "Аккаунт создан! Выполняется вход...";
        setTimeout(() => showAppScreen(user), 1000);
    } catch (err) { authError.innerText = err.message; }
};

document.getElementById('logoutBtn').onclick = () => showAuthScreen();

// Инициализация кнопок
const navHome = document.getElementById('navHome');
const navSearch = document.getElementById('navSearch');
const navProfile = document.getElementById('navProfile');
navHome.onclick = () => setPanel('home');
navSearch.onclick = () => setPanel('search');
navProfile.onclick = () => setPanel('profile');
document.getElementById('navCreatePost').onclick = openModal;
document.getElementById('confirmPostBtn').onclick = submitPost;
document.getElementById('cancelModalBtn').onclick = closeModal;
modal.onclick = (e) => { if (e.target === modal) closeModal(); };

showAuthScreen();
console.log("✅ OlegTube с регистрацией и медиа запущен!");
