"use client";

import { useEffect, useMemo, useState } from "react";

type Problem = {
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  solvedCount: number;
  url: string;
};

type Index = {
  generatedAt: string;
  ratings: number[];
  counts: Record<string, number>;
  total: number;
};

type SortKey = "recent" | "solved" | "name";

const RATING_COLOR: Record<number, string> = {
  1000: "text-neutral-300",
  1100: "text-green-400",
  1200: "text-green-400",
  1300: "text-cyan-400",
  1400: "text-cyan-400",
  1500: "text-blue-400",
  1600: "text-blue-400",
};

// Simple in-memory cache so re-visiting a tab doesn't refetch.
const cache = new Map<number, Problem[]>();

export default function ProblemBrowser({ index }: { index: Index }) {
  const [rating, setRating] = useState<number>(index.ratings[0]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("recent");

  useEffect(() => {
    let active = true;
    setLoading(true);
    const cached = cache.get(rating);
    if (cached) {
      setProblems(cached);
      setLoading(false);
      return;
    }
    fetch(`/data/${rating}.json`)
      .then((r) => r.json())
      .then((data: Problem[]) => {
        if (!active) return;
        cache.set(rating, data);
        setProblems(data);
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [rating]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const p of problems) for (const t of p.tags) s.add(t);
    return [...s].sort();
  }, [problems]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = problems.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) &&
          !`${p.contestId}${p.index}`.toLowerCase().includes(q)) return false;
      if (tag && !p.tags.includes(tag)) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sort === "solved") return b.solvedCount - a.solvedCount;
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.contestId - a.contestId ||
        (a.index < b.index ? -1 : 1); // recent
    });
    return out;
  }, [problems, query, tag, sort]);

  return (
    <div>
      {/* Rating tabs */}
      <div className="flex flex-wrap gap-1.5">
        {index.ratings.map((r) => (
          <button
            key={r}
            onClick={() => {
              setRating(r);
              setTag("");
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              r === rating
                ? "bg-white text-black"
                : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            {r}
            <span
              className={`ml-1.5 text-xs ${
                r === rating ? "text-neutral-500" : "text-neutral-600"
              }`}
            >
              {index.counts[r]}
            </span>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or ID…"
          className="w-56 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-neutral-600"
        />
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-neutral-600"
        >
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-neutral-600"
        >
          <option value="recent">Most recent</option>
          <option value="solved">Most solved</option>
          <option value="name">Name (A–Z)</option>
        </select>
        <span className="ml-auto text-sm text-neutral-500">
          {rows.length} shown
        </span>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/60 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Problem</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Tags</th>
              <th className="px-3 py-2 text-right font-medium">Solved</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-neutral-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-neutral-500">
                  No problems match.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr
                  key={`${p.contestId}${p.index}`}
                  className="hover:bg-neutral-900/40"
                >
                  <td className="px-3 py-2">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-neutral-100 hover:text-white hover:underline"
                    >
                      <span className="mr-2 font-mono text-xs text-neutral-500">
                        {p.contestId}
                        {p.index}
                      </span>
                      {p.name}
                    </a>
                  </td>
                  <td className="hidden px-3 py-2 sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {p.tags.slice(0, 4).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTag(t)}
                          className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                        >
                          {t}
                        </button>
                      ))}
                      {p.tags.length > 4 && (
                        <span className="px-1 py-0.5 text-xs text-neutral-600">
                          +{p.tags.length - 4}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-neutral-400">
                    {p.solvedCount.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
