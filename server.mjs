import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;
const youtubeApiBase = "https://www.googleapis.com/youtube/v3";

await loadEnvFile(path.join(projectRoot, ".env"));

const port = Number(process.env.PORT || 5502);
const youtubeKeys = parseKeys(process.env.YOUTUBE_API_KEYS || process.env.YOUTUBE_API_KEY || "");
let youtubeKeyIndex = 0;
const youtubeRateLimitWindowMs = Number(process.env.YOUTUBE_PROXY_RATE_LIMIT_WINDOW_MS || 60_000);
const youtubeRateLimitMax = Number(process.env.YOUTUBE_PROXY_RATE_LIMIT_MAX || 120);
const youtubeRateLimitBuckets = new Map();
const blockedStaticNames = new Set([
  ".env",
  ".env.example",
  ".gitignore",
  "firebase.json",
  "firestore.rules",
  "package.json",
  "package-lock.json",
  "server.mjs",
]);
const blockedStaticDirs = new Set([".git", ".agents", ".codex", "node_modules", "scripts"]);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/youtube/v3/")) {
      await handleYouTubeProxy(req, url, res);
      return;
    }

    await serveStaticFile(url, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: { message: "Server error" } });
  }
});

server.listen(port, () => {
  console.log(`Listen Music running at http://127.0.0.1:${port}/`);
});

async function loadEnvFile(filePath) {
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

function parseKeys(value) {
  return Array.from(
    new Set(
      String(value || "")
        .split(/[,\s;]+/)
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  );
}

async function handleYouTubeProxy(req, url, res) {
  if (!youtubeKeys.length) {
    sendJson(res, 500, { error: { message: "YouTube API keys are not configured on the server." } });
    return;
  }

  if (!checkRateLimit(getClientIp(req))) {
    sendJson(res, 429, { error: { message: "Too many YouTube API requests. Please try again later." } });
    return;
  }

  const resource = url.pathname.replace("/api/youtube/v3/", "").replace(/^\/+|\/+$/g, "");
  if (!["search", "videos", "channels"].includes(resource)) {
    sendJson(res, 404, { error: { message: "Unknown YouTube API resource." } });
    return;
  }

  const params = new URLSearchParams(url.searchParams);
  params.delete("key");

  for (let attempt = 0; attempt < youtubeKeys.length; attempt += 1) {
    params.set("key", youtubeKeys[youtubeKeyIndex]);
    const upstreamUrl = `${youtubeApiBase}/${resource}?${params.toString()}`;
    const upstream = await fetch(upstreamUrl, {
      headers: process.env.YOUTUBE_API_REFERER ? { Referer: process.env.YOUTUBE_API_REFERER } : {},
    });
    const data = await upstream.json().catch(() => ({}));

    if (!data.error || !isRecoverableYouTubeError(data.error)) {
      sendJson(res, upstream.status, data);
      return;
    }

    youtubeKeyIndex = (youtubeKeyIndex + 1) % youtubeKeys.length;
    console.warn(`[YouTube proxy] Rotated to API key #${youtubeKeyIndex + 1}`);
  }

  sendJson(res, 429, { error: { message: "All YouTube API keys are unavailable or out of quota." } });
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}

function checkRateLimit(clientIp) {
  const now = Date.now();
  for (const [key, bucket] of youtubeRateLimitBuckets) {
    if (now - bucket.startedAt > youtubeRateLimitWindowMs * 2) youtubeRateLimitBuckets.delete(key);
  }

  const bucket = youtubeRateLimitBuckets.get(clientIp);
  if (!bucket || now - bucket.startedAt > youtubeRateLimitWindowMs) {
    youtubeRateLimitBuckets.set(clientIp, { count: 1, startedAt: now });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= youtubeRateLimitMax;
}

function isRecoverableYouTubeError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("quota") ||
    message.includes("daily limit") ||
    message.includes("api key") ||
    message.includes("key not valid") ||
    message.includes("permission denied") ||
    message.includes("suspended") ||
    message.includes("forbidden") ||
    message.includes("403") ||
    message.includes("429")
  );
}

async function serveStaticFile(url, res) {
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(projectRoot, `.${pathname}`);
  const relativePath = path.relative(projectRoot, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath) || isBlockedStaticPath(relativePath)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const stats = await fs.stat(filePath).catch(() => null);
  if (!stats || !stats.isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const content = await fs.readFile(filePath);
  res.writeHead(200, {
    ...getSecurityHeaders(),
    "Content-Type": getContentType(filePath),
    "Cache-Control": "no-store",
  });
  res.end(content);
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    ...getSecurityHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function isBlockedStaticPath(relativePath) {
  const parts = relativePath.split(path.sep).filter(Boolean);
  if (!parts.length) return false;
  if (parts.some((part) => blockedStaticDirs.has(part) || (part.startsWith(".") && part !== ".well-known"))) return true;
  return blockedStaticNames.has(parts[parts.length - 1]);
}

function getSecurityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
    }[ext] || "application/octet-stream"
  );
}
