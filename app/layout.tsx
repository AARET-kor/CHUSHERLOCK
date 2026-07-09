import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "New Codex",
  description: "Aesthetic medicine knowledge base with Obsidian export.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <header className="border-b border-neutral-800 px-6 py-4">
          <nav className="mx-auto flex max-w-5xl items-center justify-between">
            <Link href="/" className="text-lg font-semibold">
              New Codex
            </Link>
            <div className="flex gap-4 text-sm text-neutral-300">
              <Link href="/">대시보드</Link>
              <Link href="/entries/new">새 자료 추가</Link>
              <Link href="/categories">분류체계</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
