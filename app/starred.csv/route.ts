import { starredCsv } from "../../lib/starred";

export function GET() {
  return new Response(starredCsv(), {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });
}
