import data from "../data/halim-book.json";

export type HalimBookProblem = {
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
  solved: boolean;
};

export const halimBook = data as HalimBookProblem[];

const columns: (keyof HalimBookProblem)[] = [
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
  "solved",
];

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function halimBookCsv(): string {
  const rows = halimBook.map((problem) => columns.map((column) => escapeCsv(problem[column])).join(","));
  return [columns.join(","), ...rows].join("\n") + "\n";
}
