var currentIndex = 0;
var currentAudio; // Lưu bài đang phát
let songs = [];
let totalSongs = 0;

// ============================
// PLAYER CORE
// ============================
function setPlayPauseIcon(isPlaying) {
  var btn = document.getElementById("playPauseBtn");
  btn.innerHTML = isPlaying
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-pause-fill" viewBox="0 0 16 16">
        <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5"/>
       </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
        <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
       </svg>`;
}
function updatePlayBtn() {
  const SVG_PLAY = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
    <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
  </svg>`;
  const SVG_PAUSE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-pause-fill" viewBox="0 0 16 16">
    <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5"/>
  </svg>`;

  document.querySelectorAll(".song-item").forEach((item, i) => {
    const btn = item.querySelector(".song-play-btn");
    if (i === currentIndex) {
      item.classList.add("is-playing");
      if (btn) btn.innerHTML = currentAudio && !currentAudio.paused ? SVG_PAUSE : SVG_PLAY;
    } else {
      item.classList.remove("is-playing");
      if (btn) btn.innerHTML = SVG_PLAY; // Reset về icon play
    }
  });
}

function playSound(index) {
  if (currentAudio && currentIndex === index) {
    if (!currentAudio.paused) {
      currentAudio.pause();
      setPlayPauseIcon(false);
    } else {
      currentAudio.play();
      setPlayPauseIcon(true);
    }
    updatePlayBtn();
    return;
  }

  currentIndex = index;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.onended = null;
    currentAudio.ontimeupdate = null;
  }

  currentAudio = new Audio(songs[index].file);
  currentAudio.ontimeupdate = updateProgress;

  currentAudio.onended = function () {
    if (currentIndex + 1 < totalSongs) {
      playSound(currentIndex + 1);
    } else {
      currentIndex = 0;
      setPlayPauseIcon(false);
      updatePlayBtn();
    }
  };

  currentAudio.play();
  updatePlayBtn();

  document.querySelector(".player-bar").classList.add("active");
  setPlayPauseIcon(true);
}

function prevSong() {
  if (currentIndex - 1 >= 0) {
    playSound(currentIndex - 1);
  } else {
    if (currentAudio) {
      currentAudio.currentTime = 0;
      currentAudio.play();
      setPlayPauseIcon(true);
      updatePlayBtn(); // ← thêm
    }
  }
}

function nextSong() {
  if (currentIndex + 1 < totalSongs) {
    playSound(currentIndex + 1);
  } else {
    playSound(0);
  }
}

function togglePlay() {
  if (!currentAudio) {
    playSound(0);
    return;
  }

  if (currentAudio.paused) {
    currentAudio.play();
    setPlayPauseIcon(true);
  } else {
    currentAudio.pause();
    setPlayPauseIcon(false);
  }
  updatePlayBtn();
}

// ============================
// DRUM BUTTONS
// ============================

document.querySelectorAll(".drum").forEach(function (btn, index) {
  var img = document.createElement("img");
  img.src = "images/x" + (index + 1) + ".jpg";
  btn.appendChild(img);

  btn.addEventListener("click", function () {
    playSound(index);
  });
});

// ============================
// KEYBOARD CONTROL
// ============================

document.addEventListener("keydown", function (e) {
  if (document.activeElement.tagName === "INPUT") return;

  switch (e.key) {
    case "ArrowUp":
      e.preventDefault();
      if (currentAudio) updateVolume(Math.min(100, Math.round(currentAudio.volume * 100) + 10));
      break;
    case "ArrowDown":
      e.preventDefault();
      if (currentAudio) updateVolume(Math.max(0, Math.round(currentAudio.volume * 100) - 10));
      break;
    case "ArrowRight":
      e.preventDefault();
      nextSong();
      break;
    case "ArrowLeft":
      e.preventDefault();
      prevSong();
      break;
    case " ":
      e.preventDefault();
      togglePlay();
      break;
  }
});

// ============================
// VOLUME
// ============================

function updateVolume(value) {
  if (currentAudio) currentAudio.volume = value / 100;
  document.getElementById("volumeSlider").value = value;
  document.getElementById("volumeText").textContent = value;

  var icon = document.getElementById("volumeIcon");
  if (value == 0) icon.textContent = "🔇";
  else if (value < 50) icon.textContent = "🔉";
  else icon.textContent = "🔊";
}

document.getElementById("volumeSlider").addEventListener("input", function () {
  updateVolume(parseInt(this.value));
});

var isMuted = false;
var lastVolume = 100;

function toggleMute() {
  if (isMuted) {
    updateVolume(lastVolume);
    isMuted = false;
  } else {
    lastVolume = Math.round(currentAudio ? currentAudio.volume * 100 : 100);
    updateVolume(0);
    isMuted = true;
  }
}

// ============================
// PROGRESS BAR
// ============================

function updateProgress() {
  var bar = document.getElementById("progressBar");
  var current = document.getElementById("currentTime");
  var dur = document.getElementById("duration");

  if (!currentAudio || isNaN(currentAudio.duration)) return;

  bar.max = currentAudio.duration;
  bar.value = currentAudio.currentTime;
  current.textContent = formatTime(currentAudio.currentTime);
  dur.textContent = formatTime(currentAudio.duration);
}

function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  var m = Math.floor(seconds / 60);
  var s = Math.floor(seconds % 60);
  return m + ":" + (s < 10 ? "0" + s : s);
}

document.getElementById("progressBar").addEventListener("input", function () {
  if (currentAudio) currentAudio.currentTime = this.value;
});

// ============================
// PAGE NAVIGATION
// ============================

var currentPage = "homePage";

function showPage(page) {
  var pageIds = ["homePage", "libraryPage", "favoritePage", "downloadPage", "uploadPage", "mvPage", "artistPage", "top100Page", "youtubePage"];
  pageIds.forEach(function (p) {
    var el = document.getElementById(p);
    if (el) el.style.display = "none";
  });

  var target = document.getElementById(page);
  if (target) {
    target.style.display = "block";
    currentPage = page;
  }

  history.pushState({ page: page }, "");
}

window.onpopstate = function (event) {
  if (event.state && event.state.page) {
    var pageIds = ["homePage", "libraryPage", "favoritePage", "downloadPage", "uploadPage", "mvPage", "artistPage", "top100Page", "youtubePage"];
    pageIds.forEach(function (p) {
      var el = document.getElementById(p);
      if (el) el.style.display = "none";
    });
    var target = document.getElementById(event.state.page);
    if (target) target.style.display = "block";
  }
};

function setActive(el) {
  document.querySelectorAll(".sidebar-menu a").forEach(function (a) {
    a.classList.remove("active");
  });
  el.classList.add("active");
}

document.getElementById("homePage").style.display = "block";
history.replaceState({ page: "homePage" }, "");

// ============================
// TOPIC CARDS
// ============================

const topics = document.querySelectorAll(".topic-card");
const images = ["discover/dis1.jpg", "discover/dis2.jpg", "discover/dis3.jpg", "discover/dis4.jpg", "discover/dis5.jpg", "discover/dis6.jpg", "discover/dis7.jpg", "discover/dis8.jpg", "discover/dis9.jpg", "discover/dis10.jpg"];

topics.forEach((card, i) => {
  if (images[i]) {
    card.style.background = `url('${images[i]}') center/cover no-repeat`;
  }
});

// ============================
// SONG LIST
// ============================

const COLORS = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6bb5", "#ff9f43", "#a29bfe", "#00cec9"];

function renderFavoriteList() {
  const list = document.getElementById("favoriteList");
  if (!list) return;

  list.innerHTML = songs
    .map(
      (song, i) => `
      <div class="song-item" onclick="playSound(${i})">
        <span class="song-index" style="color:${COLORS[i % COLORS.length]};font-size:18px;font-weight:700;">
          <span class="song-num">${i + 1}</span>
        </span>
        <div class="song-thumb">
          <div class="song-img-wrap">
            <img src="images/${song.file.replace("sounds/", "").replace(".mp3", ".jpg")}"
                 onerror="this.style.display='none'" />
            <span class="song-play-btn">▶</span>
          </div>
          <span class="song-name">${song.title}</span>
        </div>
        <span class="song-artist">${song.artist}</span>
        <span class="song-duration" id="dur-${i}">--:--</span>
      </div>
    `,
    )
    .join("");

  songs.forEach((song, i) => {
    const audio = new Audio(song.file);
    audio.addEventListener("loadedmetadata", () => {
      const el = document.getElementById(`dur-${i}`);
      if (el) el.textContent = formatTime(audio.duration);
    });
  });
}

fetch("songs.json")
  .then((r) => r.json())
  .then((data) => {
    songs = data;
    totalSongs = songs.length;
    renderFavoriteList();
  })
  .catch(() => {
    console.error("Không thể tải songs.json");
  });

// ============================
// SEARCH FEATURE
// ============================

let searchHistory = JSON.parse(localStorage.getItem("searchHistory") || "[]");

const searchInput = document.getElementById("searchInput");
const searchDropdown = document.getElementById("searchDropdown");
const searchWrapper = document.getElementById("searchWrapper");
const searchClear = document.getElementById("searchClear");

searchInput.addEventListener("focus", () => {
  searchWrapper.classList.add("active");
  renderHistory();
  searchDropdown.style.display = "block";
});

document.addEventListener("click", (e) => {
  if (!searchWrapper.contains(e.target)) {
    searchWrapper.classList.remove("active");
    searchDropdown.style.display = "none";
  }
});

// Debounce 800ms: chờ dừng gõ mới gọi YouTube API → tiết kiệm quota
let searchDebounceTimer = null;

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  searchClear.style.display = q ? "block" : "none";

  if (!q) {
    document.getElementById("searchResults").style.display = "none";
    document.getElementById("searchHistory").style.display = "block";
    renderHistory();
    clearTimeout(searchDebounceTimer);
    return;
  }

  document.getElementById("searchHistory").style.display = "none";
  document.getElementById("searchResults").style.display = "block";

  const list = document.getElementById("resultList");
  list.innerHTML = '<div class="search-empty">🔍 Đang tìm...</div>';
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    searchYouTube(q);
  }, 800);
});

// Nhấn Enter → tìm ngay, không chờ debounce
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const q = searchInput.value.trim().toLowerCase();
    clearTimeout(searchDebounceTimer);
    const matched = songs.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
    if (matched.length > 0) {
      playFromSearch(songs.indexOf(matched[0]), matched[0].title);
    } else {
      searchYouTube(q);
    }
  }
  if (e.key === "Escape") {
    searchDropdown.style.display = "none";
    searchWrapper.classList.remove("active");
    searchInput.blur();
  }
});

function playFromSearch(index, title) {
  addToHistory(title);
  playSound(index);
  searchInput.value = "";
  searchClear.style.display = "none";
  searchDropdown.style.display = "none";
  searchWrapper.classList.remove("active");
  showPage("favoritePage");
  setActive(document.querySelector(".sidebar-menu a:nth-child(2)"));
}

function highlight(text, q) {
  const regex = new RegExp(`(${q})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

function clearSearch() {
  searchInput.value = "";
  searchClear.style.display = "none";
  clearTimeout(searchDebounceTimer);
  document.getElementById("searchResults").style.display = "none";
  document.getElementById("searchHistory").style.display = "block";
  renderHistory();
  searchInput.focus();
}

function addToHistory(title) {
  searchHistory = searchHistory.filter((h) => h !== title);
  searchHistory.unshift(title);
  if (searchHistory.length > 6) searchHistory = searchHistory.slice(0, 6);
  localStorage.setItem("searchHistory", JSON.stringify(searchHistory));
}

function renderHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;
  if (searchHistory.length === 0) {
    list.innerHTML = '<div class="search-empty">Chưa có lịch sử tìm kiếm</div>';
    return;
  }
  list.innerHTML = searchHistory
    .map(
      (h) => `
      <div class="search-history-item">
        <span onclick="searchInput.value='${h}'; searchInput.dispatchEvent(new Event('input'))">
          🕐 ${h}
        </span>
        <span class="history-delete" onclick="removeHistory('${h}')">✕</span>
      </div>
    `,
    )
    .join("");
}

