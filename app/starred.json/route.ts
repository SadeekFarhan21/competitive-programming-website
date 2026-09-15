import { NextResponse } from "next/server";
import { starred } from "../../lib/starred";

export function GET() {
  return NextResponse.json({
    source: "https://cpbook.net/methodstosolve?oj=all&topic=all&quality=starred&difficulty=all",
    total: starred.length,
    problems: starred,
  });
}
