var currentAudio; // Lưu bài đang phát
let isPlayingState = false;
let currentAudioSource = "";
let audiusTracks = [];
let currentAudiusIndex = -1;
let chartTracks = [];
let currentChartIndex = -1;
let youtubePlaybackQueue = [];
let currentYouTubeIndex = -1;
let youtubeProgressTimer = null;
let currentPlayingTrack = null;
let userPausedPlayback = false;
const YOUTUBE_DURATION_CACHE_PREFIX = "yt_duration_";
const LYRICS_CACHE_PREFIX = "lyrics_cache_v1_";
const YOUTUBE_UNPLAYABLE_KEY = "listen_music_unplayable_youtube_ids_v1";
const DEFAULT_SONG_IMAGE = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='240'%20height='240'%20viewBox='0%200%20240%20240'%3E%3Cdefs%3E%3ClinearGradient%20id='g'%20x1='0'%20x2='1'%20y1='0'%20y2='1'%3E%3Cstop%20stop-color='%237c3aed'/%3E%3Cstop%20offset='1'%20stop-color='%2314b8a6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width='240'%20height='240'%20rx='28'%20fill='url(%23g)'/%3E%3Ctext%20x='50%25'%20y='54%25'%20text-anchor='middle'%20dominant-baseline='middle'%20fill='white'%20font-size='92'%20font-family='Arial,sans-serif'%20font-weight='700'%3E%E2%99%AA%3C/text%3E%3C/svg%3E";

// ============================
// PLAYER CORE
// ============================
function setPlayPauseIcon(isPlaying) {
  isPlayingState = !!isPlaying;
  var btn = document.getElementById("playPauseBtn");
  btn.innerHTML = isPlaying
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-pause-fill" viewBox="0 0 16 16">
        <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5"/>
       </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
        <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
       </svg>`;
  updatePlaybackItemState();
}
function updatePlayBtn() {
  updatePlaybackItemState();
}

function updatePlaybackItemState() {
  const activePlaybackId = getCurrentPlaybackId();
  document.querySelectorAll("[data-playback-id]").forEach((item) => {
    const isActive = !!activePlaybackId && item.getAttribute("data-playback-id") === activePlaybackId;
    const isActiveAndPlaying = isActive && isPlayingState;
    const icon = item.querySelector(".yt-play-icon, .chart-thumb span, .recent-thumb span, .song-play-btn");
    item.classList.toggle("is-playing", isActive);
    item.classList.toggle("is-active-playing", isActiveAndPlaying);
    item.classList.toggle("is-active-paused", isActive && !isPlayingState);
    if (icon) {
      icon.textContent = isActiveAndPlaying ? "❚❚" : "▶";
      icon.style.opacity = isActive ? "1" : "";
    }
  });
}

function getPlaybackId(track) {
  if (!track) return "";
  if (track.videoId) return "youtube:" + track.videoId;
  if (track.trackId || track.id) return "audius:" + (track.trackId || track.id);
  return "";
}

function getCurrentPlaybackId() {
  return getPlaybackId(currentPlayingTrack);
}

function isCurrentPlaybackTrack(track) {
  const id = getPlaybackId(track);
  return !!id && id === getCurrentPlaybackId();
}

function handlePlaybackButtonClick(event, playHandler) {
  if (event) event.stopPropagation();
  if (typeof playHandler === "function") playHandler();
}

function playYouTubeById(videoId, title, artist, image) {
  if (!videoId) return;
  const queueIndex = youtubePlaybackQueue.findIndex((track) => track.videoId === videoId);
  if (queueIndex >= 0) {
    playYouTubeFromQueue(queueIndex);
    return;
  }

  playYouTube(videoId, title || "Bài hát", {
    artist: artist || "Nguồn nhạc",
    image: image || getYouTubeVideoThumbUrl(videoId),
  });
}

function hydrateYouTubeListItems(container) {
  if (!container) return;

  let queueIndex = 0;
  container.querySelectorAll(".yt-song-item").forEach((item) => {
    if (item.classList.contains("audius-song-item")) return;

    const track = youtubePlaybackQueue[queueIndex];
    if (track) {
      if (!item.getAttribute("data-playback-id")) item.setAttribute("data-playback-id", getPlaybackId(track));
    }
    queueIndex += 1;
  });
  updatePlaybackItemState();
}

window.updatePlaybackItemState = updatePlaybackItemState;

function updateMiniPlayerInfo(song) {
  const thumb = document.getElementById("miniPlayerThumb");
  const title = document.getElementById("miniPlayerTitle");
  const artist = document.getElementById("miniPlayerArtist");
  if (!song || !title || !artist || !thumb) return;

  title.textContent = song.title || song.song || "Bai hat";
  artist.textContent = song.artist || song.channelTitle || "Listen Music";
  thumb.src = song.image || song.thumb || song.thumbnail || DEFAULT_SONG_IMAGE;
  updateMiniMoreMenuInfo(song);
}

function setCurrentPlayingTrack(track) {
  currentPlayingTrack = normalizeFavoriteTrack(track);
  updateMiniPlayerInfo(currentPlayingTrack);
  updateMiniFavoriteButton();
  updateMiniDownloadButton();
}

function notifyPlayerAction(message) {
  if (typeof window.showToast === "function") {
    window.showToast(message);
  } else {
    alert(message);
  }
}

function updateMiniMoreMenuInfo(song) {
  const thumb = document.getElementById("miniMoreThumb");
  const title = document.getElementById("miniMoreTitle");
  const meta = document.getElementById("miniMoreMeta");
  if (!song || !thumb || !title || !meta) return;

  title.textContent = song.title || song.song || "Bai hat";
  thumb.src = song.image || song.thumb || song.thumbnail || DEFAULT_SONG_IMAGE;
  const favoriteLabel = isFavoriteTrack(song) ? "Đã thích" : "Thích";
  const sourceLabel = song.videoId ? "Nguồn nhạc" : song.trackId ? "Nguồn nhạc" : "Listen Music";
  meta.textContent = `♡ ${favoriteLabel} · ♫ ${sourceLabel}`;
}

function toggleMiniMoreMenu(event) {
  if (event) event.stopPropagation();
  if (!currentPlayingTrack) {
    notifyPlayerAction("Chưa có bài hát đang phát.");
    return;
  }

  const menu = document.getElementById("miniMoreMenu");
  const btn = document.getElementById("miniMoreBtn");
  if (!menu || !btn) return;

  const shouldOpen = !menu.classList.contains("open");
  updateMiniMoreMenuInfo(currentPlayingTrack);
  menu.classList.toggle("open", shouldOpen);
  btn.classList.toggle("active", shouldOpen);
  menu.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
}

function closeMiniMoreMenu() {
  const menu = document.getElementById("miniMoreMenu");
  const btn = document.getElementById("miniMoreBtn");
  if (menu) {
    menu.classList.remove("open");
    menu.setAttribute("aria-hidden", "true");
  }
  if (btn) btn.classList.remove("active");
}

function getCurrentTrackLink() {
  if (!currentPlayingTrack) return window.location.href;
  if (currentPlayingTrack.videoId) return `https://www.youtube.com/watch?v=${currentPlayingTrack.videoId}`;
  return window.location.href;
}

function getCurrentTrackSearchQuery(suffix = "") {
  if (!currentPlayingTrack) return "";
  return [currentPlayingTrack.title, currentPlayingTrack.artist, suffix].filter(Boolean).join(" ").trim();
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  return Promise.resolve();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCurrentLyricsText() {
  if (!currentPlayingTrack) return "";
  const lyrics = currentPlayingTrack.lyrics || currentPlayingTrack.lyric || currentPlayingTrack.words || "";
  if (Array.isArray(lyrics)) return lyrics.join("\n");
  return String(lyrics || "").trim();
}

function renderLyricsContent(track, lyricsText) {
  const lyrics = String(lyricsText || getCurrentLyricsText()).trim();
  if (lyrics) {
    return lyrics
      .split(/\r?\n/)
      .map((line) => `<p class="lyrics-modal-line">${line.trim() ? escapeHtml(line) : "&nbsp;"}</p>`)
      .join("");
  }

  const title = escapeHtml((track && track.title) || "bài hát này");
  const artist = escapeHtml((track && track.artist) || "Listen Music");
  return `
    <div class="lyrics-empty">
      <strong>Listen Music chưa có lời cho "${title}".</strong>
      <span>Nghệ sĩ: ${artist}</span>
      <span>Bạn có thể đóng góp lời bài hát để hiển thị tại đây.</span>
    </div>
  `;
}

function renderLyricsLoading(track) {
  const title = escapeHtml((track && track.title) || "bài hát này");
  return `
    <div class="lyrics-empty">
      <strong>Đang tìm lời bài hát...</strong>
      <span>${title}</span>
    </div>
  `;
}

function cleanLyricsText(value) {
  return String(value || "")
    .replace(/^\[[^\]]+\]\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeLyricsSearchValue(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/\([^)]*(official|mv|music video|lyrics?|lyric video|audio|visualizer|karaoke|vietsub|remix|cover)[^)]*\)/gi, " ")
    .replace(/\[[^\]]*(official|mv|music video|lyrics?|lyric video|audio|visualizer|karaoke|vietsub|remix|cover)[^\]]*\]/gi, " ")
    .replace(/\b(official|mv|music video|audio|lyrics?|lyric video|visualizer|karaoke|vietsub|4k|hd)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+\|$/g, "")
    .trim();
}

function getLyricsSearchInfo(track) {
  const rawTitle = track ? track.title || track.song || "" : "";
  const rawArtist = track ? track.artist || track.channelTitle || "" : "";
  const titleParts = normalizeLyricsSearchValue(rawTitle)
    .split("|")
    .map((part) => normalizeLyricsSearchValue(part))
    .filter(Boolean);
  const artistParts = normalizeLyricsSearchValue(rawArtist)
    .split("|")
    .map((part) => normalizeLyricsSearchValue(part))
    .filter(Boolean);

  return {
    title: titleParts[0] || normalizeLyricsSearchValue(rawTitle),
    artist: artistParts[0] || titleParts[1] || normalizeLyricsSearchValue(rawArtist),
  };
}

function getLyricsCacheKey(track) {
  const info = getLyricsSearchInfo(track);
  return LYRICS_CACHE_PREFIX + encodeURIComponent((info.title + "|" + info.artist).toLowerCase());
}

function scoreLyricsResult(result, info) {
  const trackName = String(result.trackName || "").toLowerCase();
  const artistName = String(result.artistName || "").toLowerCase();
  const title = info.title.toLowerCase();
  const artist = info.artist.toLowerCase();
  let score = 0;
  if (trackName === title) score += 80;
  else if (trackName.includes(title) || title.includes(trackName)) score += 45;
  if (artist && artistName === artist) score += 45;
  else if (artist && (artistName.includes(artist) || artist.includes(artistName))) score += 24;
  if (result.plainLyrics) score += 12;
  if (result.syncedLyrics) score += 8;
  return score;
}

async function fetchLyricsFromLrclib(track) {
  const info = getLyricsSearchInfo(track);
  if (!info.title) return "";

  const cacheKey = getLyricsCacheKey(track);
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;

  const searchUrls = [];
  const detailParams = new URLSearchParams({ track_name: info.title });
  if (info.artist) detailParams.set("artist_name", info.artist);
  searchUrls.push(`https://lrclib.net/api/search?${detailParams.toString()}`);

  const keywordQueries = [
    [info.title, info.artist].filter(Boolean).join(" "),
    [info.title, info.artist.replace(/\s+x\s+/gi, " ")].filter(Boolean).join(" "),
    info.title,
  ]
    .map((query) => query.trim())
    .filter((query, index, list) => query && list.indexOf(query) === index);

  keywordQueries.forEach((query) => {
    searchUrls.push(`https://lrclib.net/api/search?${new URLSearchParams({ q: query }).toString()}`);
  });

  let results = [];
  for (const url of searchUrls) {
    const response = await fetch(url);
    if (!response.ok) continue;
    const items = await response.json();
    if (Array.isArray(items) && items.length) {
      results = items;
      break;
    }
  }

  if (!results.length) return "";

  const best = results
    .filter((item) => item && (item.plainLyrics || item.syncedLyrics))
    .sort((a, b) => scoreLyricsResult(b, info) - scoreLyricsResult(a, info))[0];

  const lyrics = cleanLyricsText(best && (best.plainLyrics || best.syncedLyrics));
  if (lyrics) localStorage.setItem(cacheKey, lyrics);
  return lyrics;
}

async function fetchCurrentLyrics(track) {
  const existing = getCurrentLyricsText();
  if (existing) return existing;
  return fetchLyricsFromLrclib(track);
}

async function showCurrentLyrics() {
  if (!currentPlayingTrack) {
    notifyPlayerAction("Chưa có bài hát đang phát.");
    return;
  }

  const overlay = document.getElementById("lyricsModalOverlay");
  const body = document.getElementById("lyricsModalBody");
  if (!overlay || !body) return;

  body.innerHTML = renderLyricsLoading(currentPlayingTrack);
  overlay.classList.add("open");

  try {
    const lyrics = await fetchCurrentLyrics(currentPlayingTrack);
    body.innerHTML = renderLyricsContent(currentPlayingTrack, lyrics);
  } catch (error) {
    console.warn("Lyrics fetch failed:", error);
    body.innerHTML = renderLyricsContent(currentPlayingTrack, "");
  }
}

function closeLyricsModal() {
  const overlay = document.getElementById("lyricsModalOverlay");
  if (overlay) overlay.classList.remove("open");
}

function contributeCurrentLyrics() {
  const title = currentPlayingTrack ? currentPlayingTrack.title || "bài hát này" : "bài hát này";
  notifyPlayerAction(`Cảm ơn bạn! Tính năng đóng góp lời cho "${title}" sẽ sớm được mở.`);
}

function blockCurrentTrack() {
  closeMiniMoreMenu();
  if (!currentPlayingTrack) return;
  const blocked = JSON.parse(localStorage.getItem("blockedTracks") || "[]");
  const id = getFavoriteIdentity(currentPlayingTrack);
  if (id && !blocked.includes(id)) {
    blocked.push(id);
    localStorage.setItem("blockedTracks", JSON.stringify(blocked.slice(-100)));
  }
  notifyPlayerAction("Đã chặn bài hát này khỏi gợi ý.");
}

function playSimilarContent() {
  closeMiniMoreMenu();
  const query = getCurrentTrackSearchQuery("official audio");
  if (!query) return;
  searchYouTube(query, true);
  notifyPlayerAction("Đang phát nội dung tương tự.");
}

function addCurrentToPlaylist() {
  closeMiniMoreMenu();
  toggleCurrentFavorite();
}

function playCurrentWithLyrics() {
  closeMiniMoreMenu();
  const query = getCurrentTrackSearchQuery("lyrics video");
  if (!query) return;
  searchYouTube(query, true);
  notifyPlayerAction("Đang tìm bản có lời bài hát.");
}

function copyCurrentTrackLink() {
  closeMiniMoreMenu();
  copyTextToClipboard(getCurrentTrackLink())
    .then(() => notifyPlayerAction("Đã sao chép link."))
    .catch(() => notifyPlayerAction("Không thể sao chép link."));
}