function removeHistory(title) {
  searchHistory = searchHistory.filter((h) => h !== title);
  localStorage.setItem("searchHistory", JSON.stringify(searchHistory));
  renderHistory();
}

// ============================
// YOUTUBE DATA API
// - Cache 7 ngày: mỗi từ khóa chỉ tốn quota 1 lần/tuần
// - Debounce 800ms: không gọi API khi đang gõ dở
// - Tìm local trước: chỉ gọi API khi không có kết quả local
// → 10,000 quota/ngày là quá đủ
// ============================

const YT_API_KEY = "AIzaSyD0EQ8BeBEa-PEbA8c45lMDTtY7Pf34fm4";
const CACHE_7_DAYS = 7 * 24 * 60 * 60 * 1000;

let ytPlayer = null;
let ytReady = false;

function onYouTubeIframeAPIReady() {
  ytReady = true;
}

// ============================
// OPEN TOPIC (cache 7 ngày)
// ============================

function openTopic(topicName, query) {
  showPage("youtubePage");
  document.getElementById("youtubePageTitle").textContent = "🎵 " + topicName;

  const cacheKey = "yt_topic_" + query.toLowerCase().trim();
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { html, time } = JSON.parse(cached);
      if (Date.now() - time < CACHE_7_DAYS) {
        document.getElementById("youtubeList").innerHTML = html;
        return;
      }
    } catch (e) {}
    localStorage.removeItem(cacheKey);
  }

  document.getElementById("youtubeList").innerHTML = '<div class="yt-loading">🎵 Đang tải nhạc...</div>';

  fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(query)}&maxResults=50&key=${YT_API_KEY}`)
    .then((r) => r.json())
    .then((data) => {
      if (!data.items || data.items.length === 0) {
        document.getElementById("youtubeList").innerHTML = '<div class="yt-loading">Không tìm thấy kết quả.</div>';
        return;
      }
      const html = renderYouTubeList(data.items);
      localStorage.setItem(cacheKey, JSON.stringify({ html, time: Date.now() }));
    })
    .catch(() => {
      document.getElementById("youtubeList").innerHTML = '<div class="yt-loading">❌ Lỗi kết nối. Vui lòng thử lại.</div>';
    });
}

function renderYouTubeList(items) {
  const list = document.getElementById("youtubeList");
  const html = items
    .map((item, i) => {
      const vid = item.id.videoId;
      const title = item.snippet.title;
      const channel = item.snippet.channelTitle;
      const thumb = item.snippet.thumbnails.medium.url;
      return `
        <div class="yt-song-item" onclick="playYouTube('${vid}', \`${title.replace(/`/g, "'")}\`)">
          <div class="yt-song-num">${i + 1}</div>
          <div class="yt-song-thumb">
            <img src="${thumb}" alt="${title}" />
            <span class="yt-play-icon">▶</span>
          </div>
          <div class="yt-song-info">
            <div class="yt-song-title">${title}</div>
            <div class="yt-song-channel">${channel}</div>
          </div>
        </div>
      `;
    })
    .join("");
  list.innerHTML = html;
  return html;
}

// ============================
// SEARCH YOUTUBE (cache 7 ngày)
// ============================

function searchYouTube(query) {
  document.getElementById("searchHistory").style.display = "none";
  document.getElementById("searchResults").style.display = "block";
  const list = document.getElementById("resultList");

  const cacheKey = "yt_search_" + query.toLowerCase().trim();
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { html, time } = JSON.parse(cached);
      if (Date.now() - time < CACHE_7_DAYS) {
        list.innerHTML = html;
        return;
      }
    } catch (e) {}
    localStorage.removeItem(cacheKey);
  }

  list.innerHTML = '<div class="search-empty">🔍 Đang tìm trên YouTube...</div>';

  fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(query)}&maxResults=8&key=${YT_API_KEY}`)
    .then((r) => r.json())
    .then((data) => {
      if (!data.items || data.items.length === 0) {
        list.innerHTML = '<div class="search-empty">Không tìm thấy kết quả.</div>';
        return;
      }
      const html = data.items
        .map((item) => {
          const vid = item.id.videoId;
          const title = item.snippet.title;
          const channel = item.snippet.channelTitle;
          const thumb = item.snippet.thumbnails.default.url;
          return `
          <div class="search-item" onclick="playYouTubeFromSearch('${vid}', \`${title.replace(/`/g, "'")}\`)">
            <img src="${thumb}" style="border-radius:4px; width:42px; height:42px; object-fit:cover;" />
            <div class="search-item-info">
              <div class="search-item-title">${title}</div>
              <div class="search-item-artist">▶ YouTube · ${channel}</div>
            </div>
          </div>
        `;
        })
        .join("");
      localStorage.setItem(cacheKey, JSON.stringify({ html, time: Date.now() }));
      list.innerHTML = html;
    })
    .catch(() => {
      list.innerHTML = '<div class="search-empty">❌ Lỗi kết nối. Vui lòng thử lại.</div>';
    });
}

