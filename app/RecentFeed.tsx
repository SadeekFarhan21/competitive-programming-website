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

const PLATFORM_COLORS: Record<string, string> = {
  Codeforces: "text-red-400",
  AtCoder: "text-sky-400",
  LeetCode: "text-amber-400",
  CodeChef: "text-orange-300",
  UVA: "text-violet-400",
};

function verdictColor(verdict: string) {
  if (["OK", "AC", "ACCEPTED"].includes(verdict)) return "text-emerald-400";
  if (verdict.includes("PARTIAL")) return "text-amber-400";
  return "text-red-400";
}

export default function RecentFeed() {
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/submissions?limit=20")
      .then((r) => r.json())
      .then((d) => setSubs(d.submissions))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="text-sm text-red-400">Failed to load: {error}</p>;
  if (!subs) return <p className="text-sm text-neutral-400">Loading submissions…</p>;

  return (
    <ul className="divide-y divide-neutral-800">
      {subs.map((s, i) => (
        <li key={i} className="flex items-baseline gap-x-3 py-2 text-sm">
          <span className="w-36 shrink-0 tabular-nums text-neutral-500">
            {new Date(s.time).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
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
  );
}
