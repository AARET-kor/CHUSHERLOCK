import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cognitio",
  description: "Aesthetic medicine knowledge base with Obsidian export.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-ink/5 bg-white/80 px-6 py-4 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center justify-between">
            <Link href="/" className="font-serifa text-2xl font-bold tracking-tight text-ink">
              Cognitio
            </Link>
            <div className="flex items-center gap-1 rounded-full bg-mist px-2 py-1 text-sm text-ink">
              <Link href="/" className="rounded-full px-3 py-1.5 transition hover:bg-white hover:shadow-sm">
                대시보드
              </Link>
              <Link href="/library" className="rounded-full px-3 py-1.5 transition hover:bg-white hover:shadow-sm">
                라이브러리
              </Link>
              <Link href="/entries/new" className="rounded-full px-3 py-1.5 transition hover:bg-white hover:shadow-sm">
                직접 추가
              </Link>
              <Link href="/categories" className="rounded-full px-3 py-1.5 transition hover:bg-white hover:shadow-sm">
                분류체계
              </Link>
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-5xl px-6 py-10 pb-32">{children}</main>

        {/* Floating bottom pill — the ever-present shortcut into the codex. */}
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div
            className="flex items-center gap-4 rounded-full bg-white py-2 pl-6 pr-2"
            style={{
              boxShadow:
                "0 0 0 0.5px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.10), 0 12px 40px rgba(0,0,0,0.10)",
            }}
          >
            <span className="font-serifa text-xl font-bold text-ink">C</span>
            <Link href="/" className="btn-primary !px-5 !py-2.5">
              + 자료 넣기
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
