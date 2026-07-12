"use client";

import Link from "next/link";
import { motion, MotionConfig } from "motion/react";

const fadeUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
};

const PILLS = [
  { icon: "💉", label: "시술 술기" },
  { icon: "🚨", label: "합병증 대응" },
  { icon: "🫀", label: "해부학" },
  { icon: "🧬", label: "피부과 기본" },
  { icon: "✅", label: "안전성 문진" },
] as const;

/** Light editorial interlude — one oversized statement plus category pills
 * leading into the library. */
export function ExploreSection() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="relative flex flex-col items-center pb-8 pt-28 text-center md:pt-40">
        <motion.p
          {...fadeUp}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mb-10 font-mono text-[10px] tracking-[0.2em] md:text-[11px]"
        >
          <span className="text-ink/45">[ 04 ]</span>{" "}
          <span className="font-bold uppercase text-ink">Explore the Library</span>
        </motion.p>

        <motion.h2
          {...fadeUp}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="max-w-[900px] text-[2rem] font-medium leading-[1.15] tracking-tight text-ink md:text-[3.2rem]"
        >
          논문과 교과서, 장비 파라미터, 그리고
          <br className="hidden md:block" /> 진료실의 노하우까지 —{" "}
          <span className="font-serifa font-bold italic">하나의 흐름</span>으로 엮습니다.
        </motion.h2>

        <motion.div
          initial="initial"
          whileInView="whileInView"
          viewport={{ once: true, margin: "-60px" }}
          transition={{ staggerChildren: 0.1, delayChildren: 0.3 }}
          className="mt-12 flex flex-wrap justify-center gap-3 md:gap-4"
        >
          {PILLS.map((pill) => (
            <motion.span
              key={pill.label}
              variants={fadeUp}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <Link
                href="/library"
                className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white/60 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wider text-ink/80 backdrop-blur-sm transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-white"
              >
                <span className="text-[13px]">{pill.icon}</span>
                {pill.label}
              </Link>
            </motion.span>
          ))}
        </motion.div>

        <div className="mt-20 hidden w-full items-center justify-between font-mono text-[10px] font-medium uppercase tracking-widest text-ink/40 md:flex">
          <span>We don&apos;t just store notes.</span>
          <span>Cognitio (C) 2026</span>
        </div>
      </section>
    </MotionConfig>
  );
}
