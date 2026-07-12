"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, MotionConfig } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;
const WORDMARK = "COGNITIO".split("");

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

/** Editorial hero landing — a museum-masthead treatment adapted to the ink
 * palette: full-width serif wordmark rising letter by letter, a mono
 * sub-nav strip, the core promise, and live knowledge-base stats. */
export function LandingHero({
  noteCount,
  categoryCount,
  leafTotal,
}: {
  noteCount: number;
  categoryCount: number;
  leafTotal: number;
}) {
  // The soft glow field arrives late, like the reference's delayed video —
  // the type gets the first read, the atmosphere follows.
  const [glow, setGlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setGlow(true), 2200);
    return () => clearTimeout(timer);
  }, []);

  function scrollToDock() {
    document.getElementById("ingest-dock")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <MotionConfig reducedMotion="user">
      <section className="relative flex min-h-[88vh] flex-col overflow-hidden">
        {/* Delayed atmosphere */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: glow ? 1 : 0 }}
          transition={{ duration: 2 }}
          className="pointer-events-none absolute inset-0 z-0"
        >
          {/* radial gradients instead of filter blur — no hard clip edges */}
          <div
            className="hero-glow absolute -right-40 top-0 h-[560px] w-[560px] rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(167,243,208,0.5), rgba(167,243,208,0))",
            }}
          />
          <div
            className="hero-glow absolute -left-40 bottom-0 h-[480px] w-[480px] rounded-full"
            style={{
              animationDelay: "-4.5s",
              background:
                "radial-gradient(closest-side, rgba(186,230,253,0.5), rgba(186,230,253,0))",
            }}
          />
        </motion.div>

        {/* Full-width wordmark — letters rise out of one shared mask. This
            serif's Latin capitals paint wider than their advance widths, so
            per-letter masks would shave the glyphs; a single wrapper with a
            little horizontal slack clips only vertically in practice. */}
        <div className="relative z-10 overflow-hidden pb-[0.06em]">
          <motion.h1
            aria-label="COGNITIO"
            initial={{ scale: 1.03 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2, ease: EASE }}
            className="flex w-full select-none items-baseline justify-between px-[0.1em] font-serifa font-bold leading-[0.82] text-ink"
            style={{ fontSize: "clamp(2.4rem, 8.6vw, 7.6rem)" }}
          >
            {WORDMARK.map((letter, i) => (
              <motion.span
                key={i}
                className="inline-block"
                initial={{ y: "120%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 1.2, ease: EASE, delay: 0.1 + i * 0.06 }}
              >
                {letter}
              </motion.span>
            ))}
          </motion.h1>
        </div>

        {/* Mono sub-nav strip */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.7 }}
          className="relative z-10 mt-8 flex items-start justify-between gap-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-ink/70 md:text-[11px]"
        >
          <div className="w-[15%] min-w-[90px]">
            Aesthetic
            <br />
            Medicine
            <br />
            Knowledge
          </div>
          <div className="hidden w-[5%] justify-center pt-0.5 text-ink/30 md:flex">→</div>
          <div className="flex-1 text-ink/80 md:w-[30%] md:flex-none">
            논문·교과서·파라미터·노하우를
            <br />
            한 곳에서 읽고, 분류하고,
            <br />
            연결하는 지식 엔진.
          </div>
          <div className="hidden w-[5%] justify-center pt-0.5 text-ink/30 md:flex">→</div>
          <div className="hidden w-[15%] flex-col items-end gap-1.5 md:flex">
            <Link href="/library" className="transition hover:text-ink hover:underline">
              라이브러리
            </Link>
            <Link href="/entries/new" className="transition hover:text-ink hover:underline">
              직접 추가
            </Link>
            <Link href="/categories" className="transition hover:text-ink hover:underline">
              분류체계
            </Link>
            <a href="/api/export/all" className="transition hover:text-ink hover:underline">
              Obsidian ↓
            </a>
          </div>
        </motion.div>

        {/* Main hero row */}
        <div className="relative z-10 flex flex-1 items-start justify-between gap-8 pt-16 md:pt-24">
          <motion.div
            initial="initial"
            animate="animate"
            transition={{ staggerChildren: 0.15, delayChildren: 0.9 }}
            className="max-w-[560px]"
          >
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mb-6 flex items-center gap-3 font-mono text-xs text-ink/60"
            >
              01
              <span className="h-[1.5px] w-16 bg-ink/20" />
            </motion.div>

            <motion.h2
              variants={fadeUp}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="break-keep text-[2.6rem] leading-[1.08] tracking-tight text-ink md:text-[4.2rem]"
            >
              던져 넣으면,
              <br />
              <span className="font-serifa font-bold italic">정리되어 연결된다.</span>
            </motion.h2>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mt-6 max-w-[300px] text-[13px] leading-[1.7] text-ink/60 md:text-[14px]"
            >
              AI가 문서의 흐름을 읽어 카테고리와 쓰임별로 정리하고, 그림과 표는 원본
              그대로 잘라 노트에 담습니다.
            </motion.p>

            <motion.div variants={fadeUp} transition={{ duration: 0.8, ease: "easeOut" }} className="mt-8">
              <button
                type="button"
                onClick={scrollToDock}
                className="group relative overflow-hidden rounded-md border border-inkdeep bg-inkdeep px-6 py-3.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_rgba(5,26,36,0.45)] active:translate-y-0 active:shadow-none"
              >
                {/* Sliding light panel behind the label */}
                <span className="absolute inset-0 -translate-x-[101%] bg-white transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0" />
                <span className="relative z-10 flex items-center gap-2.5 text-[15px] font-medium text-white transition-colors duration-500 group-hover:text-ink">
                  <span className="inline-block transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:-rotate-12 group-hover:scale-110">
                    ↓
                  </span>
                  자료 넣기
                </span>
              </button>
            </motion.div>
          </motion.div>

          {/* Right stats column — the "specimen card" of this knowledge base. */}
          <motion.div
            initial="initial"
            animate="animate"
            transition={{ staggerChildren: 0.15, delayChildren: 1.2 }}
            className="mt-2 hidden w-[200px] flex-col gap-8 md:flex"
          >
            <motion.div variants={fadeUp} transition={{ duration: 0.8, ease: "easeOut" }}>
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
                Knowledge Base
              </p>
              <p className="mt-2 text-[12px] leading-[1.6] text-ink/55">
                진료실에서 쌓이는
                <br />
                살아있는 코덱스
              </p>
            </motion.div>

            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="space-y-4"
            >
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">노트</p>
                <p className="mt-0.5 text-[13px] font-medium tabular-nums text-ink">{noteCount}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">
                  카테고리
                </p>
                <p className="mt-0.5 text-[13px] font-medium tabular-nums text-ink">
                  {categoryCount} / {leafTotal}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">층위</p>
                <p className="mt-0.5 text-[13px] font-medium text-ink">4 Tiers</p>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} transition={{ duration: 0.8, ease: "easeOut" }}>
              <Link href="/library" className="group flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/30 text-ink transition-colors duration-300 group-hover:border-ink group-hover:bg-ink group-hover:text-white">
                  +
                </span>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/70 group-hover:text-ink">
                  라이브러리 보기
                </span>
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.8, ease: "easeOut", delay: 1.5 }}
          className="relative z-10 mt-14 hidden items-center gap-4 pb-2 md:flex"
        >
          <span className="flex h-12 w-12 items-center justify-center gap-[4px] rounded-full border border-ink/20">
            <span className="h-[12px] w-[1px] bg-ink/60" />
            <span className="h-[12px] w-[1px] bg-ink/60" />
          </span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink/45">
            Scroll to explore
          </span>
        </motion.div>
      </section>
    </MotionConfig>
  );
}
