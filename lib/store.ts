import submissions from "../data/submissions.json";
import manualSPOJ from "../data/spoj-manual.json";
import { supabaseAdmin } from "./supabase/admin";

export type StoredSub = {
  id?: string;
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

function getBundledSubmissions(): StoredSub[] {
  const merged = [...(submissions as StoredSub[]), ...(manualSPOJ as StoredSub[])];
  const seen = new Set<string>();
  return merged.filter((submission) => {
    const key = `${submission.platform}:${submission.id ?? submission.epoch}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Supabase is the live source after the initial migration. The bundled JSON is
// intentionally retained as a fallback for local builds and failed requests.
export async function getSubmissions(): Promise<StoredSub[]> {
  if (!supabaseAdmin) return getBundledSubmissions();

  const { data, error } = await supabaseAdmin
    .from("submissions")
    .select("id, platform, epoch, problem, verdict, ac, language, runtime_ms, memory_bytes")
    .order("epoch", { ascending: false });

  if (error || !data?.length) return getBundledSubmissions();

  return data.map((row) => ({
    id: row.id,
    platform: row.platform,
    epoch: Number(row.epoch),
    problem: row.problem,
    verdict: row.verdict,
    ac: row.ac,
    language: row.language,
    runtimeMs: row.runtime_ms,
    memoryBytes: row.memory_bytes,
  })) as StoredSub[];
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
