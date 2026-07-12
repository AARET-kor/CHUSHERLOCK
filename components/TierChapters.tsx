"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { CONTENT_TIERS } from "../lib/codex/tiers";

const EASE = [0.16, 1, 0.3, 1] as const;

const TIER_GLYPHS: Record<string, string> = {
  procedure_tip: "💉",
  chairside_talk: "🗣️",
  deep_study: "📚",
  base_medical_knowledge: "🫀",
};

/** Dark chapter section — the four content tiers presented like museum
 * galleries: an auto-cycling emblem panel on the left, the chapter list on
 * the right. Adapted from the reference's "Ancient Collection" block. */
export function TierChapters({ tierCounts }: { tierCounts: Record<string, number> }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % CONTENT_TIERS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const tier = CONTENT_TIERS[active]!;

  return (
    <MotionConfig reducedMotion="user">
      <motion.section
        initial={{ opacity: 0, y: 48 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.9, ease: EASE }}
        className="relative overflow-hidden rounded-[32px] bg-inkdeep text-white"
      >
        {/* Heading area */}
        <div className="flex flex-col justify-between gap-10 px-8 pb-14 pt-14 md:px-14 md:pt-20 xl:flex-row">
          <h2 className="max-w-[640px] text-[1.7rem] font-medium leading-[1.18] tracking-tight md:text-[2.6rem]">
            수백 편의 자료에서 골라낸{" "}
            <span className="mx-1 inline-flex -translate-y-[3px] gap-2 align-middle md:mx-3">
              {["💉", "🧬", "🫀"].map((glyph) => (
                <span
                  key={glyph}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/20 text-base transition-colors duration-300 hover:border-white hover:bg-white md:h-12 md:w-12 md:text-xl"
                >
                  {glyph}
                </span>
              ))}
            </span>
            지식의 <span className="font-serifa font-bold italic">네 층위.</span>
          </h2>

          <div className="xl:pt-2 xl:text-right">
            <p className="mb-5 font-mono text-[9px] uppercase leading-relaxed tracking-widest text-white/40 md:text-[10px]">
              We don&apos;t just file documents
              <br />
              we layer clinical knowledge
            </p>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              {["출처 보존", "원본 그대로", "자동 연결"].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-white/20 px-5 py-2 font-mono text-[9px] uppercase tracking-widest text-white/60 transition-colors duration-300 hover:border-white hover:bg-white hover:text-ink"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[1px] bg-white/10" />

        {/* Two-column panel */}
        <div className="flex flex-col md:flex-row">
          {/* Emblem panel */}
          <div className="relative flex min-h-[320px] flex-col items-center justify-between border-b border-white/10 py-8 md:min-h-[440px] md:w-[35%] md:border-b-0 md:border-r">
            <span className="tracking-[0.3em] text-white/30">✳ ✳ ✳</span>

            <AnimatePresence mode="wait">
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 28, filter: "blur(14px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -28, filter: "blur(14px)" }}
                transition={{ duration: 0.55, ease: EASE }}
                className="flex flex-col items-center gap-4 px-6 text-center"
              >
                <span className="text-6xl md:text-7xl">{TIER_GLYPHS[tier.id]}</span>
                <span className="font-serifa text-2xl font-bold md:text-3xl">{tier.labelKo}</span>
                <span className="max-w-[240px] text-[12px] leading-[1.6] text-white/50">
                  {tier.descriptionKo}
                </span>
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/45">
              <span className="relative h-4 w-6 overflow-hidden text-center">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={active}
                    initial={{ y: 14 }}
                    animate={{ y: 0 }}
                    exit={{ y: -14 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="absolute inset-0 tabular-nums"
                  >
                    0{active + 1}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="text-white/20">/</span>
              <span className="tabular-nums">0{CONTENT_TIERS.length}</span>
            </div>
          </div>

          {/* Chapter list */}
          <div className="md:w-[65%]">
            <div className="flex items-center justify-between border-b border-white/10 px-8 py-6 font-mono text-[10px] uppercase tracking-widest text-white/40">
              <span>과거를 읽고, 진료에 연결한다.</span>
              <span className="relative h-4 w-20 overflow-hidden text-right">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={active}
                    initial={{ y: 14 }}
                    animate={{ y: 0 }}
                    exit={{ y: -14 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="absolute inset-0"
                  >
                    Chapter 0{active + 1}
                  </motion.span>
                </AnimatePresence>
              </span>
            </div>

            {CONTENT_TIERS.map((item, index) => {
              const isActive = index === active;
              const count = tierCounts[item.id] ?? 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActive(index)}
                  className={`group flex w-full items-center justify-between border-b border-white/10 px-8 py-7 text-left transition-colors duration-300 last:border-b-0 md:py-8 ${
                    isActive ? "text-white" : "text-white/25 hover:text-white/60"
                  }`}
                >
                  <span className="text-xl font-medium tracking-tight md:text-[1.7rem]">
                    {item.labelKo}
                    <span className="ml-3 align-middle font-mono text-[10px] uppercase tracking-widest text-white/30">
                      {item.labelEn}
                    </span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="font-mono text-[10px] tabular-nums tracking-widest text-white/35">
                      {count} notes
                    </span>
                    <motion.span
                      initial={false}
                      animate={{ opacity: isActive ? 1 : 0, x: isActive ? 0 : -8 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className="text-lg text-white/60"
                    >
                      ↗
                    </motion.span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-[1px] bg-white/10" />
        <div className="flex items-center justify-between px-8 py-7 font-mono text-[10px] uppercase tracking-widest text-white/40">
          <span>지식의 층위를 따라 내려가기</span>
          <Link href="/library" className="transition hover:text-white hover:underline">
            라이브러리에서 전체 보기 →
          </Link>
        </div>
      </motion.section>
    </MotionConfig>
  );
}
