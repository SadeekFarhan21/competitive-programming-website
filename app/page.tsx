import Heatmap from "./Heatmap";
import RecentFeed from "./RecentFeed";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Submission Activity
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Daily submissions across Codeforces, AtCoder, LeetCode, CodeChef, and CSES
            </p>
          </div>
          <a
            href="https://github.com/SadeekFarhan21/competitive-programming-website/actions/workflows/refresh-data.yml"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-200 transition-colors hover:border-emerald-600 hover:text-white"
          >
            Refresh now ↗
          </a>
        </div>
      </header>
      <Heatmap />
      <section className="mt-8">
        <h2 className="mb-2 text-lg font-semibold text-white">Recent submissions</h2>
        <RecentFeed />
      </section>
    </main>
  );
}
