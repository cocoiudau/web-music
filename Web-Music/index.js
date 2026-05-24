var currentIndex = 0;
var currentAudio; // Lưu bài đang phát
let songs = [];
let totalSongs = 0;
let currentAudioSource = "local";
let audiusTracks = [];
let currentAudiusIndex = -1;
let localChartTracks = [];
let currentLocalChartIndex = -1;
var localSearchResults = [];

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
      if (btn) btn.innerHTML = SVG_PLAY; // Reset icon
    }
  });
}

function playSound(index) {
  const song = songs[index];
  if (!song) return;

  if (!song.file) {
    alert("Bai nay chua co file audio local.");
    return;
  }

  currentAudioSource = "local";
  currentAudiusIndex = -1;
  currentLocalChartIndex = -1;

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
  recordListeningHistory({
    type: "local",
    title: song.title,
    artist: song.artist,
    image: song.image || `images/${song.file.replace("sounds/", "").replace(".mp3", ".jpg")}`,
    file: song.file,
  });

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.onended = null;
    currentAudio.ontimeupdate = null;
  }

  currentAudio = new Audio(song.file);
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
  if (currentAudioSource === "localChart") {
    if (currentLocalChartIndex > 0) {
      playLocalChartTrack(currentLocalChartIndex - 1);
    } else if (currentAudio) {
      currentAudio.currentTime = 0;
      currentAudio.play();
      setPlayPauseIcon(true);
    }
    return;
  }

  if (currentAudioSource === "audius") {
    if (currentAudiusIndex > 0) {
      playAudiusTrack(currentAudiusIndex - 1);
    } else if (currentAudio) {
      currentAudio.currentTime = 0;
      currentAudio.play();
      setPlayPauseIcon(true);
    }
    return;
  }

  if (currentIndex - 1 >= 0) {
    playSound(currentIndex - 1);
  } else {
    if (currentAudio) {
      currentAudio.currentTime = 0;
      currentAudio.play();
      setPlayPauseIcon(true);
      updatePlayBtn(); // ← add
    }
  }
}

function nextSong() {
  if (currentAudioSource === "localChart") {
    if (currentLocalChartIndex + 1 < localChartTracks.length) {
      playLocalChartTrack(currentLocalChartIndex + 1);
    } else if (localChartTracks.length > 0) {
      playLocalChartTrack(0);
    }
    return;
  }

  if (currentAudioSource === "audius") {
    if (currentAudiusIndex + 1 < audiusTracks.length) {
      playAudiusTrack(currentAudiusIndex + 1);
    } else if (audiusTracks.length > 0) {
      playAudiusTrack(0);
    }
    return;
  }

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

const HOME_ADS = [
  {
    brand: "Listen Music",
    title: "VIP Center",
    copy: "Nghe nhạc chất lượng cao, playlist không giới hạn, ưu đãi tháng này",
    buttonText: "Khám phá ngay",
    action: function () {
      showPage("vipPage");
    },
    bgImage: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=1800&q=95",
  },
  {
    brand: "Listen Music",
    title: "Thưởng thức âm nhạc",
    copy: "VIP mới: chất lượng cao và trải nghiệm không giới hạn.",
    buttonText: "Nghe ngay",
    action: function () {
      showPage("homePage");
      setActive(document.querySelector(".sidebar-menu a"));
    },
    bgImage: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1800&q=95",
  },
  {
    brand: "VIP Deal",
    title: "Ưu đãi tháng này",
    copy: "Đăng ký VIP ngay để nhận ưu đãi đặc biệt và playlist cập nhật mỗi ngày.",
    buttonText: "Đăng ký VIP",
    action: function () {
      showPage("top100Page");
      setActive(document.querySelector(".sidebar-menu a:nth-child(3)"));
    },
    bgImage: "https://images.unsplash.com/photo-1502945015378-3eec5d364ddb?auto=format&fit=crop&w=1800&q=95",
  },
  {
    brand: "Top 100",
    title: "Bảng xếp hạng mới",
    copy: "Cập nhật các bài hát nổi bật, dễ nghe và đang được tìm kiếm nhiều.",
    buttonText: "Xem Top 100",
    action: function () {
      showPage("top100Page");
      setActive(document.querySelector(".sidebar-menu a:nth-child(3)"));
    },
    bgImage: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1800&q=95",
  },
  {
    brand: "Remix Hot",
    title: "Năng lượng cho hôm nay",
    copy: "Mở nhanh những bản remix sôi động cho học tập, làm việc và thư giãn.",
    buttonText: "Mở remix",
    action: function () {
      openTopic("Remix", "nhạc remix việt nam hay nhất");
    },
    bgImage: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1800&q=95",
  },
];

let homeAdIndex = 0;
let homeAdTimer = null;
const HOME_AD_REFRESH_DELAY = 5000;

function renderHomeAd(index) {
  const ad = HOME_ADS[index];
  const banner = document.getElementById("homeAdBanner");
  if (!banner || !ad) return;

  banner.style.display = "grid";
  banner.style.backgroundImage = `linear-gradient(90deg, rgba(4, 20, 64, 0.9), rgba(0, 98, 190, 0.72), rgba(7, 16, 48, 0.88)), url('${ad.bgImage}')`;
  document.getElementById("homeAdBrand").textContent = ad.brand;
  document.getElementById("homeAdTitle").textContent = ad.title;
  document.getElementById("homeAdCopy").textContent = ad.copy;

  const actionBtn = document.getElementById("homeAdActionBtn");
  if (actionBtn) {
    actionBtn.textContent = ad.buttonText;
    actionBtn.onclick = function (event) {
      event.preventDefault();
      ad.action();
    };
  }
}

function scheduleHomeAdRefresh() {
  clearTimeout(homeAdTimer);
  homeAdTimer = setTimeout(() => {
    homeAdIndex = (homeAdIndex + 1) % HOME_ADS.length;
    renderHomeAd(homeAdIndex);
    scheduleHomeAdRefresh();
  }, HOME_AD_REFRESH_DELAY);
}

function closeHomeAd() {
  const banner = document.getElementById("homeAdBanner");
  if (!banner) return;

  banner.style.display = "none";
  clearTimeout(homeAdTimer);
  homeAdTimer = setTimeout(() => {
    homeAdIndex = (homeAdIndex + 1) % HOME_ADS.length;
    renderHomeAd(homeAdIndex);
    scheduleHomeAdRefresh();
  }, HOME_AD_REFRESH_DELAY);
}

function initHomeAdRotation() {
  renderHomeAd(homeAdIndex);
  scheduleHomeAdRefresh();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHomeAdRotation);
} else {
  initHomeAdRotation();
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

function goHistoryBack() {
  history.back();
}

function goHistoryForward() {
  history.forward();
}

function showPage(page) {
  var pageIds = ["homePage", "libraryPage", "favoritePage", "downloadPage", "uploadPage", "mvPage", "artistPage", "artistSongsPage", "top100Page", "zingChartPage", "recentPage", "youtubePage", "vipPage", "aboutPage", "termsPage"];
  pageIds.forEach(function (p) {
    var el = document.getElementById(p);
    if (el) el.style.display = "none";
  });

  var target = document.getElementById(page);
  if (target) {
    target.style.display = "block";
    currentPage = page;
  }

  if (page === "artistPage") {
    loadArtistPage();
  }

  if (page === "recentPage") {
    renderRecentSongs();
  }

  if (page === "zingChartPage") {
    renderZingChartPage();
  }

  history.pushState({ page: page }, "");
}

window.onpopstate = function (event) {
  if (event.state && event.state.page) {
    var pageIds = ["homePage", "libraryPage", "favoritePage", "downloadPage", "uploadPage", "mvPage", "artistPage", "artistSongsPage", "top100Page", "zingChartPage", "recentPage", "youtubePage", "vipPage", "aboutPage", "termsPage"];
    pageIds.forEach(function (p) {
      var el = document.getElementById(p);
      if (el) el.style.display = "none";
    });
    var target = document.getElementById(event.state.page);
    if (target) {
      target.style.display = "block";
      currentPage = event.state.page;
    }
    if (event.state.page === "artistPage") {
      loadArtistPage();
    }
    if (event.state.page === "recentPage") {
      renderRecentSongs();
    }
    if (event.state.page === "zingChartPage") {
      renderZingChartPage();
    }
  }
};

function setActive(el) {
  document.querySelectorAll(".sidebar-menu a, .sidebar-playlist").forEach(function (a) {
    a.classList.remove("active");
  });
  el.classList.add("active");
}

document.getElementById("homePage").style.display = "block";
history.replaceState({ page: "homePage" }, "");

// ============================
// TOPIC CARDS
// ============================

function scrollHomeSlider(id, direction) {
  const slider = document.getElementById(id);
  if (!slider) return;
  const distance = Math.max(320, Math.floor(slider.clientWidth * 0.8));
  slider.scrollBy({ left: distance * direction, behavior: "smooth" });
}

// ============================
// SONG LIST
// ============================

const COLORS = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6bb5", "#ff9f43", "#a29bfe", "#00cec9"];

function renderFavoriteList() {
  const list = document.getElementById("favoriteList");
  if (!list) return;

  if (!songs.length) {
    list.innerHTML = '<div class="artist-loading">Dang tai danh sach nhac local...</div>';
    return;
  }

  list.innerHTML = songs
    .map(
      (song, i) => `
      <div class="song-item" onclick="playSound(${i})">
        <span class="song-index" style="color:${COLORS[i % COLORS.length]};font-size:18px;font-weight:700;">
          <span class="song-num">${i + 1}</span>
        </span>
        <div class="song-thumb">
          <div class="song-img-wrap">
            <img src="${getSongDisplayImage(song, i)}"
                 onerror="this.style.display='none'" />
            <span class="song-play-btn">&#9654;</span>
          </div>
          <span class="song-name">${song.title}</span>
        </div>
        <span class="song-artist">${song.artist}</span>
        <span class="song-duration" id="dur-${i}">${song.duration ? formatTime(song.duration) : "--:--"}</span>
      </div>
    `,
    )
    .join("");

  loadLocalSongDurations();
}

function loadLocalSongDurations() {
  songs.forEach((song, index) => {
    if (!song || !song.file || song.durationLoading) return;
    if (song.duration) {
      updateSongDurationLabel(index, song.duration);
      return;
    }

    song.durationLoading = true;
    const probe = new Audio();
    probe.preload = "metadata";
    probe.src = song.file;

    probe.onloadedmetadata = function () {
      if (Number.isFinite(probe.duration)) {
        song.duration = Math.floor(probe.duration);
        updateSongDurationLabel(index, song.duration);
      }
      cleanupDurationProbe(probe);
    };

    probe.onerror = function () {
      cleanupDurationProbe(probe);
    };
  });
}

function updateSongDurationLabel(index, duration) {
  const label = document.getElementById(`dur-${index}`);
  if (label) label.textContent = formatTime(duration);
}

function cleanupDurationProbe(probe) {
  probe.onloadedmetadata = null;
  probe.onerror = null;
  probe.removeAttribute("src");
  probe.load();
}
const RECENT_SONGS_KEY = "listen_music_recent_songs";
const RECENT_SONGS_LIMIT = 50;
const CACHE_7_DAYS = 7 * 24 * 60 * 60 * 1000;
const SEARCH_CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const SEARCH_MIN_QUERY_LENGTH = 1;
const SEARCH_DEBOUNCE_DELAY = 1200;
const YOUTUBE_PAGE_SIZE = 50;
const SEARCH_RESULTS_COUNT = 50;
const TOP100_RESULTS_COUNT = 100;
const EXPLORE_TOPIC_RESULTS_COUNT = 100;
const VIETNAMESE_CHART_CACHE_KEY = "youtube_vietnamese_all_time_chart_v1";
const VIETNAMESE_CHART_COUNT = 100;

function getRecentSongs() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SONGS_KEY) || "[]");
  } catch (e) {
    localStorage.removeItem(RECENT_SONGS_KEY);
    return [];
  }
}

function recordListeningHistory(song) {
  if (!getAppSettings().saveHistory) return;
  if (!song || !song.title) return;

  const identity = song.file || song.videoId || song.trackId || song.title + song.artist;
  const recent = getRecentSongs().filter((item) => (item.file || item.videoId || item.trackId || item.title + item.artist) !== identity);
  recent.unshift({
    ...song,
    id: identity,
    playedAt: Date.now(),
  });

  localStorage.setItem(RECENT_SONGS_KEY, JSON.stringify(recent.slice(0, RECENT_SONGS_LIMIT)));

  if (currentPage === "recentPage") {
    renderRecentSongs();
  }
}

