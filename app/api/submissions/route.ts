import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_HANDLES = {
  codeforces: "FarhanSadeek21",
  atcoder: "Farhan2021",
  leetcode: "FarhanSadeek21",
  codechef: "farhansadeek21",
  uva: "legacy101",
};

type Submission = {
  platform: "Codeforces" | "AtCoder" | "LeetCode" | "CodeChef" | "UVA";
  time: string; // ISO 8601
  epoch: number;
  problemName: string;
  verdict: string;
  language: string | null;
  runtimeMs: number | null;
  memoryBytes: number | null;
};

async function fetchCodeforces(handle: string, limit = 10): Promise<Submission[]> {
  const res = await fetch(
    `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=${limit}`,
    { cache: "no-store" }
  );
  const data = await res.json();
  if (data.status !== "OK") return [];
  return data.result.map((sub: any) => ({
    platform: "Codeforces",
    epoch: sub.creationTimeSeconds,
    time: new Date(sub.creationTimeSeconds * 1000).toISOString(),
    problemName: `${sub.problem.contestId}${sub.problem.index} - ${sub.problem.name}`,
    verdict: sub.verdict ?? "UNKNOWN",
    language: sub.programmingLanguage ?? null,
    runtimeMs: sub.timeConsumedMillis ?? null,
    memoryBytes: sub.memoryConsumedBytes ?? null,
  }));
}

async function fetchAtCoder(handle: string, limit = 10): Promise<Submission[]> {
  const res = await fetch(
    `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=0`,
    { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
  );
  const data: any[] = await res.json();
  data.sort((a, b) => (b.epoch_second ?? 0) - (a.epoch_second ?? 0));
  return data.slice(0, limit).map((sub) => ({
    platform: "AtCoder",
    epoch: sub.epoch_second,
    time: new Date(sub.epoch_second * 1000).toISOString(),
    problemName: sub.problem_id,
    verdict: sub.result,
    language: sub.language ?? null,
    runtimeMs: sub.execution_time ?? null,
    memoryBytes: sub.memory ?? null,
  }));
}

function parseLeetCodeMemory(memory: string | null | undefined): number | null {
  const m = memory?.match(/([\d.]+)\s*MB/);
  return m ? Math.round(Number(m[1]) * 1024 * 1024) : null;
}

async function fetchLeetCode(handle: string, limit = 10): Promise<Submission[]> {
  // With a session cookie, the private API is real-time and includes verdicts,
  // language, and performance; the public endpoint only lists accepted submissions.
  const session = process.env.LEETCODE_SESSION;
  if (session) {
    const res = await fetch(`https://leetcode.com/api/submissions/?offset=0&limit=${limit}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://leetcode.com/",
        Cookie: `LEETCODE_SESSION=${session}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const dump: any[] = data.submissions_dump ?? [];
      if (dump.length > 0) {
        return dump.slice(0, limit).map((s) => ({
          platform: "LeetCode",
          epoch: s.timestamp,
          time: new Date(s.timestamp * 1000).toISOString(),
          problemName: s.title,
          verdict: (s.status_display ?? "UNKNOWN").toUpperCase(),
          language: s.lang ?? null,
          runtimeMs: s.runtime?.match(/\d+/) ? Number(s.runtime.match(/\d+/)[0]) : null,
          memoryBytes: parseLeetCodeMemory(s.memory),
        }));
      }
    }
    // fall through to the public endpoint on auth failure / empty response
  }
  const query = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id
        title
        titleSlug
        timestamp
      }
    }`;
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { username: handle, limit } }),
    cache: "no-store",
  });
  const data = await res.json();
  const subs: any[] = data?.data?.recentAcSubmissionList ?? [];
  return subs.map((sub) => ({
    platform: "LeetCode",
    epoch: Number(sub.timestamp),
    time: new Date(Number(sub.timestamp) * 1000).toISOString(),
    problemName: sub.title,
    // This public endpoint only exposes accepted submissions
    verdict: "ACCEPTED",
    language: null,
    runtimeMs: null,
    memoryBytes: null,
  }));
}

async function fetchCodeChef(handle: string, limit = 10): Promise<Submission[]> {
  // No official API — CodeChef's recent-activity widget returns JSON wrapping an HTML table
  const res = await fetch(
    `https://www.codechef.com/recent/user?user_handle=${encodeURIComponent(handle)}&page=0`,
    { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
  );
  const data = await res.json();
  const html: string = data.content ?? "";

  const rowRe =
    /<td\s+title='(\d{1,2}:\d{2} [AP]M \d{2}\/\d{2}\/\d{2})'>[\s\S]*?<td\s+title='([^']*)'>[\s\S]*?<span title='([^']*)'[\s\S]*?<td\s+title='([^']*)'>/g;
  const subs: Submission[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) && subs.length < limit) {
    const [, timeStr, problem, verdict, language] = m;
    // Timestamp format: "11:17 AM 01/07/26" (DD/MM/YY)
    const t = timeStr.match(/(\d{1,2}):(\d{2}) ([AP]M) (\d{2})\/(\d{2})\/(\d{2})/);
    if (!t) continue;
    let hour = Number(t[1]) % 12;
    if (t[3] === "PM") hour += 12;
    const epoch =
      Date.UTC(2000 + Number(t[6]), Number(t[5]) - 1, Number(t[4]), hour, Number(t[2])) / 1000;
    subs.push({
      platform: "CodeChef",
      epoch,
      time: new Date(epoch * 1000).toISOString(),
      problemName: problem,
      verdict: verdict ? verdict.toUpperCase() : "UNKNOWN",
      language: language || null,
      runtimeMs: null,
      memoryBytes: null,
    });
  }
  return subs;
}

