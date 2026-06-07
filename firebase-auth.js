// ============================================================
// BƯỚC 1: Thay thông tin config Firebase của bạn vào đây
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, deleteDoc, collection, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ⚠️ THAY ĐOẠN NÀY BẰNG CONFIG CỦA BẠN TỪ FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyADCxjK3a5pmLAqPlYnLMlIty0n6js-YF0",
  authDomain: "listen-music-7dbca.firebaseapp.com",
  projectId: "listen-music-7dbca",
  storageBucket: "listen-music-7dbca.firebasestorage.app",
  messagingSenderId: "386999175582",
  appId: "1:386999175582:web:c1ad771f3355ea300cae8f",
  measurementId: "G-3FDMKG0YXW",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeInlineString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "\\x3C")
    .replace(/>/g, "\\x3E")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "\\'")
    .replace(/`/g, "'");
}

window.isUserLoggedIn = false;
window.favoriteSongs = [];
window.favoriteSongIds = new Set();

// ============================================================
// QUẢN LÝ TRẠNG THÁI ĐĂNG NHẬP
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Đã đăng nhập
    const userData = await getUserData(user.uid);
    updateUI(user, userData);
    await loadDownloadedSongIds();
    await loadFavoriteSongs();
    if (window.currentPage === "downloadPage") renderDownloadedSongs();
    if (window.currentPage === "favoritePage") safeRenderFavoriteList();
    closeAuthModal();
  } else {
    // Chưa đăng nhập
    updateUI(null, null);
    window.isUserLoggedIn = false;
    window.downloadedSongIds = new Set();
    window.favoriteSongs = [];
    window.favoriteSongIds = new Set();
    updateDownloadButtons();
    safeUpdateMiniFavoriteButton();
    safeRenderFavoriteList();
    if (window.currentPage === "downloadPage") renderDownloadedSongs();
  }
});

async function getUserData(uid) {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return docSnap.data();
    return null;
  } catch (e) {
    return null;
  }
}

function updateUI(user, userData) {
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  const userAvatar = document.getElementById("userAvatar");
  const userName = document.getElementById("userName");
  const vipBadge = document.getElementById("vipBadge");
  const accountAvatar = document.getElementById("accountAvatar");
  const accountName = document.getElementById("accountName");
  const accountDropdown = document.getElementById("accountDropdown");
  const sidebarAuthCard = document.querySelector(".sidebar-auth-card");

  if (user) {
    if (btnLogin) btnLogin.style.display = "none";
    if (btnLogout) btnLogout.style.display = "flex";
    if (sidebarAuthCard) sidebarAuthCard.style.display = "none";
    if (userAvatar) {
      userAvatar.style.display = "flex";
      userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=7c3aed&color=fff`;
    }
    if (userName) userName.textContent = user.displayName || user.email.split("@")[0];
    if (accountAvatar) accountAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=7c3aed&color=fff`;
    if (accountName) accountName.textContent = user.displayName || user.email.split("@")[0];
    if (vipBadge) vipBadge.style.display = userData?.isVip ? "flex" : "none";
  } else {
    if (btnLogin) btnLogin.style.display = "flex";
    if (btnLogout) btnLogout.style.display = "none";
    if (sidebarAuthCard) sidebarAuthCard.style.display = "block";
    if (userAvatar) userAvatar.style.display = "none";
    if (userName) userName.textContent = "";
    if (accountAvatar) accountAvatar.src = "";
    if (accountName) accountName.textContent = "";
    if (accountDropdown) accountDropdown.classList.remove("open");
    if (vipBadge) vipBadge.style.display = "none";
  }
}

// ============================================================
// ĐĂNG KÝ BẰNG EMAIL
// ============================================================
window.registerWithEmail = async function () {
  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const errEl = document.getElementById("registerError");

  if (!name || !email || !password) {
    errEl.textContent = "Vui lòng điền đầy đủ thông tin.";
    return;
  }
  if (password.length < 6) {
    errEl.textContent = "Mật khẩu phải có ít nhất 6 ký tự.";
    return;
  }

  try {
    errEl.textContent = "";
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    await setDoc(doc(db, "users", result.user.uid), {
      name,
      email,
      isVip: false,
      createdAt: new Date().toISOString(),
    });
    closeAuthModal();
    showToast(`Chào mừng ${name}! Đăng ký thành công.`);
  } catch (err) {
    errEl.textContent = getErrorMessage(err.code);
  }
};

// ============================================================
// ĐĂNG NHẬP BẰNG EMAIL
// ============================================================
window.loginWithEmail = async function () {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");

  if (!email || !password) {
    errEl.textContent = "Vui lòng điền đầy đủ thông tin.";
    return;
  }

  try {
    errEl.textContent = "";
    const result = await signInWithEmailAndPassword(auth, email, password);
    closeAuthModal();
    showToast(`Chào mừng trở lại!`);
  } catch (err) {
    errEl.textContent = getErrorMessage(err.code);
  }
};

// ============================================================
// ĐĂNG NHẬP BẰNG GOOGLE
// ============================================================
window.loginWithGoogle = async function () {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      await setDoc(docRef, {
        name: user.displayName,
        email: user.email,
        isVip: false,
        createdAt: new Date().toISOString(),
      });
    }
    closeAuthModal();
    showToast(`Chào mừng ${user.displayName}!`);
  } catch (err) {
    console.error(err);
  }
};

// ============================================================
// ĐĂNG XUẤT
// ============================================================
window.logout = async function () {
  await signOut(auth);
  showToast("Đã đăng xuất.");
};

// ============================================================
// YEU CAU NANG CAP VIP - client khong duoc tu cap quyen VIP.
// ============================================================
window.upgradeToVip = async function () {
  const user = auth.currentUser;
  if (!user) {
    openAuthModal("login");
    return;
  }
  try {
    await setDoc(doc(db, "users", user.uid, "vipRequests", "latest"), {
      status: "pending",
      requestedAt: serverTimestamp(),
    });
    closeVipModal();
    showToast("Yêu cầu nâng cấp VIP đã được gửi.");
  } catch (err) {
    console.error(err);
    showToast("Không gửi được yêu cầu VIP. Vui lòng thử lại.");
  }
};

// ============================================================
// ĐIỀU KHIỂN MODAL
// ============================================================
window.openAuthModal = function (tab = "login") {
  const authModal = document.getElementById("authModal");
  if (!authModal) {
    window.location.href = "index.html";
    return;
  }
  authModal.style.display = "flex";
  switchAuthTab(tab);
};

window.closeAuthModal = function () {
  const authModal = document.getElementById("authModal");
  const loginError = document.getElementById("loginError");
  const registerError = document.getElementById("registerError");

  if (authModal) authModal.style.display = "none";
  if (loginError) loginError.textContent = "";
  if (registerError) registerError.textContent = "";
};

window.switchAuthTab = function (tab) {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  if (loginForm) loginForm.style.display = tab === "login" ? "block" : "none";
  if (registerForm) registerForm.style.display = tab === "register" ? "block" : "none";
  document.querySelectorAll(".auth-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
};

window.openVipModal = function () {
  window.location.href = "vip.html";
};

window.closeVipModal = function () {
  const vipModal = document.getElementById("vipModal");
  if (vipModal) vipModal.style.display = "none";
};

window.toggleAccountMenu = function (event) {
  if (event) event.stopPropagation();
  const accountDropdown = document.getElementById("accountDropdown");
  if (accountDropdown) accountDropdown.classList.toggle("open");
};

window.closeAccountMenu = function () {
  const accountDropdown = document.getElementById("accountDropdown");
  if (accountDropdown) accountDropdown.classList.remove("open");
};

document.addEventListener("click", closeAccountMenu);

// ============================================================
// TOAST THÔNG BÁO
// ============================================================
function showToast(msg) {
  let toast = document.getElementById("authToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "authToast";
    toast.style.cssText = `
      position:fixed;bottom:100px;left:50%;transform:translateX(-50%);
      background:#7c3aed;color:#fff;padding:12px 24px;border-radius:24px;
      font-size:14px;z-index:9999;opacity:0;transition:opacity 0.3s;
      white-space:nowrap;box-shadow:0 4px 20px rgba(124,58,237,0.4);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  setTimeout(() => (toast.style.opacity = "0"), 3000);
}

