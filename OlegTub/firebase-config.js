// ========== FIREBASE КОНФИГУРАЦИЯ ==========
const firebaseConfig = {
    apiKey: "AIzaSyDuJfaJAvigdDsCkeLoHpM3QG30YANa5tU",
    authDomain: "olegtub-69d16.firebaseapp.com",
    projectId: "olegtub-69d16",
    storageBucket: "olegtub-69d16.firebasestorage.app",
    messagingSenderId: "899139233363",
    appId: "1:899139233363:web:d18229151ec65c5cd4c8a6",
    measurementId: "G-3KX71M6D23"
};

// ========== ИНИЦИАЛИЗАЦИЯ FIREBASE ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    getDoc,
    query, 
    orderBy, 
    doc, 
    updateDoc, 
    arrayUnion, 
    arrayRemove,
    deleteDoc,
    where,
    limit,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Инициализация
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("✅ Firebase успешно подключен!");

// ========== РАБОТА С ПОЛЬЗОВАТЕЛЯМИ ==========

// Получить или создать ID пользователя
function getUserId() {
    let userId = localStorage.getItem('olegtube_user_id');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('olegtube_user_id', userId);
    }
    return userId;
}

// Получить или создать имя пользователя
function getUserName() {
    let userName = localStorage.getItem('olegtube_user_name');
    if (!userName) {
        userName = prompt("Введите ваше имя:", "Пользователь OlegTube");
        if (!userName || userName.trim() === "") userName = "Аноним";
        localStorage.setItem('olegtube_user_name', userName);
    }
    return userName;
}

// Обновить имя пользователя
function setUserName(newName) {
    if (newName && newName.trim()) {
        localStorage.setItem('olegtube_user_name', newName.trim());
        return true;
    }
    return false;
}

// ========== РАБОТА С ПОСТАМИ ==========

// Получить все посты (сортировка по дате: новые сверху)
async function getAllPosts() {
    try {
        const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const posts = [];
        querySnapshot.forEach((doc) => {
            posts.push({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            });
        });
        return posts;
    } catch (error) {
        console.error("Ошибка загрузки постов:", error);
        return [];
    }
}

// Добавить новый пост
async function addPost(text) {
    if (!text || !text.trim()) {
        throw new Error("Текст поста не может быть пустым");
    }
    
    try {
        const newPost = {
            author: getUserName(),
            text: text.trim(),
            timestamp: new Date(),
            userId: getUserId(),
            likes: [],
            likesCount: 0,
            createdAt: new Date().toISOString()
        };
        
        const docRef = await addDoc(collection(db, "posts"), newPost);
        console.log("✅ Пост добавлен, ID:", docRef.id);
        return { success: true, id: docRef.id, post: newPost };
    } catch (error) {
        console.error("❌ Ошибка добавления поста:", error);
        throw error;
    }
}

// Удалить пост (только свой)
async function deletePost(postId) {
    try {
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);
        
        if (!postSnap.exists()) {
            throw new Error("Пост не найден");
        }
        
        const postData = postSnap.data();
        if (postData.userId !== getUserId()) {
            throw new Error("Вы можете удалять только свои посты");
        }
        
        await deleteDoc(postRef);
        console.log("🗑️ Пост удален:", postId);
        return { success: true };
    } catch (error) {
        console.error("Ошибка удаления:", error);
        throw error;
    }
}

// ========== ЛАЙКИ ==========

// Поставить/убрать лайк
async function toggleLike(postId) {
    const userId = getUserId();
    try {
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);
        
        if (!postSnap.exists()) {
            throw new Error("Пост не найден");
        }
        
        const postData = postSnap.data();
        const likes = postData.likes || [];
        const hasLiked = likes.includes(userId);
        
        if (hasLiked) {
            // Убираем лайк
            await updateDoc(postRef, {
                likes: arrayRemove(userId),
                likesCount: (postData.likesCount || 0) - 1
            });
            console.log("👎 Лайк убран");
            return { action: "unliked", likesCount: (postData.likesCount || 0) - 1 };
        } else {
            // Добавляем лайк
            await updateDoc(postRef, {
                likes: arrayUnion(userId),
                likesCount: (postData.likesCount || 0) + 1
            });
            console.log("👍 Лайк поставлен");
            return { action: "liked", likesCount: (postData.likesCount || 0) + 1 };
        }
    } catch (error) {
        console.error("Ошибка при лайке:", error);
        throw error;
    }
}