function shareCurrentTrack() {
  closeMiniMoreMenu();
  if (!currentPlayingTrack) return;
  const shareData = {
    title: currentPlayingTrack.title || "Listen Music",
    text: `${currentPlayingTrack.title || "Bài hát"} - ${currentPlayingTrack.artist || "Listen Music"}`,
    url: getCurrentTrackLink(),
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
    return;
  }

  copyTextToClipboard(shareData.url)
    .then(() => notifyPlayerAction("Trình duyệt chưa hỗ trợ chia sẻ, đã sao chép link."))
    .catch(() => notifyPlayerAction("Không thể chia sẻ bài hát."));
}

document.addEventListener("click", (event) => {
  const menu = document.getElementById("miniMoreMenu");
  const btn = document.getElementById("miniMoreBtn");
  if (!menu || !btn) return;
  if (!menu.contains(event.target) && !btn.contains(event.target)) closeMiniMoreMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeLyricsModal();
    closeVipAd();
  }
});

function getFavoriteSongs() {
  return Array.isArray(window.favoriteSongs) ? window.favoriteSongs : [];
}

function saveFavoriteSongs(items) {
  window.favoriteSongs = Array.isArray(items) ? items : [];
}

function getFavoriteIdentity(track) {
  if (!track) return "";
  if (track.type === "youtube" && track.videoId) return "youtube:" + track.videoId;
  if (track.type === "audius" && track.trackId) return "audius:" + track.trackId;
  return (track.type || "song") + ":" + encodeURIComponent((track.title || "") + "|" + (track.artist || ""));
}

function normalizeFavoriteTrack(track) {
  if (!track) return null;
  return {
    type: track.type || (track.videoId ? "youtube" : track.trackId || track.id ? "audius" : "song"),
    title: track.title || track.song || "Bai hat",
    artist: track.artist || track.channelTitle || "Listen Music",
    image: track.image || track.thumb || track.thumbnail || DEFAULT_SONG_IMAGE,
    videoId: track.videoId || "",
    trackId: track.trackId || track.id || "",
    artwork: track.artwork || null,
    duration: track.duration || getCurrentTrackDuration(track) || 0,
  };
}

function getCurrentTrackDuration(track) {
  if (!track || !currentPlayingTrack) return 0;
  if (getFavoriteIdentity(track) !== getFavoriteIdentity(currentPlayingTrack)) return 0;

  if (currentAudio && Number.isFinite(currentAudio.duration)) {
    return Math.floor(currentAudio.duration);
  }

  if (ytPlayer && ytReady && typeof ytPlayer.getDuration === "function") {
    const duration = ytPlayer.getDuration();
    return Number.isFinite(duration) ? Math.floor(duration) : 0;
  }

  return 0;
}

function getDownloadedIdentity(track) {
  if (!track) return "";
  if (track.videoId) return track.videoId;
  if (track.trackId) return "audius:" + track.trackId;
  return (track.type || "song") + ":" + (track.title || "") + "|" + (track.artist || "");
}

function updateMiniDownloadButton() {
  const btn = document.getElementById("downloadTrackBtn");
  if (!btn) return;

  const songId = getDownloadedIdentity(currentPlayingTrack);
  if (songId) {
    btn.setAttribute("data-download-song-id", songId);
  } else {
    btn.removeAttribute("data-download-song-id");
  }

  if (typeof window.refreshDownloadButtons === "function") {
    window.refreshDownloadButtons();
  }
}

function isFavoriteTrack(track) {
  const id = getFavoriteIdentity(track);
  if (!id || !window.isUserLoggedIn) return false;
  if (window.favoriteSongIds && typeof window.favoriteSongIds.has === "function") {
    return window.favoriteSongIds.has(id);
  }
  return getFavoriteSongs().some((item) => getFavoriteIdentity(item) === id);
}

function updateMiniFavoriteButton() {
  const btn = document.getElementById("miniFavoriteBtn");
  if (!btn) return;
  const active = isFavoriteTrack(currentPlayingTrack);
  btn.classList.toggle("active", active);
  btn.textContent = active ? "♥" : "♡";
  updateMiniMoreMenuInfo(currentPlayingTrack);
}

function toggleCurrentFavorite(event) {
  if (event) event.stopPropagation();
  if (!currentPlayingTrack) return;

  const track = normalizeFavoriteTrack(currentPlayingTrack);
  const id = getFavoriteIdentity(track);
  if (!id) return;

  if (!window.isUserLoggedIn || typeof window.toggleFavoriteSong !== "function") {
    if (typeof window.showToast === "function") {
      window.showToast("Vui lòng đăng nhập");
    } else {
      alert("Vui lòng đăng nhập");
    }
    return;
  }

  window.toggleFavoriteSong(track);
}

