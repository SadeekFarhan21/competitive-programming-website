"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StarredProblem } from "../../lib/starred";

type SortKey = "order" | "judge" | "problem" | "section" | "dacu" | "points";

const PAGE_SIZE = 100;

const judges = ["UVa", "Kattis", "LeetCode"] as const;

const judgeStyles: Record<string, { chip: string; dot: string }> = {
  UVa: { chip: "bg-sky-500/10 text-sky-300 ring-sky-400/30", dot: "bg-sky-400" },
  Kattis: { chip: "bg-amber-500/10 text-amber-300 ring-amber-400/30", dot: "bg-amber-400" },
  LeetCode: { chip: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30", dot: "bg-emerald-400" },
};

const chapterNames: Record<string, string> = {
  "1": "Introduction",
  "2": "Data Structures",
  "3": "Problem Solving Paradigms",
  "4": "Graph",
  "5": "Mathematics",
  "6": "String Processing",
  "7": "Geometry",
  "8": "More Advanced Topics",
  "9": "Rare Topics",
};

const fieldClass =
  "h-9 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-neutral-200 placeholder:text-neutral-500 transition focus:border-white/25 focus:bg-white/[0.05] focus:outline-none";

// Two stacked range inputs make a dual-thumb slider; only the thumbs receive pointer events.
const sliderClass =
  "pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent focus:outline-none " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 " +
  "[&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full " +
  "[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(255,255,255,0.08)] " +
  "[&::-webkit-slider-thumb]:transition focus-visible:[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(255,255,255,0.25)] " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 " +
  "[&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 " +
  "[&::-moz-range-thumb]:bg-white [&::-moz-range-track]:bg-transparent";

function compareSections(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

function chapterOf(section: string) {
  return section.split(".")[0];
}

function pointsStyle(points: number) {
  if (points < 2) return "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25";
  if (points < 4) return "bg-sky-500/10 text-sky-300 ring-sky-400/25";
  if (points < 6) return "bg-amber-500/10 text-amber-300 ring-amber-400/25";
  return "bg-rose-500/10 text-rose-300 ring-rose-400/25";
}

function SolvedMark({ solved }: { solved: boolean }) {
  return solved ? (
    <span
      title="Solved"
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30"
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3" aria-hidden>
        <path d="m4.5 10.5 3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">Solved</span>
    </span>
  ) : (
    <span title="Unsolved" className="inline-block h-5 w-5 rounded-full ring-1 ring-inset ring-white/10">
      <span className="sr-only">Unsolved</span>
    </span>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3 opacity-0 transition group-hover:opacity-70" aria-hidden>
      <path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProblemLink({ problem }: { problem: StarredProblem }) {
  const label = problem.title ?? problem.id;
  const content = (
    <>
      <span className="truncate">{label}</span>
      {problem.url && <ExternalIcon />}
    </>
  );
  return problem.url ? (
    <a
      href={problem.url}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex max-w-full items-center gap-1.5 font-medium text-neutral-100 decoration-white/30 underline-offset-4 hover:underline"
    >
      {content}
    </a>
  ) : (
    <span className="inline-flex max-w-full items-center font-medium text-neutral-100">{content}</span>
  );
}

// Blurred hints stay hidden until clicked, so a spoiler is only revealed on purpose.
function Hint({ hint, blurred, className = "" }: { hint: string; blurred: boolean; className?: string }) {
  const [revealed, setRevealed] = useState(false);
  if (!blurred || revealed) return <p className={className}>{hint}</p>;
  return (
    <button
      onClick={() => setRevealed(true)}
      title="Click to reveal hint"
      className={`block text-left blur-sm transition select-none hover:blur-[3px] ${className}`}
    >
      {hint}
    </button>
  );
}

export default function StarredTable({ problems }: { problems: StarredProblem[] }) {
  const [query, setQuery] = useState("");
  const [activeJudges, setActiveJudges] = useState<string[]>([...judges]);
  const [chapter, setChapter] = useState("");
  const [section, setSection] = useState("");
  const [cp5Only, setCp5Only] = useState(false);
  const [hideSolved, setHideSolved] = useState(false);
  const [blurHints, setBlurHints] = useState(true);
  const [minPoints, setMinPoints] = useState("");
  const [maxPoints, setMaxPoints] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("order");
  const [sortAsc, setSortAsc] = useState(true);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [ready, setReady] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Restore filters from the URL so a filtered view can be bookmarked or shared.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") ?? "");
    if (params.get("judge")) setActiveJudges(params.get("judge")!.split(","));
    setChapter(params.get("chapter") ?? "");
    setSection(params.get("section") ?? "");
    setCp5Only(params.get("cp5") === "1");
    setHideSolved(params.get("unsolved") === "1");
    try {
      setBlurHints(localStorage.getItem("starred:blurHints") !== "0");
    } catch {}
    setMinPoints(params.get("min") ?? "");
    setMaxPoints(params.get("max") ?? "");
    const sort = params.get("sort");
    if (sort) {
      setSortKey(sort.replace(/^-/, "") as SortKey);
      setSortAsc(!sort.startsWith("-"));
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (activeJudges.length !== judges.length) params.set("judge", activeJudges.join(","));
    if (chapter) params.set("chapter", chapter);
    if (section) params.set("section", section);
    if (cp5Only) params.set("cp5", "1");
    if (hideSolved) params.set("unsolved", "1");
    if (minPoints) params.set("min", minPoints);
    if (maxPoints) params.set("max", maxPoints);
    if (sortKey !== "order" || !sortAsc) params.set("sort", `${sortAsc ? "" : "-"}${sortKey}`);
    const search = params.toString();
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
    setVisible(PAGE_SIZE);
  }, [ready, query, activeJudges, chapter, section, cp5Only, hideSolved, minPoints, maxPoints, sortKey, sortAsc]);

  // Press "/" anywhere to jump to search.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const chapters = useMemo(
    () => [...new Set(problems.map((p) => chapterOf(p.section)))].sort(compareSections),
    [problems]
  );

  const sectionGroups = useMemo(() => {
    const topics = new Map<string, string>();
    for (const p of problems) topics.set(p.section, p.topic);
    const groups = new Map<string, [string, string][]>();
    for (const [s, topic] of [...topics].sort(([a], [b]) => compareSections(a, b))) {
      const c = chapterOf(s);
      if (chapter && c !== chapter) continue;
      groups.set(c, [...(groups.get(c) ?? []), [s, topic]]);
    }
    return [...groups];
  }, [problems, chapter]);

  const judgeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of problems) counts[p.judge] = (counts[p.judge] ?? 0) + 1;
    return counts;
  }, [problems]);

  const pointBounds = useMemo(() => {
    const values = problems.map((p) => p.points);
    return { min: Math.floor(Math.min(...values)), max: Math.ceil(Math.max(...values)) };
  }, [problems]);
  const pointSpan = pointBounds.max - pointBounds.min || 1;
  const low = minPoints === "" ? pointBounds.min : Math.max(Number(minPoints), pointBounds.min);
  const high = maxPoints === "" ? pointBounds.max : Math.min(Number(maxPoints), pointBounds.max);

  // A thumb resting at the edge of the range means "no limit", so it stays out of the URL.
  function setLow(value: number) {
    setMinPoints(value <= pointBounds.min ? "" : value.toFixed(1));
  }

  function setHigh(value: number) {
    setMaxPoints(value >= pointBounds.max ? "" : value.toFixed(1));
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const min = minPoints === "" ? -Infinity : Number(minPoints);
    const max = maxPoints === "" ? Infinity : Number(maxPoints);

    const rows = problems
      .map((problem, order) => ({ problem, order }))
      .filter(({ problem: p }) => {
        if (!activeJudges.includes(p.judge)) return false;
        if (chapter && chapterOf(p.section) !== chapter) return false;
        if (section && p.section !== section) return false;
        if (cp5Only && !p.cp5) return false;
        if (hideSolved && p.solved) return false;
        if (p.points < min || p.points > max) return false;
        if (!needle) return true;
        return [p.id, p.title, p.topic, p.hint, p.section].some((field) =>
          field?.toLowerCase().includes(needle)
        );
      });

    const direction = sortAsc ? 1 : -1;
    rows.sort((a, b) => {
      const pa = a.problem;
      const pb = b.problem;
      let result = 0;
      if (sortKey === "judge") result = pa.judge.localeCompare(pb.judge);
      if (sortKey === "problem") result = (pa.title ?? pa.id).localeCompare(pb.title ?? pb.id);
      if (sortKey === "section") result = compareSections(pa.section, pb.section);
      if (sortKey === "dacu") result = (pa.dacu ?? -1) - (pb.dacu ?? -1);
      if (sortKey === "points") result = pa.points - pb.points;
      return (result || a.order - b.order) * direction;
    });

    return rows.map(({ problem }) => problem);
  }, [problems, query, activeJudges, chapter, section, cp5Only, hideSolved, minPoints, maxPoints, sortKey, sortAsc]);

  const shown = filtered.slice(0, visible);
  const isFiltered =
    query !== "" ||
    activeJudges.length !== judges.length ||
    chapter !== "" ||
    section !== "" ||
    cp5Only ||
    hideSolved ||
    minPoints !== "" ||
    maxPoints !== "";

  // Hint blurring is a personal preference, so it lives in localStorage rather than the URL.
  function toggleBlurHints() {
    const next = !blurHints;
    setBlurHints(next);
    try {
      localStorage.setItem("starred:blurHints", next ? "1" : "0");
    } catch {}
  }

  function toggleJudge(judge: string) {
    setActiveJudges((current) =>
      current.includes(judge) ? current.filter((j) => j !== judge) : [...current, judge]
    );
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key !== "dacu" && key !== "points");
    }
  }

  function pickSection(s: string) {
    setChapter(chapterOf(s));
    setSection(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setQuery("");
    setActiveJudges([...judges]);
    setChapter("");
    setSection("");
    setCp5Only(false);
    setHideSolved(false);
    setMinPoints("");
    setMaxPoints("");
    setSortKey("order");
    setSortAsc(true);
  }

  function header(label: string, key: SortKey, className = "") {
    const active = sortKey === key;
    return (
      <th className={`px-4 py-3 font-medium ${className}`}>
        <button
          onClick={() => toggleSort(key)}
          className={`inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-neutral-200 ${active ? "text-neutral-200" : ""}`}
        >
          {label}
          <span className={`text-[10px] ${active ? "opacity-100" : "opacity-0"}`}>{sortAsc ? "▲" : "▼"}</span>
        </button>
      </th>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="z-20 -mx-4 md:sticky md:top-0 mb-6 border-b border-white/5 bg-[#0a0a0b]/85 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-500">
                <SearchIcon />
              </span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search problems, topics, or hints"
                className={`${fieldClass} h-10 w-full pl-9 pr-10`}
              />
              <kbd className="pointer-events-none absolute inset-y-0 right-3 my-auto hidden h-5 items-center rounded border border-white/10 px-1.5 font-mono text-[11px] text-neutral-500 sm:flex">
                /
              </kbd>
            </div>
            <div className="flex flex-wrap gap-2">
              {judges.map((judge) => {
                const on = activeJudges.includes(judge);
                return (
                  <button
                    key={judge}
                    onClick={() => toggleJudge(judge)}
                    aria-pressed={on}
                    className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium ring-1 ring-inset transition ${
                      on
                        ? judgeStyles[judge].chip
                        : "text-neutral-500 ring-white/10 hover:text-neutral-300 hover:ring-white/20"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${on ? judgeStyles[judge].dot : "bg-neutral-600"}`} />
                    {judge}
                    <span className="tabular-nums text-xs opacity-60">{judgeCounts[judge] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            <button
              onClick={() => {
                setChapter("");
                setSection("");
              }}
              className={`h-8 shrink-0 rounded-full px-3 text-xs font-medium transition ${
                chapter === "" ? "bg-white text-neutral-900" : "text-neutral-400 ring-1 ring-inset ring-white/10 hover:text-neutral-200"
              }`}
            >
              All chapters
            </button>
            {chapters.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setChapter(chapter === c ? "" : c);
                  setSection("");
                }}
                title={chapterNames[c]}
                className={`h-8 shrink-0 rounded-full px-3 text-xs font-medium transition ${
                  chapter === c ? "bg-white text-neutral-900" : "text-neutral-400 ring-1 ring-inset ring-white/10 hover:text-neutral-200"
                }`}
              >
                <span className="tabular-nums">{c}</span>
                <span className="ml-1.5 hidden sm:inline">{chapterNames[c] ?? ""}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <select
              value={section}
              onChange={(e) => {
                setSection(e.target.value);
                if (e.target.value) setChapter(chapterOf(e.target.value));
              }}
              className={`${fieldClass} w-full min-w-0 sm:w-72`}
            >
              <option value="">All sections</option>
              {sectionGroups.map(([c, items]) => (
                <optgroup key={c} label={`Chapter ${c}${chapterNames[c] ? ` · ${chapterNames[c]}` : ""}`}>
                  {items.map(([s, topic]) => (
                    <option key={s} value={s}>
                      {s} · {topic}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <div className="flex w-full items-center gap-3 text-sm text-neutral-400 sm:w-auto">
              <span>Points</span>
              <div className="relative h-9 w-full sm:w-56">
                <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
                <div
                  className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/70"
                  style={{
                    left: `${((low - pointBounds.min) / pointSpan) * 100}%`,
                    right: `${((pointBounds.max - high) / pointSpan) * 100}%`,
                  }}
                />
                <input
                  type="range"
                  min={pointBounds.min}
                  max={pointBounds.max}
                  step="0.1"
                  value={low}
                  onChange={(e) => setLow(Math.min(Number(e.target.value), high))}
                  aria-label="Minimum points"
                  className={`${sliderClass} ${low > pointBounds.max - 0.5 ? "z-20" : "z-10"}`}
                />
                <input
                  type="range"
                  min={pointBounds.min}
                  max={pointBounds.max}
                  step="0.1"
                  value={high}
                  onChange={(e) => setHigh(Math.max(Number(e.target.value), low))}
                  aria-label="Maximum points"
                  className={`${sliderClass} z-10`}
                />
              </div>
              <span className="w-16 shrink-0 text-right font-medium tabular-nums text-neutral-200">
                {low.toFixed(1)}–{high.toFixed(1)}
              </span>
            </div>

            <button
              role="switch"
              aria-checked={cp5Only}
              onClick={() => setCp5Only(!cp5Only)}
              className="flex items-center gap-2 text-sm text-neutral-400 transition hover:text-neutral-200"
            >
              <span
                className={`relative h-5 w-9 rounded-full transition ${cp5Only ? "bg-fuchsia-500/80" : "bg-white/10"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    cp5Only ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
              New in CP5
            </button>

            <button
              role="switch"
              aria-checked={hideSolved}
              onClick={() => setHideSolved(!hideSolved)}
              className="flex items-center gap-2 text-sm text-neutral-400 transition hover:text-neutral-200"
            >
              <span
                className={`relative h-5 w-9 rounded-full transition ${hideSolved ? "bg-emerald-500/80" : "bg-white/10"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    hideSolved ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
              Hide solved
            </button>

            <button
              role="switch"
              aria-checked={blurHints}
              onClick={toggleBlurHints}
              className="flex items-center gap-2 text-sm text-neutral-400 transition hover:text-neutral-200"
            >
              <span
                className={`relative h-5 w-9 rounded-full transition ${blurHints ? "bg-sky-500/80" : "bg-white/10"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    blurHints ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
              Blur hints
            </button>

            <div className="flex items-center gap-3 text-sm sm:ml-auto">
              <span className="tabular-nums text-neutral-400">
                <span className="font-medium text-neutral-100">{filtered.length.toLocaleString()}</span> of{" "}
                {problems.length.toLocaleString()}
              </span>
              {isFiltered && (
                <button
                  onClick={reset}
                  className="rounded-md px-2 py-1 text-neutral-400 ring-1 ring-inset ring-white/10 transition hover:text-white hover:ring-white/25"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
          <div className="mb-3 rounded-full bg-white/5 p-3 text-neutral-400">
            <SearchIcon />
          </div>
          <p className="font-medium text-neutral-200">No problems match these filters</p>
          <p className="mt-1 text-sm text-neutral-500">Try a different search or loosen the filters.</p>
          <button
            onClick={reset}
            className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-white/[0.015] md:block">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-14" />
                <col className="w-28" />
                <col className="w-[22%]" />
                <col className="w-[22%]" />
                <col />
                <col className="w-20" />
                <col className="w-20" />
              </colgroup>
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="py-3 pl-4 pr-0 text-center font-medium" title="Solved">
                    ✓
                  </th>
                  {header("Judge", "judge")}
                  {header("Problem", "problem")}
                  {header("Section", "section")}
                  <th className="px-4 py-3 font-medium">Hint</th>
                  {header("DACU", "dacu", "text-right")}
                  {header("Pts", "points", "text-right")}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {shown.map((p) => (
                  <tr key={`${p.judge}:${p.id}`} className="align-top transition hover:bg-white/[0.03]">
                    <td className="py-3 pl-4 pr-0 text-center">
                      <SolvedMark solved={p.solved} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${judgeStyles[p.judge]?.chip}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${judgeStyles[p.judge]?.dot}`} />
                        {p.judge}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <ProblemLink problem={p} />
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          {p.title && p.title !== p.id && <span className="font-mono">{p.id}</span>}
                          {p.cp5 && (
                            <span className="rounded bg-fuchsia-500/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-fuchsia-300">
                              CP5
                            </span>
                          )}                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => pickSection(p.section)}
                        title="Show only this section"
                        className="group flex min-w-0 items-baseline gap-2 text-left"
                      >
                        <span className="shrink-0 font-mono text-xs text-neutral-500 group-hover:text-neutral-300">
                          {p.section}
                        </span>
                        <span className="text-neutral-300 group-hover:text-white">{p.topic}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 leading-relaxed text-neutral-400">
                      <Hint key={String(blurHints)} hint={p.hint} blurred={blurHints} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-400">
                      {p.dacu ? p.dacu.toLocaleString() : <span className="text-neutral-700">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset ${pointsStyle(p.points)}`}
                      >
                        {p.points.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {shown.map((p) => (
              <li
                key={`${p.judge}:${p.id}`}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="mt-0.5 shrink-0">
                    <SolvedMark solved={p.solved} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <ProblemLink problem={p} />
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <span className={`inline-flex items-center gap-1.5 ${judgeStyles[p.judge] ? "" : ""}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${judgeStyles[p.judge]?.dot}`} />
                        {p.judge}
                      </span>
                      {p.title && p.title !== p.id && <span className="font-mono">{p.id}</span>}
                      {p.cp5 && <span className="font-semibold text-fuchsia-300">CP5</span>}                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset ${pointsStyle(p.points)}`}
                  >
                    {p.points.toFixed(1)}
                  </span>
                </div>
                <button
                  onClick={() => pickSection(p.section)}
                  className="mt-3 flex items-baseline gap-2 text-left text-sm"
                >
                  <span className="font-mono text-xs text-neutral-500">{p.section}</span>
                  <span className="text-neutral-300">{p.topic}</span>
                </button>
                <Hint
                  key={String(blurHints)}
                  hint={p.hint}
                  blurred={blurHints}
                  className="mt-1.5 text-sm leading-relaxed text-neutral-400"
                />
              </li>
            ))}
          </ul>

          {visible < filtered.length && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-200 ring-1 ring-inset ring-white/15 transition hover:bg-white/5 hover:ring-white/25"
              >
                Show more
              </button>
              <span className="text-xs tabular-nums text-neutral-500">
                Showing {shown.length.toLocaleString()} of {filtered.length.toLocaleString()}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
