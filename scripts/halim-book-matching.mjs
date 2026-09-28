export function canonicalLeetCodeId(value) {
  const digits = String(value).trim().replace(/^lc/i, "");
  if (!/^\d+$/.test(digits)) return null;
  return String(Number.parseInt(digits, 10));
}

export function leetcodeTitleMap(problemList) {
  return new Map(
    (problemList?.stat_status_pairs ?? []).flatMap((problem) => {
      const id = canonicalLeetCodeId(problem?.stat?.frontend_question_id);
      const title = problem?.stat?.question__title;
      return id && title ? [[id, title]] : [];
    })
  );
}
