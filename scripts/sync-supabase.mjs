// Mirrors the real-time judges' rows from data/submissions.json into the
// Supabase `submissions` table. The site reads only the most recent rows from it
// and merges them over the bundled JSON (lib/store.ts), which covers every other
// judge through the nightly snapshot. Rows that disappeared from the JSON (e.g.
// after a handle rename) are deleted. Run after `pnpm refresh`.
// Skips quietly when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.join(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");

// Next.js auto-loads .env.local; plain node does not
for (const file of [".env.local", ".env"]) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.log("Supabase credentials not set — skipping sync");
  process.exit(0);
}

// Refreshed on demand (refresh-data.yml); everything else waits for the nightly run
const REALTIME_PLATFORMS = new Set(["Codeforces", "LeetCode", "AtCoder"]);

const read = (file) => JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
const submissions = read("submissions.json").filter((s) => REALTIME_PLATFORMS.has(s.platform));

// First row wins on duplicate keys, matching getBundledSubmissions() in lib/store.ts
const rows = new Map();
for (const s of submissions) {
  const key = `${s.platform}:${s.id ?? s.epoch}`;
  if (rows.has(key)) continue;
  rows.set(key, {
    key,
    id: s.id ?? null,
    platform: s.platform,
    epoch: Math.floor(Number(s.epoch)),
    problem: s.problem,
    problem_id: s.problemId ?? null,
    url: s.url ?? null,
    verdict: s.verdict,
    ac: s.ac ?? null,
    language: s.language ?? null,
    runtime_ms: s.runtimeMs ?? null,
    memory_bytes: s.memoryBytes ?? null,
  });
}
if (rows.size === 0) throw new Error("No submissions to sync — refusing to empty the table");

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Every row gets this run's timestamp; anything older afterwards is stale.
const syncedAt = new Date().toISOString();
const all = [...rows.values()].map((row) => ({ ...row, synced_at: syncedAt }));
for (let offset = 0; offset < all.length; offset += 500) {
  const { error } = await supabase
    .from("submissions")
    .upsert(all.slice(offset, offset + 500), { onConflict: "key" });
  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
}

const { count, error } = await supabase
  .from("submissions")
  .delete({ count: "exact" })
  .lt("synced_at", syncedAt);
if (error) throw new Error(`Supabase cleanup failed: ${error.message}`);

console.log(`synced ${all.length} rows to Supabase (removed ${count ?? 0} stale)`);