window.showToast = showToast;

// ============================================================
// DANH SACH YEU THICH - Firestore per user
// ============================================================
function safeRenderFavoriteList() {
  if (typeof window.renderFavoriteList === "function") {
    window.renderFavoriteList();
  }
}

function safeUpdateMiniFavoriteButton() {
  if (typeof window.updateMiniFavoriteButton === "function") {
    window.updateMiniFavoriteButton();
  }
}

function getFavoriteSongId(song) {
  if (!song) return "";
  if (song.type === "youtube" && song.videoId) return "youtube:" + song.videoId;
  if (song.type === "audius" && (song.trackId || song.id)) return "audius:" + (song.trackId || song.id);
  return (song.type || "song") + ":" + encodeURIComponent(`${song.title || song.song || ""}|${song.artist || song.channelTitle || ""}`);
}

function normalizeFavoriteSong(song) {
  const songId = song?.songId || getFavoriteSongId(song);
  return {
    songId,
    type: song?.type || (song?.videoId ? "youtube" : song?.trackId ? "audius" : "song"),
    title: song?.title || song?.song || "Bài hát",
    artist: song?.artist || song?.channelTitle || "Listen Music",
    image: song?.image || song?.thumbnail || song?.thumb || (song?.videoId ? `https://i.ytimg.com/vi/${song.videoId}/mqdefault.jpg` : "images/song-default.jpg"),
    videoId: song?.videoId || "",
    trackId: song?.trackId || song?.id || "",
    artwork: song?.artwork || null,
    duration: song?.duration || 0,
  };
}

