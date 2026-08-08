// Fetch a Kattis user's submission history as normalized JSON.
//
// Usage:
//   KATTIS_USERNAME=farhan-sadeek KATTIS_COOKIE='KattisSiteCookie=...' \
//     node scripts/fetch-kattis.mjs --full > /tmp/kattis-submissions.json
//
// KATTIS_COOKIE is only needed when the account's submission history is not
// visible to anonymous visitors. Copy the cookie value from the browser's
// KattisSiteCookie cookie; do not commit it.

const username = process.env.KATTIS_USERNAME ?? process.argv[2];
const full = process.argv.includes("--full");

if (!username) {
  console.error("Usage: KATTIS_USERNAME=... node scripts/fetch-kattis.mjs [--full]");
  process.exit(1);
}

const cookieValue = process.env.KATTIS_COOKIE;
const cookie = cookieValue
  ? cookieValue.startsWith("KattisSiteCookie=")
    ? cookieValue
    : `KattisSiteCookie=${cookieValue}`
  : null;

function decode(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(?:amp|#38);/gi, "&")
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39|#x27);/gi, "'")
    .replace(/&(?:lt|#60);/gi, "<")
    .replace(/&(?:gt|#62);/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function text(value) {
  return decode(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function parsePage(html, responseDate) {
  const rows = [];
  const cell = (row, type) => row.match(
    new RegExp(`<td[^>]*data-type=["']${type}["'][^>]*>([\\s\\S]*?)</td>`, "i")
  )?.[1] ?? "";
  const dateKey = responseDate.toISOString().slice(0, 10);

  for (const match of html.matchAll(/<tr[^>]*data-submission-id="\d+"[^>]*>[\s\S]*?<\/tr>/gi)) {
    const row = match[0];
    const problemCell = cell(row, "problem");
    const problemLinks = [...problemCell.matchAll(
      /<a[^>]*href=["'][^"']*\/problems\/[^"'#?]*["'][^>]*>([\s\S]*?)<\/a>/gi
    )];
    const problem = problemLinks.length
      ? text(problemLinks.at(-1)[1])
      : text(problemCell);
    const time = text(cell(row, "time"));
    const verdict = text(cell(row, "status")) || "UNKNOWN";
    const timestamp = /^\d{2}:\d{2}:\d{2}$/.test(time) ? `${dateKey} ${time}` : time;
    const epoch = Date.parse(`${timestamp.replace(" ", "T")}Z`) / 1000;
    const runtime = text(cell(row, "cpu")).match(/[\d.]+/)?.[0];
    const id = row.match(/data-submission-id="(\d+)"/i)?.[1];

    if (!id || !problem || !time || !Number.isFinite(epoch)) continue;
    rows.push({
      platform: "Kattis",
      id,
      epoch,
      problem,
      verdict,
      ac: verdict.toLowerCase().startsWith("accepted"),
      language: text(cell(row, "lang")) || null,
      runtimeMs: runtime ? Math.round(Number(runtime) * 1000) : null,
      memoryBytes: null,
    });
  }
  return rows;
}

async function fetchPage(page) {
  const url = new URL(`https://open.kattis.com/users/${encodeURIComponent(username)}`);
  url.searchParams.set("tab", "submissions");
  if (page > 1) url.searchParams.set("page", String(page));
  const response = await fetch(url, {
    headers: {
      "User-Agent": "submission-activity/1.0 (Kattis submission export)",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  if (!response.ok) throw new Error(`Kattis HTTP ${response.status} for page ${page}`);
  return { html: await response.text(), date: new Date(response.headers.get("date") ?? Date.now()) };
}

const all = [];
const seen = new Set();
for (let page = 1; page <= (full ? 100 : 1); page += 1) {
  const parsed = parsePage(...Object.values(await fetchPage(page)));
  const before = all.length;
  for (const row of parsed) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      all.push(row);
    }
  }
  if (!full || parsed.length === 0 || all.length === before) break;
  await new Promise((resolve) => setTimeout(resolve, 300));
}

all.sort((a, b) => a.epoch - b.epoch);
console.log(JSON.stringify(all, null, 2));
