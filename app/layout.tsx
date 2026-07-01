import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CF Problem Browser",
  description:
    "The most recent Codeforces problems by rating (1000–1600).",
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
