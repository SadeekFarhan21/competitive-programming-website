import { NextResponse } from "next/server";

const WORKFLOW_URL =
  "https://api.github.com/repos/SadeekFarhan21/competitive-programming-website/actions/workflows/refresh-data.yml/dispatches";
let lastTriggeredAt = 0;
const COOLDOWN_MS = 10 * 60 * 1000;

export async function POST() {
  const token = process.env.GITHUB_REFRESH_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Refresh is not configured on the server." },
      { status: 503 }
    );
  }

  if (Date.now() - lastTriggeredAt < COOLDOWN_MS) {
    return NextResponse.json(
      { error: "A refresh was requested recently. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const response = await fetch(WORKFLOW_URL, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref: "main" }),
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `GitHub returned HTTP ${response.status}.` },
      { status: 502 }
    );
  }

  lastTriggeredAt = Date.now();
  return NextResponse.json({ ok: true, startedAt: lastTriggeredAt });
}
