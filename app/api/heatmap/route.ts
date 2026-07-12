import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// LeetCode private-API pagination is rate-limited to ~1 page per 600ms
export const maxDuration = 60;

const DEFAULT_HANDLES = {
  codeforces: "FarhanSadeek21",
  atcoder: "Farhan2021",
  leetcode: "FarhanSadeek21",
  codechef: "farhansadeek21",
  uva: "legacy101",
};

type Platform = "codeforces" | "atcoder" | "leetcode" | "codechef" | "uva" | "cses";

// ac: true = accepted, false = rejected, null = verdict unknown for this source
type Sub = { day: string; ac: boolean | null };

type DayCounts = Record<Platform, number> & {
  total: number;
  accepted: number;
  acc: Record<Platform, number>;
};

const DAY_MS = 86_400_000;

function dateKey(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

async function fetchCodeforcesSubs(handle: string, sinceEpoch: number): Promise<Sub[]> {
  const res = await fetch(
    `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=5000`,
    { cache: "no-store" }
  );
  const data = await res.json();
  if (data.status !== "OK") throw new Error(data.comment ?? "Codeforces error");
  return (data.result as any[])
    .filter((s) => s.creationTimeSeconds >= sinceEpoch)
    .map((s) => ({ day: dateKey(s.creationTimeSeconds), ac: s.verdict === "OK" }));
}

async function fetchAtCoderSubs(handle: string, sinceEpoch: number): Promise<Sub[]> {
  const res = await fetch(
    `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=${sinceEpoch}`,
    { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
  );
  const data: any[] = await res.json();
  return data.map((s) => ({ day: dateKey(s.epoch_second), ac: s.result === "AC" }));
}

async function fetchLeetCodePrivateSubs(sinceEpoch: number): Promise<Sub[] | null> {
  // The private API (session cookie) is real-time and has per-submission verdicts.
  // Pages are capped at 20, sorted newest-first, and rate-limited (~600ms spacing
  // avoids 403s), so stop once past the window.
  const session = process.env.LEETCODE_SESSION;
  if (!session) return null;
  const headers = {
    "User-Agent": "Mozilla/5.0",
    Referer: "https://leetcode.com/",
    Cookie: `LEETCODE_SESSION=${session}`,
  };

  const raw: { ts: number; qid: number; ac: boolean }[] = [];
  const MAX_PAGES = 40;
  let done = false;
  for (let page = 0; page < MAX_PAGES && !done; page++) {
    if (page > 0) await new Promise((r) => setTimeout(r, 600));
    const res = await fetch(
      `https://leetcode.com/api/submissions/?offset=${page * 20}&limit=20`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) {
      if (page === 0) return null;
      break;
    }
    const data = await res.json();
    const dump: any[] = data.submissions_dump ?? [];
    if (page === 0 && dump.length === 0) return null;
    for (const s of dump) {
      if (s.timestamp < sinceEpoch) {
        done = true;
        break;
      }
      raw.push({ ts: s.timestamp, qid: s.question_id, ac: s.status_display === "Accepted" });
    }
    if (!data.has_next) break;
  }

  // Only the first AC of each problem counts as accepted — re-solves are
  // recorded as submissions but not as new accepted problems.
  raw.sort((a, b) => a.ts - b.ts);
  const solved = new Set<number>();
  return raw.map((s) => {
    const isNew = s.ac && !solved.has(s.qid);
    if (s.ac) solved.add(s.qid);
    return { day: dateKey(s.ts), ac: isNew };
  });
}

async function fetchLeetCodeSubs(handle: string, sinceEpoch: number): Promise<Sub[]> {
  const privateSubs = await fetchLeetCodePrivateSubs(sinceEpoch);
  if (privateSubs) return privateSubs;
  // The public calendar counts all submissions but carries no per-day verdicts (ac: null)
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query:
        "query($username:String!){matchedUser(username:$username){userCalendar{submissionCalendar}}}",
      variables: { username: handle },
    }),
    cache: "no-store",
  });
  const data = await res.json();
  const calendar: Record<string, number> = JSON.parse(
    data?.data?.matchedUser?.userCalendar?.submissionCalendar ?? "{}"
  );
  const subs: Sub[] = [];
  for (const [epoch, count] of Object.entries(calendar)) {
    if (Number(epoch) < sinceEpoch) continue;
    for (let i = 0; i < count; i++) subs.push({ day: dateKey(Number(epoch)), ac: null });
  }
  return subs;
}