// Проверить, лайкнул ли пользователь пост
async function hasUserLiked(postId) {
    const userId = getUserId();
    try {
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);
        
        if (!postSnap.exists()) return false;
        
        const postData = postSnap.data();
        const likes = postData.likes || [];
        return likes.includes(userId);
    } catch (error) {
        console.error("Ошибка проверки лайка:", error);
        return false;
    }
}

// Получить количество лайков поста
async function getLikesCount(postId) {
    try {
        const postRef = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);
        
        if (!postSnap.exists()) return 0;
        
        return postSnap.data().likesCount || 0;
    } catch (error) {
        console.error("Ошибка получения лайков:", error);
        return 0;
    }
}

// ========== ПОИСК ==========

// Поиск постов по автору или тексту
async function searchPosts(searchText) {
    if (!searchText || !searchText.trim()) {
        return await getAllPosts();
    }
    
    try {
        const allPosts = await getAllPosts();
        const lowerSearch = searchText.toLowerCase();
        const filtered = allPosts.filter(post => 
            post.author.toLowerCase().includes(lowerSearch) || 
            post.text.toLowerCase().includes(lowerSearch)
        );
        return filtered;
    } catch (error) {
        console.error("Ошибка поиска:", error);
        return [];
    }
}

// ========== СТАТИСТИКА ==========

// Получить количество постов пользователя
async function getUserPostCount() {
    const userId = getUserId();
    try {
        const q = query(collection(db, "posts"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.size;
    } catch (error) {
        console.error("Ошибка подсчета постов:", error);
        return 0;
    }
}

// Получить общее количество постов
async function getTotalPostsCount() {
    try {
        const querySnapshot = await getDocs(collection(db, "posts"));
        return querySnapshot.size;
    } catch (error) {
        console.error("Ошибка подсчета:", error);
        return 0;
    }
}

// Получить топ постов (по лайкам)
async function getTopPosts(limitCount = 10) {
    try {
        const q = query(collection(db, "posts"), orderBy("likesCount", "desc"), limit(limitCount));
        const querySnapshot = await getDocs(q);
        const topPosts = [];
        querySnapshot.forEach((doc) => {
            topPosts.push({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            });
        });
        return topPosts;
    } catch (error) {
        console.error("Ошибка получения топ постов:", error);
        return [];
    }
}

// ========== ПОДПИСКА НА ОБНОВЛЕНИЯ В РЕАЛЬНОМ ВРЕМЕНИ ==========

// Подписка на изменения в коллекции posts
function subscribeToPosts(callback) {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    
    // Импортируем onSnapshot
    
    return onSnapshot(q, (querySnapshot) => {
        const posts = [];
        querySnapshot.forEach((doc) => {
            posts.push({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            });
        });
        callback(posts);
    }, (error) => {
        console.error("Ошибка подписки:", error);
    });
}

// ========== ЭКСПОРТ ФУНКЦИЙ ==========

// Если используете в браузере как модуль
export {
    // Пользователи
    getUserId,
    getUserName,
    setUserName,
    
    // Посты
    getAllPosts,
    addPost,
    deletePost,
    
    // Лайки
    toggleLike,
    hasUserLiked,
    getLikesCount,
    
    // Поиск
    searchPosts,
    
    // Статистика
    getUserPostCount,
    getTotalPostsCount,
    getTopPosts,
    
    // Реалтайм
    subscribeToPosts,
    
    // База данных
    db
};

// Если используете в обычном script (без type="module")
if (typeof window !== 'undefined') {
    window.OlegTubeFirebase = {
        getUserId,
        getUserName,
        setUserName,
        getAllPosts,
        addPost,
        deletePost,
        toggleLike,
        hasUserLiked,
        getLikesCount,
        searchPosts,
        getUserPostCount,
        getTotalPostsCount,
        getTopPosts,
        subscribeToPosts
    };
    console.log("📦 OlegTube Firebase API готов к использованию!");
}