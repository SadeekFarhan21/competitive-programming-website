import { unstable_cache } from "next/cache";
import { dateKey, getSubmissions, StoredSub } from "./store";

export type Platform =
  | "codeforces"
  | "atcoder"
  | "leetcode"
  | "codechef"
  | "spoj"
  | "cses"
  | "kattis"
  | "uva";

export type DayCounts = Record<Platform, number> & {
  total: number;
  accepted: number;
  acc: Record<Platform, number>;
};

export type HeatmapData = {
  since: string;
  year: number | null;
  availableYears: number[];
  totalSubmissions: number;
  days: Record<string, DayCounts>;
  stats: Record<string, {
    submissions: number;
    accepted: number | null;
    accuracy: number | null;
    lifetime?: boolean;
  }>;
  errors: string[];
  warnings: string[];
};

const DAY_MS = 86_400_000;

const PLATFORM_KEY: Record<StoredSub["platform"], Platform> = {
  Codeforces: "codeforces",
  AtCoder: "atcoder",
  LeetCode: "leetcode",
  CodeChef: "codechef",
  SPOJ: "spoj",
  CSES: "cses",
  Kattis: "kattis",
  UVA: "uva",
};

const EMPTY_COUNTS = (): DayCounts => ({
  total: 0,
  accepted: 0,
  codeforces: 0,
  atcoder: 0,
  leetcode: 0,
  codechef: 0,
  spoj: 0,
  cses: 0,
  kattis: 0,
  uva: 0,
  acc: {
    codeforces: 0,
    atcoder: 0,
    leetcode: 0,
    codechef: 0,
    spoj: 0,
    cses: 0,
    kattis: 0,
    uva: 0,
  },
});

function buildHeatmapData(timeZone: string, selectedYear: number | null, days: number): HeatmapData {
  const sinceEpoch = selectedYear != null
    ? Date.UTC(selectedYear, 0, 1) / 1000
    : Math.floor((Date.now() - days * DAY_MS) / 1000);
  const untilEpoch = selectedYear != null ? Date.UTC(selectedYear + 1, 0, 1) / 1000 : null;
  const all = getSubmissions().sort((a, b) => a.epoch - b.epoch);
  const availableYears = [...new Set(all.map((s) => new Date(s.epoch * 1000).getUTCFullYear()))]
    .sort((a, b) => b - a);
  const errors: string[] = [];
  const warnings: string[] = [];

  const lcSolved = new Set<string>();
  const isNewAc = (submission: StoredSub): boolean => {
    if (submission.ac !== true) return false;
    if (submission.platform !== "LeetCode") return true;
    if (lcSolved.has(submission.problem)) return false;
    lcSolved.add(submission.problem);
    return true;
  };

  const totals: Record<Platform, { submissions: number; accepted: number }> = {
    codeforces: { submissions: 0, accepted: 0 },
    atcoder: { submissions: 0, accepted: 0 },
    leetcode: { submissions: 0, accepted: 0 },
    codechef: { submissions: 0, accepted: 0 },
    spoj: { submissions: 0, accepted: 0 },
    cses: { submissions: 0, accepted: 0 },
    kattis: { submissions: 0, accepted: 0 },
    uva: { submissions: 0, accepted: 0 },
  };
  const calendar: Record<string, DayCounts> = {};

  for (const submission of all) {
    const newAc = isNewAc(submission);
    const platform = PLATFORM_KEY[submission.platform];
    totals[platform].submissions++;
    if (newAc) totals[platform].accepted++;
    if (
      submission.epoch < sinceEpoch ||
      (untilEpoch != null && submission.epoch >= untilEpoch)
    ) continue;

    const day = dateKey(submission.epoch, submission.platform, timeZone);
    calendar[day] ??= EMPTY_COUNTS();
    calendar[day][platform]++;
    calendar[day].total++;
    if (newAc) {
      calendar[day].accepted++;
      calendar[day].acc[platform]++;
    }
  }

  const stats = Object.fromEntries(
    Object.entries(totals).map(([platform, total]) => [
      platform,
      {
        submissions: total.submissions,
        accepted: total.accepted,
        lifetime: true,
        accuracy:
          total.submissions > 0
            ? Math.round((total.accepted / total.submissions) * 1000) / 10
            : null,
      },
    ])
  );

  return {
    since: new Date(sinceEpoch * 1000).toISOString().slice(0, 10),
    year: selectedYear,
    availableYears,
    totalSubmissions: Object.values(calendar).reduce((sum, day) => sum + day.total, 0),
    days: calendar,
    stats,
    errors,
    warnings,
  };
}

export function getHeatmapData(timeZone = "UTC", selectedYear: number | null = null, days = 365) {
  return unstable_cache(
    async () => buildHeatmapData(timeZone, selectedYear, days),
    ["heatmap", timeZone, selectedYear == null ? "rolling" : String(selectedYear), String(days)],
    { revalidate: 300 }
  )();
}
