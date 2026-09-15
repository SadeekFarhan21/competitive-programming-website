import data from "../data/starred.json";

export type StarredProblem = {
  judge: string;
  id: string;
  title: string | null;
  url: string | null;
  section: string;
  topic: string;
  hint: string;
  dacu: number | null;
  points: number;
  cp5: boolean;
};

export const starred = data as StarredProblem[];

const columns: (keyof StarredProblem)[] = [
  "judge",
  "id",
  "title",
  "url",
  "section",
  "topic",
  "hint",
  "dacu",
  "points",
  "cp5",
];

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function starredCsv(): string {
  const rows = starred.map((problem) => columns.map((column) => escapeCsv(problem[column])).join(","));
  return [columns.join(","), ...rows].join("\n") + "\n";
}
