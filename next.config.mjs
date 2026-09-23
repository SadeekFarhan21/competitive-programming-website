import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A lockfile in a parent directory otherwise makes Next guess the wrong workspace root.
  outputFileTracingRoot: path.dirname(new URL(import.meta.url).pathname),
  // The CP4/CP5 list used to live at /starred.
  async redirects() {
    return [
      { source: "/starred", destination: "/halim-book", permanent: true },
      { source: "/starred.json", destination: "/halim-book.json", permanent: true },
      { source: "/starred.csv", destination: "/halim-book.csv", permanent: true },
    ];
  },
};

export default nextConfig;
