import type { Metadata } from "next";
import { starred } from "../../lib/starred";
import StarredTable from "./StarredTable";

export const metadata: Metadata = {
  title: "Starred Problems",
  description: "Filterable list of starred CP4/CP5 problems across UVa, Kattis, and LeetCode.",
};

const stats = [
  { label: "UVa", dot: "bg-sky-400", count: starred.filter((p) => p.judge === "UVa").length },
  { label: "Kattis", dot: "bg-amber-400", count: starred.filter((p) => p.judge === "Kattis").length },
  { label: "LeetCode", dot: "bg-emerald-400", count: starred.filter((p) => p.judge === "LeetCode").length },
  { label: "New in CP5", dot: "bg-fuchsia-400", count: starred.filter((p) => p.cp5).length },
];

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
      <path d="M10 3v10m0 0-4-4m4 4 4-4M4 16h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function StarredPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6">
      <header className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
              Competitive Programming 4 · 5
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Starred Problems
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400 sm:text-base">
              {starred.length.toLocaleString()} hand-picked problems from{" "}
              <a
                href="https://cpbook.net/methodstosolve"
                target="_blank"
                rel="noreferrer"
                className="text-neutral-200 underline decoration-white/20 underline-offset-4 hover:decoration-white/60"
              >
                Methods to Solve
              </a>
              , organized by chapter and section. Filter by judge, topic, or difficulty.
            </p>
          </div>
          <div className="flex gap-2">
            {[
              { href: "/starred.csv", label: "CSV" },
              { href: "/starred.json", label: "JSON" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-neutral-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/5 hover:text-white hover:ring-white/20"
              >
                <DownloadIcon />
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <dt className="flex items-center gap-2 text-xs text-neutral-500">
                <span className={`h-1.5 w-1.5 rounded-full ${stat.dot}`} />
                {stat.label}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-white">
                {stat.count.toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      </header>
      <StarredTable problems={starred} />
    </main>
  );
}
