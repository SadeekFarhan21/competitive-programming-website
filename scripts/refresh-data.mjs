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
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --full: ignore the incremental early-stop and paginate entire histories
// (slower pacing to stay under rate limits). Use for one-time backfills.
const FULL = process.argv.includes("--full");

// ---------- fetchers (return {platform, epoch, problem, verdict, ac, language, runtimeMs, memoryBytes}) ----------

async function fetchCodeforces() {
  const res = await fetch(
    `https://codeforces.com/api/user.status?handle=${HANDLES.codeforces}&from=1&count=1000`
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

async function fetchAtCoder(knownEpochs) {
  const latest = [...knownEpochs]
    .filter((key) => key.startsWith("AtCoder:"))
    .map((key) => Number(key.slice("AtCoder:".length)))
    .filter(Number.isFinite)
    .reduce((max, epoch) => Math.max(max, epoch), 0);
  const fromSecond = Math.max(0, latest - 86400);
  const res = await fetch(
    `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${HANDLES.atcoder}&from_second=${fromSecond}`,
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
  const query = session
    ? `query submissionList($limit: Int!, $offset: Int!) { submissionList(limit: $limit, offset: $offset) { hasNext submissions { id title titleSlug timestamp statusDisplay lang runtime memory } } }`
    : `query recentAcSubmissionList($username: String!, $limit: Int!, $skip: Int!) { recentAcSubmissionList(username: $username, limit: $limit, skip: $skip) { id title titleSlug timestamp statusDisplay lang } }`;
  const headers = { "Content-Type": "application/json", Referer: "https://leetcode.com/", Origin: "https://leetcode.com", ...(session ? { Cookie: `LEETCODE_SESSION=${session}` } : {}) };
  const all = [];
  for (let page = 0; page < (session ? 200 : 1); page++) {
    if (page > 0) await sleep(FULL ? 3000 : 1200);
    const variables = session ? { limit: 20, offset: page * 20 } : { username: HANDLES.leetcode, limit: 20, skip: 0 };
    const res = await fetch("https://leetcode.com/graphql", { method: "POST", headers, body: JSON.stringify({ query, variables }) });
    if (!res.ok) throw new Error(`LeetCode GraphQL HTTP ${res.status}`);
    const payload = await res.json();
    if (payload.errors?.length) throw new Error(payload.errors[0].message ?? "LeetCode GraphQL error");
    const rows = session ? payload.data?.submissionList?.submissions ?? [] : payload.data?.recentAcSubmissionList ?? [];
    all.push(...rows);
    const sawKnown = rows.some((s) => knownEpochs.has(`LeetCode:${s.timestamp}`));
    if (!session || (sawKnown && !FULL) || !payload.data?.submissionList?.hasNext) break;
  }
  return all.flatMap((s) => {
    const rawEpoch = s.timestamp ?? s.timeStamp ?? s.createdAt;
    const epoch = typeof rawEpoch === "number" ? rawEpoch : Number(rawEpoch) || Date.parse(rawEpoch) / 1000;
    const title = s.title ?? s.problem ?? s.titleSlug;
    if (!Number.isFinite(epoch) || !title) return [];
    const verdict = String(s.statusDisplay ?? "ACCEPTED").toUpperCase();
    const runtimeMatch = String(s.runtime ?? "").match(/[\d.]+/);
    const memoryMatch = String(s.memory ?? "").match(/([\d.]+)\s*(KB|MB|GB)/i);
    const memoryUnit = memoryMatch?.[2]?.toUpperCase();
    return [{
      platform: "LeetCode",
      epoch,
      problem: String(title),
      verdict,
      ac: verdict === "ACCEPTED",
      language: s.lang ?? s.language ?? null,
      runtimeMs: runtimeMatch ? Number(runtimeMatch[0]) : null,
      memoryBytes: memoryMatch
        ? Math.round(Number(memoryMatch[1]) * (memoryUnit === "GB" ? 1024 ** 3 : memoryUnit === "KB" ? 1024 : 1024 ** 2))
        : null,
    }];
  });
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
    if (!FULL && batch.some((r) => knownEpochs.has(`CodeChef:${r.epoch}`))) break;
  }
  return rows;
}

async function fetchCSES() {
  const scheduledCsesWindow = new Date().getUTCHours() === 6;
  if (process.env.REFRESH_CSES !== "true" && !scheduledCsesWindow) {
    console.log("CSES refresh skipped — scheduled separately to protect quota");
    return [];
  }
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
  fetchAtCoder(knownEpochs),
  fetchLeetCode(knownEpochs),
  fetchCodeChef(knownEpochs),
  fetchCSES(),
]);

const names = ["Codeforces", "AtCoder", "LeetCode", "CodeChef", "CSES"];
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
  if (seen.has(key)) {
    const existingIndex = merged.findIndex((row) => `${row.platform}:${row.epoch}` === key);
    if (existingIndex >= 0 && s.platform === "LeetCode") merged[existingIndex] = s;
    continue;
  }
  seen.add(key);
  merged.push(s);
  added++;
}
merged.sort((a, b) => a.epoch - b.epoch);

fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
fs.writeFileSync(DATA_PATH, JSON.stringify(merged) + "\n");
console.log(`added ${added} new rows → total ${merged.length} in ${path.relative(ROOT, DATA_PATH)}`);