function renderRecentSongs() {
  const list = document.getElementById("recentSongList");
  if (!list) return;

  const recent = getRecentSongs();
  if (recent.length === 0) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = recent
    .map((song, i) => {
      const image = getSongDisplayImage(song, i);
      const artist = song.artist || "Unknown Artist";
      const time = song.playedAt ? new Date(song.playedAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "";
      return `
        <div class="recent-song-row" onclick="playRecentSong(${i})">
          <div class="recent-rank">${i + 1}</div>
          <div class="recent-thumb">
            <img src="${image}" alt="${song.title}" />
            <span>&#9654;</span>
          </div>
          <div class="recent-info">
            <div class="recent-title">${song.title}</div>
            <div class="recent-artist">${artist} &middot; ${getSourceLabel(song.type)}${time ? " &middot; " + time : ""}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function getSourceLabel(type) {
  if (type === "audius") return "Audius";
  if (type === "youtube") return "YouTube";
  return "Local";
}

function playRecentSong(index) {
  const song = getRecentSongs()[index];
  if (!song) return;

  if (song.file) {
    const localIndex = songs.findIndex((item) => item.file === song.file);
    if (localIndex !== -1) playSound(localIndex);
    return;
  }

  if (song.type === "audius" && song.trackId) {
    audiusTracks = [
      {
        id: song.trackId,
        title: song.title,
        duration: song.duration,
        artwork: song.artwork,
        user: { name: song.artist || "Audius Artist" },
      },
    ];
    playAudiusTrack(0);
    return;
  }

  if (song.type === "youtube" && song.videoId) {
    playYouTube(song.videoId, song.title);
  }
}

function clearRecentSongs() {
  localStorage.removeItem(RECENT_SONGS_KEY);
  renderRecentSongs();
}

function renderZingChartPage() {
  loadVietnameseYouTubeChart();
}

function loadVietnameseYouTubeChart(forceReload) {
  const list = document.getElementById("zingChartList");
  if (!list) return;

  const cached = !forceReload ? readTimedCache(VIETNAMESE_CHART_CACHE_KEY, CACHE_7_DAYS) : null;
  if (cached && Array.isArray(cached.items) && cached.items.length) {
    localChartTracks = cached.items;
    renderVietnameseYouTubeChart(localChartTracks);
    return;
  }

  list.innerHTML = '<div class="artist-loading">Đang tải BXH nhạc Việt từ YouTube...</div>';

  fetchVietnameseYouTubeChart(VIETNAMESE_CHART_COUNT)
    .then((items) => {
      localChartTracks = items;
      writeTimedCache(VIETNAMESE_CHART_CACHE_KEY, { items });
      renderVietnameseYouTubeChart(localChartTracks);
    })
    .catch((error) => {
      console.error("Vietnamese YouTube chart failed:", error);
      list.innerHTML = `
        <div class="t100-error-box">
          <div class="t100-error-title">Không tải được BXH Music từ YouTube</div>
          <div class="t100-error-body">${error && error.message ? error.message : "Vui lòng kiểm tra kết nối mạng hoặc YouTube API key."}</div>
          <button class="t100-retry-btn" onclick="loadVietnameseYouTubeChart(true)">Thử lại</button>
        </div>
      `;
    });
}

function renderVietnameseYouTubeChart(items) {
  const list = document.getElementById("zingChartList");
  if (!list) return;

  if (!items || !items.length) {
    list.innerHTML = '<div class="artist-loading">Không tìm thấy BXH nhạc Việt từ YouTube.</div>';
    return;
  }

  list.innerHTML = items
    .map((song, i) => {
      const medal = getChartMedalClass(i);
      const image = song.thumb || getYouTubeVideoThumbUrl(song.videoId);
      const title = song.song || song.title || "Bài hát";
      const artist = song.artist || song.channelTitle || "YouTube";
      const views = song.viewCount ? `YouTube · ${formatViewCount(song.viewCount)}` : "YouTube";
      return `
        <div class="chart-row local-chart-row" onclick="playLocalChartTrack(${i})">
          <div class="chart-rank ${medal}">${i + 1}</div>
          <div class="chart-thumb">
            <img src="${image}" alt="${title}" />
            <span>&#9654;</span>
          </div>
          <div class="chart-info">
            <div class="chart-title">${title}</div>
            <div class="chart-artist">${artist} &middot; ${views}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function getUniqueSongs(source) {
  const seen = new Set();
  return source.filter((song) => {
    const key = normalizeSongIdentity(song.title, song.artist);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSongIdentity(title, artist) {
  return `${title || ""}|${artist || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getChartMedalClass(index) {
  if (index === 0) return "top-1";
  if (index === 1) return "top-2";
  if (index === 2) return "top-3";
  return "";
}

function fetchVietnameseYouTubeChart(limit) {
  const queries = [
    "nhạc việt official music video",
    "vpop official music video",
    "nhạc trẻ việt nam official mv",
    "vietnamese music official video",
    "bolero việt nam official music video",
  ];

  return promisePool(queries, 2, (query) => fetchYouTubeMostViewedVideos(query, 50).catch(() => []))
    .then((groups) => uniqueVideosById(groups.flat()))
    .then((items) => fetchYouTubeVideoStatistics(items))
    .then((videos) =>
      videos
        .map(normalizeVietnameseChartVideo)
        .filter(Boolean)
        .sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0))
        .slice(0, limit || VIETNAMESE_CHART_COUNT),
    );
}

function fetchYouTubeMostViewedVideos(query, totalResults) {
  const pageSize = Math.min(YOUTUBE_PAGE_SIZE, totalResults);
  const seenVideoIds = new Set();
  let items = [];

  const appendUniqueVideos = (sourceItems) => {
    (sourceItems || []).forEach((item) => {
      const videoId = item && item.id && item.id.videoId;
      if (!videoId || seenVideoIds.has(videoId)) return;
      seenVideoIds.add(videoId);
      items.push(item);
    });
  };

  const tryFetchWithKey = (keysLeft) => {
    if (keysLeft <= 0) return Promise.reject(new Error("Quota exceeded: tất cả API key đã hết quota!"));
    const apiUrl =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&order=viewCount&safeSearch=none&regionCode=VN&relevanceLanguage=vi` +
      `&q=${encodeURIComponent(query)}&key=${getYTApiKey()}`;

    const fetchPage = (pageToken) => {
      if (items.length >= totalResults) return Promise.resolve(items.slice(0, totalResults));
      const remaining = totalResults - items.length;
      const size = Math.min(pageSize, remaining);
      const tokenPart = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";

      return fetch(`${apiUrl}&maxResults=${size}${tokenPart}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            const msg = data.error.message || "YouTube API error";
            if (isYouTubeQuotaError(new Error(msg))) {
              rotateYTApiKey();
              items = [];
              seenVideoIds.clear();
              return tryFetchWithKey(keysLeft - 1);
            }
            throw new Error(msg);
          }

          appendUniqueVideos(data.items);
          if (!data.nextPageToken || items.length >= totalResults) return items.slice(0, totalResults);
          return fetchPage(data.nextPageToken);
        });
    };

    return fetchPage("");
  };

  return tryFetchWithKey(YT_API_KEYS.length);
}

function normalizeVietnameseChartVideo(video) {
  const snippet = video.snippet || {};
  const rawTitle = snippet.title || "";
  const title = cleanYouTubeTitle(rawTitle);
  const normalized = normalizeSearchText(`${rawTitle} ${snippet.channelTitle || ""}`);
  const blocked = /\b(karaoke|beat|instrumental|reaction|trailer|teaser|shorts?|livestream|live stream|phim|hai|hài|review|playlist|lien khuc|liên khúc|tuyen tap|tuyển tập)\b/i;

  if (!title || isPlaylistLikeVideoTitle(title) || blocked.test(normalized)) return null;

  const stats = video.statistics || {};
  const thumbs = snippet.thumbnails || {};
  const videoId = video.id;
  const viewCount = Number(stats.viewCount || 0);
  if (!videoId || viewCount <= 0) return null;

  const artist = extractArtistFromVideoTitle(title, snippet.channelTitle || "") || cleanupArtistName(snippet.channelTitle || "YouTube");
  const song = cleanupSongTitle(extractSongFromVideoTitle(title) || title);
  const thumb = (thumbs.high || thumbs.medium || thumbs.default || {}).url || getYouTubeVideoThumbUrl(videoId);
  const vietnameseSignal = /[à-ỹđ]/i.test(`${rawTitle} ${snippet.channelTitle || ""}`) || /\b(vpop|viet|vietnam|việt|nhạc)\b/i.test(`${rawTitle} ${snippet.channelTitle || ""}`);

  if (!vietnameseSignal || !song) return null;

  return {
    type: "youtube",
    artist,
    song,
    title: rawTitle,
    channelTitle: snippet.channelTitle || "YouTube",
    thumb,
    videoId,
    viewCount,
    publishedAt: snippet.publishedAt || "",
  };
}

function loadLocalMusic(forceReload) {
  const list = document.getElementById("zingChartList");

  return fetch("songs.json", { cache: forceReload ? "reload" : "default" })
    .then((response) => {
      if (!response.ok) throw new Error("Cannot load songs.json");
      return response.json();
    })
    .then((items) => {
      songs = Array.isArray(items) ? items.map((song) => ({ ...song, type: "local" })) : [];
      totalSongs = songs.length;
      renderFavoriteList();
      return songs;
    })
    .catch(() => {
      songs = [];
      totalSongs = 0;
      renderFavoriteList();
      return [];
    });
}

function loadLocalChart100(forceReload) {
  loadVietnameseYouTubeChart(forceReload);
}

function playLocalChartTrack(index) {
  const song = localChartTracks[index];
  if (!song) return;
  if (song.type === "youtube" && song.videoId) {
    currentAudioSource = "localChart";
    currentLocalChartIndex = index;
    playYouTube(song.videoId, song.title || song.song || "Bài hát");
    return;
  }
  const localIndex = songs.findIndex((item) => item.file === song.file);
  currentAudioSource = "localChart";
  currentLocalChartIndex = index;
  playSound(localIndex !== -1 ? localIndex : index);
  currentAudioSource = "localChart";
  currentLocalChartIndex = index;
}

function initializeLocalMusic() {
  renderFavoriteList();
  loadLocalMusic();
}

initializeLocalMusic();

const LOCAL_COVER_VERSION = "20260524";

function getSongDisplayImage(song, index) {
  if (song && song.image) return versionLocalCover(song.image);
  if (song && song.artwork) {
    const artwork = song.artwork;
    const artUrl = artwork["480x480"] || artwork["150x150"] || artwork["1000x1000"];
    if (artUrl) return artUrl;
  }

  const localImage = getLocalSongImage(song);
  if (localImage) return localImage;

  return buildSongPlaceholder(song && song.title ? song.title : "Music", index);
}

function versionLocalCover(image) {
  if (/^images\/covers\//i.test(image || "")) return `${image}?v=${LOCAL_COVER_VERSION}`;
  return image;
}

function getLocalSongImage(song) {
  if (!song || !song.file) return "";
  const fileName = song.file.replace("sounds/", "").replace(".mp3", ".jpg");
  if (/^x\d+\.jpg$/i.test(fileName)) return `images/${fileName}`;
  return "";
}

function buildSongPlaceholder(title, index) {
  const palettes = [
    ["#7c3aed", "#06b6d4"],
    ["#be123c", "#f97316"],
    ["#1d4ed8", "#22c55e"],
    ["#4338ca", "#ec4899"],
    ["#0f766e", "#facc15"],
  ];
  const pair = palettes[index % palettes.length];
  const letter = String(title || "M")
    .trim()[0]
    .toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop stop-color="${pair[0]}"/>
          <stop offset="1" stop-color="${pair[1]}"/>
        </linearGradient>
      </defs>
      <rect width="300" height="300" rx="34" fill="url(#g)"/>
      <circle cx="150" cy="150" r="62" fill="rgba(255,255,255,.16)"/>
      <text x="150" y="168" text-anchor="middle" fill="white" font-size="82" font-family="Arial, sans-serif" font-weight="800">${letter}</text>
    </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

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

// Tiết kiệm quota: hiện cache ngay, chỉ gọi YouTube API sau khi user ngừng gõ.
let searchDebounceTimer = null;
let lastSubmittedSearchQuery = "";

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
  clearTimeout(searchDebounceTimer);

  renderCachedYouTubeSearch(q);

  const list = document.getElementById("resultList");
  if (q.length < SEARCH_MIN_QUERY_LENGTH) {
    list.innerHTML = "";
    return;
  }

  if (!list.innerHTML.trim()) {
    list.innerHTML = '<div class="yt-loading">Đang tìm trên YouTube...</div>';
  }

  searchDebounceTimer = setTimeout(() => {
    searchYouTube(q);
  }, SEARCH_DEBOUNCE_DELAY);
});

// Nhấn Enter → tìm ngay, không chờ debounce
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const q = searchInput.value.trim().toLowerCase();
    clearTimeout(searchDebounceTimer);
    if (q.length < SEARCH_MIN_QUERY_LENGTH) return;
    searchYouTube(q);
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
  showSearchHistoryDropdown();
  showPage("favoritePage");
  setActive(document.querySelector(".sidebar-menu a:nth-child(2)"));
}

function searchLocalTracks(query, playFirst) {
  const list = document.getElementById("resultList");
  if (!list || !query) return;

  const normalizedQuery = normalizeSongIdentity(query, "");
  const results = songs
    .filter((song) => {
      const haystack = normalizeSongIdentity(song.title, song.artist);
      return haystack.includes(normalizedQuery);
    })
    .slice(0, 10);

  if (!results.length) {
    list.innerHTML = "";
    return;
  }

  localSearchResults = results;

  if (playFirst) {
    playLocalSearchResult(results[0]);
    return;
  }

  list.innerHTML = results
    .map(
      (track, i) => `
      <div class="search-item" onclick="playLocalSearchResult(localSearchResults[${i}])">
        <img src="${getSongDisplayImage(track, i)}" alt="${track.title}" style="border-radius:4px; width:42px; height:42px; object-fit:cover;" />
        <div class="search-item-info">
          <div class="search-item-title">${highlight(track.title, query)}</div>
          <div class="search-item-artist">Local &middot; ${track.artist}</div>
        </div>
      </div>
    `,
    )
    .join("");
}

function playLocalSearchResult(track) {
  if (!track) return;
  addToHistory(track.title);
  const localIndex = songs.findIndex((song) => song.file === track.file);
  playSound(localIndex !== -1 ? localIndex : 0);
  searchInput.value = "";
  searchClear.style.display = "none";
  showSearchHistoryDropdown();
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
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;
  if (searchHistory.length === 0) {
    list.innerHTML = `<div class="search-empty">${t("noHistory")}</div>`;
    return;
  }
  list.innerHTML = searchHistory
    .map(
      (h, index) => `
      <div class="search-history-item">
        <span onclick="searchHistoryItem(${index})">
          🕐 ${h}
        </span>
        <span class="history-delete" onclick="removeHistoryAt(${index}, event)">✕</span>
      </div>
    `,
    )
    .join("");
}

function searchHistoryItem(index) {
  const title = searchHistory[index];
  if (!title) return;
  searchInput.value = title;
  searchYouTube(title);
}

function removeHistoryAt(index, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  searchHistory.splice(index, 1);
  localStorage.setItem("searchHistory", JSON.stringify(searchHistory));
  renderHistory();
  document.getElementById("searchHistory").style.display = "block";
  document.getElementById("searchResults").style.display = "none";
  searchDropdown.style.display = "block";
  searchWrapper.classList.add("active");
  searchInput.focus();
}

function showSearchHistoryDropdown() {
  renderHistory();
  document.getElementById("searchHistory").style.display = "block";
  document.getElementById("searchResults").style.display = "none";
  searchDropdown.style.display = "block";
  searchWrapper.classList.add("active");
}

function getYouTubeSearchCacheKey(query) {
  return "yt_search_unfiltered_" + String(query || "").toLowerCase().trim();
}

function readYouTubeSearchCache(query) {
  const cacheKey = getYouTubeSearchCacheKey(query);
  const cached = localStorage.getItem(cacheKey);
  if (!cached) return null;

  try {
    const data = JSON.parse(cached);
    if (Date.now() - data.time < SEARCH_CACHE_MAX_AGE && data.html) return data;
  } catch (e) {}

  localStorage.removeItem(cacheKey);
  return null;
}

function renderCachedYouTubeSearch(query) {
  const cached = readYouTubeSearchCache(query);
  if (!cached) return false;

  document.getElementById("searchHistory").style.display = "none";
  document.getElementById("searchResults").style.display = "block";
  document.getElementById("resultList").innerHTML = cached.html;
  return true;
}

// ============================
// YOUTUBE DATA API
// - Search cache 30 ngày: cùng từ khóa không gọi lại API
// - Debounce khi gõ: chỉ gọi API sau khi user dừng nhập
// - Chặn query quá ngắn để tránh tốn quota vô ích
// → 10,000 quota/ngày là quá đủ
// ============================

// ============================
// YOUTUBE API KEY ROTATION
// 5 keys x 10,000 quota = 50,000 quota/ngày
// Tự động chuyển key khi hết quota (lỗi 429)
// ============================
const YT_API_KEYS = [
  "AIzaSyDruUxHeZt6G2Xnwje2E7_eeoQ_POfXdyQ", // Listen Music
  "AIzaSyCXqdLZe_Ar53g1Xa1jk7JC-A5mjPwP9Oc", // My First Project
  "AIzaSyD0EQ8BeBEa-PEbA8c45lMDTtY7Pf34fm4", // Listen Music 2
  "AIzaSyC2-0pM6OPR7z5GBjDvqz9QmO3aHhL4cGk", // Listen Music 3
  "AIzaSyAYJSC50Lav_8ItIc6LqQjIjCOXe6bZdzc", // Listen Music 4
];
let _ytKeyIndex = 0;
function getYTApiKey() {
  return YT_API_KEYS[_ytKeyIndex];
}
function rotateYTApiKey() {
  _ytKeyIndex = (_ytKeyIndex + 1) % YT_API_KEYS.length;
  console.warn(`[YouTube] Chuyển sang API key #${_ytKeyIndex + 1}`);
}
// Giữ tương thích với code cũ dùng YT_API_KEY
Object.defineProperty(window, "YT_API_KEY", { get: () => getYTApiKey() });
const ARTIST_RESULTS_COUNT = 50;
const AUDIUS_API_BASE = "https://discoveryprovider.audius.co/v1";
const AUDIUS_APP_NAME = "ListenMusic";
const INVIDIOUS_ENDPOINTS = ["https://yewtu.cafe", "https://yewtu.eu", "https://inv.nadeko.net", "https://vid.puffyan.us"];

let ytPlayer = null;
let ytReady = false;

function onYouTubeIframeAPIReady() {
  ytReady = true;
}

function fetchYouTubeVideos(query, totalResults) {
  return fetchFromAudiusPrimary(query, totalResults)
    .catch((error) => {
      console.warn("Audius API failed:", error);
      return fetchYouTubeVideosWithFallback(query, totalResults);
    })
    .catch((error) => {
      console.warn("YouTube/Invidious API failed:", error);
      return fetchYouTubeVideosFallback(query, totalResults);
    });
}

function fetchYouTubeVideosWithFallback(query, totalResults) {
  return fetchYouTubeVideosFromDataApi(query, totalResults).catch((error) => {
    if (!isYouTubeQuotaError(error)) throw error;
    console.warn("YouTube quota exceeded. Switching to Invidious search:", error);
    return fetchYouTubeVideosFallback(query, totalResults);
  });
}

function isYouTubeQuotaError(error) {
  const message = String((error && error.message) || error || "").toLowerCase();
  return message.includes("quota") || message.includes("daily limit") || message.includes("search queries");
}

function fetchFromAudiusPrimary(query, totalResults) {
  const url = `${AUDIUS_API_BASE}/tracks/search?query=${encodeURIComponent(query)}&limit=${totalResults}&app_name=${encodeURIComponent(AUDIUS_APP_NAME)}`;
  return fetch(url)
    .then((r) => r.json())
    .then((data) => {
      const tracks = (data.data || []).slice(0, totalResults);
      if (tracks.length === 0) throw new Error("Audius returned 0 tracks");

      return tracks.map((track) => {
        const artwork = track.artwork || {};
        const thumb = artwork["480x480"] || artwork["1000x1000"] || artwork["150x150"] || "";
        return {
          id: { videoId: track.id },
          snippet: {
            title: track.title || "(Không có tiêu đề)",
            channelTitle: (track.user && track.user.name) || "Audius Artist",
            thumbnails: { medium: { url: thumb } },
          },
          isAudius: true,
          audiusTrack: track,
        };
      });
    });
}

function fetchYouTubeVideosFromDataApi(query, totalResults) {
  const pageSize = Math.min(YOUTUBE_PAGE_SIZE, totalResults);
  const seenVideoIds = new Set();
  let items = [];

  const appendUniqueVideos = (sourceItems) => {
    (sourceItems || []).forEach((item) => {
      const videoId = item && item.id && item.id.videoId;
      if (!videoId || seenVideoIds.has(videoId)) return;
      seenVideoIds.add(videoId);
      items.push(item);
    });
  };

  const tryFetchWithKey = (keysLeft) => {
    if (keysLeft <= 0) return Promise.reject(new Error("Quota exceeded: tất cả API key đã hết quota!"));
    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=relevance&safeSearch=none&q=${encodeURIComponent(query)}&key=${getYTApiKey()}`;

    return fetch(`${apiUrl}&maxResults=${pageSize}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          const msg = data.error.message || "YouTube API error";
          if (isYouTubeQuotaError(new Error(msg))) {
            rotateYTApiKey();
            items = [];
            seenVideoIds.clear();
            return tryFetchWithKey(keysLeft - 1);
          }
          throw new Error(msg);
        }

        appendUniqueVideos(data.items);

        const fetchNextPage = (nextPageToken) => {
          if (items.length >= totalResults || !nextPageToken) {
            return Promise.resolve(items.slice(0, totalResults));
          }
          const remaining = totalResults - items.length;
          const nextPageSize = Math.min(YOUTUBE_PAGE_SIZE, remaining);
          const nextApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=relevance&safeSearch=none&q=${encodeURIComponent(query)}&key=${getYTApiKey()}`;
          return fetch(`${nextApiUrl}&maxResults=${nextPageSize}&pageToken=${encodeURIComponent(nextPageToken)}`)
            .then((r) => r.json())
            .then((nextData) => {
              if (nextData.error) throw new Error(nextData.error.message || "YouTube API error");
              appendUniqueVideos(nextData.items);
              return fetchNextPage(nextData.nextPageToken);
            });
        };

        return fetchNextPage(data.nextPageToken);
      });
  };

  return tryFetchWithKey(YT_API_KEYS.length);
}

function fetchInvidiousVideoDetails(videoId) {
  const tryEndpoint = (index) => {
    if (index >= INVIDIOUS_ENDPOINTS.length) {
      return Promise.reject(new Error("Không lấy được thông tin video từ Invidious."));
    }

    return fetch(`${INVIDIOUS_ENDPOINTS[index]}/api/v1/videos/${encodeURIComponent(videoId)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Invidious video endpoint failed");
        return r.json();
      })
      .then((data) => ({
        id: videoId,
        snippet: {
          title: data.title || "",
          channelTitle: data.author || "",
          thumbnails: { medium: { url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` } },
        },
        statistics: { viewCount: Number(data.viewCount || 0) },
        invidious: { viewCount: Number(data.viewCount || 0) },
      }))
      .catch((error) => {
        console.warn(`Invidious video endpoint ${INVIDIOUS_ENDPOINTS[index]} failed:`, error);
        return tryEndpoint(index + 1);
      });
  };

  return tryEndpoint(0);
}

function fetchYouTubeVideosFallback(query, totalResults) {
  const endpoints = INVIDIOUS_ENDPOINTS.map((base) => `${base}/api/v1/search?q=`);

  const parseFallbackResponse = (data) => {
    let rawItems = [];
    if (Array.isArray(data)) rawItems = data;
    else if (data.videos) rawItems = data.videos;
    else if (data.results) rawItems = data.results;
    else if (data.contents) rawItems = data.contents;
    else if (data.data && Array.isArray(data.data)) rawItems = data.data;

    return rawItems
      .map((item) => {
        const videoId = item.videoId || (item.id && item.id.videoId) || item.id || "";
        const title = item.title || item.name || item.videoTitle || "(Không có tiêu đề)";
        const channelTitle = item.author || item.uploader || item.channel || item.channelTitle || "YouTube";
        const thumb = item.thumbnail || item.thumbnailUrl || (item.thumbnails && item.thumbnails.medium && item.thumbnails.medium.url) || (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : "");
        return {
          id: { videoId },
          snippet: {
            title,
            channelTitle,
            thumbnails: { medium: { url: thumb } },
          },
          invidious: {
            viewCount: Number(item.viewCount || item.view_count || item.views || 0),
            published: item.publishedText || item.published || "",
          },
        };
      })
      .filter((item) => item.id.videoId)
      .slice(0, totalResults);
  };

  const tryEndpoint = (index) => {
    if (index >= endpoints.length) {
      return Promise.reject(new Error("Không tìm được endpoint fallback YouTube phù hợp."));
    }
    const url = `${endpoints[index]}${encodeURIComponent(query)}`;
    return fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const items = parseFallbackResponse(data);
        if (!items.length) {
          throw new Error("Fallback YouTube endpoint trả về 0 kết quả");
        }
        return items;
      })
      .catch((error) => {
        console.warn(`Fallback endpoint ${endpoints[index]} failed:`, error);
        return tryEndpoint(index + 1);
      });
  };

  return tryEndpoint(0);
}

function fetchAudiusTracks(query, totalResults) {
  const url = `${AUDIUS_API_BASE}/tracks/search?query=${encodeURIComponent(query)}&limit=${totalResults}&app_name=${encodeURIComponent(AUDIUS_APP_NAME)}`;

  return fetch(url)
    .then((r) => r.json())
    .then((data) => {
      if (data.error) throw new Error(data.error.message || "Audius API error");
      return (data.data || []).slice(0, totalResults).map(normalizeAudiusTrack);
    });
}

function normalizeAudiusTrack(track) {
  return {
    id: track.id,
    title: track.title,
    duration: track.duration,
    artwork: track.artwork,
    user: track.user ? { name: track.user.name } : null,
  };
}

function getAudiusArtwork(track) {
  const artwork = track.artwork || {};
  return artwork["480x480"] || artwork["150x150"] || artwork["1000x1000"] || "images/dis1.jpg";
}

function getAudiusArtist(track) {
  return track.user && track.user.name ? track.user.name : "Audius Artist";
}

function getAudiusStreamUrl(trackId) {
  return `${AUDIUS_API_BASE}/tracks/${encodeURIComponent(trackId)}/stream?app_name=${encodeURIComponent(AUDIUS_APP_NAME)}`;
}

function getAudiusTopicQuery(topicName, fallbackQuery) {
  const topicQueries = {
    Bolero: "acoustic latin love",
    Remix: "remix electronic dance",
    "V-Rap": "hip hop rap",
    "Pop Ballad": "pop ballad",
    Pop: "pop music",
    TikTok: "viral trending",
    Sad: "sad emotional",
    "K-Pop": "kpop pop",
    Chill: "chill lofi",
    Summer: "summer dance",
    "Nhạc Trẻ Ballad": "pop ballad love",
    "V-Pop Gây Bão": "pop trending",
    "Remix Thịnh Hành": "remix trending electronic",
    "Rap Việt Hot": "hip hop rap trending",
  };

  return topicQueries[topicName] || fallbackQuery;
}

function getExploreTopicQuery(topicName, fallbackQuery) {
  const topicQueries = {
    Bolero: "bolero nhạc vàng việt nam official audio",
    Remix: "nhạc remix việt nam vinahouse tiktok official",
    "V-Rap": "rap việt nam hieuthuhai mck đen low g official",
    "Pop Ballad": "pop ballad việt nam nhạc trẻ ballad official",
    Pop: "vpop nhạc pop việt nam hits official mv",
    TikTok: "nhạc tiktok việt nam trending official",
    Sad: "nhạc buồn việt nam tâm trạng ballad official",
    "K-Pop": "kpop hits official music video",
    Chill: "nhạc chill việt nam lofi acoustic official",
    Summer: "nhạc mùa hè việt nam sôi động official",
    "Nhạc Trẻ Ballad": "nhạc trẻ ballad việt nam hay nhất official",
    "V-Pop Gây Bão": "vpop việt nam trending hits official mv",
    "Remix Thịnh Hành": "nhạc remix việt nam thịnh hành vinahouse official",
    "Rap Việt Hot": "rap việt hot việt nam official mv",
  };

  return topicQueries[topicName] || `${fallbackQuery} việt nam official music`;
}

// ============================
// OPEN TOPIC (cache 7 ngày)
// ============================

function openTopic(topicName, query) {
  showPage("youtubePage");
  document.getElementById("youtubePageTitle").textContent = "🎧 " + topicName + " · YouTube";

  const youtubeQuery = getExploreTopicQuery(topicName, query);
  const cacheKey = "yt_explore_topic_v2_" + youtubeQuery.toLowerCase().trim();
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

  document.getElementById("youtubeList").innerHTML = "";

  fetchYouTubeVideosWithFallback(youtubeQuery, EXPLORE_TOPIC_RESULTS_COUNT)
    .then((items) => {
      if (!items || items.length === 0) {
        document.getElementById("youtubeList").innerHTML = '<div class="yt-loading">Không tìm thấy bài hát phù hợp trên YouTube.</div>';
        return;
      }
      const html = renderYouTubeList(items);
      localStorage.setItem(cacheKey, JSON.stringify({ html, time: Date.now() }));
    })
    .catch((error) => {
      console.error("Explore topic fetch error:", error);
      document.getElementById("youtubeList").innerHTML = `
        <div class="t100-error-box">
          <div class="t100-error-icon">❌</div>
          <div class="t100-error-title">Không tải được danh sách từ YouTube</div>
          <div class="t100-error-body">
            ${error && error.message ? error.message : "Vui lòng kiểm tra kết nối mạng hoặc YouTube API key."}
          </div>
          <button class="t100-retry-btn" onclick="openTopic('${topicName.replace(/'/g, "\\'")}', '${query.replace(/'/g, "\\'")}')">Thử lại</button>
        </div>
      `;
    });
}

function renderAudiusList(tracks) {
  const list = document.getElementById("youtubeList");
  audiusTracks = tracks;
  currentAudiusIndex = -1;

  const html = tracks
    .map((track, i) => {
      const title = track.title || "Untitled";
      const artist = getAudiusArtist(track);
      const thumb = getAudiusArtwork(track);
      const duration = track.duration ? formatTime(track.duration) : "";
      return `
        <div class="yt-song-item audius-song-item" onclick="playAudiusTrack(${i})">
          <div class="yt-song-num">${i + 1}</div>
          <div class="yt-song-thumb audius-song-thumb">
            <img src="${thumb}" alt="${title}" />
            <span class="yt-play-icon">▶</span>
          </div>
          <div class="yt-song-info">
            <div class="yt-song-title">${title}</div>
            <div class="yt-song-channel">🎧 Audius · ${artist}${duration ? " · " + duration : ""}</div>
          </div>
        </div>
      `;
    })
    .join("");

  list.innerHTML = html;
  return html;
}

function playAudiusTrack(index) {
  const track = audiusTracks[index];
  if (!track || !track.id) return;

  if (ytPlayer) {
    ytPlayer.stopVideo();
  }
  document.getElementById("ytPlayerModal").style.display = "none";

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.onended = null;
    currentAudio.ontimeupdate = null;
  }

  currentAudioSource = "audius";
  currentAudiusIndex = index;
  recordListeningHistory({
    type: "audius",
    title: track.title || "Untitled",
    artist: getAudiusArtist(track),
    image: getAudiusArtwork(track),
    artwork: track.artwork,
    trackId: track.id,
    duration: track.duration,
  });
  currentAudio = new Audio(getAudiusStreamUrl(track.id));
  currentAudio.ontimeupdate = updateProgress;
  currentAudio.onended = function () {
    if (currentAudiusIndex + 1 < audiusTracks.length) {
      playAudiusTrack(currentAudiusIndex + 1);
    } else {
      setPlayPauseIcon(false);
    }
  };

  currentAudio.play();
  document.querySelector(".player-bar").classList.add("active");
  setPlayPauseIcon(true);
  updateAudiusPlayingState();
}

function updateAudiusPlayingState() {
  document.querySelectorAll(".audius-song-item").forEach((item, i) => {
    item.classList.toggle("is-playing", i === currentAudiusIndex);
  });
}

function renderYouTubeList(items) {
  const list = document.getElementById("youtubeList");

  if (!items || items.length === 0) {
    list.innerHTML = '<div class="yt-loading">Không tìm thấy bài hát.</div>';
    return "";
  }

  const html = items
    .map((item, i) => {
      const title = item.snippet.title;
      const channel = item.snippet.channelTitle;
      const thumb = item.snippet.thumbnails.medium.url || "";

      if (item.isAudius) {
        return `
          <div class="yt-song-item audius-song-item" onclick="playAudiusTrack(${i})">
            <div class="yt-song-num">${i + 1}</div>
            <div class="yt-song-thumb audius-song-thumb">
              <img src="${thumb}" alt="${title}" />
              <span class="yt-play-icon">▶</span>
            </div>
            <div class="yt-song-info">
              <div class="yt-song-title">${title}</div>
              <div class="yt-song-channel">🎧 Audius · ${channel}</div>
            </div>
          </div>
        `;
      } else {
        const vid = item.id.videoId;
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
      }
    })
    .join("");

  list.innerHTML = html;

  if (items.some((item) => item.isAudius)) {
    audiusTracks = items.filter((item) => item.isAudius).map((item) => item.audiusTrack);
  }

  return html;
}

// ============================
// SEARCH YOUTUBE (cache 7 ngày)
// ============================

// ============================
// ARTIST PAGE
// ============================

let selectedArtistMonth = 5;
let artistPageLoadedKey = "";
let monthlyArtistItems = [];
let artistYoutubeSearchCompleted = false;
let artistAdIndex = 0;
let artistAdTimer = null;
let currentArtistSongsName = "";
const ARTIST_PAGE_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
const GENERIC_MUSIC_CHANNEL_PATTERNS = /(top|bxh|bảng xếp hạng|nonstop|vinahouse|remix|playlist|tiktok|nhạc trẻ|nhac tre|music|media|records|entertainment|network|channel|karaoke|lyrics|cover|ost|mix|best of|hay nhất|hot nhất|2025|2026)/i;
const NON_ARTIST_TITLE_PATTERNS = /(nonstop|top\s*\d*|bxh|bảng xếp hạng|playlist|liên khúc|tuyển tập|nhạc remix|remix hay nhất|bay phòng|vinahouse|edm|bass cực mạnh|chuẩn trend|hot tiktok|nhạc trẻ remix|best of|full album)/i;
const ARTIST_AD_REFRESH_DELAY = 5000;
const ARTIST_ADS = [
  {
    kicker: "LISTEN VIP",
    title: "Âm nhạc chất lượng cao mỗi ngày",
    body: "Nâng cấp trải nghiệm nghe nhạc với playlist cá nhân, âm thanh rõ hơn và ít gián đoạn hơn.",
    buttonText: "Vào VIP Center",
    bgImage: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1800&q=90",
    action: function () {
      showPage("vipPage");
    },
  },
  {
    kicker: "PLAYLIST MỚI",
    title: "Khám phá V-Pop đang được nghe nhiều",
    body: "Từ ballad, remix đến rap Việt, mở nhanh những giai điệu hợp tâm trạng hôm nay.",
    buttonText: "Nghe ngay",
    bgImage: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1800&q=90",
    action: function () {
      openTop100("Nhạc Trẻ", "nhạc trẻ việt nam hay nhất");
    },
  },
  {
    kicker: "REMIX HOT",
    title: "Bắt nhịp những bản remix sôi động",
    body: "Không khí sân khấu, beat mạnh và danh sách nhạc đổi mood thật nhanh.",
    buttonText: "Mở remix",
    bgImage: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1800&q=90",
    action: function () {
      openTopic("Remix", "nhạc remix việt nam hay nhất");
    },
  },
  {
    kicker: "CA SĨ NỔI BẬT",
    title: "Theo dõi nghệ sĩ bạn yêu thích",
    body: "Danh sách ca sĩ được sắp xếp gọn gàng để bạn tìm và nghe nhanh hơn.",
    buttonText: "Xem danh sách",
    bgImage: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1800&q=90",
    action: function () {
      showPage("artistPage");
    },
  },
  {
    kicker: "LỊCH SỬ NGHE",
    title: "Quay lại bài vừa nghe chỉ trong một chạm",
    body: "Lưu những bài gần đây để không bỏ lỡ giai điệu đang vương trong đầu.",
    buttonText: "Bài gần đây",
    bgImage: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1800&q=90",
    action: function () {
      showPage("recentPage");
    },
  },
];
const MUSIC_SOURCE_ARTISTS = [
  { artist: "Sơn Tùng M-TP", source: "Danh sách ca sĩ" },
  { artist: "Mỹ Tâm", source: "Danh sách ca sĩ", photo: "https://commons.wikimedia.org/wiki/Special:Redirect/file/MyTam.png?width=600" },
  { artist: "Hà Anh Tuấn", source: "Danh sách ca sĩ" },
  { artist: "Đàm Vĩnh Hưng", source: "Danh sách ca sĩ" },
  { artist: "Hồ Ngọc Hà", source: "Danh sách ca sĩ" },
  { artist: "Noo Phước Thịnh", source: "Danh sách ca sĩ" },
  { artist: "Bích Phương", source: "Danh sách ca sĩ" },
  { artist: "Tóc Tiên", source: "Danh sách ca sĩ" },
  { artist: "Jack (J97)", source: "Danh sách ca sĩ" },
  { artist: "Hoàng Thùy Linh", source: "Danh sách ca sĩ" },
  { artist: "Erik", source: "Danh sách ca sĩ" },
  { artist: "Min", source: "Danh sách ca sĩ" },
  { artist: "Karik", source: "Danh sách ca sĩ" },
  { artist: "Đen Vâu", source: "Danh sách ca sĩ" },
  { artist: "Rhymastic", source: "Danh sách ca sĩ" },
  { artist: "Wren Evans", source: "Danh sách ca sĩ" },
  { artist: "tlinh", source: "Danh sách ca sĩ" },
  { artist: "Hieuthuhai", source: "Danh sách ca sĩ" },
  { artist: "Mono", source: "Danh sách ca sĩ" },
  { artist: "Obito", source: "Danh sách ca sĩ" },
  { artist: "Low G", source: "Danh sách ca sĩ" },
  { artist: "Tăng Duy Tân", source: "Danh sách ca sĩ" },
  { artist: "Dương Domic", source: "Danh sách ca sĩ" },
  { artist: "Juky San", source: "Danh sách ca sĩ" },
  { artist: "Quang Hùng MasterD", source: "Danh sách ca sĩ" },
  { artist: "Vũ Cát Tường", source: "Danh sách ca sĩ" },
  { artist: "Văn Mai Hương", source: "Danh sách ca sĩ" },
  { artist: "Ái Phương", source: "Danh sách ca sĩ" },
  { artist: "Trịnh Thăng Bình", source: "Danh sách ca sĩ" },
  { artist: "Bảo Anh", source: "Danh sách ca sĩ" },
  { artist: "Thanh Bùi", source: "Danh sách ca sĩ" },
  { artist: "Phương Ly", source: "Danh sách ca sĩ", photo: "https://commons.wikimedia.org/wiki/Special:Redirect/file/PH%C6%AF%C6%A0NG%20LY%20-%202020.11.11%20-%20P1%20%28cropped%29.png?width=600" },
  { artist: "Tiên Cookie", source: "Danh sách ca sĩ" },
  { artist: "Châu Khải Phong", source: "Danh sách ca sĩ" },
  { artist: "Lê Bảo Bình", source: "Danh sách ca sĩ" },
  { artist: "Ngọc Sơn", source: "Danh sách ca sĩ", photo: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Ng%E1%BB%8Dc%20S%C6%A1n.png?width=600" },
  { artist: "Quang Lê", source: "Danh sách ca sĩ" },
  { artist: "Phi Nhung", source: "Danh sách ca sĩ" },
  { artist: "Như Quỳnh", source: "Danh sách ca sĩ" },
  { artist: "Tuấn Vũ", source: "Danh sách ca sĩ" },
  { artist: "Chế Linh", source: "Danh sách ca sĩ" },
  { artist: "Hương Lan", source: "Danh sách ca sĩ" },
  { artist: "Khánh Ly", source: "Danh sách ca sĩ" },
  { artist: "Lam Trường", source: "Danh sách ca sĩ" },
  { artist: "Mỹ Linh", source: "Danh sách ca sĩ" },
  { artist: "Thanh Lam", source: "Danh sách ca sĩ" },
  { artist: "Hồng Nhung", source: "Danh sách ca sĩ" },
  { artist: "Tuấn Ngọc", source: "Danh sách ca sĩ" },
  { artist: "Trấn Thành", source: "Danh sách ca sĩ" },
  { artist: "Lệ Quyên", source: "Danh sách ca sĩ" },
];

function getArtistMonth() {
  return 5;
}

function getArtistPeriod(month) {
  const year = new Date().getFullYear();
  return {
    month: 5,
    year,
    key: `${year}_05`,
    label: `Tháng 5/${year}`,
  };
}

function setArtistActiveMonth(month) {
  document.querySelectorAll(".artist-month-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.textContent.trim() === `Tháng ${month}`);
  });
}

function getArtistCacheKey(month, type) {
  const period = getArtistPeriod(month);
  return `artist_page_${type}_${period.key}`;
}

function readTimedCache(key, maxAge) {
  const cached = localStorage.getItem(key);
  if (!cached) return null;

  try {
    const payload = JSON.parse(cached);
    if (Date.now() - payload.time < maxAge) return payload.data;
  } catch (e) {}

  localStorage.removeItem(key);
  return null;
}

function writeTimedCache(key, data) {
  localStorage.setItem(key, JSON.stringify({ data, time: Date.now() }));
}

function openArtistMonth(month) {
  selectedArtistMonth = 5;
  artistPageLoadedKey = "";
  loadArtistPage(true);
}

function loadArtistPage(forceReload) {
  const artistPage = document.getElementById("artistPage");
  if (!artistPage) return;

  const month = 5;
  const period = getArtistPeriod(month);
  if (!forceReload && artistPageLoadedKey === period.key) return;
  artistPageLoadedKey = period.key;
  artistYoutubeSearchCompleted = false;

  setArtistActiveMonth(month);
  initArtistAdRotation();
  document.getElementById("artistRankingList").innerHTML = '<div class="artist-loading">Đang tải danh sách ca sĩ...</div>';

  loadMayYouTubeArtists(forceReload);
}

function initArtistAdRotation() {
  renderArtistAd(artistAdIndex);
  scheduleArtistAdRefresh();
}

function changeArtistAd(direction) {
  artistAdIndex = (artistAdIndex + direction + ARTIST_ADS.length) % ARTIST_ADS.length;
  renderArtistAd(artistAdIndex);
  scheduleArtistAdRefresh();
}

function scheduleArtistAdRefresh() {
  clearInterval(artistAdTimer);
  artistAdTimer = setInterval(() => {
    artistAdIndex = (artistAdIndex + 1) % ARTIST_ADS.length;
    renderArtistAd(artistAdIndex);
  }, ARTIST_AD_REFRESH_DELAY);
}

function closeArtistAd() {
  const banner = document.getElementById("artistAdBanner");
  if (!banner) return;

  banner.style.display = "none";
  clearInterval(artistAdTimer);
  artistAdTimer = setTimeout(() => {
    artistAdIndex = (artistAdIndex + 1) % ARTIST_ADS.length;
    renderArtistAd(artistAdIndex);
    banner.style.display = "flex";
    scheduleArtistAdRefresh();
  }, ARTIST_AD_REFRESH_DELAY);
}

function renderArtistAd(index) {
  const ad = ARTIST_ADS[index];
  const banner = document.getElementById("artistAdBanner");
  if (!ad || !banner) return;

  banner.style.backgroundImage = `linear-gradient(100deg, rgba(19, 13, 43, 0.92), rgba(76, 29, 149, 0.72), rgba(8, 47, 73, 0.7)), url('${ad.bgImage}')`;

  const kicker = document.getElementById("artistAdKicker");
  const title = document.getElementById("artistAdTitle");
  const body = document.getElementById("artistAdBody");
  const button = document.getElementById("artistAdButton");
  const dots = document.getElementById("artistAdDots");

  if (kicker) kicker.textContent = ad.kicker;
  if (title) title.textContent = ad.title;
  if (body) body.textContent = ad.body;
  if (button) {
    button.textContent = ad.buttonText;
    button.onclick = function (event) {
      event.preventDefault();
      ad.action();
    };
  }
  if (dots) {
    dots.innerHTML = ARTIST_ADS.map((_, dotIndex) => `<span class="${dotIndex === index ? "active" : ""}"></span>`).join("");
  }
}

function loadMayYouTubeArtists(forceReload) {
  monthlyArtistItems = getMusicSourceArtistSeeds();
  artistYoutubeSearchCompleted = true;
  renderArtistRanking(monthlyArtistItems);
  loadArtistPhotos();
}

function getRealSingerArtistItems() {
  return mergeArtistItems(getMusicSourceArtistSeeds(), getLocalArtistItems());
}

function getMusicSourceArtistSeeds() {
  return MUSIC_SOURCE_ARTISTS.map((item, index) => ({ ...item, sourceRank: index + 1 }));
}

function hasResolvedMaySong(item) {
  return !!(item && item.artist && item.song && item.song !== "Đang tìm bài hát tháng 5" && (item.videoId || item.viewCount || item.localFile));
}

function countResolvedMaySongs(items) {
  return (items || []).filter(hasResolvedMaySong).length;
}

function mergeArtistResultsWithSeeds(results, seeds) {
  const resultByArtist = new Map();
  (results || []).filter(hasResolvedMaySong).forEach((item) => {
    const key = normalizeSongIdentity(item.artist, item.song);
    const current = resultByArtist.get(key);
    if (!current || Number(item.viewCount || 0) > Number(current.viewCount || 0)) {
      resultByArtist.set(key, item);
    }
  });

  const merged = (seeds || []).slice(0, 50).map((seed, index) => {
    const key = normalizeSongIdentity(seed.artist, seed.song);
    const result = resultByArtist.get(key);
    return result ? { ...seed, ...result, sourceRank: index + 1 } : { ...seed, sourceRank: index + 1 };
  });

  return merged.sort((a, b) => Number(a.sourceRank || 999) - Number(b.sourceRank || 999));
}

function getLocalArtistItems() {
  return songs
    .map((song) => {
      const artist = getPrimaryLocalArtist(song.artist);
      if (!artist || shouldExcludeArtistName(artist)) return null;
      return {
        artist,
        song: song.title,
        thumb: song.image || "",
        localFile: song.file || "",
      };
    })
    .filter(Boolean);
}

function getPrimaryLocalArtist(artistText) {
  return String(artistText || "")
    .split(/\s*(?:,|;|&|\band\b|\bft\.?\b|\bfeat\.?\b|\bx\b)\s*/i)
    .map((name) => cleanupArtistName(name))
    .find((name) => name && isLikelyRealArtistName(name)) || "";
}

function shouldExcludeArtistName(name) {
  const value = cleanupArtistName(name);
  return !value || GENERIC_MUSIC_CHANNEL_PATTERNS.test(value) || /(^|\s)(dj|remix|producer)(\s|$)/i.test(value);
}

function mergeArtistItems() {
  const seen = new Set();
  const merged = [];
  Array.from(arguments)
    .flat()
    .forEach((item) => {
      if (!item || shouldExcludeArtistName(item.artist)) return;
      const key = normalizeSongIdentity(item.artist, "");
      if (!key) return;
      if (seen.has(key)) {
        const existing = merged.find((artistItem) => normalizeSongIdentity(artistItem.artist, "") === key);
        if (existing) {
          Object.keys(item).forEach((prop) => {
            if (existing[prop] === undefined || existing[prop] === null || existing[prop] === "") existing[prop] = item[prop];
          });
        }
        return;
      }
      seen.add(key);
      merged.push({ ...item });
    });
  return merged;
}

function renderArtistRanking(artists) {
  const list = document.getElementById("artistRankingList");
  if (!artists || artists.length === 0) {
    list.innerHTML = '<div class="artist-loading">Chưa tìm thấy ca sĩ có bài hát tháng 5 phù hợp.</div>';
    return;
  }

  list.innerHTML = artists
    .map((artist, i) => {
      const photo = getArtistPhoto(artist, i);
      const meta = hasResolvedMaySong(artist)
        ? `Bài nổi bật: ${artist.song}${artist.viewCount ? " · " + formatViewCount(artist.viewCount) : ""}`
        : "";
      return `
        <div class="artist-row" onclick="openArtistSongs(${i})">
          <div class="artist-rank">${i + 1}</div>
          <img class="artist-avatar" data-artist-photo="${i}" src="${photo}" alt="${artist.artist}" />
          <div class="artist-info">
            <div class="artist-name">${artist.artist}</div>
            ${meta ? `<div class="artist-meta">${meta}</div>` : ""}
          </div>
        </div>
      `;
    })
    .join("");
}

function openArtistSongs(index) {
  const artist = (monthlyArtistItems.length ? monthlyArtistItems : getMusicSourceArtistSeeds())[index];
  if (!artist) return;

  const artistName = artist.artist || "";
  currentArtistSongsName = artistName;
  const title = document.getElementById("artistSongsTitle");
  const list = document.getElementById("artistSongsList");

  showPage("artistSongsPage");
  if (title) title.textContent = `Bài hát của ${artistName}`;
  if (list) list.innerHTML = '<div class="yt-loading">🎵 Đang tải bài hát từ YouTube...</div>';

  loadArtistSongsFromYouTube(artistName);
}

function loadArtistSongsFromYouTube(artistName, forceReload) {
  const list = document.getElementById("artistSongsList");
  currentArtistSongsName = artistName;
  const cacheKey =
    "yt_artist_songs_" +
    artistName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_");

  if (forceReload) localStorage.removeItem(cacheKey);

  const cached = !forceReload ? readTimedCache(cacheKey, CACHE_7_DAYS) : null;
  if (cached && cached.html) {
    if (list) list.innerHTML = cached.html;
    return;
  }

  fetchArtistYouTubeCandidates(artistName)
    .then((items) => {
      const matched = filterArtistSongVideos(items, artistName, 30);
      if (!matched.length) {
        if (list) list.innerHTML = '<div class="yt-loading">Không tìm thấy bài hát phù hợp cho ca sĩ này.</div>';
        return;
      }

      const html = renderArtistSongsList(matched);
      writeTimedCache(cacheKey, { html });
    })
    .catch((error) => {
      console.error("Artist song fetch error:", error);
      if (list) {
        list.innerHTML = `
          <div class="t100-error-box">
            <div class="t100-error-icon">❌</div>
            <div class="t100-error-title">Không tải được bài hát từ YouTube</div>
            <div class="t100-error-body">${error && error.message ? error.message : "Vui lòng kiểm tra API key hoặc kết nối mạng."}</div>
            <button class="t100-retry-btn" onclick="loadArtistSongsFromYouTube('${artistName.replace(/'/g, "\\'")}')">Thử lại</button>
          </div>
        `;
      }
    });
}

function refreshCurrentArtistSongs() {
  if (!currentArtistSongsName) return;
  const list = document.getElementById("artistSongsList");
  if (list) list.innerHTML = '<div class="yt-loading">🔄 Đang refresh bài hát từ YouTube...</div>';
  loadArtistSongsFromYouTube(currentArtistSongsName, true);
}

function fetchArtistYouTubeCandidates(artistName) {
  const queries = [
    `${artistName} official music video`,
    `${artistName} official audio`,
    `${artistName} live`,
    `${artistName} lyric video`,
    `${artistName} album`,
  ];

  return promisePool(queries, 2, (query) => fetchYouTubeVideosWithFallback(query, 20).catch(() => []))
    .then((groups) => uniqueVideosById(groups.flat()));
}

function filterArtistSongVideos(items, artistName, limit) {
  const artistKey = normalizeSearchText(artistName);
  const aliases = getArtistAliases(artistName).map(normalizeSearchText);
  const source = (items || []).filter((item) => {
    const title = item && item.snippet && item.snippet.title ? item.snippet.title : "";
    return title && !isPlaylistLikeVideoTitle(title) && !/\b(karaoke|beat|instrumental|reaction|cover|shorts?|live\s*stream)\b/i.test(title);
  });

  const artistMatches = source.filter((item) => {
    const title = item && item.snippet && item.snippet.title ? item.snippet.title : "";
    const channel = item && item.snippet && item.snippet.channelTitle ? item.snippet.channelTitle : "";
    const haystack = normalizeSearchText(`${title} ${channel}`);
    return aliases.some((alias) => alias && haystack.includes(alias)) || (artistKey && haystack.includes(artistKey));
  });

  return uniqueVideosById(artistMatches).slice(0, limit || 30);
}

function uniqueVideosById(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const videoId = item && item.id && item.id.videoId;
    if (!videoId || seen.has(videoId)) return false;
    seen.add(videoId);
    return true;
  });
}

function renderArtistSongsList(items) {
  const list = document.getElementById("artistSongsList");
  if (!list) return "";

  const html = items
    .map((item, i) => {
      const title = item.snippet.title || "Bài hát";
      const channel = item.snippet.channelTitle || "YouTube";
      const videoId = item.id && item.id.videoId;
      const thumbs = item.snippet.thumbnails || {};
      const thumb = (thumbs.medium || thumbs.high || thumbs.default || {}).url || (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : "");

      return `
        <div class="yt-song-item" onclick="playYouTube('${videoId}', \`${title.replace(/`/g, "'")}\`)">
          <div class="yt-song-num">${i + 1}</div>
          <div class="yt-song-thumb">
            <img src="${thumb}" alt="${title}" />
            <span class="yt-play-icon">▶</span>
          </div>
          <div class="yt-song-info">
            <div class="yt-song-title">${title}</div>
            <div class="yt-song-channel">YouTube · ${channel}</div>
          </div>
        </div>
      `;
    })
    .join("");

  list.innerHTML = html;
  return html;
}

function loadMonthlySongs(month) {
  const count = document.getElementById("artistSongCount");
  renderMonthlySongs(monthlyArtistItems);
  if (count) count.textContent = `${countResolvedMaySongs(monthlyArtistItems)} video`;
}

function fetchMaySongVideosForSourcePairs() {
  const period = getArtistPeriod(5);
  const publishedAfter = `${period.year}-05-01T00:00:00Z`;
  const publishedBefore = `${period.year}-06-01T00:00:00Z`;
  return promisePool(getMusicSourceArtistSeeds(), 4, (item) => fetchYouTubeVideoForSourcePair(item, publishedAfter, publishedBefore))
    .then((items) => items.filter(Boolean).sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0)));
}

function fetchYouTubeVideoForSourcePair(item, publishedAfter, publishedBefore) {
  const query = `${item.song} ${item.artist} official mv`;
  return fetchYouTubeVideosByPublishedMonth(query, 6, publishedAfter, publishedBefore)
    .then((videos) => fetchYouTubeVideoStatistics(videos))
    .then((videosWithStats) => pickBestSourcePairVideo(item, videosWithStats))
    .then((bestMatch) => bestMatch || fetchYouTubeVideoForArtistMonth(item, publishedAfter, publishedBefore))
    .catch((error) => {
      console.warn("Skip source pair:", item.artist, item.song, error);
      return null;
    });
}

function fetchYouTubeVideoForArtistMonth(item, publishedAfter, publishedBefore) {
  const artist = getPrimaryLocalArtist(item.artist) || cleanupArtistName(item.artist);
  const query = `${artist} official music`;
  return fetchYouTubeVideosByPublishedMonth(query, 12, publishedAfter, publishedBefore)
    .then((videos) => fetchYouTubeVideoStatistics(videos))
    .then((videosWithStats) => pickBestArtistMonthVideo(item, videosWithStats));
}

function pickBestSourcePairVideo(sourceItem, videos) {
  return (videos || [])
    .map((video) => normalizeSourcePairYouTubeVideo(sourceItem, video))
    .filter(Boolean)
    .sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0))[0] || null;
}

function pickBestArtistMonthVideo(sourceItem, videos) {
  return (videos || [])
    .map((video) => normalizeArtistMonthYouTubeVideo(sourceItem, video))
    .filter(Boolean)
    .sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0))[0] || null;
}

function promisePool(items, concurrency, worker) {
  const results = [];
  let nextIndex = 0;

  const runNext = () => {
    if (nextIndex >= items.length) return Promise.resolve();
    const currentIndex = nextIndex++;
    return Promise.resolve(worker(items[currentIndex], currentIndex))
      .then((result) => {
        results[currentIndex] = result;
      })
      .catch(() => {
        results[currentIndex] = null;
      })
      .then(runNext);
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, runNext);
  return Promise.all(workers).then(() => results);
}

function uniqueYouTubeSearchItems(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const videoId = item && item.id && item.id.videoId;
    if (!videoId || seen.has(videoId)) return false;
    seen.add(videoId);
    return true;
  });
}

function buildMayArtistRankingFromYouTube(videos, limit) {
  const byArtist = new Map();
  (videos || [])
    .map(normalizeMayYouTubeVideo)
    .filter(Boolean)
    .sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0))
    .forEach((item) => {
      const key = normalizeSongIdentity(item.artist, "");
      if (!key || byArtist.has(key)) return;
      byArtist.set(key, item);
    });

  return Array.from(byArtist.values()).slice(0, limit);
}

function fetchYouTubeVideosByPublishedMonth(query, totalResults, publishedAfter, publishedBefore) {
  const pageSize = Math.min(YOUTUBE_PAGE_SIZE, totalResults);
  const items = [];
  const seen = new Set();

  const appendItems = (sourceItems) => {
    (sourceItems || []).forEach((item) => {
      const videoId = item && item.id && item.id.videoId;
      if (!videoId || seen.has(videoId)) return;
      seen.add(videoId);
      items.push(item);
    });
  };

  const fetchPage = (pageToken, keysLeft) => {
    const remaining = totalResults - items.length;
    const size = Math.min(pageSize, remaining);
    const tokenPart = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const apiUrl =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&order=viewCount&safeSearch=none&videoEmbeddable=true` +
      `&publishedAfter=${encodeURIComponent(publishedAfter)}&publishedBefore=${encodeURIComponent(publishedBefore)}` +
      `&q=${encodeURIComponent(query)}&key=${getYTApiKey()}`;

    return fetch(`${apiUrl}&maxResults=${size}${tokenPart}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          const error = new Error(data.error.message || "YouTube API error");
          if (isYouTubeQuotaError(error) && keysLeft > 1) {
            rotateYTApiKey();
            return fetchPage(pageToken, keysLeft - 1);
          }
          throw error;
        }
        appendItems(data.items);
        if (items.length >= totalResults || !data.nextPageToken) return items.slice(0, totalResults);
        return fetchPage(data.nextPageToken, keysLeft);
      });
  };

  return fetchPage("", YT_API_KEYS.length).catch((error) => {
    if (!isYouTubeQuotaError(error)) throw error;
    console.warn("YouTube quota exceeded. Switching to Invidious month search:", error);
    return fetchYouTubeVideosFallback(query, totalResults);
  });
}

function normalizeSourcePairYouTubeVideo(sourceItem, video) {
  const snippet = video.snippet || {};
  const stats = video.statistics || {};
  const rawTitle = snippet.title || "";
  const title = cleanYouTubeTitle(rawTitle);
  const viewCount = Number(stats.viewCount || 0);

  if (!video.id || !title || viewCount <= 0 || isPlaylistLikeVideoTitle(title)) return null;
  if (!videoMatchesSourcePair(title, snippet.channelTitle || "", sourceItem)) return null;

  const thumbs = snippet.thumbnails || {};
  const thumb = (thumbs.high || thumbs.medium || thumbs.default || {}).url || getYouTubeVideoThumbUrl(video.id);

  return {
    ...sourceItem,
    title,
    thumb,
    videoId: video.id,
    viewCount,
    publishedAt: snippet.publishedAt || "",
    channelId: snippet.channelId || "",
    channelTitle: snippet.channelTitle || "",
  };
}

function normalizeArtistMonthYouTubeVideo(sourceItem, video) {
  const snippet = video.snippet || {};
  const stats = video.statistics || {};
  const rawTitle = snippet.title || "";
  const title = cleanYouTubeTitle(rawTitle);
  const viewCount = Number(stats.viewCount || 0);

  if (!video.id || !title || viewCount <= 0 || isPlaylistLikeVideoTitle(title)) return null;
  if (/\b(karaoke|cover|reaction|live\s*stream|shorts?)\b/i.test(rawTitle)) return null;
  if (!videoMatchesAnySourceArtist(title, snippet.channelTitle || "", sourceItem.artist)) return null;

  const artist = getPrimaryLocalArtist(sourceItem.artist) || cleanupArtistName(sourceItem.artist);
  const song = extractSongForSeedArtist(title, artist) || cleanupSongTitle(title);
  if (!song || isPlaylistLikeVideoTitle(song)) return null;

  const thumbs = snippet.thumbnails || {};
  const thumb = (thumbs.high || thumbs.medium || thumbs.default || {}).url || getYouTubeVideoThumbUrl(video.id);

  return {
    ...sourceItem,
    song,
    title,
    thumb,
    videoId: video.id,
    viewCount,
    publishedAt: snippet.publishedAt || "",
    channelId: snippet.channelId || "",
    channelTitle: snippet.channelTitle || "",
  };
}

function videoMatchesSourcePair(title, channelTitle, sourceItem) {
  const haystack = normalizeSearchText(`${title} ${channelTitle}`);
  const songKey = normalizeSearchText(sourceItem.song);
  const primaryArtist = getPrimaryLocalArtist(sourceItem.artist) || cleanupArtistName(sourceItem.artist);
  const artistAliases = getArtistAliases(primaryArtist).map(normalizeSearchText);

  if (!songKey || !haystack.includes(songKey)) return false;
  return artistAliases.some((alias) => alias && haystack.includes(alias));
}

function videoMatchesAnySourceArtist(title, channelTitle, artistText) {
  const haystack = normalizeSearchText(`${title} ${channelTitle}`);
  return getSourceArtistNames(artistText).some((name) =>
    getArtistAliases(name)
      .map(normalizeSearchText)
      .some((alias) => alias && haystack.includes(alias)),
  );
}

function getSourceArtistNames(artistText) {
  const fullName = cleanupArtistName(artistText);
  const names = String(artistText || "")
    .split(/\s*(?:,|;|&|\band\b|\bft\.?\b|\bfeat\.?\b|\bx\b)\s*/i)
    .map((name) => cleanupArtistName(name))
    .filter(Boolean);

  if (fullName && !names.includes(fullName)) names.unshift(fullName);
  return names.filter(isLikelyRealArtistName);
}

function normalizeMayYouTubeVideo(video) {
  const snippet = video.snippet || {};
  const stats = video.statistics || {};
  const rawTitle = snippet.title || "";
  const title = cleanYouTubeTitle(rawTitle);
  const channelTitle = snippet.channelTitle || "";
  const viewCount = Number(stats.viewCount || 0);

  if (!video.id || !title || viewCount <= 0 || isPlaylistLikeVideoTitle(title)) return null;

  const artistSeed = findKnownArtistForVideo(title, channelTitle);
  const artist = artistSeed ? artistSeed.artist : extractArtistFromVideoTitle(title, channelTitle);
  if (!artist || !isLikelyRealArtistName(artist)) return null;

  const thumbs = snippet.thumbnails || {};
  const thumb = (thumbs.high || thumbs.medium || thumbs.default || {}).url || getYouTubeVideoThumbUrl(video.id);
  const song = artistSeed ? extractSongForSeedArtist(title, artist) : extractSongFromVideoTitle(title);
  if (!song || isPlaylistLikeVideoTitle(song)) return null;

  return {
    artist,
    song,
    title,
    thumb,
    videoId: video.id,
    viewCount,
    publishedAt: snippet.publishedAt || "",
    source: artistSeed ? artistSeed.source : "YouTube",
  };
}

function findKnownArtistForVideo(title, channelTitle) {
  const haystack = `${title} ${channelTitle}`;
  return getMusicSourceArtistSeeds().find((artistItem) => videoMatchesSeedArtist(haystack, channelTitle, artistItem.artist));
}

function normalizeSeedArtistYouTubeVideo(artistItem, video) {
  const snippet = video.snippet || {};
  const stats = video.statistics || {};
  const title = cleanYouTubeTitle(snippet.title || "");
  const artist = cleanupArtistName(artistItem.artist);
  const viewCount = Number(stats.viewCount || 0);

  if (!video.id || !title || viewCount <= 0 || isPlaylistLikeVideoTitle(title)) return null;
  if (!videoMatchesSeedArtist(title, snippet.channelTitle || "", artist)) return null;

  const thumbs = snippet.thumbnails || {};
  const thumb = (thumbs.high || thumbs.medium || thumbs.default || {}).url || getYouTubeVideoThumbUrl(video.id);
  const song = extractSongForSeedArtist(title, artist);

  return {
    artist,
    song,
    title,
    thumb,
    videoId: video.id,
    viewCount,
    publishedAt: snippet.publishedAt || "",
    source: artistItem.source || "Zing MP3",
  };
}

function videoMatchesSeedArtist(title, channelTitle, artist) {
  const titleKey = normalizeSearchText(title);
  const channelKey = normalizeSearchText(cleanupArtistName(channelTitle));
  const artistKey = normalizeSearchText(artist);
  const aliases = getArtistAliases(artist).map(normalizeSearchText);

  if (aliases.some((alias) => alias && titleKey.includes(alias))) return true;
  if (channelKey && (channelKey.includes(artistKey) || artistKey.includes(channelKey))) return true;
  return false;
}

function getArtistAliases(artist) {
  const aliases = [artist];
  const compact = artist.replace(/\s+/g, "");
  if (compact !== artist) aliases.push(compact);
  if (/sơn tùng/i.test(artist)) aliases.push("Sơn Tùng", "MTP", "M-TP");
  if (/jack/i.test(artist)) aliases.push("Jack", "J97");
  if (/rpt mck/i.test(artist)) aliases.push("MCK");
  if (/vũ\./i.test(artist)) aliases.push("Vũ", "Vu");
  return aliases;
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fetchYouTubeVideoStatistics(searchItems) {
  const ids = searchItems.map((item) => item.id.videoId).filter(Boolean);
  if (!ids.length) return Promise.resolve([]);

  if (searchItems.every((item) => item.invidious)) {
    const missingStats = searchItems.filter((item) => !item.invidious.viewCount);
    if (!missingStats.length) {
      return Promise.resolve(
        searchItems.map((item) => ({
          id: item.id.videoId,
          snippet: item.snippet || {},
          statistics: { viewCount: item.invidious.viewCount || 0 },
          invidious: item.invidious,
        })),
      );
    }

    return promisePool(searchItems, 4, (item) => {
      if (item.invidious.viewCount) {
        return {
          id: item.id.videoId,
          snippet: item.snippet || {},
          statistics: { viewCount: item.invidious.viewCount || 0 },
          invidious: item.invidious,
        };
      }
      return fetchInvidiousVideoDetails(item.id.videoId).catch(() => ({
        id: item.id.videoId,
        snippet: item.snippet || {},
        statistics: { viewCount: 0 },
        invidious: item.invidious,
      }));
    });
  }

  const chunks = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

  return Promise.all(
    chunks.map((chunk) => {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${chunk.map(encodeURIComponent).join(",")}&key=${getYTApiKey()}`;
      return fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error.message || "YouTube API error");
          return data.items || [];
        });
    }),
  )
    .then((groups) => groups.flat())
    .catch((error) => {
      if (!isYouTubeQuotaError(error)) throw error;
      console.warn("YouTube quota exceeded. Using Invidious statistics fallback:", error);
      return promisePool(searchItems, 4, (item) => {
        if (item.invidious && item.invidious.viewCount) {
          return {
            id: item.id.videoId,
            snippet: item.snippet || {},
            statistics: { viewCount: item.invidious.viewCount || 0 },
            invidious: item.invidious,
          };
        }
        return fetchInvidiousVideoDetails(item.id.videoId).catch(() => ({
          id: item.id.videoId,
          snippet: item.snippet || {},
          statistics: { viewCount: 0 },
          invidious: item.invidious || {},
        }));
      });
    });
}

function buildArtistRankingFromVideos(videos, limit) {
  const artistMap = new Map();
  videos
    .map((video) => normalizeYouTubeMusicVideo(video))
    .filter(Boolean)
    .sort((a, b) => b.viewCount - a.viewCount)
    .forEach((item) => {
      const key = normalizeSongIdentity(item.artist, "");
      if (!key || artistMap.has(key)) return;
      artistMap.set(key, item);
    });

  return Array.from(artistMap.values()).slice(0, limit);
}

function normalizeYouTubeMusicVideo(video) {
  const snippet = video.snippet || {};
  const stats = video.statistics || {};
  const title = cleanYouTubeTitle(snippet.title || "");
  if (isPlaylistLikeVideoTitle(title)) return null;

  const artist = extractArtistFromVideoTitle(title, snippet.channelTitle || "YouTube");
  const song = extractSongFromVideoTitle(title);
  const thumbs = snippet.thumbnails || {};
  const thumb = (thumbs.high || thumbs.medium || thumbs.default || {}).url || "";
  const videoId = video.id;
  const viewCount = Number(stats.viewCount || 0);
  if (!videoId || !title || !artist || !isLikelyRealArtistName(artist) || viewCount <= 0) return null;

  return {
    artist,
    song,
    title,
    thumb,
    videoId,
    viewCount,
    publishedAt: snippet.publishedAt || "",
  };
}

function cleanYouTubeTitle(title) {
  return String(title)
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*(official|mv|music video|lyrics?|audio|visualizer)[^)]*\)/gi, " ")
    .replace(/\b(official\s*)?(mv|music video|audio|lyrics?|visualizer|4k)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractArtistFromVideoTitle(title, channelTitle) {
  const parts = title
    .split(/\s[-–—|]\s|\s\|\s/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const first = cleanupArtistName(parts[0]);
    const last = cleanupArtistName(parts[parts.length - 1]);
    const channelArtist = cleanupArtistName(channelTitle);

    if (isLikelyRealArtistName(last) && !looksLikeSongTitle(last)) return last;
    if (isLikelyRealArtistName(first) && namesLookRelated(first, channelArtist)) return first;
  }

  return "";
}

function extractSongFromVideoTitle(title) {
  const parts = title
    .split(/\s[-–—|]\s|\s\|\s/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const first = cleanupArtistName(parts[0]);
    const last = cleanupArtistName(parts[parts.length - 1]);
    if (isLikelyRealArtistName(first) && !looksLikeSongTitle(first)) return parts.slice(1).join(" - ");
    if (isLikelyRealArtistName(last) && !looksLikeSongTitle(last)) return parts.slice(0, -1).join(" - ");
  }
  return parts[0] || title || "Bài hát nổi bật";
}

function extractSongForSeedArtist(title, artist) {
  const cleanedTitle = cleanYouTubeTitle(title);
  const artistAliases = getArtistAliases(artist).map(normalizeSearchText);
  const parts = cleanedTitle
    .split(/\s[-–—|]\s|\s\|\s|:/)
    .map((part) => part.trim())
    .filter(Boolean);

  const withoutArtistPart = parts.find((part) => {
    const key = normalizeSearchText(part);
    return key && !artistAliases.some((alias) => alias && (key === alias || key.includes(alias)));
  });

  if (withoutArtistPart) return cleanupSongTitle(withoutArtistPart);

  let song = cleanedTitle;
  getArtistAliases(artist).forEach((alias) => {
    song = song.replace(new RegExp(escapeRegExp(alias), "gi"), " ");
  });

  return cleanupSongTitle(song) || cleanedTitle || "Bài hát nổi bật";
}

function cleanupSongTitle(title) {
  return String(title || "")
    .replace(/\b(ft|feat|featuring|prod|official|mv|music video|audio|lyrics?|visualizer)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[-–—|:]+|[-–—|:]+$/g, "")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanupArtistName(name) {
  return String(name || "")
    .replace(/\b(official|vevo|channel|music|entertainment|media|records)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlaylistLikeVideoTitle(title) {
  return NON_ARTIST_TITLE_PATTERNS.test(title);
}

function isLikelyRealArtistName(name) {
  const value = cleanupArtistName(name);
  if (!value || value.length < 2 || value.length > 40) return false;
  if (GENERIC_MUSIC_CHANNEL_PATTERNS.test(value)) return false;
  if (/^\d+$/.test(value)) return false;
  return true;
}

function looksLikeSongTitle(value) {
  return /(yêu|anh|em|đau|buồn|mưa|nắng|tim|tình|người|đời|khóc|cười|nhớ|thương|vui|sad|love|remix)/i.test(value);
}

function namesLookRelated(name, channelName) {
  const a = normalizeSongIdentity(name, "");
  const b = normalizeSongIdentity(channelName, "");
  return a && b && (a.includes(b) || b.includes(a));
}

function formatViewCount(value) {
  const count = Number(value || 0);
  if (count >= 1000000000) return (count / 1000000000).toFixed(1).replace(/\.0$/, "") + "B views";
  if (count >= 1000000) return (count / 1000000).toFixed(1).replace(/\.0$/, "") + "M views";
  if (count >= 1000) return (count / 1000).toFixed(1).replace(/\.0$/, "") + "K views";
  return count + " views";
}

function renderMonthlySongs(artists) {
  const list = document.getElementById("monthlySongList");
  if (!list) return;
  const resolvedSongs = (artists || [])
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .filter(({ item }) => hasResolvedMaySong(item));

  if (resolvedSongs.length === 0) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = resolvedSongs
    .map(({ item, sourceIndex }, i) => {
      const thumb = getSongThumb(item, i);
      return `
        <div class="artist-song-row" onclick="playCuratedMaySong(${sourceIndex})">
          <div class="artist-rank">${i + 1}</div>
          <div class="artist-song-thumb">
            <img data-song-thumb="${i}" src="${thumb}" alt="${item.song}" />
            <span>▶</span>
          </div>
          <div class="artist-info">
            <div class="artist-name">${item.song}</div>
            <div class="artist-meta">${item.artist}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function getArtistPhoto(artist, index) {
  if (artist.photo) return artist.photo;

  const cached = artist.preferSongThumb ? null : readTimedCache(getArtistPhotoCacheKey(artist.artist), CACHE_7_DAYS);
  if (cached && cached.url) {
    artist.photo = cached.url;
    return artist.photo;
  }

  return buildArtistPlaceholder(artist.artist, index);
}

function getArtistPhotoCacheKey(artistName) {
  return (
    "artist_photo_" +
    artistName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
  );
}

function buildArtistPlaceholder(name, index) {
  const colors = [
    ["#0f766e", "#38bdf8"],
    ["#7c2d12", "#fb7185"],
    ["#1d4ed8", "#a78bfa"],
    ["#166534", "#facc15"],
    ["#be123c", "#f97316"],
  ];
  const pair = colors[index % colors.length];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop stop-color="${pair[0]}"/>
          <stop offset="1" stop-color="${pair[1]}"/>
        </linearGradient>
      </defs>
      <rect width="240" height="240" rx="120" fill="url(#g)"/>
      <text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="72" font-family="Arial, sans-serif" font-weight="700">${initials}</text>
    </svg>`;

  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function isArtistPlaceholderPhoto(url) {
  return !url || String(url).startsWith("data:image/svg+xml");
}

function applyArtistPhoto(index, url) {
  if (!url || isArtistPlaceholderPhoto(url)) return;
  const artist = (monthlyArtistItems.length ? monthlyArtistItems : getMusicSourceArtistSeeds())[index];
  if (!artist) return;
  artist.photo = url;
  writeTimedCache(getArtistPhotoCacheKey(artist.artist), { url });
  updateArtistPhoto(index, url);
}

function loadArtistPhotos() {
  (monthlyArtistItems.length ? monthlyArtistItems : getMusicSourceArtistSeeds()).forEach((artist, index) => {
    if (!isArtistPlaceholderPhoto(artist.photo) || artist.photoLoading) return;

    const cacheKey = getArtistPhotoCacheKey(artist.artist);
    const cached = artist.preferSongThumb ? null : readTimedCache(cacheKey, CACHE_7_DAYS);
    if (cached && cached.url) {
      applyArtistPhoto(index, cached.url);
      return;
    }

    artist.photoLoading = true;
    setTimeout(() => {
      fetchArtistPhotoUrl(artist.artist, artist.song, artist.channelId, artist.preferSongThumb)
        .then((url) => applyArtistPhoto(index, url))
        .catch(() => {})
        .finally(() => {
          artist.photoLoading = false;
        });
    }, index * 120);
  });
}

function fetchDeezerJsonp(path) {
  return new Promise((resolve, reject) => {
    const callbackName = "dzcb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Deezer JSONP timeout"));
    }, 12000);

    function cleanup() {
      clearTimeout(timeout);
      if (window[callbackName]) delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Deezer JSONP failed"));
    };

    const sep = path.includes("?") ? "&" : "?";
    script.src = `https://api.deezer.com${path}${sep}output=jsonp&callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

function pickDeezerArtistPhoto(data, artistName) {
  const items = (data && data.data) || [];
  if (!items.length) return "";

  const target = artistName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const match =
    items.find((item) => {
      const name = (item.name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return name === target || name.includes(target) || target.includes(name);
    }) || items[0];

  return match.picture_xl || match.picture_big || match.picture_medium || "";
}

function upscaleItunesArtwork(url) {
  if (!url) return "";
  return url.replace(/100x100bb\.jpg$/, "600x600bb.jpg");
}

function fetchArtistPhotoUrl(artistName, featuredSong, channelId, preferSongThumb) {
  const q = encodeURIComponent(artistName);

  if (preferSongThumb && featuredSong) {
    return fetchSongThumbUrl(featuredSong, artistName).then((url) => {
      if (url) return url;
      return fetchArtistPhotoUrl(artistName, "", channelId, false);
    });
  }

  return fetchDeezerJsonp(`/search/artist?q=${q}`)
    .then((data) => pickDeezerArtistPhoto(data, artistName))
    .catch(() => "")
    .then((url) => {
      if (url) return url;
      return fetch(`https://api.deezer.com/search/artist?q=${q}`)
        .then((r) => r.json())
        .then((data) => pickDeezerArtistPhoto(data, artistName))
        .catch(() => "");
    })
    .then((url) => {
      if (url) return url;
      return fetch(`https://itunes.apple.com/search?term=${q}&entity=musicArtist&limit=1`)
        .then((r) => r.json())
        .then((data) => {
          const item = data.results && data.results[0];
          return item && item.artworkUrl100 ? upscaleItunesArtwork(item.artworkUrl100) : "";
        })
        .catch(() => "");
    })
    .then((url) => {
      if (url) return url;
      return fetchYouTubeChannelPhotoUrl(artistName, channelId);
    })
    .then((url) => {
      if (url || !featuredSong) return url;
      return fetchSongThumbUrl(featuredSong, artistName);
    })
    .catch(() => "");
}

function fetchYouTubeChannelPhotoUrl(artistName, channelId) {
  if (channelId) {
    const channelUrl =
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${encodeURIComponent(channelId)}` +
      `&key=${getYTApiKey()}`;

    return fetch(channelUrl)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error.message || "YouTube API error");
        const item = data.items && data.items[0];
        const thumbs = (item && item.snippet && item.snippet.thumbnails) || {};
        return (thumbs.high || thumbs.medium || thumbs.default || {}).url || "";
      })
      .catch((error) => {
        if (!isYouTubeQuotaError(error)) return "";
        rotateYTApiKey();
        return "";
      });
  }

  const query = `${artistName} official artist music`;
  const apiUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=5` +
    `&q=${encodeURIComponent(query)}&key=${getYTApiKey()}`;

  return fetch(apiUrl)
    .then((r) => r.json())
    .then((data) => {
      if (data.error) throw new Error(data.error.message || "YouTube API error");
      const target = normalizeSearchText(artistName);
      const items = data.items || [];
      const match =
        items.find((item) => {
          const title = normalizeSearchText((item.snippet && item.snippet.channelTitle) || "");
          return title && (title.includes(target) || target.includes(title));
        }) || items[0];
      const thumbs = (match && match.snippet && match.snippet.thumbnails) || {};
      return (thumbs.high || thumbs.medium || thumbs.default || {}).url || "";
    })
    .catch((error) => {
      if (!isYouTubeQuotaError(error)) return "";
      rotateYTApiKey();
      return "";
    });
}

function fetchSongThumbUrl(song, artist) {
  const q = encodeURIComponent(`${song} ${artist}`);

  return fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=1`)
    .then((r) => r.json())
    .then((data) => {
      const item = data.results && data.results[0];
      return item && item.artworkUrl100 ? upscaleItunesArtwork(item.artworkUrl100) : "";
    })
    .catch(() => "")
    .then((url) => {
      if (url) return url;
      const dq = encodeURIComponent(`${artist} ${song}`);
      return fetch(`https://api.deezer.com/search/track?q=${dq}`)
        .then((r) => r.json())
        .then((data) => {
          const track = data.data && data.data[0];
          if (!track || !track.album) return "";
          const album = track.album;
          return album.cover_xl || album.cover_big || album.cover_medium || "";
        });
    })
    .catch(() => "");
}

function updateArtistPhoto(index, url) {
  document.querySelectorAll(`[data-artist-photo="${index}"]`).forEach((img) => {
    img.src = url;
  });
}

function getSongThumbCacheKey(item) {
  return (
    "song_thumb_" +
    (item.song + "_" + item.artist)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
  );
}

function getMaySongVideoCacheKey(item) {
  const query = `${item.song} ${item.artist} official music video`;
  return "yt_may_artist_song_" + query.toLowerCase().trim();
}

function getYouTubeVideoThumbUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

function getSongThumb(item, index) {
  if (item.thumb) return item.thumb;

  const cached = readTimedCache(getSongThumbCacheKey(item), CACHE_7_DAYS);
  if (cached && cached.url) {
    item.thumb = cached.url;
    return item.thumb;
  }

  const videoCached = readTimedCache(getMaySongVideoCacheKey(item), CACHE_7_DAYS);
  if (videoCached && videoCached.videoId) {
    item.thumb = getYouTubeVideoThumbUrl(videoCached.videoId);
    return item.thumb;
  }

  return buildSongPlaceholder(item.song, index);
}

function updateSongThumb(index, url) {
  document.querySelectorAll(`[data-song-thumb="${index}"]`).forEach((img) => {
    img.src = url;
  });
}

function loadSongThumbnails() {
  (monthlyArtistItems.length ? monthlyArtistItems : getMusicSourceArtistSeeds()).forEach((item, index) => {
    if (!hasResolvedMaySong(item)) return;
    if (item.thumb || item.thumbLoading) return;

    const cacheKey = getSongThumbCacheKey(item);
    const cached = readTimedCache(cacheKey, CACHE_7_DAYS);
    if (cached && cached.url) {
      item.thumb = cached.url;
      updateSongThumb(index, item.thumb);
      return;
    }

    const videoCached = readTimedCache(getMaySongVideoCacheKey(item), CACHE_7_DAYS);
    if (videoCached && videoCached.videoId) {
      item.thumb = getYouTubeVideoThumbUrl(videoCached.videoId);
      writeTimedCache(cacheKey, { url: item.thumb });
      updateSongThumb(index, item.thumb);
      return;
    }

    item.thumbLoading = true;

    setTimeout(() => {
      fetchSongThumbUrl(item.song, item.artist)
        .then((url) => {
          if (!url) return;
          item.thumb = url;
          writeTimedCache(cacheKey, { url });
          updateSongThumb(index, url);
          if (isArtistPlaceholderPhoto(item.photo) && !item.photoLoading) {
            updateArtistPhoto(index, url);
          }
        })
        .catch(() => {})
        .finally(() => {
          item.thumbLoading = false;
        });
    }, index * 150);
  });
}

function cacheMaySongVideo(index, video) {
  const item = (monthlyArtistItems.length ? monthlyArtistItems : getMusicSourceArtistSeeds())[index];
  if (!item || !video || !video.id || !video.id.videoId) return;

  const videoId = video.id.videoId;
  const thumbUrl = getYouTubeThumb(video);
  item.videoId = videoId;
  item.thumb = thumbUrl;
  writeTimedCache(getMaySongVideoCacheKey(item), { videoId });
  writeTimedCache(getSongThumbCacheKey(item), { url: thumbUrl });
  updateSongThumb(index, thumbUrl);
}

function playCuratedMaySong(index) {
  const item = (monthlyArtistItems.length ? monthlyArtistItems : getMusicSourceArtistSeeds())[index];
  if (!item) return;

  if (!hasResolvedMaySong(item)) {
    alert("Chưa tìm thấy bài hát tháng 5 phù hợp cho ca sĩ này trên YouTube.");
    return;
  }

  if (item.localFile) {
    const localIndex = songs.findIndex((song) => song.file === item.localFile);
    if (localIndex !== -1) {
      playSound(localIndex);
      return;
    }
  }

  if (item.videoId) {
    playYouTube(item.videoId, `${item.song} - ${item.artist}`);
    return;
  }

  const query = `${item.song} ${item.artist} official music video`;
  const cacheKey = getMaySongVideoCacheKey(item);
  const cached = readTimedCache(cacheKey, CACHE_7_DAYS);

  if (cached && cached.videoId) {
    if (!item.thumb) {
      item.thumb = getYouTubeVideoThumbUrl(cached.videoId);
      updateSongThumb(index, item.thumb);
    }
    playYouTube(cached.videoId, `${item.song} - ${item.artist}`);
    return;
  }

  fetchYouTubeVideos(query, 1)
    .then((items) => {
      const video = items[0];
      if (!video || !video.id || !video.id.videoId) {
        alert("Không tìm thấy video phù hợp cho bài này.");
        return;
      }
      cacheMaySongVideo(index, video);
      playYouTube(video.id.videoId, `${item.song} - ${item.artist}`);
    })
    .catch(() => {
      alert("Lỗi kết nối YouTube. Vui lòng thử lại.");
    });
}

function getYouTubeThumb(item) {
  const thumbs = item.snippet.thumbnails;
  return (thumbs.medium || thumbs.default || thumbs.high).url;
}

function escapeTemplateText(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/`/g, "'").replace(/\$\{/g, "$ {");
}

function searchYouTube(query, playFirst) {
  query = String(query || "").trim().toLowerCase();
  if (!query || query.length < SEARCH_MIN_QUERY_LENGTH) return;

  document.getElementById("searchHistory").style.display = "none";
  document.getElementById("searchResults").style.display = "block";
  const list = document.getElementById("resultList");

  const cacheKey = getYouTubeSearchCacheKey(query);
  const cached = readYouTubeSearchCache(query);
  if (cached && playFirst) {
    const { html, items } = cached;
    if (playFirst && items && items[0]) {
      playYouTubeFromSearch(items[0].videoId, items[0].title);
      return;
    }
    list.innerHTML = html;
    lastSubmittedSearchQuery = query;
    return;
  }

  if (!playFirst && query === lastSubmittedSearchQuery && list.innerHTML.trim() && !readYouTubeSearchCache(query)) {
    return;
  }

  lastSubmittedSearchQuery = query;
  list.innerHTML = "";

  fetchYouTubeVideosWithFallback(query, SEARCH_RESULTS_COUNT)
    .then((items) => {
      if (!items || items.length === 0) {
        hideSearchDropdown();
        return;
      }

      const cacheItems = [];
      const html = items
        .map((item) => {
          const vid = item.id.videoId;
          const title = item.snippet.title;
          const channel = item.snippet.channelTitle;
          const thumbs = item.snippet.thumbnails || {};
          const thumb = (thumbs.default || thumbs.medium || thumbs.high || {}).url || `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`;
          cacheItems.push({ videoId: vid, title });
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
      localStorage.setItem(cacheKey, JSON.stringify({ html, items: cacheItems, time: Date.now() }));

      if (playFirst && cacheItems[0]) {
        playYouTubeFromSearch(cacheItems[0].videoId, cacheItems[0].title);
        return;
      }

      list.innerHTML = html;
    })
    .catch((error) => {
      console.warn("YouTube search failed:", error);
      hideSearchDropdown();
    });
}

function hideSearchDropdown() {
  const list = document.getElementById("resultList");
  if (list) list.innerHTML = "";
  searchDropdown.style.display = "none";
  searchWrapper.classList.remove("active");
}

// ============================
// PHÁT VIDEO YOUTUBE
// ============================

function playYouTube(videoId, title) {
  const modal = document.getElementById("ytPlayerModal");
  document.getElementById("ytModalTitle").textContent = title;
  modal.style.display = "flex";
  recordListeningHistory({
    type: "youtube",
    title,
    artist: "YouTube",
    image: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    videoId,
  });

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
  showSearchHistoryDropdown();
  playYouTube(vid, title);
}
function toggleSettings() {
  document.getElementById("settingsDropdown").classList.toggle("open");
}
function closeSettings() {
  document.getElementById("settingsDropdown").classList.remove("open");
}

const APP_SETTINGS_KEY = "listen_music_app_settings";
const DEFAULT_APP_SETTINGS = {
  compactPlayer: false,
  showVolume: true,
  saveHistory: true,
  lightTheme: false,
  largeText: false,
  reduceMotion: false,
  language: "vi",
};
let currentSettingsPanelType = "";

const I18N = {
  vi: {
    on: "Bật",
    off: "Tắt",
    searchPlaceholder: "Tìm kiếm bài hát, nghệ sĩ...",
    navExplore: "🏠 Khám Phá",
    navLibrary: "⭐ Thư Viện",
    navTop100: "🏆 Top 100",
    navArtist: "🎸 Nghệ Sĩ",
    navChart: "BXH Music",
    navRecent: "Bài hát gần đây",
    vipCenter: "👑 VIP Center",
    searchHistory: "🕐 Tìm kiếm gần đây",
    searchResults: "🎵 Kết quả",
    noHistory: "Chưa có lịch sử tìm kiếm",
    settingsKicker: "Listen Music",
    player: "Trình phát nhạc",
    appearance: "Giao diện",
    about: "Giới thiệu",
    terms: "Thỏa thuận sử dụng",
    privacy: "Chính sách bảo mật",
    copyright: "Báo cáo vi phạm bản quyền",
    ads: "Quảng cáo",
    contact: "Liên hệ",
    compactPlayer: "Thanh phát nhỏ gọn",
    compactPlayerDesc: "Thu gọn player để có thêm không gian duyệt nhạc.",
    showVolume: "Hiển thị âm lượng",
    showVolumeDesc: "Bật hoặc ẩn nút âm lượng bên dưới góc phải.",
    saveHistory: "Lưu bài hát gần đây",
    saveHistoryDesc: "Ghi lại lịch sử nghe trong mục Bài hát gần đây.",
    lightTheme: "Giao diện sáng",
    lightThemeDesc: "Chuyển nền sang tông sáng nhẹ.",
    largeText: "Chữ lớn hơn",
    largeTextDesc: "Tăng cỡ chữ cho sidebar, danh sách và menu.",
    reduceMotion: "Giảm chuyển động",
    reduceMotionDesc: "Giảm animation và hiệu ứng hover.",
    language: "Ngôn ngữ",
    languageDesc: "Chọn ngôn ngữ hiển thị cho Listen Music.",
    aboutBody: "<p><strong>Listen Music</strong> là trình nghe nhạc cá nhân tích hợp nhạc local, YouTube, Top 100, lịch sử nghe và trang VIP.</p><p>Phiên bản hiện tại tập trung vào trải nghiệm nghe nhạc nhanh, giao diện tối và tìm kiếm tiết kiệm quota.</p>",
    termsBody: "<p>Bạn chịu trách nhiệm với nội dung mình phát, tải lên hoặc chia sẻ trong ứng dụng.</p><p>Nhạc từ YouTube được phát thông qua trình phát nhúng và tuân theo điều khoản của nền tảng nguồn.</p>",
    privacyBody: "<p>Ứng dụng lưu lịch sử nghe, cache tìm kiếm và tùy chọn cài đặt trong trình duyệt của bạn bằng <code>localStorage</code>.</p><p>Dữ liệu này nằm trên máy của bạn và có thể xóa bằng cách xóa dữ liệu trang web trong trình duyệt.</p>",
    copyrightBody: "Nếu bạn thấy nội dung cần gỡ bỏ, hãy gửi tên bài hát, nghệ sĩ, liên kết video và lý do báo cáo.",
    sendContact: "Gửi liên hệ",
    adsBody: "Gói VIP giúp ẩn quảng cáo trong trải nghiệm Listen Music và ưu tiên các playlist chất lượng cao.",
    viewVip: "Xem gói VIP",
    contactEmail: "Email của bạn",
    contactMessage: "Nội dung liên hệ",
    contactThanks: "Cảm ơn bạn. Nội dung đã được ghi nhận demo.",
  },
  en: {
    on: "On",
    off: "Off",
    searchPlaceholder: "Search songs, artists...",
    navExplore: "🏠 Explore",
    navLibrary: "⭐ Library",
    navTop100: "🏆 Top 100",
    navArtist: "🎸 Artists",
    navChart: "Music Chart",
    navRecent: "Recently played",
    vipCenter: "👑 VIP Center",
    searchHistory: "🕐 Recent searches",
    searchResults: "🎵 Results",
    noHistory: "No recent searches",
    settingsKicker: "Listen Music",
    player: "Music Player",
    appearance: "Appearance",
    about: "About",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    copyright: "Copyright Report",
    ads: "Advertising",
    contact: "Contact",
    compactPlayer: "Compact player",
    compactPlayerDesc: "Shrink the player to leave more room for browsing.",
    showVolume: "Show volume control",
    showVolumeDesc: "Show or hide the volume button in the bottom-right corner.",
    saveHistory: "Save listening history",
    saveHistoryDesc: "Keep played tracks in the Recently played section.",
    lightTheme: "Light theme",
    lightThemeDesc: "Switch the app to a softer light background.",
    largeText: "Larger text",
    largeTextDesc: "Increase text size for the sidebar, lists, and menus.",
    reduceMotion: "Reduce motion",
    reduceMotionDesc: "Reduce animations and hover effects.",
    language: "Language",
    languageDesc: "Choose the display language for Listen Music.",
    aboutBody: "<p><strong>Listen Music</strong> is a personal music player with local music, YouTube, Top 100, listening history, and VIP subscriptions.</p><p>This version focuses on fast playback, a dark interface, and quota-friendly search.</p>",
    termsBody: "<p>You are responsible for the content you play, upload, or share in the app.</p><p>YouTube music is played through the embedded player and follows the source platform's terms.</p>",
    privacyBody: "<p>The app stores listening history, search cache, and preferences in your browser using <code>localStorage</code>.</p><p>This data stays on your device and can be removed by clearing site data in your browser.</p>",
    copyrightBody: "If you find content that should be removed, send the song name, artist, video link, and report reason.",
    sendContact: "Send message",
    adsBody: "VIP removes ads from the Listen Music experience and prioritizes high-quality playlists.",
    viewVip: "View VIP plans",
    contactEmail: "Your email",
    contactMessage: "Message",
    contactThanks: "Thanks. Your demo message has been received.",
  },
};

function t(key) {
  const lang = getAppSettings().language;
  return (I18N[lang] && I18N[lang][key]) || I18N.vi[key] || key;
}

function getAppSettings() {
  try {
    return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(localStorage.getItem(APP_SETTINGS_KEY) || "{}") };
  } catch (e) {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

function saveAppSettings(settings) {
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
  applyAppSettings();
}

function toggleAppSetting(key) {
  const settings = getAppSettings();
  settings[key] = !settings[key];
  saveAppSettings(settings);
  updateSettingsToggles();
}

function setAppLanguage(language) {
  const settings = getAppSettings();
  settings.language = language;
  saveAppSettings(settings);
  updateLanguageOptions();
  if (document.getElementById("settingsPanelOverlay") && document.getElementById("settingsPanelOverlay").classList.contains("active")) {
    openSettingsPanel(currentSettingsPanelType || "appearance");
  }
}

function applyAppSettings() {
  const settings = getAppSettings();
  document.body.classList.toggle("compact-player-mode", settings.compactPlayer);
  document.body.classList.toggle("hide-volume-mode", !settings.showVolume);
  document.body.classList.toggle("light-theme-mode", settings.lightTheme);
  document.body.classList.toggle("large-text-mode", settings.largeText);
  document.body.classList.toggle("reduce-motion-mode", settings.reduceMotion);
  document.documentElement.lang = settings.language === "en" ? "en" : "vi";
  applyLanguageText();
}

function updateSettingsToggles() {
  const settings = getAppSettings();
  document.querySelectorAll("[data-setting-toggle]").forEach((button) => {
    const key = button.getAttribute("data-setting-toggle");
    const active = !!settings[key];
    button.classList.toggle("active", active);
    button.textContent = active ? t("on") : t("off");
  });
  updateLanguageOptions();
}

function updateLanguageOptions() {
  const settings = getAppSettings();
  document.querySelectorAll("[data-language-option]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-language-option") === settings.language);
  });
}

function openSettingsPanel(type) {
  closeSettings();
  currentSettingsPanelType = type;
  const overlay = document.getElementById("settingsPanelOverlay");
  const title = document.getElementById("settingsPanelTitle");
  const body = document.getElementById("settingsPanelBody");
  if (!overlay || !title || !body) return;

  const panel = getSettingsPanelContent(type);
  title.textContent = panel.title;
  body.innerHTML = panel.html;
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
  updateSettingsToggles();
}

function closeSettingsPanel() {
  const overlay = document.getElementById("settingsPanelOverlay");
  if (overlay) overlay.classList.remove("active");
  document.body.style.overflow = "";
}

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

function applyLanguageText() {
  const searchInputEl = document.getElementById("searchInput");
  if (searchInputEl) searchInputEl.placeholder = t("searchPlaceholder");

  setText(".sidebar-menu a:nth-child(1)", t("navExplore"));
  setText(".sidebar-menu a:nth-child(2)", t("navLibrary"));
  setText(".sidebar-menu a:nth-child(3)", t("navTop100"));
  setText(".sidebar-menu a:nth-child(4)", t("navArtist"));
  const sidebarPlaylists = document.querySelectorAll(".sidebar-playlist");
  if (sidebarPlaylists[0]) {
    const icon = sidebarPlaylists[0].querySelector("svg");
    sidebarPlaylists[0].innerHTML = "";
    if (icon) sidebarPlaylists[0].appendChild(icon);
    sidebarPlaylists[0].append(" " + t("navChart"));
  }
  if (sidebarPlaylists[1]) {
    const icon = sidebarPlaylists[1].querySelector("svg");
    sidebarPlaylists[1].innerHTML = "";
    if (icon) sidebarPlaylists[1].appendChild(icon);
    sidebarPlaylists[1].append(" " + t("navRecent"));
  }
  setText(".vip-btn", t("vipCenter"));
  setText("#searchHistory .search-section-title", t("searchHistory"));
  setText("#searchResults .search-section-title", t("searchResults"));
  setText(".settings-panel-kicker", t("settingsKicker"));

  const settingLabels = document.querySelectorAll(".settings-label");
  const settingKeys = ["player", "appearance", "about", "terms", "privacy", "copyright", "ads", "contact"];
  settingKeys.forEach((key, index) => {
    if (settingLabels[index]) settingLabels[index].textContent = t(key);
  });
}

function getSettingsPanelContent(type) {
  const contactThanks = t("contactThanks").replace(/'/g, "\\'");
  const settingsRows = {
    player: {
      title: t("player"),
      html: `
        <div class="settings-option">
          <div><strong>${t("compactPlayer")}</strong><span>${t("compactPlayerDesc")}</span></div>
          <button data-setting-toggle="compactPlayer" onclick="toggleAppSetting('compactPlayer')">${t("off")}</button>
        </div>
        <div class="settings-option">
          <div><strong>${t("showVolume")}</strong><span>${t("showVolumeDesc")}</span></div>
          <button data-setting-toggle="showVolume" onclick="toggleAppSetting('showVolume')">${t("on")}</button>
        </div>
        <div class="settings-option">
          <div><strong>${t("saveHistory")}</strong><span>${t("saveHistoryDesc")}</span></div>
          <button data-setting-toggle="saveHistory" onclick="toggleAppSetting('saveHistory')">${t("on")}</button>
        </div>
      `,
    },
    appearance: {
      title: t("appearance"),
      html: `
        <div class="settings-option">
          <div><strong>${t("lightTheme")}</strong><span>${t("lightThemeDesc")}</span></div>
          <button data-setting-toggle="lightTheme" onclick="toggleAppSetting('lightTheme')">${t("off")}</button>
        </div>
        <div class="settings-option">
          <div><strong>${t("largeText")}</strong><span>${t("largeTextDesc")}</span></div>
          <button data-setting-toggle="largeText" onclick="toggleAppSetting('largeText')">${t("off")}</button>
        </div>
        <div class="settings-option">
          <div><strong>${t("reduceMotion")}</strong><span>${t("reduceMotionDesc")}</span></div>
          <button data-setting-toggle="reduceMotion" onclick="toggleAppSetting('reduceMotion')">${t("off")}</button>
        </div>
        <div class="settings-option language-option">
          <div><strong>${t("language")}</strong><span>${t("languageDesc")}</span></div>
          <div class="settings-language-group">
            <button data-language-option="vi" onclick="setAppLanguage('vi')">Tiếng Việt</button>
            <button data-language-option="en" onclick="setAppLanguage('en')">English</button>
          </div>
        </div>
      `,
    },
    about: {
      title: t("about"),
      html: `<div class="settings-info">${t("aboutBody")}</div>`,
    },
    terms: {
      title: t("terms"),
      html: `<div class="settings-info">${t("termsBody")}</div>`,
    },
    privacy: {
      title: t("privacy"),
      html: `<div class="settings-info">${t("privacyBody")}</div>`,
    },
    copyright: {
      title: t("copyright"),
      html: `<div class="settings-info"><p>${t("copyrightBody")}</p><button class="settings-action-btn" onclick="openSettingsPanel('contact')">${t("sendContact")}</button></div>`,
    },
    ads: {
      title: t("ads"),
      html: `<div class="settings-info"><p>${t("adsBody")}</p><button class="settings-action-btn" onclick="closeSettingsPanel(); showPage('vipPage')">${t("viewVip")}</button></div>`,
    },
    contact: {
      title: t("contact"),
      html: `<div class="settings-contact"><input placeholder="${t("contactEmail")}" /><textarea placeholder="${t("contactMessage")}"></textarea><button onclick="alert('${contactThanks}')">${t("sendContact")}</button></div>`,
    },
  };

  return settingsRows[type] || settingsRows.about;
}

document.addEventListener("click", function (e) {
  if (!document.getElementById("settingsWrapper").contains(e.target)) {
    closeSettings();
  }
});

applyAppSettings();

// ============================
// LOGIN MODAL
// ============================
function openLoginModal() {
  document.getElementById("loginModalOverlay").classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeLoginModal() {
  document.getElementById("loginModalOverlay").classList.remove("active");
  document.body.style.overflow = "";
}

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeLoginModal();
    closeSettingsPanel();
  }
});

// Toggle password visibility
function togglePassword() {
  const input = document.querySelector('.login-input[type="password"], .login-input[type="text"][data-pass]');
  const eye = document.querySelector(".login-eye");
  const passInput = document.getElementById("passwordInput");

  if (passInput.type === "password") {
    passInput.type = "text";
    eye.textContent = "👁";
  } else {
    passInput.type = "password";
    eye.textContent = "🙈";
  }
}

// ============================
// TOP 100 PAGE
// ============================
function openTop100(name, query) {
  showPage("youtubePage");
  document.getElementById("youtubePageTitle").textContent = "🏆 Top 100 - " + name;

  const cacheKey = "yt_top100_v3_" + query.toLowerCase().trim();
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

  document.getElementById("youtubeList").innerHTML = "";

  fetchYouTubeVideosWithFallback(query, TOP100_RESULTS_COUNT)
    .then((items) => {
      if (!items || items.length === 0) {
        document.getElementById("youtubeList").innerHTML = '<div class="yt-loading">Không tìm thấy kết quả.</div>';
        return;
      }

      const html = renderYouTubeList(items);
      localStorage.setItem(cacheKey, JSON.stringify({ html, time: Date.now() }));
    })
    .catch((error) => {
      console.error("Top 100 fetch error:", error);
      document.getElementById("youtubeList").innerHTML = `
        <div class="t100-error-box">
          <div class="t100-error-icon">❌</div>
          <div class="t100-error-title">Không tải được Top 100 từ YouTube</div>
          <div class="t100-error-body">
            ${error && error.message ? error.message : "Vui lòng kiểm tra kết nối mạng hoặc YouTube API key."}
          </div>
          <button class="t100-retry-btn" onclick="openTop100('${name.replace(/'/g, "\\'")}', '${query.replace(/'/g, "\\'")}')">Thử lại</button>
        </div>
      `;
    });
}
