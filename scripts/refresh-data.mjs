// Fetches submissions from all platforms and merges them into data/submissions.json.
// Run locally with `pnpm refresh` (reads cookies from .env.local) or via CI.
// The site serves from the stored JSON, so this script is the only thing that
// talks to the platform APIs.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "submissions.json");

// Next.js auto-loads .env.local; plain node does not
for (const file of [".env.local", ".env"]) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const HANDLES = {
  codeforces: "FarhanSadeek21",
  atcoder: "Farhan2021",
  leetcode: "FarhanSadeek21",
  codechef: "farhansadeek21",
  uva: "legacy101",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- fetchers (return {platform, epoch, problem, verdict, ac, language, runtimeMs, memoryBytes}) ----------

async function fetchCodeforces() {
  const res = await fetch(
    `https://codeforces.com/api/user.status?handle=${HANDLES.codeforces}&from=1&count=10000`
  );
  const data = await res.json();
  if (data.status !== "OK") throw new Error(data.comment ?? "CF error");
  return data.result.map((s) => ({
    platform: "Codeforces",
    epoch: s.creationTimeSeconds,
    problem: `${s.problem.contestId}${s.problem.index} - ${s.problem.name}`,
    verdict: s.verdict ?? "UNKNOWN",
    ac: s.verdict === "OK",
    language: s.programmingLanguage,
    runtimeMs: s.timeConsumedMillis,
    memoryBytes: s.memoryConsumedBytes,
  }));
}

async function fetchAtCoder() {
  const res = await fetch(
    `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${HANDLES.atcoder}&from_second=0`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  const data = await res.json();
  return data.map((s) => ({
    platform: "AtCoder",
    epoch: s.epoch_second,
    problem: s.problem_id,
    verdict: s.result,
    ac: s.result === "AC",
    language: s.language,
    runtimeMs: s.execution_time ?? null,
    memoryBytes: s.memory ?? null,
  }));
}

async function fetchLeetCode(knownEpochs) {
  const session = process.env.LEETCODE_SESSION;
  if (!session) {
    console.warn("LEETCODE_SESSION not set — skipping LeetCode");
    return [];
  }
  const headers = {
    "User-Agent": "Mozilla/5.0",
    Referer: "https://leetcode.com/",
    Cookie: `LEETCODE_SESSION=${session}`,
  };
  const subs = [];
  for (let page = 0; page < 200; page++) {
    if (page > 0) await sleep(1200);
    const res = await fetch(
      `https://leetcode.com/api/submissions/?offset=${page * 20}&limit=20`,
      { headers }
    );
    if (!res.ok) {
      console.warn(`LeetCode page ${page}: HTTP ${res.status} — stopping`);
      break;
    }
    const data = await res.json();
    const dump = data.submissions_dump ?? [];
    let sawKnown = false;
    for (const s of dump) {
      if (knownEpochs.has(`LeetCode:${s.timestamp}`)) sawKnown = true;
      subs.push({
        platform: "LeetCode",
        epoch: s.timestamp,
        problem: s.title,
        verdict: (s.status_display ?? "UNKNOWN").toUpperCase(),
        ac: s.status_display === "Accepted",
        language: s.lang,
        runtimeMs: s.runtime?.match(/\d+/) ? Number(s.runtime.match(/\d+/)[0]) : null,
        memoryBytes: (() => {
          const m = s.memory?.match(/([\d.]+)\s*MB/);
          return m ? Math.round(Number(m[1]) * 1024 * 1024) : null;
        })(),
      });
    }
    // incremental: once we reach already-stored submissions, stop paginating
    if (sawKnown || !data.has_next) break;
  }
  return subs;
}

async function fetchCodeChef(knownEpochs) {
  const parse = (html) => {
    const rows = [];
    const re =
      /<td\s+title='(\d{1,2}):(\d{2}) ([AP]M) (\d{2})\/(\d{2})\/(\d{2})'>[\s\S]*?<td\s+title='([^']*)'>[\s\S]*?<span title='([^']*)'[\s\S]*?<td\s+title='([^']*)'>/g;
    let m;
    while ((m = re.exec(html))) {
      let hour = Number(m[1]) % 12;
      if (m[3] === "PM") hour += 12;
      rows.push({
        platform: "CodeChef",
        epoch:
          Date.UTC(2000 + Number(m[6]), Number(m[5]) - 1, Number(m[4]), hour, Number(m[2])) /
          1000,
        problem: m[7],
        verdict: (m[8] || "UNKNOWN").toUpperCase(),
        ac: m[8]?.toLowerCase().startsWith("accepted") ?? false,
        language: m[9],
        runtimeMs: null,
        memoryBytes: null,
      });
    }
    return rows;
  };
  const first = await (
    await fetch(
      `https://www.codechef.com/recent/user?user_handle=${HANDLES.codechef}&page=0`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    )
  ).json();
  const maxPage = Math.min(Number(first.max_page) || 1, 100);
  let rows = parse(first.content ?? "");
  for (let p = 1; p < maxPage; p++) {
    await sleep(400);
    const data = await (
      await fetch(
        `https://www.codechef.com/recent/user?user_handle=${HANDLES.codechef}&page=${p}`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      )
    ).json();
    const batch = parse(data.content ?? "");
    rows = rows.concat(batch);
    if (batch.some((r) => knownEpochs.has(`CodeChef:${r.epoch}`))) break;
  }
  return rows;
}

