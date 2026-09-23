import data from "../data/youkn0wwho.json";

export type TopicMeta = {
  title: string;
  category: string;
  subCategory: string;
  difficulty: number | null;
  importance: number | null;
  order: number;
};

export type TopicProblem = {
  id: string;
  judge: string;
  title: string;
  url: string;
  difficulty: number | null;
  starred: boolean;
  topic: string;
  topics: string[];
  solved: boolean;
};

export const youkn0wwho = data as {
  source: string;
  repository: string;
  topics: Record<string, TopicMeta>;
  problems: TopicProblem[];
};

const columns: (keyof TopicProblem)[] = ["judge", "id", "title", "url", "difficulty", "starred", "topic", "topics", "solved"];

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : Array.isArray(value) ? value.join("|") : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function youkn0wwhoCsv(): string {
  const rows = youkn0wwho.problems.map((problem) => columns.map((column) => escapeCsv(problem[column])).join(","));
  return [columns.join(","), ...rows].join("\n") + "\n";
}
