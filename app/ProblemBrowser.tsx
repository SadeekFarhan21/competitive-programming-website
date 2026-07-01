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

type SortKey = "rating" | "recent" | "solved" | "name";

const RATING_COLOR: Record<number, string> = {
  1000: "text-neutral-300",
  1100: "text-green-400",
  1200: "text-green-400",
  1300: "text-cyan-400",
  1400: "text-cyan-400",
  1500: "text-blue-400",
  1600: "text-blue-400",
};

// Default profile: solved problems for this handle are hidden out of the box.
const DEFAULT_HANDLE = "FarhanSadeek21";

// Simple in-memory cache so re-visiting a tab doesn't refetch.
const cache = new Map<number, Problem[]>();

export default function ProblemBrowser({ index }: { index: Index }) {
  const [rating, setRating] = useState<number>(index.ratings[0]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("rating");

  // Codeforces handle -> set of solved "contestId-index" keys.
  const [handleInput, setHandleInput] = useState(DEFAULT_HANDLE);
  const [handle, setHandle] = useState(DEFAULT_HANDLE);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [hideSolved, setHideSolved] = useState(true);
  const [solvedStatus, setSolvedStatus] = useState("");

  // Restore saved handle once, on mount.
  useEffect(() => {
    const saved = localStorage.getItem("cf-handle");
    if (saved) {
      setHandleInput(saved);
      setHandle(saved);
    }
  }, []);

  // Fetch the user's accepted submissions whenever the handle changes.
  useEffect(() => {
    if (!handle) {
      setSolved(new Set());
      setSolvedStatus("");
      return;
    }
    let active = true;
    setSolvedStatus("Loading solved…");
    fetch(
      `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d.status !== "OK") {
          setSolved(new Set());
          setSolvedStatus(`Error: ${d.comment ?? "could not load handle"}`);
          return;
        }
        const s = new Set<string>();
        for (const sub of d.result) {
          if (sub.verdict === "OK" && sub.problem?.contestId != null) {
            s.add(`${sub.problem.contestId}-${sub.problem.index}`);
          }
        }
        setSolved(s);
        setSolvedStatus(`${s.size} solved on Codeforces`);
      })
      .catch(() => active && setSolvedStatus("Failed to load submissions"));
    return () => {
      active = false;
    };
  }, [handle]);

  function applyHandle() {
    const h = handleInput.trim();
    setHandle(h);
    if (h) localStorage.setItem("cf-handle", h);
    else localStorage.removeItem("cf-handle");
  }

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
      if (hideSolved && solved.has(`${p.contestId}-${p.index}`)) return false;
      return true;
    });
    const byRecent = (a: Problem, b: Problem) =>
      b.contestId - a.contestId || (a.index < b.index ? -1 : 1);
    out = [...out].sort((a, b) => {
      if (sort === "solved") return b.solvedCount - a.solvedCount;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "rating") return a.rating - b.rating || byRecent(a, b);
      return byRecent(a, b);
    });
    return out;
  }, [problems, query, tag, sort, solved, hideSolved]);

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

      {/* Codeforces profile: hide solved */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 p-2">
        <input
          value={handleInput}
          onChange={(e) => setHandleInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyHandle()}
          placeholder="Codeforces handle…"
          className="w-48 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-neutral-600"
        />
        <button
          onClick={applyHandle}
          className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-neutral-200"
        >
          Load
        </button>
        <button
          onClick={() => setHideSolved((v) => !v)}
          disabled={!handle}
          aria-pressed={hideSolved}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
            hideSolved
              ? "bg-green-600 text-white hover:bg-green-500"
              : "border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
          }`}
        >
          {hideSolved ? "✓ Hiding solved" : "Hide solved"}
        </button>
        {solvedStatus && (
          <span
            className={`text-sm ${
              solvedStatus.startsWith("Error") ||
              solvedStatus.startsWith("Failed")
                ? "text-red-400"
                : "text-neutral-500"
            }`}
          >
            {solvedStatus}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
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
          <option value="rating">Rating</option>
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
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Rating</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Tags</th>
              <th className="px-3 py-2 text-right font-medium">Solved</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-neutral-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-neutral-500">
                  No problems match.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr
                  key={`${p.contestId}${p.index}`}
                  className="hover:bg-neutral-900/40"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-neutral-500">
                    {p.contestId}
                    {p.index}
                  </td>
                  <td className="px-3 py-2">
                    {solved.has(`${p.contestId}-${p.index}`) && (
                      <span
                        title="Solved"
                        className="mr-1.5 text-green-500"
                      >
                        ✓
                      </span>
                    )}
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-neutral-100 hover:text-white hover:underline"
                    >
                      {p.name}
                    </a>
                  </td>
                  <td className={`px-3 py-2 font-mono text-xs ${RATING_COLOR[p.rating] ?? "text-neutral-400"}`}>
                    {p.rating}
                  </td>
                  <td className="hidden px-3 py-2 sm:table-cell">
                    {/* Tags are spoilers — blurred until hovered. */}
                    <div className="group flex flex-wrap gap-1">
                      {p.tags.slice(0, 4).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTag(t)}
                          title="Reveal tag"
                          className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs text-neutral-400 blur-[3px] transition duration-150 hover:bg-neutral-800 hover:text-neutral-200 group-hover:blur-none"
                        >
                          {t}
                        </button>
                      ))}
                      {p.tags.length > 4 && (
                        <span className="px-1 py-0.5 text-xs text-neutral-600 blur-[3px] group-hover:blur-none">
                          +{p.tags.length - 4}
                        </span>
                      )}
                      {p.tags.length === 0 && (
                        <span className="px-1 py-0.5 text-xs text-neutral-700">—</span>
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
