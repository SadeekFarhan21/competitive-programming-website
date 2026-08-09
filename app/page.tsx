import Heatmap from "./Heatmap";
import RecentFeed from "./RecentFeed";
import RefreshButton from "./RefreshButton";

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
              Daily submissions across Codeforces, AtCoder, LeetCode, CodeChef, Sphere, CSES, Kattis, and Online Judge
            </p>
          </div>
          <RefreshButton />
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
