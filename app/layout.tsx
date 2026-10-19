import type { Metadata } from "next";
import "./globals.css";
import { AppNav, KnowledgePill } from "../components/AppNav";
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
        <AppNav due={due} />

        <main className="mx-auto max-w-[1360px] px-5 py-8 pb-32 sm:px-8 sm:py-12 lg:px-12">{children}</main>

        <KnowledgePill />
      </body>
    </html>
  );
}