function sanitizeDownloadFileName(value) {
  return String(value || "listen-music")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function downloadCurrentTrack() {
  if (!currentPlayingTrack) {
    alert("Chưa có bài hát đang phát để tải.");
    return;
  }

  if (typeof window.saveDownloadedSong === "function") {
    window.saveDownloadedSong(currentPlayingTrack);
    return;
  }

  if (typeof window.toggleDownloadedSong === "function") {
    window.toggleDownloadedSong(currentPlayingTrack);
    return;
  }

  alert("Chức năng Đã Tải chưa sẵn sàng. Vui lòng thử lại sau.");
}

function playDownloadedTrack(track) {
  if (!track) return;

  if (isCurrentPlaybackTrack(track)) {
    togglePlay();
    return;
  }

  if (track.videoId) {
    userPausedPlayback = false;
    playYouTube(track.videoId, track.title || "Bài hát", {
      artist: track.artist || "Nguồn nhạc",
      image: track.thumbnail || track.image,
    });
    return;
  }

  if (track.trackId || track.id) {
    audiusTracks = [
      {
        id: track.trackId || track.id,
        title: track.title,
        duration: track.duration,
        artwork: track.artwork,
        user: { name: track.artist || "Audius Artist" },
      },
    ];
    playAudiusTrack(0);
  }
}

function showMiniPlayer() {
  document.querySelector(".player-bar").classList.add("active");
}

function stopYouTubePlayback() {
  stopYouTubeProgressTimer();
  if (ytPlayer && ytReady && typeof ytPlayer.stopVideo === "function") {
    ytPlayer.stopVideo();
  }
}

function stopYouTubeProgressTimer() {
  if (youtubeProgressTimer) {
    clearInterval(youtubeProgressTimer);
    youtubeProgressTimer = null;
  }
}

function startYouTubeProgressTimer() {
  stopYouTubeProgressTimer();
  youtubeProgressTimer = setInterval(updateProgress, 500);
}

function prevSong() {
  if (currentAudioSource === "youtube") {
    if (currentYouTubeIndex > 0) {
      playYouTubeFromQueue(currentYouTubeIndex - 1);
    } else if (ytPlayer && ytReady) {
      userPausedPlayback = false;
      ytPlayer.seekTo(0, true);
      ytPlayer.playVideo();
      setPlayPauseIcon(true);
    }
    return;
  }

  if (currentAudioSource === "chart") {
    if (currentChartIndex > 0) {
      playChartTrack(currentChartIndex - 1);
    } else if (ytPlayer && ytReady && typeof ytPlayer.seekTo === "function") {
      userPausedPlayback = false;
      ytPlayer.seekTo(0, true);
      ytPlayer.playVideo();
      setPlayPauseIcon(true);
    } else if (currentAudio) {
      userPausedPlayback = false;
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
      userPausedPlayback = false;
      currentAudio.currentTime = 0;
      currentAudio.play();
      setPlayPauseIcon(true);
    }
    return;
  }

  if (currentAudio) {
    userPausedPlayback = false;
    currentAudio.currentTime = 0;
    currentAudio.play();
    setPlayPauseIcon(true);
    updatePlayBtn();
  }
}

function nextSong() {
  if (currentAudioSource === "youtube") {
    if (currentYouTubeIndex + 1 < youtubePlaybackQueue.length) {
      playYouTubeFromQueue(currentYouTubeIndex + 1);
    } else if (youtubePlaybackQueue.length > 0) {
      playYouTubeFromQueue(0);
    }
    return;
  }

  if (currentAudioSource === "chart") {
    if (currentChartIndex + 1 < chartTracks.length) {
      playChartTrack(currentChartIndex + 1);
    } else if (chartTracks.length > 0) {
      playChartTrack(0);
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

}

function togglePlay() {
  if (currentAudioSource === "youtube" || (currentAudioSource === "chart" && ytPlayer && ytReady)) {
    if (!ytPlayer || !ytReady || typeof ytPlayer.getPlayerState !== "function") return;
    const state = ytPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) {
      userPausedPlayback = true;
      ytPlayer.pauseVideo();
      setPlayPauseIcon(false);
    } else {
      userPausedPlayback = false;
      ytPlayer.playVideo();
      setPlayPauseIcon(true);
    }
    return;
  }

  if (!currentAudio) return;

  if (currentAudio.paused) {
    userPausedPlayback = false;
    currentAudio.play();
    setPlayPauseIcon(true);
  } else {
    userPausedPlayback = true;
    currentAudio.pause();
    setPlayPauseIcon(false);
  }
  updatePlayBtn();
}

// ============================
// KEYBOARD CONTROL
// ============================

document.addEventListener("keydown", function (e) {
  if (document.activeElement.tagName === "INPUT") return;

  switch (e.key) {
    case "ArrowUp":
      e.preventDefault();
      updateVolume(Math.min(100, parseInt(document.getElementById("volumeSlider").value || "100", 10) + 10));
      break;
    case "ArrowDown":
      e.preventDefault();
      updateVolume(Math.max(0, parseInt(document.getElementById("volumeSlider").value || "100", 10) - 10));
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
  if (ytPlayer && ytReady && typeof ytPlayer.setVolume === "function") ytPlayer.setVolume(value);
  document.getElementById("volumeSlider").value = value;
  document.getElementById("volumeText").textContent = value;

  var icon = document.getElementById("volumeIcon");
  if (value == 0) icon.textContent = "Mute";
  else if (value < 50) icon.textContent = "Vol";
  else icon.textContent = "Vol";
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
    lastVolume = parseInt(document.getElementById("volumeSlider").value || "100", 10);
    updateVolume(0);
    isMuted = true;
  }
}

const HOME_ADS = [
  {
    brand: "Listen Music",
    title: "Top 100",
    copy: "Khám phá nhanh các bài hát nổi bật và playlist đang được nghe nhiều.",
    buttonText: "Khám phá ngay",
    action: function () {
      showPage("top100Page");
      setActive(document.querySelector(".sidebar-menu a:nth-child(3)"));
    },
    bgImage: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=1800&q=95",
  },
  {
    brand: "Listen Music",
    title: "Thưởng thức âm nhạc",
    copy: "Mở playlist yêu thích, tìm nghệ sĩ mới và nghe nhạc mỗi ngày.",
    buttonText: "Nghe ngay",
    action: function () {
      showPage("homePage");
      setActive(document.querySelector(".sidebar-menu a"));
    },
    bgImage: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1800&q=95",
  },
  {
    brand: "Listen Music",
    title: "Playlist cập nhật",
    copy: "Các chủ đề nghe nhanh được làm mới để bạn dễ chọn bài phù hợp.",
    buttonText: "Xem Top 100",
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

const VIP_AD_LAST_KEY = "listen_music_last_vip_ad_index";
const VIP_POPUP_ADS = [
  {
    plan: "BASIC",
    title: "Muốn nghe nhạc không quảng cáo?",
    copy: "Gói Basic giúp bạn loại bỏ quảng cáo, nghe nhạc 320kbps và tải tối đa 100 bài yêu thích.",
    price: "29K",
    cycle: "/tháng",
    benefits: ["Không quảng cáo", "320kbps", "Tải 100 bài"],
    colors: ["#7c3aed", "#db2777"],
  },
  {
    plan: "PLUS",
    title: "Playlist của bạn mượt hơn với Plus",
    copy: "Mở rộng trải nghiệm nghe nhạc với offline lớn hơn, gợi ý cá nhân hóa và ít gián đoạn hơn.",
    price: "59K",
    cycle: "/tháng",
    benefits: ["Tải 1.000 bài", "Gợi ý riêng", "Ưu tiên mới"],
    colors: ["#8b5cf6", "#0ea5e9"],
  },
  {
    plan: "PRO",
    title: "Nghe nhiều hơn, giới hạn ít hơn",
    copy: "Gói Pro dành cho người nghe thường xuyên, tải không giới hạn và được ưu tiên các tính năng mới.",
    price: "99K",
    cycle: "/tháng",
    benefits: ["Tải không giới hạn", "Chất lượng cao", "Hỗ trợ ưu tiên"],
    colors: ["#f59e0b", "#7c3aed"],
  },
  {
    plan: "YEAR",
    title: "Tiết kiệm hơn với gói năm",
    copy: "Thanh toán theo năm để giữ trải nghiệm VIP ổn định, nghe nhạc liền mạch trong thời gian dài.",
    price: "299K",
    cycle: "/năm",
    benefits: ["Basic cả năm", "Giá tốt hơn", "Không quảng cáo"],
    colors: ["#06b6d4", "#7c3aed"],
  },
  {
    plan: "VIP",
    title: "Tải nhạc offline cho mọi mood",
    copy: "Lưu bài hát yêu thích để nghe lại khi học tập, làm việc hoặc thư giãn mà không cần tìm lại.",
    price: "59K",
    cycle: "/tháng",
    benefits: ["Nghe offline", "Thư viện riêng", "Playlist cá nhân"],
    colors: ["#db2777", "#f97316"],
  },
];

function getRandomVipAdIndex() {
  if (VIP_POPUP_ADS.length <= 1) return 0;
  const lastIndex = Number(localStorage.getItem(VIP_AD_LAST_KEY));
  let nextIndex = Math.floor(Math.random() * VIP_POPUP_ADS.length);
  if (Number.isFinite(lastIndex) && nextIndex === lastIndex) {
    nextIndex = (nextIndex + 1 + Math.floor(Math.random() * (VIP_POPUP_ADS.length - 1))) % VIP_POPUP_ADS.length;
  }
  localStorage.setItem(VIP_AD_LAST_KEY, String(nextIndex));
  return nextIndex;
}

function renderVipAd(ad) {
  const modal = document.getElementById("vipAdModal");
  if (!modal || !ad) return;

  modal.style.setProperty("--vip-ad-start", ad.colors[0]);
  modal.style.setProperty("--vip-ad-end", ad.colors[1]);
  document.getElementById("vipAdPlan").textContent = ad.plan;
  document.getElementById("vipAdTitle").textContent = ad.title;
  document.getElementById("vipAdCopy").textContent = ad.copy;
  document.getElementById("vipAdPrice").textContent = ad.price;
  document.getElementById("vipAdCycle").textContent = ad.cycle;

  const benefitList = document.getElementById("vipAdBenefits");
  if (benefitList) {
    benefitList.innerHTML = "";
    ad.benefits.forEach((benefit) => {
      const item = document.createElement("li");
      item.textContent = benefit;
      benefitList.appendChild(item);
    });
  }

  const action = document.getElementById("vipAdAction");
  if (action) {
    action.onclick = function () {
      window.location.href = "vip.html";
    };
  }
}

function openVipAd() {
  const overlay = document.getElementById("vipAdOverlay");
  if (!overlay) return;

  const vipBadge = document.getElementById("vipBadge");
  if (vipBadge && getComputedStyle(vipBadge).display !== "none") return;

  renderVipAd(VIP_POPUP_ADS[getRandomVipAdIndex()]);
  overlay.classList.add("open");
}

function closeVipAd() {
  const overlay = document.getElementById("vipAdOverlay");
  if (overlay) overlay.classList.remove("open");
}

function initVipAdPopup() {
  setTimeout(openVipAd, 900);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initVipAdPopup);
} else {
  initVipAdPopup();
}

// ============================
// PROGRESS BAR
// ============================

function updateProgress() {
  var bar = document.getElementById("progressBar");
  var current = document.getElementById("currentTime");
  var dur = document.getElementById("duration");

  if ((currentAudioSource === "youtube" || currentAudioSource === "chart") && ytPlayer && ytReady && typeof ytPlayer.getDuration === "function") {
    const duration = ytPlayer.getDuration() || 0;
    const currentTime = ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() || 0 : 0;
    bar.max = duration || 0;
    bar.value = currentTime;
    current.textContent = formatTime(currentTime);
    dur.textContent = formatTime(duration);
    return;
  }

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
  if ((currentAudioSource === "youtube" || currentAudioSource === "chart") && ytPlayer && ytReady && typeof ytPlayer.seekTo === "function") {
    ytPlayer.seekTo(parseFloat(this.value || "0"), true);
    return;
  }
  if (currentAudio) currentAudio.currentTime = this.value;
});

// ============================
// PAGE NAVIGATION
// ============================

var currentPage = "homePage";

function goHistoryBack() {
  history.back();
}

function showPage(page) {
  var pageIds = ["homePage", "libraryPage", "favoritePage", "downloadPage", "uploadPage", "mvPage", "artistPage", "artistSongsPage", "top100Page", "zingChartPage", "recentPage", "youtubePage", "aboutPage", "termsPage", "privacyPage"];
  pageIds.forEach(function (p) {
    var el = document.getElementById(p);
    if (el) el.style.display = "none";
  });

  var target = document.getElementById(page);
  if (target) {
    target.style.display = "block";
    currentPage = page;
    window.currentPage = page;
  }

  if (page === "artistPage") {
    loadArtistPage();
  }

  if (page === "recentPage") {
    renderRecentSongs();
  }

  if (page === "favoritePage") {
    renderFavoriteList();
  }

  if (page === "downloadPage") {
    if (typeof window.renderDownloadedSongs === "function") {
      window.renderDownloadedSongs();
    } else {
      setTimeout(function () {
        if (typeof window.renderDownloadedSongs === "function") {
          window.renderDownloadedSongs();
        }
      }, 300);
    }
  }

  if (page === "zingChartPage") {
    renderZingChartPage();
  }

  history.pushState({ page: page }, "");
}

window.onpopstate = function (event) {
  if (event.state && event.state.page) {
    var pageIds = ["homePage", "libraryPage", "favoritePage", "downloadPage", "uploadPage", "mvPage", "artistPage", "artistSongsPage", "top100Page", "zingChartPage", "recentPage", "youtubePage", "aboutPage", "termsPage", "privacyPage"];
    pageIds.forEach(function (p) {
      var el = document.getElementById(p);
      if (el) el.style.display = "none";
    });
    var target = document.getElementById(event.state.page);
    if (target) {
      target.style.display = "block";
      currentPage = event.state.page;
      window.currentPage = event.state.page;
    }
    if (event.state.page === "artistPage") {
      loadArtistPage();
    }
    if (event.state.page === "recentPage") {
      renderRecentSongs();
    }
    if (event.state.page === "favoritePage") {
      renderFavoriteList();
    }
    if (event.state.page === "downloadPage" && typeof window.renderDownloadedSongs === "function") {
      window.renderDownloadedSongs();
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

  if (!window.isUserLoggedIn) {
    list.innerHTML = '<div class="artist-loading">Chưa có bài hát yêu thích.</div>';
    return;
  }

  const favorites = getFavoriteSongs();
  if (!favorites.length) {
    list.innerHTML = '<div class="artist-loading">Chưa có bài hát yêu thích.</div>';
    return;
  }

  list.innerHTML = favorites
    .map(
      (song, i) => `
      <div class="song-item" data-playback-id="${getPlaybackId(song)}" onclick="playFavoriteTrack(${i})">
        <span class="song-index" style="color:${COLORS[i % COLORS.length]};font-size:18px;font-weight:700;">
          <span class="song-num">${i + 1}</span>
        </span>
        <div class="song-thumb">
          <div class="song-img-wrap">
            <img src="${song.image || getSongDisplayImage(song, i)}"
                 onerror="this.style.display='none'" />
            <span class="song-play-btn" onclick="handlePlaybackButtonClick(event, () => playFavoriteTrack(${i}))">&#9654;</span>
          </div>
          <span class="song-name">${song.title}</span>
        </div>
        <span class="song-artist">${song.artist}</span>
        <span class="song-duration" id="favorite-dur-${i}">${getFavoriteDurationLabel(song)}</span>
      </div>
    `,
    )
    .join("");
  updatePlaybackItemState();
  loadFavoriteDurations();
}

function getFavoriteDurationLabel(song) {
  const liveDuration = getCurrentTrackDuration(song);
  if (liveDuration) return formatTime(liveDuration);

  if (song.duration) return formatTime(song.duration);

  return "--:--";
}

function loadFavoriteDurations() {
  const favorites = getFavoriteSongs();
  const missingYouTubeIds = [];

  favorites.forEach((song, index) => {
    const label = document.getElementById(`favorite-dur-${index}`);
    if (!label) return;

    const knownDuration = getFavoriteDurationLabel(song);
    if (knownDuration !== "--:--") {
      label.textContent = knownDuration;
      return;
    }

    if (song.videoId) {
      const cachedDuration = readCachedYouTubeDuration(song.videoId);
      if (cachedDuration) {
        saveFavoriteDuration(index, song, cachedDuration);
        label.textContent = formatTime(cachedDuration);
        return;
      }
      missingYouTubeIds.push(song.videoId);
      return;
    }

  });

  if (missingYouTubeIds.length) {
    fetchYouTubeDurations(missingYouTubeIds).then((durationMap) => {
      const latestFavorites = getFavoriteSongs();
      latestFavorites.forEach((song, index) => {
        if (!song.videoId || !durationMap[song.videoId]) return;
        saveFavoriteDuration(index, song, durationMap[song.videoId]);
        const label = document.getElementById(`favorite-dur-${index}`);
        if (label) label.textContent = formatTime(durationMap[song.videoId]);
      });
    });
  }
}

function saveFavoriteDuration(index, song, duration) {
  if (!duration) return;
  const favorites = getFavoriteSongs();
  const current = favorites[index];
  if (!current || getFavoriteIdentity(current) !== getFavoriteIdentity(song)) return;
  current.duration = duration;
  saveFavoriteSongs(favorites);
  if (typeof window.updateFavoriteSongDuration === "function") {
    window.updateFavoriteSongDuration(getFavoriteIdentity(current), duration);
  }
}

function readCachedYouTubeDuration(videoId) {
  const duration = Number(localStorage.getItem(YOUTUBE_DURATION_CACHE_PREFIX + videoId) || 0);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function writeCachedYouTubeDuration(videoId, duration) {
  if (!videoId || !duration) return;
  localStorage.setItem(YOUTUBE_DURATION_CACHE_PREFIX + videoId, String(duration));
}

function fetchYouTubeDurations(videoIds) {
  const uniqueIds = Array.from(new Set(videoIds)).filter(Boolean);
  if (!uniqueIds.length) return Promise.resolve({});

  const cachedMap = {};
  const idsToFetch = uniqueIds.filter((videoId) => {
    const cachedDuration = readCachedYouTubeDuration(videoId);
    if (cachedDuration) cachedMap[videoId] = cachedDuration;
    return !cachedDuration;
  });

  if (!idsToFetch.length) return Promise.resolve(cachedMap);

  const chunks = [];
  for (let i = 0; i < idsToFetch.length; i += 50) chunks.push(idsToFetch.slice(i, i + 50));

  return Promise.all(
    chunks.map((chunk) => {
      return fetchYouTubeApi("videos", {
        part: "contentDetails",
        id: chunk.join(","),
      })
        .then((data) => {
          if (data.error) throw new Error(data.error.message || "YouTube API error");
          return data.items || [];
        });
    }),
  )
    .then((groups) => {
      const durationMap = { ...cachedMap };
      groups.flat().forEach((item) => {
        const duration = parseYouTubeIsoDuration(item.contentDetails && item.contentDetails.duration);
        if (!item.id || !duration) return;
        durationMap[item.id] = duration;
        writeCachedYouTubeDuration(item.id, duration);
      });
      return durationMap;
    })
    .catch((error) => {
      console.warn("Không lấy được thời lượng YouTube:", error);
      return cachedMap;
    });
}

function parseYouTubeIsoDuration(value) {
  const match = String(value || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function playFavoriteTrack(index) {
  const song = getFavoriteSongs()[index];
  if (!song) return;

  if (isCurrentPlaybackTrack(song)) {
    togglePlay();
    return;
  }

  if (song.type === "youtube" && song.videoId) {
    playYouTube(song.videoId, song.title, { artist: song.artist, image: song.image });
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

}

function removeFavoriteTrack(event, index) {
  event.stopPropagation();
  const song = getFavoriteSongs()[index];
  if (!song) return;
  if (typeof window.removeFavoriteSong === "function") {
    window.removeFavoriteSong(getFavoriteIdentity(song));
  }
}

const RECENT_SONGS_KEY = "listen_music_recent_songs";
const RECENT_SONGS_LIMIT = 50;
const CACHE_7_DAYS = 7 * 24 * 60 * 60 * 1000;
const ARTIST_PHOTO_CACHE_VERSION = "v8_verified_artist_portraits";
const ARTIST_DYNAMIC_PHOTO_LOOKUP_ENABLED = false;
const SEARCH_CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const SEARCH_MIN_QUERY_LENGTH = 1;
const SEARCH_DEBOUNCE_DELAY = 1200;
const YOUTUBE_PAGE_SIZE = 50;
const SEARCH_RESULTS_COUNT = 50;
const TOP100_RESULTS_COUNT = 100;
const EXPLORE_TOPIC_RESULTS_COUNT = 100;
const VIETNAMESE_CHART_CACHE_KEY = "db_vietnamese_all_time_chart_v1";
const VIETNAMESE_CHART_COUNT = 100;
let currentTop100State = null;
let artistSongDatabasePromise = null;
let artistSongDatabaseCache = null;
let artistSongDatabaseTracks = [];
let artistPhotoObserver = null;
let currentArtistDetailIndex = -1;

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

function loadArtistSongDatabase(forceReload) {
  if (!forceReload && artistSongDatabasePromise) return artistSongDatabasePromise;

  artistSongDatabasePromise = fetch("data/artists-by-genre/index.json", {
    cache: forceReload ? "reload" : "no-store",
  })
    .then((response) => {
      if (!response.ok) throw new Error("Cannot load artists-by-genre/index.json");
      return response.json();
    })
    .then((indexDb) => {
      const genres = Array.isArray(indexDb.genres) ? indexDb.genres : [];
      return Promise.all(
        genres.map((genre) =>
          fetch("data/artists-by-genre/" + genre.file, {
            cache: forceReload ? "reload" : "no-store",
          })
            .then((response) => {
              if (!response.ok) throw new Error("Cannot load " + genre.file);
              return response.json();
            })
            .then((genreDb) => ({
              ...genreDb,
              id: genreDb.id || genre.id,
              name: genreDb.name || genre.name,
            })),
        ),
      ).then((genreDbs) => ({
        source: indexDb.source || "artists-by-genre",
        genres: genreDbs,
        artists: genreDbs.flatMap((genreDb) =>
          (genreDb.artists || []).map((artist) => ({
            ...artist,
            genreId: genreDb.id,
            genreName: genreDb.name,
          })),
        ),
      }));
    })
    .then((db) => {
      artistSongDatabaseCache = db || {};
      artistSongDatabaseTracks = flattenArtistSongDatabase(artistSongDatabaseCache);
      return artistSongDatabaseCache;
    });

  return artistSongDatabasePromise;
}

function flattenArtistSongDatabase(db) {
  const tracks = [];
  (db.artists || []).forEach((artist, artistIndex) => {
    const songs = artist.songs || artist.videos || [];
    songs.forEach((song, songIndex) => {
      const item = normalizeDatabaseSongToYouTubeItem(artist, song, artistIndex, songIndex);
      if (item) tracks.push(item);
    });
  });
  return tracks;
}

function normalizeDatabaseSongToYouTubeItem(artist, song, artistIndex, songIndex) {
  const youtube = (song && song.youtube) || {};
  const videoId = youtube.videoId || song.videoId || "";
  if (!videoId) return null;

  const artistName = song.artist || artist.name || "Nguồn nhạc";
  const songTitle = song.title || song.song || youtube.title || "Bài hát";
  const thumb = youtube.thumbnail || song.thumbnail || song.thumb || getYouTubeVideoThumbUrl(videoId);
  const aliases = Array.isArray(artist.aliases) ? artist.aliases : [];
  const titleForSearch = youtube.title || songTitle;
  const channelTitle = song.channelTitle || youtube.channel || artistName;
  const searchText = [songTitle, titleForSearch, artistName, artist.name, aliases.join(" "), channelTitle, youtube.query, artist.genreName].join(" ");

  return {
    id: { videoId },
    snippet: {
      title: songTitle,
      channelTitle,
      description: youtube.title || "",
      publishedAt: youtube.lastCheckedAt || artist.youtubeLastCheckedAt || "",
      thumbnails: {
        default: { url: thumb },
        medium: { url: thumb },
        high: { url: thumb },
      },
    },
    dbArtist: artistName,
    dbArtistId: artist.id || "",
    dbSongTitle: songTitle,
    dbSearchText: normalizeSearchText(searchText),
    dbArtistText: normalizeSearchText([artistName, artist.name, aliases.join(" ")].join(" ")),
    dbTitleText: normalizeSearchText([songTitle, titleForSearch].join(" ")),
    dbIndex: artistIndex * 1000 + songIndex,
    type: "youtube",
  };
}

function isGenericMusicQuery(query) {
  const value = normalizeSearchText(query);
  return /\b(nhac|music|vpop|viet|vietnam|top|hit|hay nhat|trending|playlist|remix|bolero|ballad|rap|pop|chill|official|mv|audio)\b/.test(value);
}

function scoreDatabaseTrack(item, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 1;

  const title = item.dbTitleText || "";
  const artist = item.dbArtistText || "";
  const haystack = item.dbSearchText || "";
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  let score = 0;

  if (title === normalizedQuery) score += 140;
  if (artist === normalizedQuery) score += 120;
  if (title.includes(normalizedQuery)) score += 95;
  if (artist.includes(normalizedQuery)) score += 85;
  if (haystack.includes(normalizedQuery)) score += 65;

  tokens.forEach((token) => {
    if (title.includes(token)) score += 12;
    if (artist.includes(token)) score += 10;
    if (haystack.includes(token)) score += 4;
  });

  return score;
}

function getScoredDatabaseTracks(query) {
  return artistSongDatabaseTracks
    .map((item) => ({ item, score: scoreDatabaseTrack(item, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.dbIndex - b.item.dbIndex)
    .map((entry) => entry.item);
}

function buildDatabaseSearchResults(query, totalResults) {
  const limit = totalResults || SEARCH_RESULTS_COUNT;
  const scored = getScoredDatabaseTracks(query);

  if (scored.length >= limit || !isGenericMusicQuery(query)) return uniqueVideosById(scored).slice(0, limit);

  const seen = new Set(scored.map((item) => getVideoIdFromItem(item)));
  const fallback = artistSongDatabaseTracks.filter((item) => !seen.has(getVideoIdFromItem(item)));
  return uniqueVideosById(scored.concat(fallback)).slice(0, limit);
}

function fetchMusicDatabaseVideos(query, totalResults, forceReload) {
  return loadArtistSongDatabase(forceReload).then(() => {
    const results = buildDatabaseSearchResults(query, totalResults);
    if (results.length || forceReload) return results;

    return loadArtistSongDatabase(true).then(() => buildDatabaseSearchResults(query, totalResults));
  });
}

function getDatabaseArtists(forceReload) {
  return loadArtistSongDatabase(forceReload).then((db) =>
    (db.artists || [])
      .filter((artist) => hasPlayableArtistVideos(artist))
      .map((artist, index) => {
      const songs = artist.songs || artist.videos || [];
      const firstSong = songs.find((song) => (song.youtube && song.youtube.videoId) || song.videoId) || songs[0] || {};
      const explicitPhoto = artist.photo || artist.image || artist.avatar || artist.picture || "";
      const seedArtist = findMusicSourceArtistSeed(artist.name);
      const seedPhoto = seedArtist && seedArtist.photo ? seedArtist.photo : "";
      const firstSongVideoId = (firstSong.youtube && firstSong.youtube.videoId) || firstSong.videoId || "";
      const firstSongThumb = (firstSong.youtube && firstSong.youtube.thumbnail) || firstSong.thumbnail || firstSong.thumb || (firstSongVideoId ? getYouTubeVideoThumbUrl(firstSongVideoId) : "");
      const photo = explicitPhoto || seedPhoto || "";
      return {
        artist: artist.name,
        source: artist.genreName || "Database",
        song: firstSong.title || "",
        songCount: songs.length,
        sourceRank: index + 1,
        aliases: artist.aliases || [],
        photoVerified: !!artist.photoVerified || !!(seedArtist && seedArtist.photo),
        photoSource: artist.photoSource || (seedArtist && seedArtist.photo ? "seed" : ""),
        photoLookupDisabled: !!artist.photoLookupDisabled,
        preferSongThumb: false,
        fallbackPhoto: firstSongThumb,
        photo,
      };
    }),
  );
}

function hasPlayableArtistVideos(artist) {
  return ((artist && (artist.songs || artist.videos)) || []).some((song) => song && (song.videoId || (song.youtube && song.youtube.videoId)));
}

function getDatabaseArtistSongs(artistName, limit) {
  const target = normalizeSearchText(artistName);
  return loadArtistSongDatabase().then((db) => {
    const artist = (db.artists || []).find((item) => {
      const aliases = [item.name].concat(item.aliases || []).map(normalizeSearchText);
      return aliases.some((alias) => alias && (alias === target || alias.includes(target) || target.includes(alias)));
    });
    if (!artist) return fetchMusicDatabaseVideos(artistName, limit || 120);

    return (artist.songs || artist.videos || [])
      .map((song, index) => normalizeDatabaseSongToYouTubeItem(artist, song, 0, index))
      .filter(Boolean)
      .slice(0, limit || 120);
  });
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
        <div class="recent-song-row" data-playback-id="${getPlaybackId(song)}" onclick="playRecentSong(${i})">
          <div class="recent-rank">${i + 1}</div>
          <div class="recent-thumb">
            <img src="${image}" alt="${song.title}" />
            <span onclick="handlePlaybackButtonClick(event, () => playRecentSong(${i}))">&#9654;</span>
          </div>
          <div class="recent-info">
            <div class="recent-title">${song.title}</div>
            <div class="recent-artist">${artist} &middot; ${getSourceLabel(song.type)}${time ? " &middot; " + time : ""}</div>
          </div>
        </div>
      `;
    })
    .join("");
  updatePlaybackItemState();
}

function getSourceLabel(type) {
  if (type === "audius") return "Audius";
  if (type === "youtube") return "Nguồn nhạc";
  return "Listen Music";
}

function playRecentSong(index) {
  const song = getRecentSongs()[index];
  if (!song) return;

  if (isCurrentPlaybackTrack(song)) {
    togglePlay();
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
    playYouTube(song.videoId, song.title, {
      artist: song.artist || song.channelTitle || "Nguồn nhạc",
      image: song.image || song.thumb || getYouTubeVideoThumbUrl(song.videoId),
    });
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

  localStorage.removeItem(VIETNAMESE_CHART_CACHE_KEY);
  chartTracks = [];
  renderVietnameseYouTubeChart(chartTracks);
}

function renderVietnameseYouTubeChart(items) {
  const list = document.getElementById("zingChartList");
  if (!list) return;

  if (!items || !items.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = items
    .map((song, i) => {
      const medal = getChartMedalClass(i);
      const image = song.thumb || getYouTubeVideoThumbUrl(song.videoId);
      const title = cleanYouTubeTitle(song.title || song.song || "Bài hát");
      const artist = song.artist || song.channelTitle || "Nguồn nhạc";
      const views = song.viewCount ? formatViewCount(song.viewCount) : "Nguồn nhạc";
      return `
        <div class="chart-row chart-source-row" data-playback-id="${getPlaybackId(song)}" onclick="playChartTrack(${i})">
          <div class="chart-rank ${medal}">${i + 1}</div>
          <div class="chart-thumb">
            <img src="${image}" alt="${title}" />
            <span onclick="handlePlaybackButtonClick(event, () => playChartTrack(${i}))">&#9654;</span>
          </div>
          <div class="chart-info">
            <div class="chart-title">${title}</div>
            <div class="chart-artist">${artist} &middot; ${views}</div>
          </div>
        </div>
      `;
    })
    .join("");
  updatePlaybackItemState();
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
  return fetchMusicDatabaseVideos("nhạc việt vpop official music", limit || VIETNAMESE_CHART_COUNT).then((items) =>
    items.map((item, index) => {
      const videoId = getVideoIdFromItem(item);
      const snippet = item.snippet || {};
      const thumbs = snippet.thumbnails || {};
      return {
        type: "youtube",
        artist: item.dbArtist || snippet.channelTitle || "Nguồn nhạc",
        song: item.dbSongTitle || snippet.title || "Bài hát",
        title: snippet.title || item.dbSongTitle || "Bài hát",
        channelTitle: snippet.channelTitle || item.dbArtist || "Nguồn nhạc",
        thumb: (thumbs.high || thumbs.medium || thumbs.default || {}).url || getYouTubeVideoThumbUrl(videoId),
        videoId,
        viewCount: Math.max(1, (limit || VIETNAMESE_CHART_COUNT) - index) * 1000,
        publishedAt: snippet.publishedAt || "",
      };
    }),
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

  const fetchPage = (pageToken) => {
    if (items.length >= totalResults) return Promise.resolve(items.slice(0, totalResults));
    const remaining = totalResults - items.length;
    const size = Math.min(pageSize, remaining);

    return fetchYouTubeApi("search", {
      part: "snippet",
      type: "video",
      order: "viewCount",
      q: query,
      maxResults: size,
      pageToken,
    }).then((data) => {
      if (data.error) throw new Error(data.error.message || "YouTube API error");
      appendUniqueVideos(data.items);
      if (!data.nextPageToken || items.length >= totalResults) return items.slice(0, totalResults);
      return fetchPage(data.nextPageToken);
    });
  };

  return fetchPage("").then((items) => filterPlayableMusicVideos(items, { query, limit: totalResults }));
}

function normalizeVietnameseChartVideo(video) {
  const snippet = video.snippet || {};
  const rawTitle = snippet.title || "";
  const title = cleanYouTubeTitle(rawTitle);
  const normalized = normalizeSearchText(`${rawTitle} ${snippet.channelTitle || ""}`);
  if (!title) return null;

  const stats = video.statistics || {};
  const thumbs = snippet.thumbnails || {};
  const videoId = video.id;
  const viewCount = Number(stats.viewCount || 0);
  if (!videoId || viewCount <= 0) return null;

  const artist = extractArtistFromVideoTitle(title, snippet.channelTitle || "") || cleanupArtistName(snippet.channelTitle || "Nguồn nhạc");
  const song = cleanupSongTitle(extractSongFromVideoTitle(title) || title);
  const thumb = (thumbs.high || thumbs.medium || thumbs.default || {}).url || getYouTubeVideoThumbUrl(videoId);
  const vietnameseSignal = /[à-ỹđ]/i.test(`${rawTitle} ${snippet.channelTitle || ""}`) || /\b(vpop|viet|vietnam|việt|nhạc)\b/i.test(`${rawTitle} ${snippet.channelTitle || ""}`);

  if (!vietnameseSignal || !song) return null;

  return {
    type: "youtube",
    artist,
    song,
    title: rawTitle,
    channelTitle: snippet.channelTitle || "Nguồn nhạc",
    thumb,
    videoId,
    viewCount,
    publishedAt: snippet.publishedAt || "",
  };
}

function playChartTrack(index) {
  const song = chartTracks[index];
  if (!song) return;
  if (isCurrentPlaybackTrack(song)) {
    togglePlay();
    return;
  }
  if (song.type === "youtube" && song.videoId) {
    currentAudioSource = "chart";
    currentChartIndex = index;
    playYouTube(song.videoId, cleanYouTubeTitle(song.title || song.song || "Bai hat"), {
      artist: song.artist || song.channelTitle || "Nguồn nhạc",
      image: song.thumb || song.image || getYouTubeVideoThumbUrl(song.videoId),
      source: "chart",
    });
  }
}

function initializeMusic() {
  renderFavoriteList();
}

initializeMusic();

function getSongDisplayImage(song, index) {
  if (song && song.image) return song.image;
  if (song && song.artwork) {
    const artwork = song.artwork;
    const artUrl = artwork["480x480"] || artwork["150x150"] || artwork["1000x1000"];
    if (artUrl) return artUrl;
  }

  return buildSongPlaceholder(song && song.title ? song.title : "Music", index);
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
  if (searchInput.value.trim()) {
    searchWrapper.classList.add("active");
    searchDropdown.style.display = "block";
    return;
  }
  showSearchHomeDropdown(true);
});

document.addEventListener("click", (e) => {
  if (!searchWrapper.contains(e.target)) {
    searchWrapper.classList.remove("active");
    searchDropdown.style.display = "none";
  }
});

// Tìm kiếm từ database nội bộ để không tốn quota YouTube Search API.
let searchDebounceTimer = null;
let lastSubmittedSearchQuery = "";
let searchRequestToken = 0;
let searchSuggestionOpenCount = 0;
let dynamicTrendingSearchSuggestions = [];
const TRENDING_SEARCH_CACHE_KEY = "listen_music_trending_search_suggestions_v1";
const TRENDING_SEARCH_CACHE_AGE = 30 * 60 * 1000;
const SEARCH_CACHE_VERSION = "db_search_music_v3";

const TRENDING_SEARCH_SUGGESTIONS = [
  "bên ấy em có ai rồi",
  "50 năm về sau",
  "hạt mưa vương vấn",
  "gió đêm qua đường",
  "mất bảo",
  "cụ tuyệt",
  "nơi này có anh",
  "hồn lễ của em",
  "không buông",
  "e là không thể",
  "nhường lại nỗi đau",
  "thiệp hồng sai tên",
  "sóng gió",
  "bạc phận",
  "đom đóm",
  "chúng ta của hiện tại",
  "đừng làm trái tim anh đau",
  "chăm hoa",
  "tái sinh",
  "anh đâu từ lúc em đi",
  "có chắc yêu là đây",
  "thủy triều",
  "ngày mai người ta lấy chồng",
  "rồi tới luôn",
  "cắt đôi nỗi sầu",
  "vaicaunoicokhiennguoithaydoi",
  "nấu ăn cho em",
  "vì mẹ anh bắt chia tay",
  "waiting for you",
  "em xinh",
];

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  searchClear.style.display = q ? "block" : "none";

  if (!q) {
    document.getElementById("searchResults").style.display = "none";
    showSearchHomeDropdown(false);
    clearTimeout(searchDebounceTimer);
    return;
  }

  document.getElementById("searchSuggestions").style.display = "none";
  document.getElementById("searchHistory").style.display = "none";
  document.getElementById("searchResults").style.display = "block";
  clearTimeout(searchDebounceTimer);

  const hasCachedResults = renderCachedYouTubeSearch(q);

  const list = document.getElementById("resultList");
  if (q.length < SEARCH_MIN_QUERY_LENGTH) {
    list.innerHTML = "";
    return;
  }

  if (!hasCachedResults) {
    list.innerHTML = '<div class="yt-loading">Đang tìm kiếm...</div>';
  }

  searchDebounceTimer = setTimeout(() => {
    searchYouTube(q);
  }, SEARCH_DEBOUNCE_DELAY);
});

// Nhấn Enter → tìm ngay, không chờ debounce
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    submitHeaderSearch();
  }
  if (e.key === "Escape") {
    searchDropdown.style.display = "none";
    searchWrapper.classList.remove("active");
    searchInput.blur();
  }
});

function submitHeaderSearch() {
  const q = searchInput.value.trim();
  clearTimeout(searchDebounceTimer);
  searchWrapper.classList.add("active");
  searchDropdown.style.display = "block";

  if (q.length < SEARCH_MIN_QUERY_LENGTH) {
    searchInput.focus();
    showSearchHomeDropdown(false);
    return;
  }

  searchClear.style.display = "block";
  searchYouTube(q, false, { force: true });
}

function clearSearch() {
  searchInput.value = "";
  searchClear.style.display = "none";
  clearTimeout(searchDebounceTimer);
  document.getElementById("searchResults").style.display = "none";
  showSearchHomeDropdown(true);
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

function getRotatingTrendingSuggestions() {
  const pool = [...dynamicTrendingSearchSuggestions, ...TRENDING_SEARCH_SUGGESTIONS];
  const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 6));
  const offset = (daySeed + searchSuggestionOpenCount * 5) % pool.length;
  const rotated = pool.slice(offset).concat(pool.slice(0, offset));
  const recent = searchHistory.map((item) => String(item || "").toLowerCase());
  return rotated.filter((item, index, list) => list.indexOf(item) === index).filter((item) => !recent.includes(item.toLowerCase())).slice(0, 6);
}

function hydrateTrendingSearchSuggestions() {
  try {
    const cached = JSON.parse(localStorage.getItem(TRENDING_SEARCH_CACHE_KEY) || "null");
    if (cached && Date.now() - cached.time < TRENDING_SEARCH_CACHE_AGE && Array.isArray(cached.items)) {
      dynamicTrendingSearchSuggestions = cached.items;
      return;
    }
  } catch (e) {}

  if (typeof fetchVietnameseYouTubeChart !== "function") return;
  fetchVietnameseYouTubeChart(12)
    .then((items) => {
      const suggestions = (items || [])
        .map((item) => cleanupSongTitle(item.song || cleanYouTubeTitle(item.title || "")))
        .filter(Boolean)
        .slice(0, 12);
      if (!suggestions.length) return;
      dynamicTrendingSearchSuggestions = suggestions;
      localStorage.setItem(TRENDING_SEARCH_CACHE_KEY, JSON.stringify({ items: suggestions, time: Date.now() }));
      if (!searchInput.value.trim() && searchDropdown.style.display === "block") renderSuggestions();
    })
    .catch(() => {});
}

function renderSuggestions() {
  const list = document.getElementById("suggestionList");
  if (!list) return;
  list.innerHTML = getRotatingTrendingSuggestions()
    .map(
      (item) => `
      <button class="search-suggestion-item" type="button" onclick="searchSuggestionItem('${escapeInlineString(item)}')">
        <span>↗</span>
        <strong>${escapeHtml(item)}</strong>
      </button>
    `,
    )
    .join("");
}

function showSearchHomeDropdown(rotateSuggestions) {
  if (rotateSuggestions) searchSuggestionOpenCount += 1;
  hydrateTrendingSearchSuggestions();
  renderSuggestions();
  renderHistory();
  document.getElementById("searchSuggestions").style.display = "block";
  document.getElementById("searchHistory").style.display = "block";
  document.getElementById("searchResults").style.display = "none";
  searchDropdown.style.display = "block";
  searchWrapper.classList.add("active");
}

function searchSuggestionItem(query) {
  searchInput.value = query;
  searchClear.style.display = "block";
  searchYouTube(query);
}

function searchHistoryItem(index) {
  const title = searchHistory[index];
  if (!title) return;
  searchInput.value = title;
  searchClear.style.display = "block";
  searchYouTube(title);
}

function clearSearchHistory(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  searchHistory = [];
  localStorage.setItem("searchHistory", JSON.stringify(searchHistory));
  renderHistory();
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
  showSearchHomeDropdown(true);
}

function getYouTubeSearchCacheKey(query) {
  return (
    SEARCH_CACHE_VERSION +
    "_" +
    String(query || "")
      .toLowerCase()
      .trim()
  );
}

function readYouTubeSearchCache(query) {
  const cacheKey = getYouTubeSearchCacheKey(query);
  let cached = null;
  try {
    cached = localStorage.getItem(cacheKey);
  } catch (error) {
    return null;
  }
  if (!cached) return null;

  try {
    const data = JSON.parse(cached);
    if (Date.now() - data.time < SEARCH_CACHE_MAX_AGE && data.html) return data;
  } catch (e) {}

  localStorage.removeItem(cacheKey);
  return null;
}

function clearSearchResultCaches() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("db_search_music_") || key.startsWith("db_top100_music_"))
      .forEach((key) => localStorage.removeItem(key));
  } catch (error) {}
}

function writeYouTubeSearchCache(cacheKey, data) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch (error) {
    clearSearchResultCaches();
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (retryError) {
      console.warn("Search cache skipped:", retryError);
    }
  }
}

function renderCachedYouTubeSearch(query) {
  const cached = readYouTubeSearchCache(query);
  if (!cached) return false;

  document.getElementById("searchSuggestions").style.display = "none";
  document.getElementById("searchHistory").style.display = "none";
  document.getElementById("searchResults").style.display = "block";
  document.getElementById("resultList").innerHTML = cached.html;
  youtubePlaybackQueue = (cached.items || []).map((item) => ({
    videoId: item.videoId,
    title: item.title,
    artist: item.artist || "Nguồn nhạc",
    image: item.image || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`,
  }));
  return true;
}

function renderSearchNoResults(query) {
  const safeQuery = escapeHtml(query || "nội dung này");
  return `
    <div class="search-no-results-popup">
      <div class="search-no-results-icon">⌕</div>
      <strong>Không thể tìm thấy kết quả</strong>
      <span>Không có video âm nhạc có thể phát cho "${safeQuery}".</span>
    </div>
  `;
}

const YOUTUBE_API_PROXY_BASE = "/api/youtube/v3";

function fetchYouTubeApi(resource, params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, value);
  });
  return fetch(`${YOUTUBE_API_PROXY_BASE}/${resource}?${query.toString()}`).then((response) => response.json());
}

const AUDIUS_API_BASE = "https://discoveryprovider.audius.co/v1";
const AUDIUS_APP_NAME = "ListenMusic";

let ytPlayer = null;
let ytReady = false;

function onYouTubeIframeAPIReady() {
  ytReady = true;
}

function fetchYouTubeVideosWithFallback(query, totalResults) {
  return fetchMusicDatabaseVideos(query, totalResults);
}

function isYouTubeQuotaError(error) {
  const message = String((error && error.message) || error || "").toLowerCase();
  return message.includes("quota") || message.includes("daily limit") || message.includes("search queries");
}

function isRecoverableYouTubeApiError(error) {
  const message = String((error && error.message) || error || "").toLowerCase();
  return (
    isYouTubeQuotaError(error) ||
    message.includes("api key") ||
    message.includes("key not valid") ||
    message.includes("forbidden") ||
    message.includes("access not configured") ||
    message.includes("referer") ||
    message.includes("429") ||
    message.includes("403")
  );
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

  return fetchYouTubeApi("search", {
    part: "snippet",
    type: "video",
    order: "relevance",
    q: query,
    maxResults: pageSize,
  }).then((data) => {
    if (data.error) throw new Error(data.error.message || "YouTube API error");
    appendUniqueVideos(data.items);

    const fetchNextPage = (nextPageToken) => {
      if (items.length >= totalResults || !nextPageToken) return Promise.resolve(items.slice(0, totalResults));
      const remaining = totalResults - items.length;
      const nextPageSize = Math.min(YOUTUBE_PAGE_SIZE, remaining);
      return fetchYouTubeApi("search", {
        part: "snippet",
        type: "video",
        order: "relevance",
        q: query,
        maxResults: nextPageSize,
        pageToken: nextPageToken,
      }).then((nextData) => {
        if (nextData.error) throw new Error(nextData.error.message || "YouTube API error");
        appendUniqueVideos(nextData.items);
        return fetchNextPage(nextData.nextPageToken);
      });
    };

    return fetchNextPage(data.nextPageToken);
  });
}

function getVideoIdFromItem(item) {
  if (!item) return "";
  if (typeof item.id === "string") return item.id;
  return (item.id && item.id.videoId) || item.videoId || "";
}

function getUnplayableYouTubeIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(YOUTUBE_UNPLAYABLE_KEY) || "[]"));
  } catch (e) {
    localStorage.removeItem(YOUTUBE_UNPLAYABLE_KEY);
    return new Set();
  }
}

function markUnplayableYouTubeVideo(videoId) {
  if (!videoId) return;
  const ids = getUnplayableYouTubeIds();
  ids.add(videoId);
  localStorage.setItem(YOUTUBE_UNPLAYABLE_KEY, JSON.stringify(Array.from(ids).slice(-300)));
}

function removeYouTubeVideoFromQueue(videoId) {
  if (!videoId) return;
  const oldIndex = currentYouTubeIndex;
  youtubePlaybackQueue = youtubePlaybackQueue.filter((item) => item.videoId !== videoId);
  if (oldIndex >= youtubePlaybackQueue.length) currentYouTubeIndex = youtubePlaybackQueue.length - 1;
}

function getItemTextForFiltering(item) {
  const snippet = (item && item.snippet) || {};
  return `${snippet.title || item.title || ""} ${snippet.channelTitle || item.channelTitle || ""} ${snippet.description || ""}`;
}

function isProbablyNonMusicVideo(item) {
  return false;
}

function hasPlayableMusicDetails(item) {
  return true;
}

function fetchYouTubePlaybackDetails(videoIds) {
  const ids = Array.from(new Set(videoIds.filter(Boolean)));
  if (!ids.length) return Promise.resolve({});

  const chunks = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

  return Promise.all(
    chunks.map((chunk) =>
      fetchYouTubeApi("videos", {
        part: "snippet,contentDetails,status",
        id: chunk.join(","),
      }).then((data) => {
        if (data.error) throw new Error(data.error.message || "YouTube API error");
        return data.items || [];
      }),
    ),
  ).then((groups) => {
    const map = {};
    groups.flat().forEach((item) => {
      if (item && item.id) map[item.id] = item;
    });
    return map;
  });
}

function mergeYouTubeDetailIntoSearchItem(item, detail) {
  if (!detail) return item;
  const videoId = getVideoIdFromItem(item) || detail.id;
  return {
    ...item,
    id: { videoId },
    snippet: {
      ...(detail.snippet || {}),
      ...((item && item.snippet) || {}),
      thumbnails: (((item && item.snippet) || {}).thumbnails || (detail.snippet && detail.snippet.thumbnails) || {}),
    },
    contentDetails: detail.contentDetails || item.contentDetails,
    status: detail.status || item.status,
  };
}

function filterPlayableMusicVideos(items, options = {}) {
  const limit = options.limit || items.length;
  return Promise.resolve(
    uniqueVideosById(items)
      .filter((item) => getVideoIdFromItem(item))
      .slice(0, limit),
  );
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
  document.getElementById("youtubePageTitle").textContent = "🎧 " + topicName;
  setTop100RefreshVisible(false);

  const youtubeQuery = getExploreTopicQuery(topicName, query);
  const cacheKey = "db_explore_topic_music_v2_" + youtubeQuery.toLowerCase().trim();
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { html, time, queue } = JSON.parse(cached);
      if (Date.now() - time < CACHE_7_DAYS) {
        youtubePlaybackQueue = queue || [];
        const youtubeList = document.getElementById("youtubeList");
        youtubeList.innerHTML = html;
        hydrateYouTubeListItems(youtubeList);
        return;
      }
    } catch (e) {}
    localStorage.removeItem(cacheKey);
  }

  document.getElementById("youtubeList").innerHTML = '<div class="yt-loading">Đang tải nhạc khám phá...</div>';

  fetchYouTubeVideosWithFallback(youtubeQuery, EXPLORE_TOPIC_RESULTS_COUNT)
    .then((items) => {
      if (!items || items.length === 0) {
        document.getElementById("youtubeList").innerHTML = '<div class="yt-loading">Không tìm thấy bài hát phù hợp.</div>';
        return;
      }
      const html = renderYouTubeList(items);
      localStorage.setItem(cacheKey, JSON.stringify({ html, queue: youtubePlaybackQueue, time: Date.now() }));
    })
    .catch((error) => {
      console.error("Explore topic fetch error:", error);
      document.getElementById("youtubeList").innerHTML = "";
    });
}

