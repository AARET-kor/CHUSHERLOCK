// components/papers/JournalTable.tsx
"use client";

import { useState } from "react";
import type { Journal } from "../../lib/papers/types";

function IfInput({ journal }: { journal: Journal }) {
  const [value, setValue] = useState(journal.impactFactor?.toString() ?? "");
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");

  async function save() {
    const number = value.trim() === "" ? null : Number(value);
    if (number !== null && (!Number.isFinite(number) || number < 0)) {
      setState("error");
      return;
    }
    const res = await fetch("/api/papers/journals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ta: journal.ta, impactFactor: number }),
    });
    setState(res.ok ? "saved" : "error");
  }

  return (
    <span className="inline-flex items-center gap-2">
      <input
        aria-label={`${journal.name} IF`}
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={() => void save()}
        className="w-16 border-b border-ink/20 bg-transparent py-0.5 text-right font-mono text-[14px]"
      />
      {state === "saved" && <span className="text-[12.5px] text-[#0f5132]">Saved · 저장됨</span>}
      {state === "error" && <span role="alert" className="text-[12.5px] text-red-800">0 이상 숫자로 넣어 주세요</span>}
    </span>
  );
}

export function JournalTable({ journals }: { journals: Journal[] }) {
  return (
    <table className="w-full border-collapse text-[15px]">
      <thead>
        <tr className="border-b border-ink/15 text-left text-[13px] text-ink/65">
          <th scope="col" className="py-2 font-medium">Journal · 저널</th>
          <th scope="col" className="py-2 text-right font-medium">IF ≈</th>
          <th scope="col" className="hidden py-2 text-right font-medium sm:table-cell">Status · 상태</th>
        </tr>
      </thead>
      <tbody>
        {journals.map((journal) => (
          <tr key={journal.ta} className="border-b border-ink/[0.07]">
            <th scope="row" className="py-2 pr-4 text-left font-normal">
              {journal.name}
              <span className="block font-mono text-[12.5px] text-ink/60">{journal.ta}</span>
            </th>
            <td className="py-2 text-right"><IfInput journal={journal} /></td>
            <td className="hidden py-2 text-right text-[13px] text-ink/60 sm:table-cell">{journal.edited ? "Edited · 수정함" : "Approx · 근사값"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
