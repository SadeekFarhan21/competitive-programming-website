import assert from "node:assert/strict";
import test from "node:test";
import { canonicalLeetCodeId, leetcodeTitleMap } from "./halim-book-matching.mjs";

test("canonicalLeetCodeId matches CPBook's padded ids to LeetCode ids", () => {
  assert.equal(canonicalLeetCodeId("lc0001"), "1");
  assert.equal(canonicalLeetCodeId("lc0217"), "217");
  assert.equal(canonicalLeetCodeId(2469), "2469");
  assert.equal(canonicalLeetCodeId("not-a-problem"), null);
});

test("leetcodeTitleMap keys catalog entries by canonical frontend id", () => {
  const titles = leetcodeTitleMap({
    stat_status_pairs: [
      { stat: { frontend_question_id: 1, question__title: "Two Sum" } },
      { stat: { frontend_question_id: "217", question__title: "Contains Duplicate" } },
    ],
  });

  assert.equal(titles.get(canonicalLeetCodeId("lc0001")), "Two Sum");
  assert.equal(titles.get(canonicalLeetCodeId("lc0217")), "Contains Duplicate");
});