const UVA_VERDICTS = {
  10: "SUBMISSION_ERROR", 15: "CANT_BE_JUDGED", 20: "IN_QUEUE", 30: "COMPILE_ERROR",
  35: "RESTRICTED_FUNCTION", 40: "RUNTIME_ERROR", 45: "OUTPUT_LIMIT", 50: "TIME_LIMIT",
  60: "MEMORY_LIMIT", 70: "WRONG_ANSWER", 80: "PRESENTATION_ERROR", 90: "ACCEPTED",
};
const UVA_LANGUAGES = { 1: "ANSI C", 2: "Java", 3: "C++", 4: "Pascal", 5: "C++11", 6: "Python 3" };

async function fetchUVA() {
  const uid = await (
    await fetch(`https://uhunt.onlinejudge.org/api/uname2uid/${HANDLES.uva}`)
  ).json();
  if (!uid) throw new Error("unknown UVA username");
  const data = await (
    await fetch(`https://uhunt.onlinejudge.org/api/subs-user/${uid}`)
  ).json();
  const subs = data.subs ?? [];
  // resolve problem titles (cached across runs would be nicer; volume is small)
  const pids = [...new Set(subs.map((s) => s[1]))];
  const titles = {};
  for (const pid of pids) {
    const p = await (await fetch(`https://uhunt.onlinejudge.org/api/p/id/${pid}`)).json();
    titles[pid] = p?.num && p?.title ? `${p.num} - ${p.title}` : `problem ${pid}`;
    await sleep(150);
  }
  return subs.map((s) => ({
    platform: "UVA",
    epoch: s[4],
    problem: titles[s[1]],
    verdict: UVA_VERDICTS[s[2]] ?? `VERDICT_${s[2]}`,
    ac: s[2] === 90,
    language: UVA_LANGUAGES[s[5]] ?? `lang ${s[5]}`,
    runtimeMs: s[3],
    memoryBytes: null,
  }));
}

async function fetchCSES() {
  const session = process.env.CSES_SESSION;
  if (!session) {
    console.warn("CSES_SESSION not set — skipping CSES");
    return [];
  }
  const headers = { "User-Agent": "Mozilla/5.0", Cookie: `PHPSESSID=${session}` };
  const grid = await (await fetch("https://cses.fi/problemset/", { headers })).text();
  if (!grid.includes('href="/logout"')) {
    console.warn("CSES session expired — skipping CSES");
    return [];
  }
  const taskIds = [...grid.matchAll(
    /<li class="task"><a href="\/problemset\/task\/(\d+)">([^<]*)<\/a>[\s\S]*?task-score icon (full|zero)/g
  )].map((m) => [m[1], m[2]]);

  const subs = [];
  for (const [id, name] of taskIds) {
    await sleep(200);
    const page = await (
      await fetch(`https://cses.fi/problemset/task/${id}`, { headers })
    ).text();
    const section = page.split("Your submissions")[1] ?? "";
    for (const ts of section.matchAll(
      /href="\/problemset\/result\/\d+\/">(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) <span class="task-score icon (full|zero)"/g
    )) {
      subs.push({
        platform: "CSES",
        epoch: Date.parse(`${ts[1]}T${ts[2]}Z`) / 1000,
        problem: name,
        verdict: ts[3] === "full" ? "ACCEPTED" : "REJECTED",
        ac: ts[3] === "full",
        language: "C++",
        runtimeMs: null,
        memoryBytes: null,
      });
    }
  }
  return subs;
}

// ---------- merge ----------

function loadExisting() {
  if (!fs.existsSync(DATA_PATH)) return [];
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

const existing = loadExisting();
const knownEpochs = new Set(existing.map((s) => `${s.platform}:${s.epoch}`));
console.log(`existing rows: ${existing.length}`);

const results = await Promise.allSettled([
  fetchCodeforces(),
  fetchAtCoder(),
  fetchLeetCode(knownEpochs),
  fetchCodeChef(knownEpochs),
  fetchUVA(),
  fetchCSES(),
]);

const names = ["Codeforces", "AtCoder", "LeetCode", "CodeChef", "UVA", "CSES"];
let fresh = [];
results.forEach((r, i) => {
  if (r.status === "fulfilled") {
    console.log(`${names[i]}: fetched ${r.value.length}`);
    fresh = fresh.concat(r.value);
  } else {
    console.warn(`${names[i]}: FAILED — ${r.reason}`);
  }
});

// merge: keep every existing row; add fetched rows we haven't seen
const merged = [...existing];
const seen = new Set(knownEpochs);
let added = 0;
for (const s of fresh) {
  const key = `${s.platform}:${s.epoch}`;
  if (seen.has(key)) continue;
  seen.add(key);
  merged.push(s);
  added++;
}
merged.sort((a, b) => a.epoch - b.epoch);

fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
fs.writeFileSync(DATA_PATH, JSON.stringify(merged) + "\n");
console.log(`added ${added} new rows → total ${merged.length} in ${path.relative(ROOT, DATA_PATH)}`);