function playAudiusTrack(index) {
  const track = audiusTracks[index];
  if (!track || !track.id) return;

  if (isCurrentPlaybackTrack(track)) {
    togglePlay();
    return;
  }

  userPausedPlayback = false;
  stopYouTubePlayback();

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.onended = null;
    currentAudio.ontimeupdate = null;
  }

  currentAudioSource = "audius";
  currentAudiusIndex = index;
  currentYouTubeIndex = -1;
  const playingTrack = {
    type: "audius",
    title: track.title || "Untitled",
    artist: getAudiusArtist(track),
    image: getAudiusArtwork(track),
    artwork: track.artwork,
    trackId: track.id,
    duration: track.duration,
  };
  recordListeningHistory(playingTrack);
  setCurrentPlayingTrack(playingTrack);
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
  showMiniPlayer();
  setPlayPauseIcon(true);
  updatePlaybackItemState();
}

function renderYouTubeList(items) {
  const list = document.getElementById("youtubeList");

  if (!items || items.length === 0) {
    list.innerHTML = '<div class="yt-loading">Không tìm thấy bài hát.</div>';
    return "";
  }

  youtubePlaybackQueue = items
    .filter((item) => !item.isAudius && item.id && item.id.videoId)
    .map((item) => {
      const thumbs = item.snippet.thumbnails || {};
      const thumb = (thumbs.medium || thumbs.high || thumbs.default || {}).url || `https://i.ytimg.com/vi/${item.id.videoId}/mqdefault.jpg`;
      return {
        videoId: item.id.videoId,
        title: item.snippet.title,
        artist: item.snippet.channelTitle || "Nguồn nhạc",
        image: thumb,
      };
    });

  const html = items
    .map((item, i) => {
      const title = item.snippet.title || "Bài hát";
      const channel = item.snippet.channelTitle || "Nguồn nhạc";
      const thumbs = item.snippet.thumbnails || {};
      const thumb = ((thumbs.medium || thumbs.high || thumbs.default || {}).url || "").trim();
      const displayTitle = escapeHtml(title);
      const displayChannel = escapeHtml(channel);
      const safeThumbAttr = escapeHtml(thumb);

      if (item.isAudius) {
        const audiusIndex = items.slice(0, i + 1).filter((entry) => entry.isAudius).length - 1;
        const audiusTrackId = item.audiusTrack && item.audiusTrack.id;
        return `
          <div class="yt-song-item audius-song-item" data-playback-id="${getPlaybackId({ trackId: audiusTrackId })}" onclick="playAudiusTrack(${audiusIndex})">
            <div class="yt-song-num">${i + 1}</div>
            <div class="yt-song-thumb audius-song-thumb">
              <img src="${safeThumbAttr}" alt="${displayTitle}" />
              <span class="yt-play-icon" onclick="handlePlaybackButtonClick(event, () => playAudiusTrack(${audiusIndex}))">▶</span>
            </div>
            <div class="yt-song-info">
              <div class="yt-song-title">${displayTitle}</div>
              <div class="yt-song-channel">🎧 Audius · ${displayChannel}</div>
            </div>
          </div>
        `;
      } else {
        const vid = item.id.videoId;
        const safeVid = escapeInlineString(vid);
        const safeTitle = escapeInlineString(title);
        const safeChannel = escapeInlineString(channel);
        const safeThumb = escapeInlineString(thumb);
        return `
          <div class="yt-song-item" data-playback-id="${getPlaybackId({ videoId: vid })}" onclick="playYouTubeById('${safeVid}', '${safeTitle}', '${safeChannel}', '${safeThumb}')">
            <div class="yt-song-num">${i + 1}</div>
            <div class="yt-song-thumb">
              <img src="${safeThumbAttr}" alt="${displayTitle}" />
              <span class="yt-play-icon" onclick="handlePlaybackButtonClick(event, () => playYouTubeById('${safeVid}', '${safeTitle}', '${safeChannel}', '${safeThumb}'))">▶</span>
            </div>
            <div class="yt-song-info">
              <div class="yt-song-title">${displayTitle}</div>
              <div class="yt-song-channel">${displayChannel}</div>
            </div>
          </div>
        `;
      }
    })
    .join("");

  list.innerHTML = html;
  hydrateYouTubeListItems(list);

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

let artistPageLoadedKey = "";
let monthlyArtistItems = [];
let artistYoutubeSearchCompleted = false;
let artistAdIndex = 0;
let artistAdTimer = null;
let currentArtistSongsName = "";
let artistSearchQuery = "";
let artistGenreFilter = "Tất cả";
let followedArtistNames = readFollowedArtists();
const GENERIC_MUSIC_CHANNEL_PATTERNS = /(top|bxh|bảng xếp hạng|nonstop|vinahouse|remix|playlist|tiktok|nhạc trẻ|nhac tre|music|media|records|entertainment|network|channel|karaoke|lyrics|cover|ost|mix|best of|hay nhất|hot nhất|2025|2026)/i;
const NON_ARTIST_TITLE_PATTERNS = /(nonstop|top\s*\d*|bxh|bảng xếp hạng|playlist|liên khúc|tuyển tập|nhạc remix|remix hay nhất|bay phòng|vinahouse|edm|bass cực mạnh|chuẩn trend|hot tiktok|nhạc trẻ remix|best of|full album)/i;
const ARTIST_AD_REFRESH_DELAY = 5000;
const ARTIST_ADS = [
  {
    kicker: "Listen Music",
    title: "Âm nhạc chất lượng cao mỗi ngày",
    body: "Khám phá playlist cá nhân, âm thanh rõ hơn và ít gián đoạn hơn.",
    buttonText: "Xem Top 100",
    bgImage: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1800&q=90",
    action: function () {
      showPage("top100Page");
      setActive(document.querySelector(".sidebar-menu a:nth-child(3)"));
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
  getDatabaseArtists(forceReload)
    .then((artists) => {
      monthlyArtistItems = artists || [];
      artistYoutubeSearchCompleted = true;
      renderArtistRanking(monthlyArtistItems);
    })
    .catch((error) => {
      console.error("Artist database load error:", error);
      monthlyArtistItems = [];
      artistYoutubeSearchCompleted = true;
      const list = document.getElementById("artistRankingList");
      if (list) {
        list.innerHTML = `
          <div class="artist-loading">
            Danh sách nghệ sĩ đang tạm thời chưa hiển thị. Vui lòng thử lại sau.
          </div>
        `;
      }
    });
}

function getMusicSourceArtistSeeds() {
  return MUSIC_SOURCE_ARTISTS.map((item, index) => ({ ...item, sourceRank: index + 1 }));
}

function findMusicSourceArtistSeed(artistName) {
  const target = normalizeSearchText(artistName);
  return MUSIC_SOURCE_ARTISTS.find((item) => normalizeSearchText(item.artist) === target);
}

function hasResolvedMaySong(item) {
  return !!(item && item.artist && item.song && item.song !== "Đang tìm bài hát tháng 5" && (item.videoId || item.viewCount || item.localFile));
}

function renderArtistRanking(artists) {
  const list = document.getElementById("artistRankingList");
  const visibleArtists = filterArtistItems(artists || []);
  if (!visibleArtists.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = visibleArtists
    .map((artist, i) => {
      const sourceIndex = getArtistSourceIndex(artist);
      const photo = getArtistPhoto(artist, sourceIndex);
      const displayName = getArtistDisplayName(artist);
      const rankClass = sourceIndex === 0 ? "gold" : sourceIndex === 1 ? "silver" : sourceIndex === 2 ? "bronze" : "";
      const followed = isArtistFollowed(artist.artist);
      return `
        <article class="artist-card" style="--artist-delay:${i * 35}ms" onclick="openArtistSongs(${sourceIndex})">
          <div class="artist-card-rank ${rankClass}">#${sourceIndex + 1}</div>
          <button class="artist-card-play" type="button" onclick="event.stopPropagation(); openArtistSongs(${sourceIndex}, true)">▶</button>
          <img class="artist-card-avatar" data-artist-photo="${sourceIndex}" src="${photo}" alt="${displayName}" loading="lazy" decoding="async" onerror="handleArtistImageError(this, ${sourceIndex})" />
          <div class="artist-card-name">${displayName}</div>
          <button class="artist-follow-btn ${followed ? "following" : ""}" type="button" onclick="toggleArtistFollow(event, '${escapeInlineString(artist.artist)}')">
            ${followed ? "Unfollow" : "Follow"}
          </button>
        </article>
      `;
    })
    .join("");

  bindArtistPhotoLazyLoading();
}

function filterArtistItems(artists) {
  const query = normalizeSearchText(artistSearchQuery);
  return (artists || []).filter((artist) => {
    const searchableName = normalizeSearchText([artist.artist, getArtistDisplayName(artist)].join(" "));
    if (query && !searchableName.includes(query)) return false;
    if (artistGenreFilter !== "Tất cả" && getArtistGenre(artist) !== artistGenreFilter) return false;
    return true;
  });
}

function getArtistSourceIndex(artist) {
  const rank = Number(artist && artist.sourceRank);
  return Number.isFinite(rank) && rank > 0 ? rank - 1 : 0;
}

function filterArtists() {
  const input = document.getElementById("artistSearchInput");
  artistSearchQuery = input ? input.value : "";
  renderArtistRanking(monthlyArtistItems);
}

function setArtistGenreFilter(genre, button) {
  artistGenreFilter = genre || "Tất cả";
  document.querySelectorAll(".artist-genre-tabs button").forEach((btn) => btn.classList.remove("active"));
  if (button) button.classList.add("active");
  renderArtistRanking(monthlyArtistItems);
}

function getArtistGenre(artist) {
  const source = normalizeSearchText((artist && artist.source) || "");
  if (source.includes("rap") || source.includes("hip hop")) return "Rap/Hip-hop";
  if (source.includes("bolero") || source.includes("tru tinh") || source.includes("indie") || source.includes("singer songwriter")) return "Ballad";
  if (source.includes("pop") || source.includes("crossover") || source.includes("da linh vuc")) return "V-Pop";

  const name = normalizeSearchText(artist && artist.artist);
  if (/(bts|blackpink|twice|newjeans|exo|iu|bigbang)/i.test(name)) return "K-Pop";
  if (/(karik|den vau|rhymastic|tlinh|hieuthuhai|obito|low g|mck|rap)/i.test(name)) return "Rap/Hip-hop";
  if (/(ha anh tuan|my tam|le quyen|duc phuc|van mai huong|ai phuong|trinh thang binh|phuong ly|bich phuong|tang duy tan|juky san|quang hung|vu cat tuong)/i.test(name)) return "Ballad";
  return "V-Pop";
}

function getArtistDisplayName(artist) {
  const rawName = typeof artist === "string" ? artist : (artist && artist.artist) || "";
  const exactNames = {
    "Min (ST.319)": "MIN",
    "Vũ. (Vũ Phong Thủy)": "Vũ.",
    "Nicky (Hải Triều)": "Nicky",
  };
  if (exactNames[rawName]) return exactNames[rawName];
  return rawName.replace(/\s*\((?:band|nhóm nhạc)\)\s*$/i, "").trim() || rawName;
}

function getArtistSongCount(artist, sourceIndex) {
  if (artist && artist.songCount) return artist.songCount;
  return Math.max(12, 30 - (sourceIndex % 11) - Math.floor(sourceIndex / 7));
}

function getArtistFollowerCount(artist, sourceIndex) {
  const base = 980000 - sourceIndex * 17200;
  return Math.max(42000, base + getArtistSongCount(artist, sourceIndex) * 1300);
}

function formatFollowerCount(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(1).replace(".0", "") + "M";
  if (value >= 1000) return Math.round(value / 1000) + "K";
  return String(value);
}

function readFollowedArtists() {
  try {
    return new Set(JSON.parse(localStorage.getItem("listen_music_followed_artists") || "[]"));
  } catch (e) {
    localStorage.removeItem("listen_music_followed_artists");
    return new Set();
  }
}

function saveFollowedArtists() {
  localStorage.setItem("listen_music_followed_artists", JSON.stringify(Array.from(followedArtistNames)));
}

function isArtistFollowed(name) {
  return followedArtistNames.has(normalizeSearchText(name));
}

function toggleArtistFollow(event, artistName) {
  if (event) event.stopPropagation();
  const key = normalizeSearchText(artistName);
  if (!key) return;
  if (followedArtistNames.has(key)) {
    followedArtistNames.delete(key);
  } else {
    followedArtistNames.add(key);
  }
  saveFollowedArtists();
  renderArtistRanking(monthlyArtistItems);
  renderArtistDetailHero(artistName);
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

function renderArtistDetailHero(artistName) {
  const hero = document.getElementById("artistDetailHero");
  if (!hero) return;
  const items = getCurrentArtistItems();
  const index = Math.max(
    0,
    items.findIndex((item) => item.artist === artistName),
  );
  currentArtistDetailIndex = index;
  const artist = items[index] || { artist: artistName };
  const photo = getArtistPhoto(artist, index);
  const displayName = getArtistDisplayName(artist);
  const followed = isArtistFollowed(artistName);
  const followerCount = formatFollowerCount(getArtistFollowerCount(artist, index));
  hero.style.backgroundImage = `linear-gradient(90deg, rgba(26,26,46,0.94), rgba(124,58,237,0.52), rgba(26,26,46,0.82)), url('${photo}')`;
  hero.innerHTML = `
    <div class="artist-detail-body">
      <img class="artist-detail-avatar" src="${photo}" alt="${displayName}" onerror="handleArtistImageError(this, ${index})" />
      <div class="artist-detail-copy">
        <div class="artist-kicker">Nghệ sĩ</div>
        <h1>${displayName}</h1>
        <p>${followerCount} lượt theo dõi · ${getArtistSongCount(artist, index)} bài hát nổi bật</p>
        <button class="artist-follow-btn artist-follow-large ${followed ? "following" : ""}" type="button" onclick="toggleArtistFollow(event, '${escapeInlineString(artistName)}')">
          ${followed ? "Unfollow" : "Follow"}
        </button>
      </div>
    </div>
    <button class="yt-back-btn artist-refresh-btn" type="button" onclick="refreshCurrentArtistSongs()">Refresh</button>
  `;
  ensureArtistPhotoLoaded(index, 0);
}

function renderArtistSongsSection(items) {
  return `
    <section class="artist-detail-songs">
      <div class="artist-detail-section-head">
        <h2>Bài hát nổi bật</h2>
      </div>
      <div class="youtube-list">
        ${renderArtistSongsListHtml(items)}
      </div>
    </section>
  `;
}

function renderArtistSongsListHtml(items) {
  return items
    .map((item, i) => {
      const title = item.snippet.title || "Bài hát";
      const channel = item.snippet.channelTitle || "Nguồn nhạc";
      const videoId = item.id && item.id.videoId;
      const thumbs = item.snippet.thumbnails || {};
      const thumb = (thumbs.medium || thumbs.high || thumbs.default || {}).url || (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : "");
      const safeVideoId = escapeInlineString(videoId);
      const safeTitle = escapeInlineString(title);
      const safeChannel = escapeInlineString(channel);
      const safeThumb = escapeInlineString(thumb);
      const displayTitle = escapeHtml(title);
      const displayChannel = escapeHtml(channel);
      const safeThumbAttr = escapeHtml(thumb);
      return `
        <div class="yt-song-item" data-playback-id="${getPlaybackId({ videoId })}" onclick="playYouTubeById('${safeVideoId}', '${safeTitle}', '${safeChannel}', '${safeThumb}')">
          <div class="yt-song-num">${i + 1}</div>
          <div class="yt-song-thumb">
            <img src="${safeThumbAttr}" alt="${displayTitle}" />
            <span class="yt-play-icon" onclick="handlePlaybackButtonClick(event, () => playYouTubeById('${safeVideoId}', '${safeTitle}', '${safeChannel}', '${safeThumb}'))">▶</span>
          </div>
          <div class="yt-song-info">
            <div class="yt-song-title">${displayTitle}</div>
            <div class="yt-song-channel">${displayChannel}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function openArtistSongs(index) {
  const artist = getCurrentArtistItems()[index];
  if (!artist) return;

  const artistName = artist.artist || "";
  currentArtistSongsName = artistName;
  const title = document.getElementById("artistSongsTitle");
  const list = document.getElementById("artistSongsList");

  showPage("artistSongsPage");
  renderArtistDetailHero(artistName);
  if (title) title.textContent = `Bài hát của ${getArtistDisplayName(artist)}`;
  if (list) list.innerHTML = '<div class="yt-loading">🎵 Đang tìm kiếm bài hát dành cho bạn</div>';

  loadArtistSongsFromYouTube(artistName);
}

function loadArtistSongsFromYouTube(artistName, forceReload) {
  const list = document.getElementById("artistSongsList");
  currentArtistSongsName = artistName;
  const cacheKey =
    "yt_artist_songs_music_only_v7_" +
    artistName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_");

  if (forceReload) localStorage.removeItem(cacheKey);

  const cached = !forceReload ? readTimedCache(cacheKey, CACHE_7_DAYS) : null;
  if (cached && cached.html) {
    youtubePlaybackQueue = cached.queue || [];
    if (list) list.innerHTML = cached.html;
    hydrateYouTubeListItems(list);
    renderArtistDetailHero(artistName);
    return;
  }

  getDatabaseArtistSongs(artistName, 120)
    .then((items) => {
      const matched = filterArtistSongVideos(items, artistName, 120);
      if (!matched.length) {
        if (list) list.innerHTML = '<div class="yt-loading">Không tìm thấy bài hát phù hợp cho ca sĩ này.</div>';
        return;
      }

      const html = renderArtistSongsList(matched);
      writeTimedCache(cacheKey, { html, queue: youtubePlaybackQueue });
    })
    .catch((error) => {
      console.error("Artist song fetch error:", error);
      if (list) {
        list.innerHTML = `
          <div class="t100-error-box">
            <div class="t100-error-icon">❌</div>
            <div class="t100-error-title">Không tải được bài hát</div>
            <div class="t100-error-body">Nguồn nhạc đang tạm thời gián đoạn. Vui lòng thử lại sau.</div>
            <button class="t100-retry-btn" onclick="loadArtistSongsFromYouTube('${artistName.replace(/'/g, "\\'")}')">Thử lại</button>
          </div>
        `;
      }
    });
}

function refreshCurrentArtistSongs() {
  if (!currentArtistSongsName) return;
  const list = document.getElementById("artistSongsList");
  if (list) list.innerHTML = '<div class="yt-loading">🔄 Đang làm mới bài hát...</div>';
  loadArtistSongsFromYouTube(currentArtistSongsName, true);
}

function fetchArtistYouTubeCandidates(artistName) {
  const queries = [`${artistName}`, `${artistName} official`, `${artistName} official music video`, `${artistName} official audio`, `${artistName} lyric video`, `${artistName} lyrics`, `${artistName} live`, `${artistName} performance`, `${artistName} album`, `${artistName} full album`, `${artistName} playlist`, `${artistName} topic`, `${artistName} vevo`, `${artistName} mv`, `${artistName} bài hát`, `${artistName} ca khúc`, `${artistName} nhạc`];

  return promisePool(queries, 3, (query) => fetchYouTubeVideosWithFallback(query, 50).catch(() => [])).then((groups) => uniqueVideosById(groups.flat()));
}

function filterArtistSongVideos(items, artistName, limit) {
  const artistKey = normalizeSearchText(artistName);
  const aliases = getArtistAliases(artistName).map(normalizeSearchText);
  const aliasMatches = (value) => aliases.some((alias) => alias && value.includes(alias)) || (artistKey && value.includes(artistKey));

  const scored = uniqueVideosById(items)
    .map((item, originalIndex) => {
      const snippet = (item && item.snippet) || {};
      const title = snippet.title || "";
      const channel = snippet.channelTitle || "";
      const normalizedTitle = normalizeSearchText(title);
      const normalizedChannel = normalizeSearchText(channel);
      const haystack = normalizeSearchText(`${title} ${channel}`);

      if (!title) return null;
      if (!aliasMatches(haystack)) return null;

      let score = 0;
      if (aliasMatches(normalizedChannel)) score += 70;
      if (/\b(official|vevo|topic)\b/i.test(channel)) score += 35;
      if (aliasMatches(normalizedTitle)) score += 30;
      if (/\b(official|music video|mv|audio|lyrics?|lyric video|visualizer|live|performance|album)\b/i.test(title)) score += 18;

      return { item, score, originalIndex };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex);

  return scored.map((entry) => entry.item).slice(0, limit || 120);
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

  youtubePlaybackQueue = (items || [])
    .filter((item) => item && item.id && item.id.videoId)
    .map((item) => {
      const videoId = item.id.videoId;
      const thumbs = item.snippet.thumbnails || {};
      const thumb = (thumbs.medium || thumbs.high || thumbs.default || {}).url || getYouTubeVideoThumbUrl(videoId);
      return {
        videoId,
        title: item.snippet.title || "Bài hát",
        artist: item.snippet.channelTitle || "Nguồn nhạc",
        image: thumb,
      };
    });

  const html = renderArtistSongsSection(items);

  list.innerHTML = html;
  hydrateYouTubeListItems(list);
  return html;
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

  const chunks = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

  return Promise.all(
    chunks.map((chunk) => {
      return fetchYouTubeApi("videos", {
        part: "snippet,statistics",
        id: chunk.join(","),
      })
        .then((data) => {
          if (data.error) throw new Error(data.error.message || "YouTube API error");
          return data.items || [];
        });
    }),
  )
    .then((groups) => groups.flat());
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

function cleanupSongTitle(title) {
  return String(title || "")
    .replace(/\b(ft|feat|featuring|prod|official|mv|music video|audio|lyrics?|visualizer)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[-–—|:]+|[-–—|:]+$/g, "")
    .trim();
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

function getArtistPhoto(artist, index) {
  if (isUsableArtistPortrait(artist.photo, artist.preferSongThumb, artist.artist)) return artist.photo;
  artist.photo = "";

  if (artist.photoLookupDisabled) return buildArtistPlaceholder(artist.artist, index);

  const cached = artist.preferSongThumb ? null : readTimedCache(getArtistPhotoCacheKey(artist.artist), CACHE_7_DAYS);
  if (cached && isUsableArtistPortrait(cached.url, artist.preferSongThumb, artist.artist)) {
    artist.photo = cached.url;
    return artist.photo;
  }

  const fallbackPhoto = getArtistFallbackPhoto(artist);
  if (fallbackPhoto) return fallbackPhoto;

  return buildArtistPlaceholder(artist.artist, index);
}

function getArtistFallbackPhoto(artist) {
  if (!artist) return "";
  if (artist.photoLookupDisabled) return "";
  const fallback = artist.fallbackPhoto || artist.songThumb || artist.thumbnail || artist.thumb || "";
  return isLikelySongThumbnail(fallback) ? "" : fallback;
}

function getArtistPhotoCacheKey(artistName) {
  return (
    "artist_photo_" +
    ARTIST_PHOTO_CACHE_VERSION +
    "_" +
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

function isLikelySongThumbnail(url) {
  const value = String(url || "").toLowerCase();
  return /i\.ytimg\.com\/vi\//.test(value) || /img\.youtube\.com\/vi\//.test(value) || /\/(hqdefault|mqdefault|sddefault|maxresdefault)\.jpg/.test(value);
}

function isLikelyNonPortraitArtistAsset(url) {
  const value = normalizeArtistLookupText(decodeURIComponent(String(url || "")));
  return /\b(logo|icon|poster|album|single|cover|statue|monument|tuong|co vua|emperor|king|queen)\b/.test(value);
}

function isLikelyWrongArtistPhoto(url, artistName) {
  const dbArtists = (artistSongDatabaseCache && artistSongDatabaseCache.artists) || [];
  if (!url || !dbArtists.length) return false;

  const imageText = normalizeArtistLookupText(decodeURIComponent(String(url || "")));
  if (!imageText) return false;

  const targetAliases = getArtistAliases(artistName).map(normalizeArtistLookupText).filter((alias) => alias.length >= 4);
  const targetMatches = targetAliases.some((alias) => imageText.includes(alias.replace(/\s+/g, " ")) || imageText.includes(alias.replace(/\s+/g, "")));

  return dbArtists.some((artist) => {
    const otherName = artist && artist.name;
    if (!otherName || normalizeArtistLookupText(otherName) === normalizeArtistLookupText(artistName)) return false;
    return getArtistAliases(otherName)
      .map(normalizeArtistLookupText)
      .filter((alias) => alias.length >= 4)
      .some((alias) => {
        const spaced = alias.replace(/\s+/g, " ");
        const compact = alias.replace(/\s+/g, "");
        return (imageText.includes(spaced) || imageText.includes(compact)) && !targetMatches;
      });
  });
}

function isUsableArtistPortrait(url, allowSongThumbnail, artistName) {
  return !!url && !isArtistPlaceholderPhoto(url) && (allowSongThumbnail || !isLikelySongThumbnail(url)) && !isLikelyNonPortraitArtistAsset(url) && !isLikelyWrongArtistPhoto(url, artistName);
}

function applyArtistPhoto(index, url) {
  const artist = getCurrentArtistItems()[index];
  if (!artist || artist.photoLookupDisabled || !isUsableArtistPortrait(url, artist.preferSongThumb, artist.artist)) return;
  artist.photo = url;
  if (!isLikelySongThumbnail(url)) writeTimedCache(getArtistPhotoCacheKey(artist.artist), { url });
  updateArtistPhoto(index, url);
}

function getCurrentArtistItems() {
  return monthlyArtistItems.length ? monthlyArtistItems : [];
}

function ensureArtistPhotoLoaded(index, delay) {
  if (!ARTIST_DYNAMIC_PHOTO_LOOKUP_ENABLED) return;
  const artist = getCurrentArtistItems()[index];
  if (!artist || artist.photoLookupDisabled || isUsableArtistPortrait(artist.photo, artist.preferSongThumb, artist.artist) || artist.photoLoading) return;
  artist.photo = "";

  const cacheKey = getArtistPhotoCacheKey(artist.artist);
  const cached = artist.preferSongThumb ? null : readTimedCache(cacheKey, CACHE_7_DAYS);
  if (cached && isUsableArtistPortrait(cached.url, artist.preferSongThumb, artist.artist)) {
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
  }, delay || 0);
}

function loadArtistPhotos(indexes) {
  const items = getCurrentArtistItems();
  const orderedIndexes = Array.isArray(indexes) && indexes.length ? indexes : items.map((_, index) => index);
  orderedIndexes.forEach((index, order) => ensureArtistPhotoLoaded(index, order * 70));
}

function bindArtistPhotoLazyLoading() {
  const images = Array.from(document.querySelectorAll(".artist-card-avatar[data-artist-photo]"));
  const firstIndexes = images.slice(0, 25).map((img) => Number(img.getAttribute("data-artist-photo"))).filter(Number.isFinite);
  loadArtistPhotos(firstIndexes);

  if (!("IntersectionObserver" in window)) {
    loadArtistPhotos(images.map((img) => Number(img.getAttribute("data-artist-photo"))).filter(Number.isFinite));
    return;
  }

  if (artistPhotoObserver) artistPhotoObserver.disconnect();
  artistPhotoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const index = Number(entry.target.getAttribute("data-artist-photo"));
        if (Number.isFinite(index)) ensureArtistPhotoLoaded(index, 0);
        artistPhotoObserver.unobserve(entry.target);
      });
    },
    { root: null, rootMargin: "900px 0px", threshold: 0.01 },
  );

  images.forEach((img) => {
    const index = Number(img.getAttribute("data-artist-photo"));
    if (!Number.isFinite(index)) return;
    const artist = getCurrentArtistItems()[index];
    if (artist && isUsableArtistPortrait(artist.photo, artist.preferSongThumb, artist.artist)) return;
    artistPhotoObserver.observe(img);
  });
}

function loadAllArtistPhotosInBackground() {
  if (!ARTIST_DYNAMIC_PHOTO_LOOKUP_ENABLED) return;
  const items = getCurrentArtistItems();
  items.forEach((artist, index) => {
    artist.photoLoading = true;
    setTimeout(() => {
      fetchArtistPhotoUrl(artist.artist, artist.song, artist.channelId, artist.preferSongThumb)
        .then((url) => applyArtistPhoto(index, url))
        .catch(() => {})
        .finally(() => {
          artist.photoLoading = false;
        });
    }, index * 260);
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

  const target = normalizeArtistLookupText(artistName);
  const aliases = getArtistAliases(artistName).map(normalizeArtistLookupText).filter(Boolean);
  const match = items.find((item) => {
    const name = normalizeArtistLookupText(item.name || "");
    if (!name) return false;
    return aliases.some((alias) => alias === name || (alias.length >= 5 && name.includes(alias)) || (name.length >= 5 && alias.includes(name)));
  });

  if (!match) return "";

  return match.picture_xl || match.picture_big || match.picture_medium || "";
}

function upscaleItunesArtwork(url) {
  if (!url) return "";
  return url.replace(/100x100bb\.jpg$/, "600x600bb.jpg");
}

function normalizeArtistLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pickWikipediaArtistPhoto(data, artistName) {
  const pages = Object.values((data && data.query && data.query.pages) || {});
  if (!pages.length) return "";

  const target = normalizeArtistLookupText(artistName);
  const scored = pages
    .map((page) => {
      const title = normalizeArtistLookupText(page.title);
      const source = (page.original && page.original.source) || (page.thumbnail && page.thumbnail.source) || "";
      let score = 0;
      if (title === target) score += 100;
      if (title.includes(target) || target.includes(title)) score += 70;
      if (/\b(ca si|singer|musician|rapper|band|nhom nhac|artist)\b/.test(title)) score += 18;
      if (/\.(jpe?g|png|webp)(\?|$)/i.test(source)) score += 10;
      return { source, score };
    })
    .filter((item) => item.source && item.score > 0 && !/logo|icon|poster|album|single/i.test(item.source))
    .sort((a, b) => b.score - a.score);

  return (scored[0] && scored[0].source) || "";
}

function fetchWikipediaArtistPhotoUrl(artistName, host, extraTerm) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: [artistName, extraTerm || ""].filter(Boolean).join(" "),
    gsrnamespace: "0",
    gsrlimit: "6",
    prop: "pageimages",
    piprop: "thumbnail|original",
    pithumbsize: "700",
    redirects: "1",
    format: "json",
    origin: "*",
  });

  return fetch(`https://${host}/w/api.php?${params.toString()}`)
    .then((r) => r.json())
    .then((data) => pickWikipediaArtistPhoto(data, artistName))
    .catch(() => "");
}

function pickCommonsArtistPhoto(data) {
  const pages = Object.values((data && data.query && data.query.pages) || {});
  const page = pages.find((item) => {
    const url = item.thumbnail && item.thumbnail.source;
    return url && /\.(jpe?g|png|webp)(\?|$)/i.test(url) && !/logo|icon|poster|album|single/i.test(url);
  });
  return (page && page.thumbnail && page.thumbnail.source) || "";
}

function fetchCommonsArtistPhotoUrl(artistName) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `${artistName} singer musician portrait`,
    gsrlimit: "8",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "700",
    format: "json",
    origin: "*",
  });

  return fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`)
    .then((r) => r.json())
    .then(pickCommonsArtistPhoto)
    .catch(() => "");
}

function getCommonsRedirectUrl(fileName) {
  if (!fileName) return "";
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(fileName)}?width=700`;
}

function pickWikidataImageFile(data) {
  const entities = Object.values((data && data.entities) || {});
  for (const entity of entities) {
    const claims = entity.claims && entity.claims.P18;
    const fileName = claims && claims[0] && claims[0].mainsnak && claims[0].mainsnak.datavalue && claims[0].mainsnak.datavalue.value;
    if (fileName && !/logo|icon|poster|album|single/i.test(fileName)) return fileName;
  }
  return "";
}

function fetchWikidataArtistPhotoUrl(artistName, language) {
  const searchParams = new URLSearchParams({
    action: "wbsearchentities",
    search: artistName,
    language: language || "vi",
    uselang: language || "vi",
    limit: "6",
    format: "json",
    origin: "*",
  });

  return fetch(`https://www.wikidata.org/w/api.php?${searchParams.toString()}`)
    .then((r) => r.json())
    .then((data) => {
      const ids = ((data && data.search) || []).map((item) => item.id).filter(Boolean).slice(0, 4);
      if (!ids.length) return "";
      const entityParams = new URLSearchParams({
        action: "wbgetentities",
        ids: ids.join("|"),
        props: "claims",
        format: "json",
        origin: "*",
      });
      return fetch(`https://www.wikidata.org/w/api.php?${entityParams.toString()}`)
        .then((r) => r.json())
        .then((entityData) => getCommonsRedirectUrl(pickWikidataImageFile(entityData)));
    })
    .catch(() => "");
}

function fetchArtistPhotoUrl(artistName, featuredSong, channelId, preferSongThumb) {
  const q = encodeURIComponent(artistName);

  return fetchWikipediaArtistPhotoUrl(artistName, "vi.wikipedia.org", "ca sĩ")
    .then((url) => {
      if (url) return url;
      return fetchWikipediaArtistPhotoUrl(artistName, "en.wikipedia.org", "singer musician");
    })
    .then((url) => {
      if (url) return url;
      return fetchWikidataArtistPhotoUrl(artistName, "vi");
    })
    .then((url) => {
      if (url) return url;
      return fetchWikidataArtistPhotoUrl(artistName, "en");
    })
    .then((url) => {
      if (url) return url;
      return fetchCommonsArtistPhotoUrl(artistName);
    })
    .then((url) => {
      if (url) return url;
      return fetchDeezerJsonp(`/search/artist?q=${q}`)
        .then((data) => pickDeezerArtistPhoto(data, artistName))
        .catch(() => "");
    })
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
      return fetchYouTubeChannelPhotoUrl(artistName, channelId);
    })
    .catch(() => "");
}

function fetchYouTubeChannelPhotoUrl(artistName, channelId) {
  if (channelId) {
    return fetchYouTubeApi("channels", {
      part: "snippet",
      id: channelId,
    })
      .then((data) => {
        if (data.error) throw new Error(data.error.message || "YouTube API error");
        const item = data.items && data.items[0];
        const thumbs = (item && item.snippet && item.snippet.thumbnails) || {};
        return (thumbs.high || thumbs.medium || thumbs.default || {}).url || "";
      })
      .catch((error) => {
        if (!isYouTubeQuotaError(error)) return "";
        return "";
      });
  }

  const query = `${artistName} official artist music`;
  return fetchYouTubeApi("search", {
    part: "snippet",
    type: "channel",
    maxResults: 5,
    q: query,
  })
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

function handleArtistImageError(img, index) {
  if (!img) return;
  const artist = getCurrentArtistItems()[index];
  const fallback = buildArtistPlaceholder((artist && artist.artist) || "Artist", index || 0);
  if (artist) artist.photo = fallback;
  img.onerror = null;
  img.src = fallback;
}

function getYouTubeVideoThumbUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

function searchYouTube(query, playFirst, options = {}) {
  query = String(query || "")
    .trim()
    .toLowerCase();
  if (!query || query.length < SEARCH_MIN_QUERY_LENGTH) return;

  const requestToken = ++searchRequestToken;

  document.getElementById("searchHistory").style.display = "none";
  document.getElementById("searchSuggestions").style.display = "none";
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

  if (!options.force && !playFirst && query === lastSubmittedSearchQuery && list.querySelector(".search-item") && !readYouTubeSearchCache(query)) {
    return;
  }

  lastSubmittedSearchQuery = query;
  list.innerHTML = "";

  fetchYouTubeVideosWithFallback(query, SEARCH_RESULTS_COUNT)
    .then((items) => {
      if (requestToken !== searchRequestToken) return;
      if (!items || items.length === 0) {
        list.innerHTML = renderSearchNoResults(query);
        return;
      }

      const cacheItems = [];
      const html = items
        .map((item) => {
          const vid = item.id.videoId;
          const title = item.snippet.title || "Bài hát";
          const channel = item.snippet.channelTitle || "Nguồn nhạc";
          const thumbs = item.snippet.thumbnails || {};
          const thumb = (thumbs.default || thumbs.medium || thumbs.high || {}).url || `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`;
          const safeVid = escapeInlineString(vid);
          const safeTitle = escapeInlineString(title);
          const displayTitle = escapeHtml(title);
          const displayChannel = escapeHtml(channel);
          const safeThumbAttr = escapeHtml(thumb);
          cacheItems.push({ videoId: vid, title, artist: channel, image: thumb });
          return `
          <div class="search-item" onclick="playYouTubeFromSearch('${safeVid}', '${safeTitle}')">
            <img src="${safeThumbAttr}" style="border-radius:4px; width:42px; height:42px; object-fit:cover;" />
            <div class="search-item-info">
              <div class="search-item-title">${displayTitle}</div>
              <div class="search-item-artist">▶ ${displayChannel}</div>
            </div>
          </div>
        `;
        })
        .join("");
      writeYouTubeSearchCache(cacheKey, { html, items: cacheItems, time: Date.now() });
      youtubePlaybackQueue = cacheItems.map((item) => ({
        videoId: item.videoId,
        title: item.title,
        artist: item.artist || "Nguồn nhạc",
        image: item.image || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`,
      }));

      if (playFirst && cacheItems[0]) {
        playYouTubeFromSearch(cacheItems[0].videoId, cacheItems[0].title);
        return;
      }

      list.innerHTML = html;
    })
    .catch((error) => {
      if (requestToken !== searchRequestToken) return;
      console.warn("YouTube search failed:", error);
      list.innerHTML = renderSearchNoResults(query);
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

function handleYouTubeStateChange(e) {
  if (e.data === YT.PlayerState.PLAYING) {
    if (userPausedPlayback) {
      e.target.pauseVideo();
      stopYouTubeProgressTimer();
      setPlayPauseIcon(false);
      return;
    }
    startYouTubeProgressTimer();
    setPlayPauseIcon(true);
  } else if (e.data === YT.PlayerState.PAUSED) {
    stopYouTubeProgressTimer();
    setPlayPauseIcon(false);
  } else if (e.data === YT.PlayerState.BUFFERING) {
    if (userPausedPlayback) {
      setPlayPauseIcon(false);
      setTimeout(() => {
        if (userPausedPlayback && e.target && typeof e.target.pauseVideo === "function") {
          e.target.pauseVideo();
          setPlayPauseIcon(false);
        }
      }, 300);
    }
  } else if (e.data === YT.PlayerState.ENDED) {
    stopYouTubeProgressTimer();
    userPausedPlayback = false;
    nextSong();
  }
}

function handleYouTubePlaybackError(event) {
  const failedId =
    (ytPlayer && typeof ytPlayer.getVideoData === "function" && ytPlayer.getVideoData() && ytPlayer.getVideoData().video_id) ||
    (youtubePlaybackQueue[currentYouTubeIndex] && youtubePlaybackQueue[currentYouTubeIndex].videoId) ||
    "";
  markUnplayableYouTubeVideo(failedId);
  removeYouTubeVideoFromQueue(failedId);
  stopYouTubeProgressTimer();
  setPlayPauseIcon(false);
  notifyPlayerAction("Bài hát này tạm thời không phát được, đã bỏ qua.");

  const nextItem = youtubePlaybackQueue[currentYouTubeIndex + 1] || youtubePlaybackQueue[currentYouTubeIndex];
  if (nextItem) {
    currentYouTubeIndex = youtubePlaybackQueue.findIndex((item) => item.videoId === nextItem.videoId);
    playYouTube(nextItem.videoId, nextItem.title, { artist: nextItem.artist, image: nextItem.image });
  }
}

function bindYouTubeStateChangeHandler() {
  if (!ytPlayer) return;
  if (typeof ytPlayer.removeEventListener === "function") {
    try {
      ytPlayer.removeEventListener("onStateChange", handleYouTubeStateChange);
      ytPlayer.removeEventListener("onError", handleYouTubePlaybackError);
    } catch (e) {}
  }
  if (typeof ytPlayer.addEventListener === "function") {
    ytPlayer.addEventListener("onStateChange", handleYouTubeStateChange);
    ytPlayer.addEventListener("onError", handleYouTubePlaybackError);
  }
}

function playYouTube(videoId, title, meta = {}) {
  const artist = meta.artist || "Nguồn nhạc";
  const image = meta.image || meta.thumb || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  const playbackSource = meta.source || "youtube";

  userPausedPlayback = false;
  currentAudioSource = playbackSource;
  currentAudiusIndex = -1;
  if (playbackSource !== "chart") currentChartIndex = -1;
  if (currentYouTubeIndex < 0 || !youtubePlaybackQueue[currentYouTubeIndex] || youtubePlaybackQueue[currentYouTubeIndex].videoId !== videoId) {
    const queueIndex = youtubePlaybackQueue.findIndex((item) => item.videoId === videoId);
    if (queueIndex >= 0) {
      currentYouTubeIndex = queueIndex;
    } else {
      youtubePlaybackQueue = [{ videoId, title, artist, image }];
      currentYouTubeIndex = 0;
    }
  }
  const playingTrack = {
    type: "youtube",
    title,
    artist,
    image,
    videoId,
  };
  recordListeningHistory(playingTrack);
  setCurrentPlayingTrack(playingTrack);
  showMiniPlayer();

  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
  }
  currentAudio = null;
  updatePlayBtn();

  if (ytPlayer && ytReady) {
    bindYouTubeStateChangeHandler();
    ytPlayer.loadVideoById(videoId);
    ytPlayer.setVolume(parseInt(document.getElementById("volumeSlider").value || "100", 10));
    startYouTubeProgressTimer();
    setPlayPauseIcon(true);
  } else {
    document.getElementById("ytPlayer").innerHTML = "";
    ytPlayer = new YT.Player("ytPlayer", {
      height: "0",
      width: "0",
      videoId: videoId,
      playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1 },
      events: {
        onReady: (e) => {
          ytReady = true;
          e.target.setVolume(parseInt(document.getElementById("volumeSlider").value || "100", 10));
          e.target.playVideo();
          startYouTubeProgressTimer();
          setPlayPauseIcon(true);
        },
        onStateChange: handleYouTubeStateChange,
        onError: handleYouTubePlaybackError,
      },
    });
  }
}

function closeYTPlayer() {
  stopYouTubePlayback();
  setPlayPauseIcon(false);
}

function playYouTubeFromQueue(index) {
  const item = youtubePlaybackQueue[index];
  if (!item) return;
  if (getUnplayableYouTubeIds().has(item.videoId)) {
    removeYouTubeVideoFromQueue(item.videoId);
    notifyPlayerAction("Bài hát này từng lỗi phát, đã bỏ qua.");
    return;
  }
  if (isCurrentPlaybackTrack(item)) {
    togglePlay();
    return;
  }
  currentYouTubeIndex = index;
  playYouTube(item.videoId, item.title, { artist: item.artist, image: item.image });
}

function playYouTubeFromSearch(vid, title) {
  if (getUnplayableYouTubeIds().has(vid)) {
    notifyPlayerAction("Bài hát này từng lỗi phát, đã bỏ qua.");
    return;
  }
  addToHistory(title);
  searchInput.value = "";
  searchClear.style.display = "none";
  showSearchHistoryDropdown();
  currentYouTubeIndex = youtubePlaybackQueue.findIndex((item) => item.videoId === vid);
  const item = youtubePlaybackQueue[currentYouTubeIndex] || { videoId: vid, title, artist: "Nguồn nhạc", image: `https://i.ytimg.com/vi/${vid}/mqdefault.jpg` };
  playYouTube(vid, title, { artist: item.artist, image: item.image });
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
    top100Shortcut: "Top 100",
    searchSuggestions: "Đề xuất cho bạn",
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
    aboutBody: "<p><strong>Listen Music</strong> là trình nghe nhạc cá nhân tích hợp nhạc local, Top 100 và lịch sử nghe.</p><p>Phiên bản hiện tại tập trung vào trải nghiệm nghe nhạc nhanh, giao diện tối và tìm kiếm mượt mà.</p>",
    termsBody: "<p>Bạn chịu trách nhiệm với nội dung mình phát, tải lên hoặc chia sẻ trong ứng dụng.</p><p>Nhạc trực tuyến được phát thông qua các nguồn hợp lệ và tuân theo điều khoản của nền tảng nguồn.</p>",
    privacyBody: "<p>Ứng dụng lưu lịch sử nghe, tìm kiếm và tùy chọn hiển thị trong trình duyệt của bạn.</p><p>Dữ liệu này nằm trên máy của bạn và có thể xóa bằng cách xóa dữ liệu trang web trong trình duyệt.</p>",
    copyrightBody: "Nếu bạn thấy nội dung cần gỡ bỏ, hãy gửi tên bài hát, nghệ sĩ, liên kết video và lý do báo cáo.",
    sendContact: "Gửi liên hệ",
    adsBody: "Listen Music chỉ hiển thị các gợi ý nội dung nội bộ và không yêu cầu đăng nhập hoặc thanh toán.",
    viewVip: "Xem Top 100",
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
    top100Shortcut: "Top 100",
    searchSuggestions: "Recommended for you",
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
    aboutBody: "<p><strong>Listen Music</strong> is a personal music player with local music, Top 100, and listening history.</p><p>This version focuses on fast playback, a dark interface, and smooth search.</p>",
    termsBody: "<p>You are responsible for the content you play, upload, or share in the app.</p><p>Online music is played through valid sources and follows the source platform's terms.</p>",
    privacyBody: "<p>The app stores listening history, search data, and display preferences in your browser.</p><p>This data stays on your device and can be removed by clearing site data in your browser.</p>",
    copyrightBody: "If you find content that should be removed, send the song name, artist, video link, and report reason.",
    sendContact: "Send message",
    adsBody: "Listen Music only shows internal content suggestions and does not ask for sign-in or payment.",
    viewVip: "View Top 100",
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
  setText(".top100-shortcut-btn", t("top100Shortcut"));
  setText("#searchSuggestions .search-section-title", t("searchSuggestions"));
  setText("#searchHistory .search-section-title span", t("searchHistory"));
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
      html: `<div class="settings-info"><p>${t("adsBody")}</p><button class="settings-action-btn" onclick="closeSettingsPanel(); showPage('top100Page')">${t("viewVip")}</button></div>`,
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

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeSettingsPanel();
  }
});

// ============================
// TOP 100 PAGE
// ============================
function setTop100RefreshVisible(visible) {
  const btn = document.getElementById("top100RefreshBtn");
  if (btn) btn.style.display = visible ? "inline-flex" : "none";
}

function getTop100CacheKey(query) {
  return (
    "db_top100_music_v2_" +
    String(query || "")
      .toLowerCase()
      .trim()
  );
}

function getTop100SeenKey(query) {
  return getTop100CacheKey(query) + "_seen";
}

function getTop100RefreshQueries(query, refreshCount) {
  const year = new Date().getFullYear();
  const variants = [query, `${query} official music video`, `${query} hit mới nhất`, `${query} trending ${year}`, `${query} hay nhất ${year}`, `${query} audio lyrics`, `${query} playlist tuyển chọn`, `${query} live performance`, `${query} mv mới`];
  if (!refreshCount) return [query];

  const start = refreshCount % variants.length;
  return [variants[start], variants[(start + 3) % variants.length], variants[(start + 6) % variants.length]];
}

function readTop100SeenIds(query) {
  try {
    return JSON.parse(localStorage.getItem(getTop100SeenKey(query)) || "[]");
  } catch (e) {
    localStorage.removeItem(getTop100SeenKey(query));
    return [];
  }
}

function rememberTop100SeenIds(query, items) {
  const seen = new Set(readTop100SeenIds(query));
  (items || []).forEach((item) => {
    const videoId = item && item.id && item.id.videoId;
    if (videoId) seen.add(videoId);
  });
  localStorage.setItem(getTop100SeenKey(query), JSON.stringify(Array.from(seen).slice(-500)));
}

function getItemVideoId(item) {
  return item && item.id && item.id.videoId ? item.id.videoId : "";
}

function clearTop100MusicCaches() {
  Object.keys(localStorage)
    .filter((key) => key.indexOf("db_top100_music_v1_") === 0 || key.indexOf("db_top100_music_v2_") === 0)
    .forEach((key) => localStorage.removeItem(key));
}

function fetchTop100Items(query, refreshCount) {
  return Promise.resolve([]);
}

function openTop100(name, query, options) {
  const forceRefresh = !!(options && options.forceRefresh);
  const refreshCount = options && options.refreshCount ? options.refreshCount : 0;
  showPage("youtubePage");
  document.getElementById("youtubePageTitle").textContent = "🏆 Top 100 - " + name;
  setTop100RefreshVisible(true);
  currentTop100State = { name, query, refreshCount };
  youtubePlaybackQueue = [];
  currentYouTubeIndex = -1;
  currentChartIndex = -1;
  currentPlayingTrack = null;
  stopYouTubePlayback();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  setPlayPauseIcon(false);
  const playerBar = document.querySelector(".player-bar");
  if (playerBar) playerBar.classList.remove("active");
  const list = document.getElementById("youtubeList");
  const top100Query = getTop100RefreshQueries(query, refreshCount).join(" ");
  const cacheKey = getTop100CacheKey(name + "_" + top100Query);

  if (!forceRefresh) {
    const cached = readTimedCache(cacheKey, CACHE_7_DAYS);
    if (cached && cached.html) {
      youtubePlaybackQueue = cached.queue || [];
      list.innerHTML = cached.html;
      hydrateYouTubeListItems(list);
      return;
    }
  }

  list.innerHTML = '<div class="yt-loading">Đang tải Top 100...</div>';

  fetchMusicDatabaseVideos(top100Query, 100)
    .then((items) => {
      if (!items || !items.length) {
        list.innerHTML = '<div class="yt-loading">Chưa có bài hát phù hợp cho mục này.</div>';
        return;
      }

      const html = renderYouTubeList(items);
      writeTimedCache(cacheKey, { html, queue: youtubePlaybackQueue });
    })
    .catch((error) => {
      console.error("Top 100 database load error:", error);
      list.innerHTML = `
        <div class="t100-error-box">
          <div class="t100-error-icon">!</div>
          <div class="t100-error-title">Nội dung chưa sẵn sàng</div>
          <div class="t100-error-body">Danh sách nhạc đang tạm thời chưa hiển thị. Vui lòng thử lại sau.</div>
          <button class="t100-retry-btn" onclick="refreshCurrentTop100()">Thử lại</button>
        </div>
      `;
    });
}

function refreshCurrentTop100() {
  if (!currentTop100State) return;
  const nextRefreshCount = (currentTop100State.refreshCount || 0) + 1;
  openTop100(currentTop100State.name, currentTop100State.query, {
    forceRefresh: true,
    refreshCount: nextRefreshCount,
  });
}
