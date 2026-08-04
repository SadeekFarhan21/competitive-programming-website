# Submission Activity

A fast Next.js dashboard for tracking submission activity across Codeforces, AtCoder, LeetCode, CodeChef, CSES, Kattis, and UVa Online Judge.

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

The refresh script uses the configured platform credentials from `.env.local`. LeetCode uses authenticated GraphQL through `LEETCODE_SESSION`; CSES uses `CSES_SESSION`; Kattis uses `KATTIS_USERNAME` and, when required for private submission history, `KATTIS_COOKIE`; SPOJ uses `SPOJ_USERNAME` (defaults to `farhan101`); and UVa uses `UVA_USERNAME` or `UVA_USER_ID`.

## Build and deploy

```bash
npm run build
npm start
```

The project deploys directly to Vercel. GitHub Actions refreshes and commits the submission dataset on schedule.

To enable the **Refresh now** button, add a Vercel environment variable named `GITHUB_REFRESH_TOKEN` containing a fine-grained GitHub token with Actions: write permission for this repository. The token stays server-side.

## Structure

- `app/Heatmap.tsx` — activity heatmap and platform/mode controls
- `app/RecentFeed.tsx` — recent submissions with platform and verdict filters
- `app/api/heatmap/route.ts` — local heatmap data endpoint
- `app/api/submissions/route.ts` — local recent-submission endpoint
- `lib/leetcode.ts` — authenticated/public LeetCode GraphQL client
- `scripts/refresh-data.mjs` — platform data refresh script
- `data/submissions.json` — bundled submission history