// uhunt verdict and language codes: https://uhunt.onlinejudge.org/api
const UVA_VERDICTS: Record<number, string> = {
  10: "SUBMISSION_ERROR",
  15: "CANT_BE_JUDGED",
  20: "IN_QUEUE",
  30: "COMPILE_ERROR",
  35: "RESTRICTED_FUNCTION",
  40: "RUNTIME_ERROR",
  45: "OUTPUT_LIMIT",
  50: "TIME_LIMIT",
  60: "MEMORY_LIMIT",
  70: "WRONG_ANSWER",
  80: "PRESENTATION_ERROR",
  90: "ACCEPTED",
};
const UVA_LANGUAGES: Record<number, string> = {
  1: "ANSI C",
  2: "Java",
  3: "C++",
  4: "Pascal",
  5: "C++11",
  6: "Python 3",
};

async function fetchUVA(handle: string, limit = 10): Promise<Submission[]> {
  const uid = await (
    await fetch(`https://uhunt.onlinejudge.org/api/uname2uid/${encodeURIComponent(handle)}`, {
      cache: "no-store",
    })
  ).json();
  if (!uid) throw new Error(`unknown UVA username: ${handle}`);

  const data = await (
    await fetch(`https://uhunt.onlinejudge.org/api/subs-user/${uid}`, { cache: "no-store" })
  ).json();
  // Each sub: [subId, problemId, verdictId, runtimeMs, epoch, languageId, rank]
  const subs: number[][] = (data.subs ?? []).sort((a: number[], b: number[]) => b[4] - a[4]);

  const recent = subs.slice(0, limit);
  const titles = await Promise.all(
    recent.map(async (s) => {
      const p = await (
        await fetch(`https://uhunt.onlinejudge.org/api/p/id/${s[1]}`, { cache: "no-store" })
      ).json();
      return p?.num && p?.title ? `${p.num} - ${p.title}` : `problem ${s[1]}`;
    })
  );

  return recent.map((s, i) => ({
    platform: "UVA",
    epoch: s[4],
    time: new Date(s[4] * 1000).toISOString(),
    problemName: titles[i],
    verdict: UVA_VERDICTS[s[2]] ?? `VERDICT_${s[2]}`,
    language: UVA_LANGUAGES[s[5]] ?? `lang ${s[5]}`,
    runtimeMs: s[3],
    memoryBytes: null,
  }));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const cf = params.get("cf") ?? DEFAULT_HANDLES.codeforces;
  const ac = params.get("ac") ?? DEFAULT_HANDLES.atcoder;
  const lc = params.get("lc") ?? DEFAULT_HANDLES.leetcode;
  const cc = params.get("cc") ?? DEFAULT_HANDLES.codechef;
  const uva = params.get("uva") ?? DEFAULT_HANDLES.uva;
  const limit = Math.min(Number(params.get("limit")) || 15, 50);

  const results = await Promise.allSettled([
    fetchCodeforces(cf),
    fetchAtCoder(ac),
    fetchLeetCode(lc),
    fetchCodeChef(cc),
    fetchUVA(uva),
  ]);

  const errors: string[] = [];
  const submissions = results.flatMap((r, i) => {
    if (r.status === "fulfilled") return r.value;
    errors.push(`${["Codeforces", "AtCoder", "LeetCode", "CodeChef", "UVA"][i]}: ${r.reason}`);
    return [];
  });

  submissions.sort((a, b) => b.epoch - a.epoch);

  return NextResponse.json({
    submissions: submissions.slice(0, limit),
    errors,
  });
}
