import submissions from "../data/submissions.json";

export type StoredSub = {
  platform: "Codeforces" | "AtCoder" | "LeetCode" | "CodeChef" | "CSES";
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

export function dateKey(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}
