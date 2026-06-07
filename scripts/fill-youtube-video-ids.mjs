import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");

const args = parseArgs(process.argv.slice(2));
const artistDir = path.resolve(projectRoot, args.dir || path.join("data", "artists-by-genre"));
const maxVideosPerArtist = clamp(Number(args["max-videos"] || 30), 1, 100);
const searchResultsPerQuery = clamp(Number(args["search-results"] || 25), 1, 50);
const queryLimit = Math.max(0, Number(args["query-limit"] || 0));
const artistFilter = args.artist ? normalizeText(args.artist) : "";
const genreFilter = args.genre ? normalizeText(args.genre) : "";
const delayMs = Number(args.delay || 120);
const referer = String(args.referer || process.env.YOUTUBE_API_REFERER || "http://127.0.0.1:5502/").trim();
const force = !!args.force;

const BLACKLIST_TERMS = [
  "remix",
  "nonstop",
  "nhac tong hop",
  "nhạc tổng hợp",
  "tong hop",
  "tổng hợp",
  "playlist",
  "full album",
  "album full",
  "karaoke",
  "beat",
  "instrumental",
  "cover",
  "reaction",
  "slowed",
  "speed up",
  "sped up",
  "nightcore",
  "live full",
  "full concert",
  "1 hour",
  "2 hours",
  "extended",
  "mashup",
  "mix",
  "dj",
  "lofi",
  "shorts",
  "#shorts",
];

const TITLE_CLEANUP_TERMS = [
  "official",
  "official music video",
  "official mv",
  "official audio",
  "mv",
  "m v",
  "audio",
  "lyrics",
  "lyric",
  "video",
  "music video",
  "hd",
  "4k",
  "full hd",
  "prod",
  "ft",
  "feat",
];

const keys = await loadYouTubeApiKeys();
if (!keys.length) {
  fail("Missing YouTube API key. Add YOUTUBE_API_KEY=your_key_here or YOUTUBE_API_KEYS=key1,key2 to .env.");
}

let keyIndex = 0;
let apiCalls = 0;
let totalCandidates = 0;
let totalValid = 0;
let skippedExisting = 0;
let processedThisRun = 0;

const artists = await loadArtists();

for (let index = 0; index < artists.length; index += 1) {
  const artist = artists[index];
  console.log(`\n[${index + 1}/${artists.length}] Artist: ${artist.name} (${artist.genreName})`);

  if (Array.isArray(artist.videos) && artist.videos.length && !force) {
    skippedExisting += 1;
    totalValid += artist.videos.length;
    console.log(`  Skip existing in genre file: ${artist.videos.length} videos. Use --force to refresh.`);
    continue;
  }

  try {
    const searchItems = await searchArtist(artist);
    const videoIds = unique(searchItems.map((item) => item.id?.videoId).filter(Boolean));
    console.log(`  Search candidates: ${videoIds.length}`);
    totalCandidates += videoIds.length;

    const details = await fetchVideoDetails(videoIds);
    const evaluated = details.map((video) => evaluateVideo(video, artist));
    logRejectedVideos(evaluated);

    const validVideos = evaluated
      .filter((item) => item.valid)
      .map((item) => item.video)
      .sort((a, b) => scoreVideo(b, artist) - scoreVideo(a, artist));

    const deduped = dedupeSongs(validVideos, artist).slice(0, maxVideosPerArtist);
    totalValid += deduped.length;
    processedThisRun += 1;
    console.log(`  Valid kept: ${deduped.length}`);

    await writeArtistVideosToGenreFile(artist, deduped.map(formatOutputVideo));
  } catch (error) {
    processedThisRun += 1;
    console.error(`  Error: ${error.message}`);
    await writeArtistErrorToGenreFile(artist, error.message);

    if (isFatalYouTubeError(error.message)) {
      console.error("Stopping early because every configured YouTube API key failed or is out of quota.");
      break;
    }
  }

  await sleep(delayMs);
}

console.log("\nDone.");
console.log(
  JSON.stringify(
    {
      artistCount: artists.length,
      processedThisRun,
      totalSearchCandidates: totalCandidates,
      totalValidVideos: totalValid,
      skippedExisting,
      apiCalls,
      output: "data/artists-by-genre/*.json",
    },
    null,
    2,
  ),
);

