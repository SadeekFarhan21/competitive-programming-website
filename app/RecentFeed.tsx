"use client";

import { useEffect, useState } from "react";

type Submission = {
  platform: string;
  time: string;
  problemName: string;
  verdict: string;
  language: string | null;
  runtimeMs: number | null;
  memoryBytes: number | null;
};

const CSES_TIME_ZONE = "America/Los_Angeles";
const PLATFORM_OPTIONS = [
  "Codeforces",
  "AtCoder",
  "LeetCode",
  "CodeChef",
  "SPOJ",
  "CSES",
  "Kattis",
  "UVA",
];

function standardLanguage(language: string | null): string | null {
  if (!language) return null;
  const value = language.toLowerCase();
  if (value.includes("c++") || value.includes("cpp") || value.includes("gnu c")) return "C++";
  if (value === "c" || value.includes("ansi c")) return "C";
  if (value.includes("python") || value.includes("pypy")) return "Python";
  if (value.includes("java")) return "Java";
  if (value.includes("kotlin")) return "Kotlin";
  if (value.includes("javascript") || value === "js") return "JavaScript";
  if (value.includes("typescript") || value === "ts") return "TypeScript";
  if (value.includes("rust")) return "Rust";
  if (value.includes("golang") || value === "go") return "Go";
  if (value.includes("swift")) return "Swift";
  return language;
}

function standardVerdict(verdict: string, platform: string): string {
  const value = verdict.toLowerCase().replace(/[_-]+/g, " ");

  // Some judges report scored results (for example, "16/19 TLE") instead
  // of using the word "partial". Normalize those results consistently.
  const score = value.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (score) {
    const earned = Number(score[1]);
    const possible = Number(score[2]);
    if (possible > 0 && earned === possible) return "Accepted";
    if (possible > 0 && earned > 0 && earned < possible) return "Partially Accepted";
  }

  if (value === "wa" || value === "wrong answer") return "Wrong Answer";
  if (value === "re" && platform === "AtCoder") return "Runtime Error";
  if (value === "ac" && platform === "AtCoder") return "Accepted";
  if (platform === "CSES" && value.includes("reject")) return "Wrong Answer";
  if (value === "ok" || value === "ac" || value.includes("accepted")) return "Accepted";
  if (value.includes("wrong answer")) return "Wrong Answer";
  if (value.includes("runtime")) return "Runtime Error";
  if (value === "ce" || value.includes("compile") || value.includes("compilation")) {
    return "Compilation Error";
  }
  if (value === "tle" || value.includes("time limit")) return "Time Limit Exceeded";
  if (value.includes("memory limit")) return "Memory Limit Exceeded";
  if (value.includes("presentation")) return "Presentation Error";
  if (value.includes("partial")) return "Partially Accepted";
  if (value.includes("queue")) return "In Queue";
  if (value.includes("reject")) return "Rejected";
  return verdict
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const PLATFORM_COLORS: Record<string, string> = {
  Codeforces: "text-red-400",
  AtCoder: "text-sky-400",
  LeetCode: "text-amber-400",
  CodeChef: "text-orange-300",
  SPOJ: "text-pink-400",
  UVA: "text-blue-400",
};

function verdictColor(verdict: string) {
  const value = verdict.toLowerCase();
  if (["ok", "ac", "accepted"].includes(value)) return "text-emerald-400";
  if (value.includes("partial")) return "text-amber-400";
  return "text-red-400";
}

export default function RecentFeed() {
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState("all");
  const [verdict, setVerdict] = useState("all");

  useEffect(() => {
    fetch("/api/submissions?limit=5000")
      .then((r) => r.json())
      .then((d) =>
        setSubs(
          d.submissions.map((submission: Submission) => ({
            ...submission,
            language: standardLanguage(submission.language),
            verdict: standardVerdict(submission.verdict, submission.platform),
          }))
        )
      )
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="text-sm text-red-400">Failed to load: {error}</p>;
  if (!subs) return <p className="text-sm text-neutral-400">Loading submissions…</p>;

  const platforms = ["all", ...PLATFORM_OPTIONS];
  const verdicts = ["all", ...new Set(subs.map((s) => s.verdict))];
  const visible = subs
    .filter((s) => platform === "all" || s.platform === platform)
    .filter((s) => verdict === "all" || s.verdict === verdict)
    .slice(0, 20);

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="flex items-center gap-2 text-xs text-neutral-500">
          Platform
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200 outline-none"
          >
            {platforms.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All platforms" : value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-neutral-500">
          Verdict
          <select
            value={verdict}
            onChange={(e) => setVerdict(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200 outline-none"
          >
            {verdicts.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All verdicts" : value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="divide-y divide-neutral-800">
      {visible.map((s, i) => (
        <li key={i} className="flex items-baseline gap-x-3 py-2 text-sm">
          <span className="w-36 shrink-0 tabular-nums text-neutral-500">
            {new Date(s.time).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              ...(s.platform === "CSES" ? { timeZone: CSES_TIME_ZONE } : {}),
            })}
          </span>
          <span className={`w-24 shrink-0 font-medium ${PLATFORM_COLORS[s.platform] ?? "text-neutral-300"}`}>
            {s.platform}
          </span>
          <span className="w-56 shrink-0 truncate text-xs text-neutral-500">
            {s.language ?? ""}
          </span>
          <span className="min-w-0 flex-1 truncate text-neutral-200">{s.problemName}</span>
          <span className={`shrink-0 text-right font-medium ${verdictColor(s.verdict)}`}>
            {s.verdict}
          </span>
          <span className="w-20 shrink-0 text-right text-xs tabular-nums text-neutral-500">
            {s.runtimeMs != null ? `${s.runtimeMs} ms` : ""}
          </span>
        </li>
      ))}
      </ul>
      {visible.length === 0 && (
        <p className="py-4 text-sm text-neutral-500">No submissions match these filters.</p>
      )}
    </>
  );
}
