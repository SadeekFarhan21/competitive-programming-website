// Builds data/problem-tags.json: topic tags for every attempted problem, keyed
// "<platform>:<problem>" exactly as stored in submissions.json.
//   Codeforces — official tags from the problemset API
//   LeetCode   — official topic tags from LeetCode's GraphQL question list
//   AtCoder    — categories from the AtCoder Topicwise list
//   CodeChef   — tags from CodeChef's problem API (only problems not tagged yet)
//   CSES       — the problem set section each task is listed under
//   Kattis, UVa, SPOJ — topics from the Halim Book and YouKn0wWho lists
// A source that fails to load keeps the tags from the previous build.
import fs from "node:fs";
import path from "node:path";

const DATA = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "data");
const read = (file) => JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
const OUT = path.join(DATA, "problem-tags.json");

const submissions = read("submissions.json");
const previous = fs.existsSync(OUT) ? read("problem-tags.json") : {};
const problemsOn = (platform) => [...new Set(submissions.filter((s) => s.platform === platform).map((s) => s.problem))];

async function codeforcesTags() {
  const res = await fetch("https://codeforces.com/api/problemset.problems");
  const data = await res.json();
  if (data.status !== "OK") throw new Error(data.comment ?? "Codeforces API error");
  const byId = new Map(data.result.problems.map((p) => [`${p.contestId}${p.index}`, p.tags]));
  const tags = {};
  for (const problem of problemsOn("Codeforces")) {
    const id = problem.match(/^(\d+[A-Za-z]\d*)\s+-/)?.[1];
    if (byId.get(id)?.length) tags[`Codeforces:${problem}`] = byId.get(id);
  }
  return tags;
}

async function leetcodeTags() {
  const query = `query list($skip: Int, $limit: Int) {
    questionList(categorySlug: "", limit: $limit, skip: $skip, filters: {}) {
      total: totalNum
      data { title titleSlug topicTags { name } }
    }
  }`;
  const byTitle = new Map();
  for (let skip = 0, total = Infinity; skip < total; skip += 100) {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Referer: "https://leetcode.com/", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify({ query, variables: { skip, limit: 100 } }),
    });
    const list = (await res.json())?.data?.questionList;
    if (!list) throw new Error("LeetCode question list unavailable");
    total = list.total;
    for (const q of list.data) byTitle.set(q.title, q.topicTags.map((t) => t.name));
  }
  const tags = {};
  for (const problem of problemsOn("LeetCode")) {
    if (byTitle.get(problem)?.length) tags[`LeetCode:${problem}`] = byTitle.get(problem);
  }
  return tags;
}

function atcoderTags() {
  const { topics, problems } = read("atcoder-topicwise.json");
  const byId = new Map(problems.map((p) => [p.id, (p.topics ?? [p.topic]).map((t) => topics[t]?.title ?? t)]));
  const tags = {};
  for (const problem of problemsOn("AtCoder")) {
    if (byId.get(problem)?.length) tags[`AtCoder:${problem}`] = byId.get(problem);
  }
  return tags;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const norm = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
const unique = (values) => [...new Set(values.filter(Boolean))];

async function codechefTags() {
  const tags = {};
  for (const problem of problemsOn("CodeChef")) {
    const key = `CodeChef:${problem}`;
    if (previous[key]) {
      tags[key] = previous[key];
      continue;
    }
    await sleep(300);
    const res = await fetch(`https://www.codechef.com/api/contests/PRACTICE/problems/${encodeURIComponent(problem)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) continue;
    const data = await res.json().catch(() => null);
    const found = unique([...(data?.user_tags ?? []), ...(data?.computed_tags ?? [])]);
    if (found.length) tags[key] = found;
  }
  return tags;
}

async function csesTags() {
  const html = await (await fetch("https://cses.fi/problemset/", { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  const section = new Map();
  for (const [, heading, list] of html.matchAll(/<h2>([^<]+)<\/h2>\s*<ul class="task-list">([\s\S]*?)<\/ul>/g)) {
    for (const [, name] of list.matchAll(/<a href="\/problemset\/task\/\d+">([^<]+)<\/a>/g)) section.set(name, heading.trim());
  }
  if (!section.size) throw new Error("CSES problem list not recognized");
  const tags = {};
  for (const problem of problemsOn("CSES")) {
    if (section.has(problem)) tags[`CSES:${problem}`] = [section.get(problem)];
  }
  return tags;
}

// Halim Book topics and YouKn0wWho topics for judges without their own tags
function listTags() {
  const halim = read("halim-book.json");
  const ykw = read("youkn0wwho.json");
  const kattisSlugs = new Map(Object.entries(read("kattis-titles.json")).map(([slug, title]) => [title, slug]));
  const ykwTopics = (p) => (p.topics ?? [p.topic]).map((t) => ykw.topics[t]?.title ?? t);
  const lookup = new Map();
  const add = (key, values) => lookup.set(key, unique([...(lookup.get(key) ?? []), ...values]));
  for (const p of halim) {
    if (p.judge === "Kattis") add(`Kattis:${norm(p.id)}`, [p.topic]);
    if (p.judge === "UVa") add(`UVA:${p.id}`, [p.topic]);
  }
  for (const p of ykw.problems) {
    if (p.judge === "Kattis") add(`Kattis:${norm(p.id.replace(/^kattis_/, ""))}`, ykwTopics(p));
    if (p.judge === "UVa") add(`UVA:${p.id.replace(/^uva_/, "")}`, ykwTopics(p));
    if (p.judge === "SPOJ") add(`SPOJ:${norm(p.title)}`, ykwTopics(p));
  }
  const manualSpoj = read("spoj-manual.json");
  const tags = {};
  for (const problem of problemsOn("Kattis")) {
    const found = lookup.get(`Kattis:${norm(kattisSlugs.get(problem) ?? problem)}`);
    if (found?.length) tags[`Kattis:${problem}`] = found;
  }
  for (const problem of problemsOn("UVA")) {
    const found = lookup.get(`UVA:${problem.match(/^(\d+)/)?.[1]}`);
    if (found?.length) tags[`UVA:${problem}`] = found;
  }
  for (const problem of new Set([...problemsOn("SPOJ"), ...manualSpoj.map((s) => s.problem)])) {
    const found = lookup.get(`SPOJ:${norm(problem)}`);
    if (found?.length) tags[`SPOJ:${problem}`] = found;
  }
  return tags;
}

const sources = [
  ["Codeforces", codeforcesTags],
  ["LeetCode", leetcodeTags],
  ["AtCoder", atcoderTags],
  ["CodeChef", codechefTags],
  ["CSES", csesTags],
  ["Kattis, UVA, SPOJ", listTags],
];

const result = {};
for (const [platform, load] of sources) {
  try {
    const tags = await load();
    Object.assign(result, tags);
    console.log(`${platform}: tags for ${Object.keys(tags).length} problems`);
  } catch (error) {
    console.warn(`${platform} tags unavailable (${error.message}) — keeping previous`);
    const prefixes = platform.split(", ").map((name) => `${name}:`);
    for (const [key, value] of Object.entries(previous)) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) result[key] = value;
    }
  }
}

const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(OUT, JSON.stringify(sorted, null, 1) + "\n");
console.log(`Wrote ${Object.keys(sorted).length} entries to data/problem-tags.json`);