async function loadArtists() {
  const files = (await fs.readdir(artistDir))
    .filter((file) => file.endsWith(".json") && file !== "index.json")
    .sort();

  const loaded = [];
  const seen = new Set();

  for (const file of files) {
    if (genreFilter && !normalizeText(file).includes(genreFilter)) continue;

    const filePath = path.join(artistDir, file);
    let db;
    try {
      db = JSON.parse(await fs.readFile(filePath, "utf8"));
    } catch (error) {
      throw new Error(`Invalid JSON file ${file}: ${error.message}`);
    }

    if (!Array.isArray(db.artists)) {
      console.warn(`Skip ${file}: missing artists array.`);
      continue;
    }

    db.artists.forEach((entry, artistIndex) => {
      if (!entry || typeof entry.name !== "string" || !entry.name.trim()) {
        console.warn(`Skip invalid artist entry in ${file}.`);
        return;
      }

      if (artistFilter && !normalizeText(entry.name).includes(artistFilter)) return;

      const key = normalizeText(entry.name);
      if (seen.has(key)) return;
      seen.add(key);

      loaded.push({
        ...entry,
        name: entry.name.trim(),
        artistIndex,
        filePath,
        genreId: db.id || path.basename(file, ".json"),
        genreName: db.name || path.basename(file, ".json"),
      });
    });
  }

  if (!loaded.length) throw new Error(`No artists found in ${artistDir}.`);
  return loaded;
}

async function writeArtistVideosToGenreFile(artist, videos) {
  await updateArtistInGenreFile(artist, (entry) => {
    entry.videos = videos;
    entry.youtubeLastCheckedAt = new Date().toISOString();
    entry.youtubeSource = "YouTube Data API v3";
    delete entry.youtubeError;
  });
}

async function writeArtistErrorToGenreFile(artist, error) {
  await updateArtistInGenreFile(artist, (entry) => {
    entry.videos = Array.isArray(entry.videos) ? entry.videos : [];
    entry.youtubeLastCheckedAt = new Date().toISOString();
    entry.youtubeSource = "YouTube Data API v3";
    entry.youtubeError = error;
  });
}

async function updateArtistInGenreFile(artist, updater) {
  const db = JSON.parse(await fs.readFile(artist.filePath, "utf8"));
  const entry =
    db.artists?.[artist.artistIndex]?.name === artist.name
      ? db.artists[artist.artistIndex]
      : db.artists?.find((item) => normalizeText(item.name) === normalizeText(artist.name));

  if (!entry) throw new Error(`Cannot find artist ${artist.name} in ${artist.filePath}`);

  updater(entry);
  db.updatedAt = new Date().toISOString();

  const tmpPath = artist.filePath.replace(/\.json$/i, ".tmp.json");
  await fs.writeFile(tmpPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, artist.filePath);
}

async function searchArtist(artist) {
  const queries = buildQueries(artist.name);
  const allItems = [];

  for (const query of queries) {
    console.log(`  Search: ${query}`);
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      order: "relevance",
      videoCategoryId: "10",
      maxResults: String(searchResultsPerQuery),
      q: query,
      key: getCurrentKey(),
    });

    const data = await youtubeFetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    const items = Array.isArray(data.items) ? data.items : [];
    allItems.push(...items.filter((item) => item.id?.kind === "youtube#video" && item.id?.videoId));
  }

  return allItems;
}

function buildQueries(artistName) {
  const base = cleanArtistName(artistName);
  const queries = unique([
    `${base} official music video`,
    `${base} official audio`,
    `${base} topic`,
    `${base} mv`,
    `${base} bài hát chính thức`,
    `${base} ca khúc official`,
  ]);
  return queryLimit ? queries.slice(0, queryLimit) : queries;
}

async function fetchVideoDetails(videoIds) {
  const videos = [];
  for (const batch of chunk(videoIds, 50)) {
    const params = new URLSearchParams({
      part: "snippet,contentDetails,statistics,status",
      id: batch.join(","),
      key: getCurrentKey(),
    });

    const data = await youtubeFetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
    videos.push(...(Array.isArray(data.items) ? data.items : []));
  }
  return videos;
}

