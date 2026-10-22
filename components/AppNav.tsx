"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, History, Stethoscope } from "lucide-react";
import { T, type BiTerm } from "../lib/bbip/terms";
import { Term } from "./bbip/Term";

// BBIP-first information architecture: the chairside assistant and its case
// history are the product; the Cognitio knowledge base lives one level down
// as "지식창고" — the evidence BBIP reads from — with its own sub-nav.

const KNOWLEDGE_PREFIXES = [
  "/kb",
  "/library",
  "/study",
  "/review",
  "/ask",
  "/entries",
  "/categories",
  "/ingest",
];

export function isKnowledgePath(pathname: string): boolean {
  return KNOWLEDGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

type Section = "consult" | "cases" | "knowledge";

function sectionOf(pathname: string): Section {
  if (pathname.startsWith("/cases") || pathname.startsWith("/patients")) return "cases";
  if (isKnowledgePath(pathname)) return "knowledge";
  return "consult";
}

const KNOWLEDGE_LINKS = [
  { href: "/kb", label: "HOME" },
  { href: "/library", label: "LIBRARY" },
  { href: "/study", label: "CHUNK!" },
  { href: "/review", label: "ANKI's", badge: true },
  { href: "/categories", label: "Sort" },
];

function DueBadge({ due }: { due: number }) {
  return (
    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-700 px-1 text-[11.5px] font-bold text-white tabular-nums">
      {due > 99 ? "99+" : due}
    </span>
  );
}

export function AppNav({ due }: { due: number }) {
  const pathname = usePathname() ?? "/";
  const section = sectionOf(pathname);

  const primary: Array<{ key: Section; href: string; term: BiTerm; icon: React.ReactNode }> = [
    { key: "consult", href: "/", term: T.consult, icon: <Stethoscope aria-hidden="true" className="h-3.5 w-3.5" /> },
    { key: "cases", href: "/cases", term: T.cases, icon: <History aria-hidden="true" className="h-3.5 w-3.5" /> },
    { key: "knowledge", href: "/kb", term: T.knowledge, icon: <BookOpen aria-hidden="true" className="h-3.5 w-3.5" /> },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-white/85 backdrop-blur print:hidden">
      <nav aria-label="주 메뉴" className="mx-auto flex max-w-[1360px] items-center justify-between gap-3 px-5 py-3.5 sm:px-8 sm:py-4 lg:px-12">
        <Link href="/" className="brand-link flex shrink-0 items-center gap-2 text-ink sm:gap-3">
          <img src="/brand/bbip-mark.svg" alt="" aria-hidden="true" className="h-[18px] w-auto sm:h-[28px]" />
          <span className="font-serifa text-2xl font-bold tracking-tight sm:text-[32px]">BBIP</span>
        </Link>
        <div className="flex items-center gap-1 rounded-full bg-mist p-1 text-[14.5px] min-[400px]:text-[15.5px] sm:text-[17px]">
          {primary.map((item) => {
            const active = item.key === section;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 transition max-[399px]:[&>svg]:hidden sm:px-4 ${
                  active ? "bg-inkdeep font-semibold text-white shadow-sm" : "text-ink hover:bg-white hover:shadow-sm"
                }`}
              >
                {item.icon}
                <Term term={item.term} />
                {item.key === "knowledge" && due > 0 && !active && (
                  <span aria-label={`복습할 카드 ${due}장`} className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {section === "knowledge" && (
        <nav aria-label="지식창고 메뉴" className="border-t border-ink/5 bg-white/70">
          <div className="mobile-nav mx-auto flex max-w-[1360px] items-center gap-1 overflow-x-auto px-5 py-2 text-[15px] text-ink sm:px-8 lg:px-12">
            <span className="mr-2 shrink-0 font-mono text-[11.5px] uppercase tracking-[0.2em] text-ink/60">
              Knowledge
            </span>
            {KNOWLEDGE_LINKS.map((link) => {
              const active =
                (link.href === "/library" && pathname.startsWith("/entries/")) ||
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
                    active ? "bg-mist font-semibold" : "hover:bg-mist"
                  }`}
                >
                  {link.label}
                  {link.badge && due > 0 && <DueBadge due={due} />}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}

/** The "+ 자료 넣기" shortcut belongs to the knowledge base, not the console. */
export function KnowledgePill() {
  const pathname = usePathname() ?? "/";
  if (!isKnowledgePath(pathname) || pathname === "/kb") return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div
        className="pill-rise flex items-center gap-3 rounded-full bg-white py-2 pl-5 pr-2"
        style={{
          boxShadow:
            "0 0 0 0.5px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.10), 0 12px 40px rgba(0,0,0,0.10)",
        }}
      >
        <BookOpen aria-hidden="true" className="h-4 w-4 text-ink" />
        <Link href="/kb#ingest-dock" className="btn-primary !px-5 !py-2.5">
          + 자료 넣기
        </Link>
      </div>
    </div>
  );
}
