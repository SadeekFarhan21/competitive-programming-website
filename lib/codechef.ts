import type { StoredSub } from "./store";

function parseEpoch(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (normalized === "just now") return Date.now() / 1000;
  const relative = normalized.match(/^(\d+)\s+(minute|hour|day|week)s?\s+ago$/);
  if (relative) {
    const seconds = { minute: 60, hour: 3600, day: 86400, week: 604800 }[relative[2] as "minute" | "hour" | "day" | "week"];
    return Date.now() / 1000 - Number(relative[1]) * seconds;
  }

  const absolute = value.match(/^(\d{1,2}):(\d{2})\s*([AP]M)\s+(\d{2})\/(\d{2})\/(\d{2})$/i);
  if (!absolute) return NaN;
  let hour = Number(absolute[1]) % 12;
  if (absolute[3].toUpperCase() === "PM") hour += 12;
  return Date.UTC(2000 + Number(absolute[6]), Number(absolute[5]) - 1, Number(absolute[4]), hour, Number(absolute[2])) / 1000;
}

function decode(value: string): string {
  return value
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .trim();
}

export function parseCodeChefSubmissions(html: string): StoredSub[] {
  const rows: StoredSub[] = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1];
    const titles = [...row.matchAll(/<td\b[^>]*\btitle\s*=\s*(['"])(.*?)\1/gi)].map((entry) => decode(entry[2]));
    const epoch = parseEpoch(titles[0] ?? "");
    const problem = titles[1] || row.match(/\/problems\/([^'"?#]+)/i)?.[1];
    const verdict = row.match(/<span\b[^>]*\btitle\s*=\s*(['"])(.*?)\1/i)?.[2] ?? "UNKNOWN";
    const solutionId = row.match(/\/viewsolution\/(\d+)/i)?.[1];
    if (!problem || !Number.isFinite(epoch)) continue;
    rows.push({
      ...(solutionId ? { id: `codechef:${solutionId}` } : {}),
      platform: "CodeChef",
      epoch,
      problem: decode(problem),
      verdict: decode(verdict).toUpperCase(),
      ac: decode(verdict).toLowerCase().startsWith("accepted"),
      language: titles[3] ?? null,
      runtimeMs: null,
      memoryBytes: null,
    });
  }
  return rows;
}