async function loadFavoriteSongs() {
  if (!auth.currentUser) {
    window.isUserLoggedIn = false;
    window.favoriteSongs = [];
    window.favoriteSongIds = new Set();
    safeUpdateMiniFavoriteButton();
    safeRenderFavoriteList();
    return;
  }

  window.isUserLoggedIn = true;
  try {
    const q = query(collection(db, "users", auth.currentUser.uid, "favorites"), orderBy("favoritedAt", "desc"));
    const snap = await getDocs(q);
    window.favoriteSongs = snap.docs.map((item) => normalizeFavoriteSong({ songId: item.id, ...item.data() }));
    window.favoriteSongIds = new Set(window.favoriteSongs.map((song) => song.songId));
  } catch (error) {
    console.error("Load favorite songs failed:", error);
    window.favoriteSongs = [];
    window.favoriteSongIds = new Set();
  }

  safeUpdateMiniFavoriteButton();
  safeRenderFavoriteList();
}

window.toggleFavoriteSong = async function (song) {
  const user = auth.currentUser;
  if (!user) {
    showToast("Vui lòng đăng nhập");
    return;
  }

  const data = normalizeFavoriteSong(song);
  if (!data.songId) return;

  try {
    const ref = doc(db, "users", user.uid, "favorites", data.songId);
    if (window.favoriteSongIds.has(data.songId)) {
      await deleteDoc(ref);
      window.favoriteSongs = window.favoriteSongs.filter((item) => item.songId !== data.songId);
      window.favoriteSongIds.delete(data.songId);
    } else {
      await setDoc(ref, {
        songId: data.songId,
        type: data.type,
        title: data.title,
        artist: data.artist,
        image: data.image,
        videoId: data.videoId,
        trackId: data.trackId,
        artwork: data.artwork,
        duration: data.duration,
        favoritedAt: serverTimestamp(),
      });
      window.favoriteSongs = [data, ...window.favoriteSongs];
      window.favoriteSongIds.add(data.songId);
    }
    safeUpdateMiniFavoriteButton();
    safeRenderFavoriteList();
  } catch (error) {
    console.error("Toggle favorite song failed:", error);
    showToast("Không thể cập nhật Yêu Thích. Vui lòng thử lại.");
  }
};

window.removeFavoriteSong = async function (songId) {
  if (!auth.currentUser || !songId) {
    showToast("Vui lòng đăng nhập");
    return;
  }

  try {
    await deleteDoc(doc(db, "users", auth.currentUser.uid, "favorites", songId));
    window.favoriteSongs = window.favoriteSongs.filter((item) => item.songId !== songId);
    window.favoriteSongIds.delete(songId);
    safeUpdateMiniFavoriteButton();
    safeRenderFavoriteList();
  } catch (error) {
    console.error("Remove favorite song failed:", error);
    showToast("Không thể xóa bài hát yêu thích.");
  }
};

