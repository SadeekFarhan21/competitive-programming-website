"use client";

import { useState } from "react";
import LoadMore from "./LoadMore";
import {
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  PLATFORM_OPTIONS,
  standardVerdict,
  verdictColor,
} from "./RecentFeed";

export type UnsolvedProblem = {
  platform: string;
  problem: string;
  url: string | null;
  attempts: number;
  lastEpoch: number;
  lastVerdict: string;
};

const PAGE = 20;

function formatDate(epoch: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(epoch * 1000));
}

export default function UnsolvedList({ problems }: { problems: UnsolvedProblem[] }) {
  const [platform, setPlatform] = useState("all");
  const [shown, setShown] = useState(PAGE);

  const filtered = problems.filter((p) => platform === "all" || p.platform === platform);
  const visible = filtered.slice(0, shown);
  const platforms = PLATFORM_OPTIONS.filter((value) => problems.some((p) => p.platform === value));

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-neutral-500">
          Platform
          <select
            value={platform}
            onChange={(e) => {
              setPlatform(e.target.value);
              setShown(PAGE);
            }}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200 outline-none"
          >
            <option value="all">All platforms</option>
            {platforms.map((value) => (
              <option key={value} value={value}>
                {PLATFORM_LABELS[value] ?? value}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-neutral-500">
          {filtered.length.toLocaleString()} {filtered.length === 1 ? "problem" : "problems"} attempted
          but never accepted
        </span>
      </div>
      <ul className="divide-y divide-neutral-800">
        {visible.map((p) => {
          const verdict = standardVerdict(p.lastVerdict, p.platform);
          return (
            <li
              key={`${p.platform}:${p.problem}`}
              className="grid min-w-0 gap-1 py-3 text-sm sm:grid-cols-[9rem_7rem_minmax(0,1fr)_6rem_auto] sm:items-baseline sm:gap-x-5 sm:py-2"
            >
              <span className="tabular-nums text-xs text-neutral-500 sm:text-sm">
                {formatDate(p.lastEpoch)}
              </span>
              <span className={`font-medium ${PLATFORM_COLORS[p.platform] ?? "text-neutral-300"}`}>
                {PLATFORM_LABELS[p.platform] ?? p.platform}
              </span>
              {p.url ? (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 truncate text-neutral-200 decoration-white/30 underline-offset-4 hover:underline"
                >
                  {p.problem}
                </a>
              ) : (
                <span className="min-w-0 truncate text-neutral-200">{p.problem}</span>
              )}
              <span className="tabular-nums text-xs text-neutral-500 sm:text-sm">
                {p.attempts} {p.attempts === 1 ? "attempt" : "attempts"}
              </span>
              <span className={`font-medium sm:text-right ${verdictColor(verdict)}`}>{verdict}</span>
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 && (
        <p className="py-4 text-sm text-neutral-500">No unsolved problems here.</p>
      )}
      <LoadMore shown={visible.length} total={filtered.length} onMore={() => setShown((n) => n + PAGE)} />
    </>
  );
}
