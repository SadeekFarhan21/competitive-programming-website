// Adds a `solved` flag to data/starred.json and data/starred.csv based on the
// accepted submissions in data/submissions.json. Run after `pnpm refresh`.
//
// Matching per judge:
//   UVa      starred id "01124"  ↔ submission "1124 - Title"
//   LeetCode starred id "lc2469" ↔ submission title (via LeetCode's problem list)
//   Kattis   starred id "hello"  ↔ submission title "Hello World!" (titles cached
//            in data/kattis-titles.json so each slug is only fetched once)

import fs from "node:fs";
import path from "node:path";

const DATA = path.join(import.meta.dirname, "..", "data");
const read = (file) => JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (value) => String(value).normalize("NFKC").trim().toLowerCase();

const submissions = read("submissions.json");
const starred = read("starred.json");

const accepted = (platform) => submissions.filter((s) => s.platform === platform && s.ac);

const uvaSolved = new Set(
  accepted("UVA").map((s) => Number(s.problem.split(" - ")[0])).filter(Number.isFinite)
);

const leetcodeSolvedTitles = new Set(accepted("LeetCode").map((s) => norm(s.problem)));
let leetcodeTitleById = null;
try {
  const res = await fetch("https://leetcode.com/api/problems/all/", { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = await res.json();
  leetcodeTitleById = new Map(
    payload.stat_status_pairs.map((p) => [String(p.stat.frontend_question_id), p.stat.question__title])
  );
} catch (error) {
  console.warn(`LeetCode problem list unavailable (${error.message}) — keeping previous LeetCode flags`);
}

const KATTIS_CACHE = path.join(DATA, "kattis-titles.json");
const kattisTitles = fs.existsSync(KATTIS_CACHE) ? read("kattis-titles.json") : {};
const kattisSolvedTitles = new Set(accepted("Kattis").map((s) => norm(s.problem)));
const decode = (value) =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const missing = [...new Set(starred.filter((p) => p.judge === "Kattis" && !(p.id in kattisTitles)).map((p) => p.id))];
if (missing.length) console.log(`fetching ${missing.length} Kattis titles…`);
for (const slug of missing) {
  try {
    const res = await fetch(`https://open.kattis.com/problems/${encodeURIComponent(slug)}`, {
      headers: { "User-Agent": "submission-activity/1.0 (local dashboard)" },
    });
    const title = (await res.text()).match(/<title>([\s\S]*?)\s*&ndash;\s*Kattis/i)?.[1];
    if (res.ok && title) kattisTitles[slug] = decode(title.trim());
  } catch (error) {
    console.warn(`Kattis ${slug}: ${error.message}`);
  }
  await sleep(250);
}
fs.writeFileSync(KATTIS_CACHE, JSON.stringify(kattisTitles, null, 2) + "\n");

for (const problem of starred) {
  let solved = problem.solved ?? false;
  if (problem.judge === "UVa") {
    solved = uvaSolved.has(Number(problem.id));
  } else if (problem.judge === "LeetCode" && leetcodeTitleById) {
    const title = leetcodeTitleById.get(problem.id.replace(/^lc/, ""));
    solved = title != null && leetcodeSolvedTitles.has(norm(title));
  } else if (problem.judge === "Kattis") {
    const title = kattisTitles[problem.id];
    solved = kattisSolvedTitles.has(norm(problem.id)) || (title != null && kattisSolvedTitles.has(norm(title)));
  }
  problem.solved = solved;
}
fs.writeFileSync(path.join(DATA, "starred.json"), JSON.stringify(starred, null, 2) + "\n");

// starred.csv keeps its original layout (one row per starred.json entry, same
// order); only a trailing Solved column is added or updated.
function parseCsv(textValue) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < textValue.length; i++) {
    const c = textValue[i];
    if (quoted) {
      if (c === '"' && textValue[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const escapeCsv = (value) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

const csvPath = path.join(DATA, "starred.csv");
const [header, ...body] = parseCsv(fs.readFileSync(csvPath, "utf8"));
if (body.length !== starred.length) throw new Error(`starred.csv has ${body.length} rows, starred.json has ${starred.length}`);
let solvedIndex = header.indexOf("Solved");
if (solvedIndex < 0) solvedIndex = header.push("Solved") - 1;
body.forEach((row, i) => {
  if (row[0] !== starred[i].id) throw new Error(`starred.csv row ${i + 2} (${row[0]}) does not match starred.json (${starred[i].id})`);
  row[solvedIndex] = String(starred[i].solved);
});
fs.writeFileSync(csvPath, [header, ...body].map((row) => row.map(escapeCsv).join(",")).join("\n") + "\n");

const count = (judge) => starred.filter((p) => p.judge === judge && p.solved).length;
console.log(
  `solved ${starred.filter((p) => p.solved).length}/${starred.length} starred ` +
    `(UVa ${count("UVa")}, Kattis ${count("Kattis")}, LeetCode ${count("LeetCode")})`
);