async function fetchLeetCodeLifetimeStats(handle: string) {
  // Aggregate accepted vs total submissions (lifetime — per-day verdicts aren't public)
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query:
        "query($username:String!){matchedUser(username:$username){submitStats{acSubmissionNum{difficulty submissions}totalSubmissionNum{difficulty submissions}}}}",
      variables: { username: handle },
    }),
    cache: "no-store",
  });
  const data = await res.json();
  const stats = data?.data?.matchedUser?.submitStats;
  const all = (rows: any[]) => rows?.find((r) => r.difficulty === "All")?.submissions ?? 0;
  return {
    accepted: all(stats?.acSubmissionNum),
    submissions: all(stats?.totalSubmissionNum),
  };
}

async function fetchCodeChefPage(handle: string, page: number) {
  const res = await fetch(
    `https://www.codechef.com/recent/user?user_handle=${encodeURIComponent(handle)}&page=${page}`,
    { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
  );
  return res.json();
}

async function fetchCodeChefSubs(handle: string, sinceEpoch: number): Promise<Sub[]> {
  // No API — paginate the recent-activity widget (HTML in JSON) until past the window
  const parseRows = (html: string): { epoch: number; ac: boolean }[] => {
    const rows: { epoch: number; ac: boolean }[] = [];
    const re =
      /<td\s+title='(\d{1,2}):(\d{2}) ([AP]M) (\d{2})\/(\d{2})\/(\d{2})'>[\s\S]*?<span title='([^']*)'/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      let hour = Number(m[1]) % 12;
      if (m[3] === "PM") hour += 12;
      rows.push({
        epoch:
          Date.UTC(2000 + Number(m[6]), Number(m[5]) - 1, Number(m[4]), hour, Number(m[2])) /
          1000,
        ac: m[7].toLowerCase().startsWith("accepted"),
      });
    }
    return rows;
  };

  const first = await fetchCodeChefPage(handle, 0);
  const maxPage = Math.min(Number(first.max_page) || 1, 30);
  let rows = parseRows(first.content ?? "");

  const BATCH = 5;
  for (let start = 1; start < maxPage; start += BATCH) {
    const pages = await Promise.all(
      Array.from({ length: Math.min(BATCH, maxPage - start) }, (_, i) =>
        fetchCodeChefPage(handle, start + i)
      )
    );
    const batchRows = pages.flatMap((p) => parseRows(p.content ?? ""));
    rows = rows.concat(batchRows);
    if (batchRows.some((r) => r.epoch < sinceEpoch)) break;
  }
  return rows
    .filter((r) => r.epoch >= sinceEpoch)
    .map((r) => ({ day: dateKey(r.epoch), ac: r.ac }));
}

async function fetchUVASubs(handle: string, sinceEpoch: number): Promise<Sub[]> {
  const uid = await (
    await fetch(`https://uhunt.onlinejudge.org/api/uname2uid/${encodeURIComponent(handle)}`, {
      cache: "no-store",
    })
  ).json();
  if (!uid) throw new Error(`unknown UVA username: ${handle}`);
  const data = await (
    await fetch(`https://uhunt.onlinejudge.org/api/subs-user/${uid}`, { cache: "no-store" })
  ).json();
  // Each sub: [subId, problemId, verdictId, runtimeMs, epoch, languageId, rank]; 90 = AC
  return ((data.subs ?? []) as number[][])
    .filter((s) => s[4] >= sinceEpoch)
    .map((s) => ({ day: dateKey(s[4]), ac: s[2] === 90 }));
}