window.updateFavoriteSongDuration = async function (songId, duration) {
  if (!auth.currentUser || !songId || !duration) return;

  try {
    await setDoc(doc(db, "users", auth.currentUser.uid, "favorites", songId), { duration }, { merge: true });
  } catch (error) {
    console.warn("Update favorite duration failed:", error);
  }
};

// ============================================================
// DANH SACH DA TAI - Firestore metadata only
// ============================================================
window.downloadedSongIds = new Set();

function normalizeDownloadedSong(song) {
  const videoId = song && song.videoId ? String(song.videoId) : "";
  const trackId = song && (song.trackId || song.id) ? String(song.trackId || song.id) : "";
  const type = song && song.type ? String(song.type) : videoId ? "youtube" : trackId ? "audius" : "song";
  const fallbackId = type + ":" + ((videoId || trackId || `${song?.title || ""}|${song?.artist || ""}`) || Date.now());
  return {
    songId: song?.songId || videoId || fallbackId,
    type,
    title: song?.title || song?.song || "Bài hát",
    artist: song?.artist || song?.channelTitle || "YouTube",
    thumbnail: song?.thumbnail || song?.image || song?.thumb || (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : ""),
    videoId,
    trackId,
  };
}

async function loadDownloadedSongIds() {
  if (!auth.currentUser) {
    window.downloadedSongIds = new Set();
    updateDownloadButtons();
    return;
  }

  try {
    const snap = await getDocs(collection(db, "users", auth.currentUser.uid, "downloaded"));
    window.downloadedSongIds = new Set(snap.docs.map((item) => item.id));
  } catch (error) {
    console.error("Load downloaded ids failed:", error);
    window.downloadedSongIds = new Set();
  }
  updateDownloadButtons();
}

function downloadIconSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.1A1.5 1.5 0 0 0 2.5 14h11a1.5 1.5 0 0 0 1.5-1.5v-2.1a.5.5 0 0 1 1 0v2.1a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 0 12.5v-2.1a.5.5 0 0 1 .5-.5z"/>
      <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
    </svg>
  `;
}

function updateDownloadButtons() {
  document.querySelectorAll("[data-download-song-id]").forEach((btn) => {
    const songId = btn.getAttribute("data-download-song-id");
    const downloaded = window.downloadedSongIds && window.downloadedSongIds.has(songId);
    btn.classList.toggle("is-downloaded", !!downloaded);
    btn.innerHTML = downloaded ? "✓" : downloadIconSvg();
    btn.setAttribute("aria-label", downloaded ? "Đã tải" : "Tải nhạc");
    btn.title = downloaded ? "Đã tải" : "Tải nhạc";
  });
}

window.refreshDownloadButtons = updateDownloadButtons;

window.toggleDownloadedSong = async function (song) {
  return window.saveDownloadedSong(song);
};

window.saveDownloadedSong = async function (song) {
  const user = auth.currentUser;
  if (!user) {
    showToast("Vui lòng đăng nhập để tải nhạc.");
    openAuthModal("login");
    return;
  }

  const data = normalizeDownloadedSong(song);
  if (!data.songId) {
    showToast("Không tìm thấy thông tin bài hát để tải.");
    return;
  }

  try {
    const ref = doc(db, "users", user.uid, "downloaded", data.songId);
    if (window.downloadedSongIds.has(data.songId)) {
      showToast("Bài hát của bạn đã được tải");
    } else {
      await setDoc(ref, {
        songId: data.songId,
        type: data.type,
        title: data.title,
        artist: data.artist,
        thumbnail: data.thumbnail,
        videoId: data.videoId,
        trackId: data.trackId,
        downloadedAt: serverTimestamp(),
      });
      window.downloadedSongIds.add(data.songId);
      showToast("Đã thêm vào Đã Tải ✅");
    }
    updateDownloadButtons();
    if (window.currentPage === "downloadPage") renderDownloadedSongs();
  } catch (error) {
    console.error("Toggle downloaded song failed:", error);
    showToast("Không thể cập nhật Đã Tải. Vui lòng thử lại.");
  }
};

window.renderDownloadedSongs = async function () {
  const list = document.getElementById("downloadedList");
  if (!list) return;

  if (!auth.currentUser) {
    list.innerHTML = '<div class="artist-loading">Vui lòng đăng nhập để xem bài hát đã tải.</div>';
    return;
  }

  list.innerHTML = '<div class="artist-loading">Đang tải danh sách...</div>';
  try {
    const q = query(collection(db, "users", auth.currentUser.uid, "downloaded"), orderBy("downloadedAt", "desc"));
    const snap = await getDocs(q);
    const songs = snap.docs.map((item) => item.data());
    window.downloadedSongIds = new Set(songs.map((song) => song.songId));
    updateDownloadButtons();

    if (!songs.length) {
      list.innerHTML = '<div class="artist-loading">Chưa có bài hát đã tải.</div>';
      return;
    }

    list.innerHTML = songs
      .map((song, index) => {
        const title = song.title || "Bài hát";
        const artist = song.artist || "YouTube";
        const thumb = song.thumbnail || (song.videoId ? `https://i.ytimg.com/vi/${song.videoId}/mqdefault.jpg` : "images/song-default.jpg");
        const safeTitle = escapeInlineString(title);
        const safeArtist = escapeInlineString(artist);
        const safeThumb = escapeInlineString(thumb);
        const safeVideoId = escapeInlineString(song.videoId || "");
        const safeTrackId = escapeInlineString(song.trackId || "");
        const safeSongId = escapeInlineString(song.songId || "");
        const safePlaybackId = escapeHtml(song.videoId ? `youtube:${song.videoId}` : song.trackId ? `audius:${song.trackId}` : "");
        const displayTitle = escapeHtml(title);
        const displayArtist = escapeHtml(artist);
        const safeThumbAttr = escapeHtml(thumb);
        return `
          <div class="downloaded-song-item" data-playback-id="${safePlaybackId}" onclick="playDownloadedTrack({ videoId: '${safeVideoId}', trackId: '${safeTrackId}', title: '${safeTitle}', artist: '${safeArtist}', thumbnail: '${safeThumb}' })">
            <div class="yt-song-num">${index + 1}</div>
            <div class="yt-song-thumb">
              <img src="${safeThumbAttr}" alt="${displayTitle}" />
              <span class="yt-play-icon" onclick="handlePlaybackButtonClick(event, () => playDownloadedTrack({ videoId: '${safeVideoId}', trackId: '${safeTrackId}', title: '${safeTitle}', artist: '${safeArtist}', thumbnail: '${safeThumb}' }))">▶</span>
            </div>
            <div class="yt-song-info">
              <div class="yt-song-title">${displayTitle}</div>
              <div class="yt-song-channel">${displayArtist}</div>
            </div>
            <button class="download-remove-btn" onclick="removeDownloadedSong(event, '${safeSongId}')">Xóa</button>
          </div>
        `;
      })
      .join("");
    if (typeof window.updatePlaybackItemState === "function") window.updatePlaybackItemState();
  } catch (error) {
    console.error("Render downloaded songs failed:", error);
    list.innerHTML = '<div class="artist-loading">Không tải được danh sách Đã Tải.</div>';
  }
};

window.removeDownloadedSong = async function (event, songId) {
  if (event) event.stopPropagation();
  if (!auth.currentUser || !songId) return;

  try {
    await deleteDoc(doc(db, "users", auth.currentUser.uid, "downloaded", songId));
    window.downloadedSongIds.delete(songId);
    updateDownloadButtons();
    renderDownloadedSongs();
    showToast("Đã xóa khỏi Đã Tải.");
  } catch (error) {
    console.error("Remove downloaded song failed:", error);
    showToast("Không thể xóa bài hát.");
  }
};

// ============================================================
// XỬ LÝ LỖI FIREBASE
// ============================================================
function getErrorMessage(code) {
  const messages = {
    "auth/email-already-in-use": "Email này đã được đăng ký.",
    "auth/invalid-email": "Email không hợp lệ.",
    "auth/weak-password": "Mật khẩu quá yếu.",
    "auth/user-not-found": "Tài khoản không tồn tại.",
    "auth/wrong-password": "Mật khẩu không đúng.",
    "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
    "auth/too-many-requests": "Quá nhiều lần thử. Vui lòng thử lại sau.",
  };
  return messages[code] || "Đã xảy ra lỗi. Vui lòng thử lại.";
}
