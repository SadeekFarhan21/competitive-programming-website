import ProblemBrowser from "./ProblemBrowser";
import index from "../public/data/index.json";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Codeforces Problem Browser
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          The {index.total.toLocaleString()} most recent problems across ratings
          1000–1600 · updated{" "}
          {new Date(index.generatedAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </header>
      <ProblemBrowser index={index} />
    </main>
  );
}