async function fetchCSESSubs(sinceEpoch: number): Promise<Sub[]> {
  // CSES has no API and no public history. With a logged-in session cookie, each
  // attempted task's page lists "Your submissions" with timestamps — crawl those.
  const session = process.env.CSES_SESSION;
  if (!session) throw new Error("CSES_SESSION not configured");
  const headers = { "User-Agent": "Mozilla/5.0", Cookie: `PHPSESSID=${session}` };

  const grid = await (
    await fetch("https://cses.fi/problemset/", { headers, cache: "no-store" })
  ).text();
  if (!grid.includes('href="/logout"')) throw new Error("CSES session expired");

  const taskIds: string[] = [];
  const taskRe =
    /<li class="task"><a href="\/problemset\/task\/(\d+)">[^<]*<\/a>[\s\S]*?task-score icon (full|zero)/g;
  let m: RegExpExecArray | null;
  while ((m = taskRe.exec(grid))) taskIds.push(m[1]);

  const subs: Sub[] = [];
  const BATCH = 10;
  for (let i = 0; i < taskIds.length; i += BATCH) {
    const pages = await Promise.all(
      taskIds.slice(i, i + BATCH).map(async (id) => {
        const res = await fetch(`https://cses.fi/problemset/task/${id}`, {
          headers,
          cache: "no-store",
        });
        return res.text();
      })
    );
    for (const page of pages) {
      const section = page.split("Your submissions")[1] ?? "";
      for (const ts of section.matchAll(
        /href="\/problemset\/result\/\d+\/">(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2} <span class="task-score icon (full|zero)"/g
      )) {
        const epoch = Date.parse(ts[1] + "T00:00:00Z") / 1000;
        if (epoch >= sinceEpoch) subs.push({ day: ts[1], ac: ts[2] === "full" });
      }
    }
  }
  return subs;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const handles = {
    codeforces: params.get("cf") ?? DEFAULT_HANDLES.codeforces,
    atcoder: params.get("ac") ?? DEFAULT_HANDLES.atcoder,
    leetcode: params.get("lc") ?? DEFAULT_HANDLES.leetcode,
    codechef: params.get("cc") ?? DEFAULT_HANDLES.codechef,
    uva: params.get("uva") ?? DEFAULT_HANDLES.uva,
  };
  const days = Math.min(Number(params.get("days")) || 365, 730);
  const sinceEpoch = Math.floor((Date.now() - days * DAY_MS) / 1000);

  const platforms: Platform[] = [
    "codeforces",
    "atcoder",
    "leetcode",
    "codechef",
    "uva",
    "cses",
  ];
  const [lifetimeLC, ...results] = await Promise.allSettled([
    fetchLeetCodeLifetimeStats(handles.leetcode),
    fetchCodeforcesSubs(handles.codeforces, sinceEpoch),
    fetchAtCoderSubs(handles.atcoder, sinceEpoch),
    fetchLeetCodeSubs(handles.leetcode, sinceEpoch),
    fetchCodeChefSubs(handles.codechef, sinceEpoch),
    fetchUVASubs(handles.uva, sinceEpoch),
    fetchCSESSubs(sinceEpoch),
  ]);

  const errors: string[] = [];
  const calendar: Record<string, DayCounts> = {};
  const stats: Record<
    string,
    { submissions: number; accepted: number | null; accuracy: number | null; lifetime?: boolean }
  > = {};

  results.forEach((r, i) => {
    const platform = platforms[i];
    if (r.status === "rejected") {
      errors.push(`${platform}: ${r.reason}`);
      return;
    }
    const subs = r.value as Sub[];
    let accepted: number | null = 0;
    for (const sub of subs) {
      calendar[sub.day] ??= {
        total: 0,
        accepted: 0,
        codeforces: 0,
        atcoder: 0,
        leetcode: 0,
        codechef: 0,
        uva: 0,
        cses: 0,
        acc: { codeforces: 0, atcoder: 0, leetcode: 0, codechef: 0, uva: 0, cses: 0 },
      };
      calendar[sub.day][platform]++;
      calendar[sub.day].total++;
      if (sub.ac === true) {
        calendar[sub.day].accepted++;
        calendar[sub.day].acc[platform]++;
      }
      if (sub.ac === null) accepted = null;
      else if (accepted !== null && sub.ac) accepted++;
    }
    stats[platform] = {
      submissions: subs.length,
      accepted,
      accuracy:
        accepted !== null && subs.length > 0
          ? Math.round((accepted / subs.length) * 1000) / 10
          : null,
    };
  });

  // Public-calendar fallback has no verdicts; substitute lifetime accepted/total.
  // With a session cookie the per-day data is real, so leave it untouched.
  if (lifetimeLC.status === "fulfilled" && stats.leetcode?.accepted === null) {
    const { accepted, submissions } = lifetimeLC.value;
    if (submissions > 0) {
      stats.leetcode = {
        submissions,
        accepted,
        accuracy: Math.round((accepted / submissions) * 1000) / 10,
        lifetime: true,
      };
    }
  }

  return NextResponse.json({
    since: new Date(sinceEpoch * 1000).toISOString().slice(0, 10),
    totalSubmissions: Object.values(calendar).reduce((sum, d) => sum + d.total, 0),
    days: calendar,
    stats,
    errors,
  });
}
