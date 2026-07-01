# Codeforces Problem Browser

A Next.js website listing the **1000 most recent Codeforces problems for each rating from 1000 to 1600** (in 100-point steps). Filter by tag, search by name/ID, and sort by recency or solve count.

## Data

Problem data comes from the official Codeforces API (`problemset.problems`) — no HTML scraping. For each rating bucket it keeps the newest problems (highest contest ID first), capped at 1000.

Regenerate the dataset any time:

```bash
npm run data     # writes public/data/{rating}.json + index.json
```

Edit `RATINGS` / `PER_BUCKET` in `scripts/build-data.mjs` to change the ranges.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
```

## Build / deploy

```bash
npm run build
npm start
```

Fully static — deploys to Vercel (or any static host) with zero config.

## Structure

- `scripts/build-data.mjs` — fetches + buckets problems into `public/data/`
- `app/page.tsx` — server page, loads the index
- `app/ProblemBrowser.tsx` — client UI (tabs, search, tag filter, sort)
