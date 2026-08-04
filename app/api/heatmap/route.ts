import { NextRequest, NextResponse } from "next/server";
import { getSubmissions, dateKey, StoredSub } from "../../../lib/store";

type Platform =
  | "codeforces"
  | "atcoder"
  | "leetcode"
  | "codechef"
  | "cses"
  | "kattis"
  | "uva";

type DayCounts = Record<Platform, number> & {
  total: number;
  accepted: number;
  acc: Record<Platform, number>;
};

const DAY_MS = 86_400_000;

const PLATFORM_KEY: Record<StoredSub["platform"], Platform> = {
  Codeforces: "codeforces",
  AtCoder: "atcoder",
  LeetCode: "leetcode",
  CodeChef: "codechef",
  CSES: "cses",
  Kattis: "kattis",
  UVA: "uva",
};

export async function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get("year");
  const selectedYear = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : null;
  const days = Math.min(Number(request.nextUrl.searchParams.get("days")) || 365, 730);
  const sinceEpoch = selectedYear != null
    ? Date.UTC(selectedYear, 0, 1) / 1000
    : Math.floor((Date.now() - days * DAY_MS) / 1000);
  const untilEpoch = selectedYear != null ? Date.UTC(selectedYear + 1, 0, 1) / 1000 : null;

  // The heatmap is backed by the bundled dataset so it renders immediately.
  // scripts/refresh-data.mjs updates this file through the scheduled workflow.
  const all = getSubmissions().slice().sort((a, b) => a.epoch - b.epoch);
  const availableYears = [...new Set(all.map((s) => new Date(s.epoch * 1000).getUTCFullYear()))].sort((a, b) => b - a);
  const errors: string[] = [];
  const warnings: string[] = [];

  // LeetCode: only the first AC of each problem counts as accepted (full-history
  // dedupe), so re-solves don't inflate the accepted heatmap.
  const lcSolved = new Set<string>();
  const isNewAc = (s: StoredSub): boolean => {
    if (s.ac !== true) return false;
    if (s.platform !== "LeetCode") return true;
    if (lcSolved.has(s.problem)) return false;
    lcSolved.add(s.problem);
    return true;
  };

  const calendar: Record<string, DayCounts> = {};
  const totals: Record<Platform, { submissions: number; accepted: number }> = {
    codeforces: { submissions: 0, accepted: 0 },
    atcoder: { submissions: 0, accepted: 0 },
    leetcode: { submissions: 0, accepted: 0 },
    codechef: { submissions: 0, accepted: 0 },
    cses: { submissions: 0, accepted: 0 },
    kattis: { submissions: 0, accepted: 0 },
    uva: { submissions: 0, accepted: 0 },
  };

  for (const s of all) {
    const newAc = isNewAc(s); // must run over full history for the dedupe
    const platform = PLATFORM_KEY[s.platform];
    totals[platform].submissions++;
    if (newAc) totals[platform].accepted++;
    if (s.epoch < sinceEpoch || (untilEpoch != null && s.epoch >= untilEpoch)) continue;
    const day = dateKey(s.epoch, s.platform);
    calendar[day] ??= {
      total: 0,
      accepted: 0,
      codeforces: 0,
      atcoder: 0,
      leetcode: 0,
      codechef: 0,
      cses: 0,
      kattis: 0,
      uva: 0,
      acc: {
        codeforces: 0,
        atcoder: 0,
        leetcode: 0,
        codechef: 0,
        cses: 0,
        kattis: 0,
        uva: 0,
      },
    };
    calendar[day][platform]++;
    calendar[day].total++;
    if (newAc) {
      calendar[day].accepted++;
      calendar[day].acc[platform]++;
    }
  }

  const stats = Object.fromEntries(
    Object.entries(totals).map(([platform, t]) => [
      platform,
      {
        submissions: t.submissions,
        accepted: t.accepted,
        lifetime: true,
        accuracy:
          t.submissions > 0 ? Math.round((t.accepted / t.submissions) * 1000) / 10 : null,
      },
    ])
  );

  return NextResponse.json(
    {
      since: new Date(sinceEpoch * 1000).toISOString().slice(0, 10),
      year: selectedYear,
      availableYears,
      totalSubmissions: Object.values(calendar).reduce((sum, d) => sum + d.total, 0),
      days: calendar,
      stats,
      errors,
      warnings,
    },
    {
      headers: {
        // CDN caches for 5 minutes — upstream APIs are hit at most once per window
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    }
  );
}
