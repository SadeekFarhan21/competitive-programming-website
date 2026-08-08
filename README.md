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

To export only Kattis submissions, use the standalone scraper. Add `--full` to
follow pagination until no new submissions are found:

```bash
KATTIS_USERNAME=farhan-sadeek KATTIS_COOKIE='KattisSiteCookie=...' \
  npm run fetch:kattis -- --full > /tmp/kattis-submissions.json
```

The script also reads `KATTIS_USERNAME` and `KATTIS_COOKIE` from `.env.local`.
The cookie is needed when Kattis only shows the submissions table to your logged-in
browser session and must never be committed.
To update the dashboard data directly instead of exporting a file, use
`npm run fetch:kattis -- --full --merge`.

The refresh script uses the configured platform credentials from `.env.local`. LeetCode uses authenticated GraphQL through `LEETCODE_SESSION`; CSES uses `CSES_SESSION`; Kattis uses `KATTIS_USERNAME` and, when required for private submission history, `KATTIS_COOKIE`; and UVa uses `UVA_USERNAME` or `UVA_USER_ID`. SPOJ entries are maintained manually in `data/spoj-manual.json` because its public submission page blocks automated refreshes.

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
- `app/submissions.json/route.ts` — full AI-friendly submission export at `/submissions.json`
- `lib/leetcode.ts` — authenticated/public LeetCode GraphQL client
- `scripts/refresh-data.mjs` — platform data refresh script
- `data/submissions.json` — bundled submission history

## Machine-readable export

The full deduplicated submission history is available at `/submissions.json`. It contains
schema metadata, account handles, summary counts, field definitions, and one normalized
record per submission. The refresh workflow updates the underlying dataset before the
export is served.
