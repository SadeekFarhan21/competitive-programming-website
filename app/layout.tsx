import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Submission Activity",
  description:
    "Daily submission heatmap and feed across Codeforces, AtCoder, LeetCode, CodeChef, CSES, Kattis, and UVa.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