// ============================
// PHÁT VIDEO YOUTUBE
// ============================

function playYouTube(videoId, title) {
  const modal = document.getElementById("ytPlayerModal");
  document.getElementById("ytModalTitle").textContent = title;
  modal.style.display = "flex";

  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
    setPlayPauseIcon(false);
    updatePlayBtn();
  }

  if (ytPlayer && ytReady) {
    ytPlayer.loadVideoById(videoId);
  } else {
    document.getElementById("ytPlayer").innerHTML = "";
    ytPlayer = new YT.Player("ytPlayer", {
      height: "100%",
      width: "100%",
      videoId: videoId,
      playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: (e) => {
          e.target.playVideo();
          ytReady = true;
        },
      },
    });
  }
}

function closeYTPlayer() {
  document.getElementById("ytPlayerModal").style.display = "none";
  if (ytPlayer) {
    ytPlayer.stopVideo();
  }
}

function playYouTubeFromSearch(vid, title) {
  addToHistory(title);
  searchInput.value = "";
  searchClear.style.display = "none";
  searchDropdown.style.display = "none";
  searchWrapper.classList.remove("active");
  playYouTube(vid, title);
}
function toggleSettings() {
  document.getElementById("settingsDropdown").classList.toggle("open");
}
function closeSettings() {
  document.getElementById("settingsDropdown").classList.remove("open");
}
document.addEventListener("click", function (e) {
  if (!document.getElementById("settingsWrapper").contains(e.target)) {
    closeSettings();
  }
});
