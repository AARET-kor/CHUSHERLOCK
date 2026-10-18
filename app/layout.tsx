import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { dueCardCount } from "../lib/services/flashcardService";

export const metadata: Metadata = {
  title: "BBIP",
  description: "미용 GP 진료 비서 — 케이스를 넣으면 핵심부터.",
};

/** Number of flashcards due now — shown as a nav badge. Safe before the
 * flashcards table exists (fresh clone pre-migration): returns 0. */
async function safeDueCount(): Promise<number> {
  try {
    return await dueCardCount();
  } catch {
    return 0;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const due = await safeDueCount();
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-ink/5 bg-white/80 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
          <nav className="mx-auto flex max-w-5xl items-center gap-3 sm:justify-between">
            <Link
              href="/"
              className="brand-link shrink-0 font-serifa text-xl font-bold tracking-tight text-ink sm:text-2xl"
            >
              BBIP
            </Link>
            <div className="mobile-nav flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-full bg-mist px-2 py-1 text-xs text-ink sm:flex-initial sm:text-sm">
              <Link href="/" className="rounded-full px-3 py-1.5 font-bold transition hover:bg-white hover:shadow-sm">
                BBIP
              </Link>
              <Link href="/kb" className="rounded-full px-3 py-1.5 transition hover:bg-white hover:shadow-sm">
                HOME
              </Link>
              <Link href="/library" className="rounded-full px-3 py-1.5 transition hover:bg-white hover:shadow-sm">
                LIBRARY
              </Link>
              <Link href="/study" className="rounded-full px-3 py-1.5 transition hover:bg-white hover:shadow-sm">
                CHUNK!
              </Link>
              <Link
                href="/review"
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-white hover:shadow-sm"
              >
                ANKI&apos;s
                {due > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-700 px-1 text-[10px] font-bold text-white tabular-nums">
                    {due > 99 ? "99+" : due}
                  </span>
                )}
              </Link>
              <Link href="/ask" className="rounded-full px-3 py-1.5 font-medium transition hover:bg-white hover:shadow-sm">
                ASK to
              </Link>
              <Link href="/entries/new" className="rounded-full px-3 py-1.5 transition hover:bg-white hover:shadow-sm">
                Qmemo
              </Link>
              <Link href="/categories" className="rounded-full px-3 py-1.5 transition hover:bg-white hover:shadow-sm">
                Sort
              </Link>
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8 pb-32 sm:px-6 sm:py-10">{children}</main>

        {/* Floating bottom pill — the ever-present shortcut into the codex. */}
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div
            className="pill-rise flex items-center gap-4 rounded-full bg-white py-2 pl-6 pr-2"
            style={{
              boxShadow:
                "0 0 0 0.5px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.10), 0 12px 40px rgba(0,0,0,0.10)",
            }}
          >
            <span className="font-serifa text-xl font-bold text-ink">B</span>
            <Link href="/kb#ingest-dock" className="btn-primary !px-5 !py-2.5">
              + 자료 넣기
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
