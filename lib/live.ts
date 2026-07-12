import { StoredSub } from "./store";

// Lightweight "recent only" fetchers — one request per platform, no pagination.
// Merged on top of the bundled history so the site stays fresh between
// data refreshes. CSES is excluded (its history needs a ~300-page crawl;
// it refreshes via scripts/refresh-data.mjs).

const HANDLES = {
  codeforces: "FarhanSadeek21",
  atcoder: "Farhan2021",
  codechef: "farhansadeek21",
  uva: "legacy101",
};

async function recentCodeforces(): Promise<StoredSub[]> {
  const res = await fetch(
    `https://codeforces.com/api/user.status?handle=${HANDLES.codeforces}&from=1&count=50`,
    { cache: "no-store" }
  );
  const data = await res.json();
  if (data.status !== "OK") return [];
  return (data.result as any[]).map((s) => ({
    platform: "Codeforces" as const,
    epoch: s.creationTimeSeconds,
    problem: `${s.problem.contestId}${s.problem.index} - ${s.problem.name}`,
    verdict: s.verdict ?? "UNKNOWN",
    ac: s.verdict === "OK",
    language: s.programmingLanguage ?? null,
    runtimeMs: s.timeConsumedMillis ?? null,
    memoryBytes: s.memoryConsumedBytes ?? null,
  }));
}

async function recentAtCoder(): Promise<StoredSub[]> {
  const since = Math.floor(Date.now() / 1000) - 7 * 86400;
  const res = await fetch(
    `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${HANDLES.atcoder}&from_second=${since}`,
    { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
  );
  const data: any[] = await res.json();
  return data.map((s) => ({
    platform: "AtCoder" as const,
    epoch: s.epoch_second,
    problem: s.problem_id,
    verdict: s.result,
    ac: s.result === "AC",
    language: s.language ?? null,
    runtimeMs: s.execution_time ?? null,
    memoryBytes: s.memory ?? null,
  }));
}

async function recentLeetCode(warnings: string[]): Promise<StoredSub[]> {
  const session = process.env.LEETCODE_SESSION;
  if (!session) {
    warnings.push("LeetCode session not configured — new submissions won't appear");
    return [];
  }
  const res = await fetch("https://leetcode.com/api/submissions/?offset=0&limit=20", {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://leetcode.com/",
      Cookie: `LEETCODE_SESSION=${session}`,
    },
    cache: "no-store",
  });
  // 401/redirect-to-login means the cookie died; 403 is just rate limiting
  if (res.status === 401 || res.redirected) {
    warnings.push("LeetCode session expired — refresh LEETCODE_SESSION to keep data current");
    return [];
  }
  if (!res.ok) return [];
  const data = await res.json();
  return ((data.submissions_dump ?? []) as any[]).map((s) => ({
    platform: "LeetCode" as const,
    epoch: s.timestamp,
    problem: s.title,
    verdict: (s.status_display ?? "UNKNOWN").toUpperCase(),
    ac: s.status_display === "Accepted",
    language: s.lang ?? null,
    runtimeMs: s.runtime?.match(/\d+/) ? Number(s.runtime.match(/\d+/)[0]) : null,
    memoryBytes: (() => {
      const m = s.memory?.match(/([\d.]+)\s*MB/);
      return m ? Math.round(Number(m[1]) * 1024 * 1024) : null;
    })(),
  }));
}

async function recentCodeChef(): Promise<StoredSub[]> {
  const res = await fetch(
    `https://www.codechef.com/recent/user?user_handle=${HANDLES.codechef}&page=0`,
    { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
  );
  const data = await res.json();
  const html: string = data.content ?? "";
  const subs: StoredSub[] = [];
  const re =
    /<td\s+title='(\d{1,2}):(\d{2}) ([AP]M) (\d{2})\/(\d{2})\/(\d{2})'>[\s\S]*?<td\s+title='([^']*)'>[\s\S]*?<span title='([^']*)'[\s\S]*?<td\s+title='([^']*)'>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let hour = Number(m[1]) % 12;
    if (m[3] === "PM") hour += 12;
    subs.push({
      platform: "CodeChef",
      epoch:
        Date.UTC(2000 + Number(m[6]), Number(m[5]) - 1, Number(m[4]), hour, Number(m[2])) /
        1000,
      problem: m[7],
      verdict: (m[8] || "UNKNOWN").toUpperCase(),
      ac: m[8]?.toLowerCase().startsWith("accepted") ?? false,
      language: m[9] ?? null,
      runtimeMs: null,
      memoryBytes: null,
    });
  }
  return subs;
}

async function checkCsesSession(warnings: string[]): Promise<StoredSub[]> {
  const session = process.env.CSES_SESSION;
  if (!session) {
    warnings.push("CSES session not configured — new submissions won't appear");
    return [];
  }
  const res = await fetch("https://cses.fi/problemset/", {
    headers: { "User-Agent": "Mozilla/5.0", Cookie: `PHPSESSID=${session}` },
    cache: "no-store",
  });
  const html = await res.text();
  if (!html.includes('href="/logout"')) {
    warnings.push("CSES session expired — refresh CSES_SESSION to keep data current");
  }
  return [];
}

export async function getLiveRecent(): Promise<{
  subs: StoredSub[];
  errors: string[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const names = ["Codeforces", "AtCoder", "LeetCode", "CodeChef", "CSES"];
  const results = await Promise.allSettled([
    recentCodeforces(),
    recentAtCoder(),
    recentLeetCode(warnings),
    recentCodeChef(),
    checkCsesSession(warnings),
  ]);
  const errors: string[] = [];
  const subs = results.flatMap((r, i) => {
    if (r.status === "fulfilled") return r.value;
    errors.push(`${names[i]}: ${r.reason}`);
    return [];
  });
  return { subs, errors, warnings };
}

export function mergeSubs(base: StoredSub[], fresh: StoredSub[]): StoredSub[] {
  const seen = new Set(base.map((s) => `${s.platform}:${s.epoch}`));
  const merged = base.slice();
  for (const s of fresh) {
    const key = `${s.platform}:${s.epoch}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(s);
    }
  }
  return merged;
}
