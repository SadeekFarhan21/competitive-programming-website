import submissions from "../data/submissions.json";

export type StoredSub = {
  platform:
    | "Codeforces"
    | "AtCoder"
    | "LeetCode"
    | "CodeChef"
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

// Bundled at build time; refreshed by scripts/refresh-data.mjs + redeploy
export function getSubmissions(): StoredSub[] {
  return submissions as StoredSub[];
}

export function dateKey(epochSeconds: number, platform?: StoredSub["platform"]): string {
  const date = new Date(epochSeconds * 1000);
  if (platform === "CSES") {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
  return date.toISOString().slice(0, 10);
}
