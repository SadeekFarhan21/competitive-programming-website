import submissions from "../data/submissions.json";
import manualSPOJ from "../data/spoj-manual.json";
import { createClient } from "@supabase/supabase-js";

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
  url?: string;
  verdict: string;
  ac: boolean | null;
  language: string | null;
  runtimeMs: number | null;
  memoryBytes: number | null;
  problemId?: string;
};

const submissionKey = (s: StoredSub) => `${s.platform}:${s.id ?? s.epoch}`;

// Keeps the first row for each key, so callers list the preferred source first
function dedupe(subs: StoredSub[]): StoredSub[] {
  const seen = new Set<string>();
  return subs.filter((submission) => {
    const key = submissionKey(submission);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getBundledSubmissions(): StoredSub[] {
  return dedupe([...(submissions as StoredSub[]), ...(manualSPOJ as StoredSub[])]);
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

// Only the newest rows come from Supabase; older history is already bundled
const RECENT_LIMIT = 200;
const CACHE_MS = 60_000;

async function fetchRecentSubmissions(): Promise<StoredSub[]> {
  const { data, error } = await supabase!
    .from("submissions")
    .select("id, platform, epoch, problem, problem_id, url, verdict, ac, language, runtime_ms, memory_bytes")
    .order("epoch", { ascending: false })
    .limit(RECENT_LIMIT);
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    ...(row.id != null && { id: row.id }),
    platform: row.platform,
    epoch: Number(row.epoch),
    problem: row.problem,
    ...(row.problem_id != null && { problemId: row.problem_id }),
    ...(row.url != null && { url: row.url }),
    verdict: row.verdict,
    ac: row.ac,
    language: row.language,
    runtimeMs: row.runtime_ms,
    memoryBytes: row.memory_bytes == null ? null : Number(row.memory_bytes),
  }));
}

let cached: { at: number; subs: Promise<StoredSub[]> } | null = null;

// Supabase holds the full history (scripts/sync-supabase.mjs), but only its
// RECENT_LIMIT newest rows are fetched and merged over the bundled JSON. Rows in
// both appear once, with the Supabase copy winning. Falls back to the JSON alone when Supabase is unset or down.
export function getSubmissions(): Promise<StoredSub[]> {
  if (!supabase) return Promise.resolve(getBundledSubmissions());
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.subs;
  const subs = fetchRecentSubmissions()
    .then((recent) => dedupe([...recent, ...getBundledSubmissions()]).sort((a, b) => a.epoch - b.epoch))
    .catch((error) => {
      console.error(`Supabase read failed, using bundled submissions: ${error}`);
      cached = null;
      return getBundledSubmissions();
    });
  cached = { at: Date.now(), subs };
  return subs;
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
