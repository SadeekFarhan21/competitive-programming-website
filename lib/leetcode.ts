import { StoredSub } from "./store";

const API_URL =
  process.env.LEETCODE_API_URL ?? "https://alfa-leetcode-api.onrender.com";
const USERNAME = "FarhanSadeek21";

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  const date = Date.parse(value);
  return Number.isFinite(date) ? date / 1000 : null;
}

function memoryBytes(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.match(/([\d.]+)\s*(KB|MB|GB)?/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "MB").toUpperCase();
  const multiplier = unit === "GB" ? 1024 ** 3 : unit === "KB" ? 1024 : 1024 ** 2;
  return Math.round(amount * multiplier);
}

function runtimeMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}

export function normalizeLeetCodeSubmissions(payload: any): StoredSub[] {
  const rows = [
    payload?.submission,
    payload?.submissions,
    payload?.result,
    payload?.data?.submission,
    payload?.data?.submissions,
    payload?.data,
  ].find(Array.isArray) ?? [];

  return rows.flatMap((row: any) => {
    const epochValue = row.timestamp ?? row.timeStamp ?? row.createdAt;
    const epoch = asNumber(epochValue);
    const title = row.title ?? row.problem ?? row.titleSlug;
    if (epoch === null || !title) return [];

    const verdict = String(
      row.statusDisplay ?? row.status_display ?? row.status ?? "UNKNOWN"
    ).toUpperCase();
    return [{
      platform: "LeetCode" as const,
      epoch,
      problem: String(title),
      verdict,
      ac: verdict === "ACCEPTED",
      language: row.lang ?? row.language ?? null,
      runtimeMs: runtimeMs(row.runtime),
      memoryBytes: memoryBytes(row.memory),
    }];
  });
}

export async function fetchLeetCodeSubmissions(limit = 20): Promise<StoredSub[]> {
  const url = `${API_URL.replace(/\/$/, "")}/${USERNAME}/submission?limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return normalizeLeetCodeSubmissions(await res.json());
}
