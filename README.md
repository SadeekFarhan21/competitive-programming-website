# Submission Activity

A fast Next.js dashboard for tracking submission activity across Codeforces, AtCoder, LeetCode, CodeChef, and CSES.

The heatmap and recent-submission feed read from the bundled `data/submissions.json` file, so page requests do not wait on external services. The refresh workflow updates that dataset before deployment.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Refresh data

```bash
npm run refresh
```

The refresh script uses the configured platform credentials from `.env.local`. LeetCode uses authenticated GraphQL through `LEETCODE_SESSION`; CSES uses `CSES_SESSION`.

## Build and deploy

```bash
npm run build
npm start
```

The project deploys directly to Vercel. GitHub Actions refreshes and commits the submission dataset on schedule.

## Structure

- `app/Heatmap.tsx` — activity heatmap and platform/mode controls
- `app/RecentFeed.tsx` — recent submissions with platform and verdict filters
- `app/api/heatmap/route.ts` — local heatmap data endpoint
- `app/api/submissions/route.ts` — local recent-submission endpoint
- `lib/leetcode.ts` — authenticated/public LeetCode GraphQL client
- `scripts/refresh-data.mjs` — platform data refresh script
- `data/submissions.json` — bundled submission history