async function youtubeFetch(url) {
  apiCalls += 1;
  const response = await fetch(url, {
    headers: referer ? { Referer: referer } : {},
  });
  const data = await response.json();

  if (data.error) {
    const message = data.error.message || "YouTube API error";
    if (isRecoverableYouTubeError(message)) {
      rotateKey();
      return youtubeFetch(replaceApiKey(url, getCurrentKey()));
    }
    throw new Error(message);
  }

  if (!response.ok) throw new Error(`YouTube API HTTP ${response.status}`);
  return data;
}

function evaluateVideo(item, artist) {
  const video = mapVideoDetails(item);
  const text = `${video.title} ${video.description}`;
  const reasons = [];

  if (!video.videoId) reasons.push("missing_video_id");
  if (item.kind !== "youtube#video") reasons.push("not_video");
  if (item.status?.privacyStatus && item.status.privacyStatus !== "public") reasons.push("not_public");
  if (video.durationSeconds <= 0) reasons.push("missing_duration");
  if (video.durationSeconds > 600) reasons.push("duration_over_10_minutes");
  if (video.durationSeconds <= 60) reasons.push("likely_short");

  const blacklistHit = findBlacklistHit(text);
  if (blacklistHit) reasons.push(`blacklist:${blacklistHit}`);

  if (!matchesArtist(video, artist)) reasons.push("artist_not_matched");
  if (!looksLikeSongVideo(video)) reasons.push("not_song_video");

  return {
    valid: reasons.length === 0,
    reasons,
    video,
  };
}

function mapVideoDetails(item) {
  const snippet = item.snippet || {};
  const stats = item.statistics || {};

  return {
    videoId: item.id || "",
    title: decodeHtml(snippet.title || ""),
    channelTitle: decodeHtml(snippet.channelTitle || ""),
    description: decodeHtml(snippet.description || ""),
    durationSeconds: parseIsoDuration(item.contentDetails?.duration || ""),
    viewCount: Number(stats.viewCount || 0),
    publishedAt: snippet.publishedAt || "",
  };
}

function matchesArtist(video, artist) {
  const artistNames = getArtistAliases(artist.name);
  const title = normalizeText(video.title);
  const channel = normalizeText(video.channelTitle);

  return artistNames.some((name) => {
    const normalized = normalizeText(name);
    return normalized && (title.includes(normalized) || channel.includes(normalized));
  });
}

function looksLikeSongVideo(video) {
  const title = normalizeText(video.title);
  const channel = normalizeText(video.channelTitle);
  const positiveTerms = ["official", "mv", "m v", "audio", "topic", "music video", "performance", "visualizer"];

  if (positiveTerms.some((term) => title.includes(term) || channel.includes(term))) return true;
  return video.durationSeconds >= 120 && video.durationSeconds <= 420 && /[-|–]/.test(video.title);
}

