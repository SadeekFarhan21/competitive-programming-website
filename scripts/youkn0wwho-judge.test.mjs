import assert from "node:assert/strict";
import test from "node:test";
import { isCodeforcesGym } from "./youkn0wwho-judge.mjs";

test("recognizes every Codeforces Gym link format used by the topic list", () => {
  assert.equal(isCodeforcesGym("cf_gym_100625j", "https://codeforces.com/gym/100625/problem/J"), true);
  assert.equal(isCodeforcesGym("gym_287306b", "https://codeforces.com/group/x/contest/219158/problem/B"), true);
  assert.equal(isCodeforcesGym("codeforces_100482a", "https://codeforces.com/problemset/gymProblem/100482/A"), true);
  assert.equal(isCodeforcesGym("anything", "https://vjudge.net/problem/Gym-102644C"), true);
});

test("does not classify regular Codeforces contests as Gym", () => {
  assert.equal(isCodeforcesGym("codeforces_1063b", "https://codeforces.com/problemset/problem/1063/B"), false);
  assert.equal(isCodeforcesGym("codeforces_1900a", "https://codeforces.com/contest/1900/problem/A"), false);
});
