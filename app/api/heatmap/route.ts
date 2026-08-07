import { NextRequest, NextResponse } from "next/server";
import { getHeatmapData } from "../../../lib/heatmap";

function validTimeZone(value: string | null): string {
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const timeZone = validTimeZone(params.get("tz"));
  const yearParam = params.get("year");
  const selectedYear = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : null;
  const days = Math.min(Number(params.get("days")) || 365, 730);

  return NextResponse.json(getHeatmapData(timeZone, selectedYear, days), {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
