import { NextRequest, NextResponse } from "next/server";
import { getRecentSubmissions } from "../../../lib/store";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const limit = Math.min(Number(params.get("limit")) || 15, 5000);
  const platform = params.get("platform");

  const errors: string[] = [];
  let submissions = getRecentSubmissions(5000);
  if (platform) {
    submissions = submissions.filter(
      (s) => s.platform.toLowerCase() === platform.toLowerCase()
    );
  }

  return NextResponse.json(
    { submissions: submissions.slice(0, limit), errors },
    {
      headers: {
        // CDN caches for 5 minutes — upstream APIs are hit at most once per window
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    }
  );
}
