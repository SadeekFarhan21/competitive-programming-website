// Fetches all Codeforces problems and buckets the most-recent 1000 by rating.
// Ratings 800..1600 (step 100). Run: `node scripts/build-data.mjs`
import { writeFileSync, mkdirSync } from "node:fs";

const RATINGS = [1000, 1100, 1200, 1300, 1400, 1500, 1600];
const PER_BUCKET = 1000;
const API = "https://codeforces.com/api/problemset.problems";

const res = await fetch(API, { headers: { "User-Agent": "Mozilla/5.0" } });
const json = await res.json();
if (json.status !== "OK") throw new Error(`API error: ${json.comment}`);

const { problems, problemStatistics } = json.result;
const solved = new Map(
  problemStatistics.map((s) => [`${s.contestId}-${s.index}`, s.solvedCount])
);

const buckets = {};
for (const r of RATINGS) buckets[r] = [];

for (const p of problems) {
  if (!buckets[p.rating]) continue;
  buckets[p.rating].push({
    contestId: p.contestId,
    index: p.index,
    name: p.name,
    rating: p.rating,
    tags: p.tags ?? [],
    solvedCount: solved.get(`${p.contestId}-${p.index}`) ?? 0,
    url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
  });
}

// Most recent first (higher contestId = newer), cap at PER_BUCKET.
const out = {};
let total = 0;
for (const r of RATINGS) {
  const list = buckets[r]
    .sort((a, b) => b.contestId - a.contestId || (a.index < b.index ? -1 : 1))
    .slice(0, PER_BUCKET);
  out[r] = list;
  total += list.length;
  console.log(`rating ${r}: ${list.length}`);
}

// Per-rating files (loaded on demand by the client) + a small index.
mkdirSync("public/data", { recursive: true });
const generatedAt = new Date().toISOString();
const counts = {};
for (const r of RATINGS) {
  counts[r] = out[r].length;
  writeFileSync(`public/data/${r}.json`, JSON.stringify(out[r]));
}
writeFileSync(
  "public/data/index.json",
  JSON.stringify({ generatedAt, ratings: RATINGS, counts, total }, null, 2)
);
console.log(`\nTotal problems: ${total} -> public/data/{rating}.json`);
