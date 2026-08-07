"use client";

import dynamic from "next/dynamic";
import type { FeedSubmission } from "../lib/store";

const RecentFeed = dynamic(() => import("./RecentFeed"), {
  loading: () => <p className="text-sm text-neutral-400">Loading submissions…</p>,
});

export default function LazyRecentFeed({
  initialSubmissions,
}: {
  initialSubmissions: FeedSubmission[];
}) {
  return <RecentFeed initialSubmissions={initialSubmissions} />;
}
