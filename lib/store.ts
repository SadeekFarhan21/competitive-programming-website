import submissions from "../data/submissions.json";
import manualSPOJ from "../data/spoj-manual.json";

export type StoredSub = {
  platform:
    | "Codeforces"
    | "AtCoder"
    | "LeetCode"
    | "CodeChef"
    | "SPOJ"
    | "CSES"
    | "Kattis"
    | "UVA";
  epoch: number;
  problem: string;
  verdict: string;
  ac: boolean | null;
  language: string | null;
  runtimeMs: number | null;
  memoryBytes: number | null;
};

export type FeedSubmission = {
  platform: StoredSub["platform"];
  epoch: number;
  time: string;
  problemName: string;
  verdict: string;
  language: string | null;
  runtimeMs: number | null;
  memoryBytes: number | null;
};

// Bundled at build time; refreshed by scripts/refresh-data.mjs + redeploy
export function getSubmissions(): StoredSub[] {
  const merged = [...(submissions as StoredSub[]), ...(manualSPOJ as StoredSub[])];
  const seen = new Set<string>();
  return merged.filter((submission) => {
    const key = `${submission.platform}:${submission.epoch}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getRecentSubmissions(limit = 5000): FeedSubmission[] {
  return getSubmissions()
    .sort((a, b) => b.epoch - a.epoch)
    .slice(0, limit)
    .map((submission) => ({
      platform: submission.platform,
      epoch: submission.epoch,
      time: new Date(submission.epoch * 1000).toISOString(),
      problemName: submission.problem,
      verdict: submission.verdict,
      language: submission.language,
      runtimeMs: submission.runtimeMs,
      memoryBytes: submission.memoryBytes,
    }));
}

export function dateKey(epochSeconds: number, _platform?: StoredSub["platform"], timeZone = "UTC"): string {
  const date = new Date(epochSeconds * 1000);
  if (timeZone === "UTC") return date.toISOString().slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
