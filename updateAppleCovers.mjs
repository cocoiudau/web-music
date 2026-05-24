import fs from "fs/promises";
import https from "https";
import path from "path";

const root = path.resolve("Web-Music");
const songsPath = path.join(root, "songs.json");
const coversDir = path.join(root, "images", "covers");
const songs = JSON.parse(await fs.readFile(songsPath, "utf8"));

await fs.mkdir(coversDir, { recursive: true });

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 160)}`));
            return;
          }
          resolve(JSON.parse(body));
        });
      })
      .on("error", reject);
  });
}

function downloadFile(url, target) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          downloadFile(res.headers.location, target).then(resolve, reject);
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Download HTTP ${res.statusCode}`));
          return;
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", async () => {
          await fs.writeFile(target, Buffer.concat(chunks));
          resolve();
        });
      })
      .on("error", reject);
  });
}

function cleanTitle(title) {
  return String(title || "")
    .replace(/\([^)]*remix[^)]*\)/gi, "")
    .replace(/\bremix\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreResult(song, result) {
  const title = normalize(song.title);
  const clean = normalize(cleanTitle(song.title));
  const artist = normalize(song.artist);
  const track = normalize(result.trackName);
  const resultArtist = normalize(result.artistName);
  let score = 0;

  if (track === title) score += 8;
  if (clean && track.includes(clean)) score += 5;
  if (title.includes(track) || track.includes(title)) score += 3;
  if (artist && resultArtist && (artist.includes(resultArtist) || resultArtist.includes(artist.split(" ")[0]))) score += 3;
  if (/remix/i.test(result.trackName || "") === /remix/i.test(song.title || "")) score += 1;

  return score;
}

function biggerArtwork(url) {
  return String(url || "")
    .replace(/100x100bb\.(jpg|png|webp)$/i, "600x600bb.$1")
    .replace(/100x100-999\.(jpg|png|webp)$/i, "600x600-999.$1");
}

async function findArtwork(song) {
  const queries = [
    `${song.title} ${song.artist}`,
    `${cleanTitle(song.title)} ${song.artist}`,
    song.title,
  ];

  for (const query of queries) {
    const url =
      "https://itunes.apple.com/search?media=music&entity=song&limit=8&country=VN&term=" +
      encodeURIComponent(query);
    const data = await requestJson(url);
    const results = data.results || [];
    if (!results.length) continue;

    const best = results.sort((a, b) => scoreResult(song, b) - scoreResult(song, a))[0];
    if (best?.artworkUrl100) return { artwork: biggerArtwork(best.artworkUrl100), match: `${best.trackName} - ${best.artistName}` };
  }

  return null;
}

let updated = 0;

for (const song of songs) {
  const id = path.basename(song.file, path.extname(song.file));
  const found = await findArtwork(song);

  if (!found) {
    console.log(`${id}: no Apple artwork found`);
    continue;
  }

  const target = path.join(coversDir, `${id}.jpg`);
  await downloadFile(found.artwork, target);
  song.image = `images/covers/${id}.jpg`;
  updated += 1;
  console.log(`${id}: ${found.match}`);
}

await fs.writeFile(songsPath, JSON.stringify(songs, null, 2) + "\n", "utf8");
console.log(`Done. Updated ${updated}/${songs.length} covers.`);