function findBlacklistHit(value) {
  const normalized = normalizeText(value);
  return BLACKLIST_TERMS.find((term) => {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) return false;
    return new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}(\\s|$)`, "i").test(normalized);
  });
}

function dedupeSongs(videos, artist) {
  const bestByTitle = new Map();
  for (const video of videos) {
    const key = normalizeSongTitle(video.title, artist.name);
    const current = bestByTitle.get(key);
    if (!current || scoreVideo(video, artist) > scoreVideo(current, artist)) {
      bestByTitle.set(key, video);
    }
  }
  return Array.from(bestByTitle.values()).sort((a, b) => scoreVideo(b, artist) - scoreVideo(a, artist));
}

function normalizeSongTitle(title, artistName) {
  let value = normalizeText(title);

  for (const alias of getArtistAliases(artistName)) {
    value = value.replace(new RegExp(`(^|\\s)${escapeRegExp(normalizeText(alias))}(\\s|$)`, "g"), " ");
  }

  for (const term of TITLE_CLEANUP_TERMS) {
    value = value.replace(new RegExp(`(^|\\s)${escapeRegExp(normalizeText(term))}(\\s|$)`, "g"), " ");
  }

  return (
    value
      .replace(/\b\d{3,4}p\b/g, " ")
      .replace(/\b20\d{2}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim() || normalizeText(title)
  );
}

function scoreVideo(video, artist) {
  const title = normalizeText(video.title);
  const channel = normalizeText(video.channelTitle);
  const aliases = getArtistAliases(artist.name).map(normalizeText).filter(Boolean);
  let score = 0;

  if (title.includes("official")) score += 100;
  if (title.includes("music video") || title.includes("mv")) score += 40;
  if (title.includes("official audio")) score += 35;
  if (title.includes("lyrics") || title.includes("lyric")) score -= 20;
  if (channel.includes("topic")) score += 25;
  if (aliases.some((name) => channel.includes(name))) score += 70;
  if (aliases.some((name) => title.includes(name))) score += 30;
  if (video.durationSeconds >= 120 && video.durationSeconds <= 420) score += 20;
  if (video.durationSeconds > 420 && video.durationSeconds <= 600) score -= 15;
  score += Math.min(Math.log10(Math.max(video.viewCount, 1)), 9);

  return score;
}

function formatOutputVideo(video) {
  return {
    videoId: video.videoId,
    title: video.title,
    channelTitle: video.channelTitle,
    durationSeconds: video.durationSeconds,
    youtubeUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
  };
}

function logRejectedVideos(evaluated) {
  const rejected = evaluated.filter((item) => !item.valid);
  console.log(`  Rejected: ${rejected.length}`);
  for (const item of rejected.slice(0, 12)) {
    console.log(`    - ${item.video.videoId || "unknown"} | ${item.reasons.join(", ")} | ${item.video.title}`);
  }
  if (rejected.length > 12) console.log(`    ... ${rejected.length - 12} more rejected`);
}

function getArtistAliases(name) {
  const aliases = new Set([name, cleanArtistName(name)]);
  const parenthetical = String(name).match(/\(([^)]+)\)/);
  if (parenthetical) aliases.add(parenthetical[1]);
  String(name)
    .split(/[,&/–—-]| x | ft\.? | feat\.?/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => aliases.add(cleanArtistName(part)));
  Array.from(aliases).forEach((alias) => {
    const compact = normalizeText(alias).replace(/\s+/g, "");
    if (compact.length >= 5) aliases.add(compact);
  });
  return Array.from(aliases).filter(Boolean);
}

function cleanArtistName(value) {
  return String(value || "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIsoDuration(value) {
  const match = String(value || "").match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const [, days = 0, hours = 0, minutes = 0, seconds = 0] = match.map((part) => Number(part || 0));
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function replaceApiKey(url, key) {
  const parsed = new URL(url);
  parsed.searchParams.set("key", key);
  return parsed.toString();
}

function getCurrentKey() {
  return keys[keyIndex];
}

function rotateKey() {
  keyIndex += 1;
  if (keyIndex >= keys.length) throw new Error("All YouTube API keys failed or are out of quota.");
  console.warn(`Switching to YouTube API key #${keyIndex + 1}`);
}

function isFatalYouTubeError(message) {
  return String(message || "").toLowerCase().includes("all youtube api keys failed");
}

function isRecoverableYouTubeError(message) {
  const value = String(message || "").toLowerCase();
  return (
    value.includes("quota") ||
    value.includes("daily limit") ||
    value.includes("api key") ||
    value.includes("key not valid") ||
    value.includes("permission denied") ||
    value.includes("suspended") ||
    value.includes("forbidden") ||
    value.includes("403") ||
    value.includes("429")
  );
}

async function loadYouTubeApiKeys() {
  const envFile = await readEnvFile(envPath);
  const envKeys = String(process.env.YOUTUBE_API_KEYS || process.env.YOUTUBE_API_KEY || "")
    .split(/[,\s;]+/)
    .map((key) => key.trim())
    .filter(Boolean);
  if (envKeys.length) return unique(envKeys);

  const fileKeys = String(envFile.YOUTUBE_API_KEYS || envFile.YOUTUBE_API_KEY || "")
    .split(/[,\s;]+/)
    .map((key) => key.trim())
    .filter(Boolean);
  return unique(fileKeys);
}

async function readEnvFile(filePath) {
  const result = {};
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key) result[key] = value;
  });
  return result;
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const equalIndex = arg.indexOf("=");
    if (equalIndex > 2) {
      parsed[arg.slice(2, equalIndex)] = arg.slice(equalIndex + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function unique(values) {
  return Array.from(new Set(values));
}

function chunk(values, size) {
  const result = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
