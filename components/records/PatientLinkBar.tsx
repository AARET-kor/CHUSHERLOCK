// components/records/PatientLinkBar.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import type { SessionLink } from "../../lib/bbip/types";
import type { PatientSummary, Visit } from "../../lib/records/types";

const LINK = "underline decoration-ink/25 underline-offset-4 hover:decoration-ink";

/** Who this consult belongs to: the linked patient, a typed chart number to
 * register, similar patients to pick, or a chart-number box. */
export function PatientLinkBar({
  sessionId,
  link,
  onLinked,
  onUnlinked,
}: {
  sessionId: string;
  link: SessionLink;
  onLinked: (patient: PatientSummary, visit: Visit | null) => void;
  onUnlinked: () => void;
}) {
  const [chartNo, setChartNo] = useState(link.pendingChartNo ?? "");
  const [alias, setAlias] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function put(body: object) {
    const res = await fetch(`/api/bbip/sessions/${sessionId}/patient`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.patient) return setError(data.error ?? "연결하지 못했습니다.");
    setError(null);
    onLinked(data.patient, data.visit ?? null);
  }

  async function unlink() {
    const res = await fetch(`/api/bbip/sessions/${sessionId}/patient`, { method: "DELETE" });
    if (res.ok) onUnlinked();
  }

  if (link.patient) {
    const p = link.patient;
    return (
      <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-l-2 border-[#0f5132] pl-4">
        <span className="text-[13px] font-semibold text-[#0f5132]">Patient · 환자</span>
        <Link href={`/patients/${p.patient.id}`} className={`font-mono text-[15px] text-inkdeep ${LINK}`}>#{p.patient.chartNo}</Link>
        <span className="text-[15.5px] text-inkdeep">{p.patient.alias || p.patient.features}</span>
        <span className="text-[14px] text-ink/65">{p.activeCourses.map((c) => `${c.procedure} ${c.done}${c.planned ? `/${c.planned}` : "회"}`).join(" · ")}</span>
        <button type="button" onClick={() => void unlink()} className={`ml-auto text-[13.5px] text-ink/60 ${LINK}`}>Unlink · 연결 해제 (기록 보존)</button>
      </div>
    );
  }

  return (
    <div className="mt-6 border-l-2 border-ink/20 pl-4">
      {link.candidates.length > 0 && (
        <div className="mb-3">
          <p className="text-[13px] font-semibold text-ink/70">Possibly a previous patient · 이전 환자일 수 있어요</p>
          <ul className="mt-1">
            {link.candidates.map((c) => (
              <li key={c.patient.id} className="flex flex-wrap items-baseline gap-x-3 py-1 text-[15px]">
                <span className="font-mono text-inkdeep">#{c.patient.chartNo}</span>
                <span className="text-inkdeep">{c.patient.alias || c.patient.features}</span>
                <span className="text-[13.5px] text-ink/60">{c.reason}</span>
                <button type="button" onClick={() => void put({ patientId: c.patient.id })} className={`text-[14px] font-semibold text-[#0f5132] ${LINK}`}>Link · 연결</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (chartNo.trim()) void put({ chartNo, alias });
        }}
      >
        <label className="block text-[13px] text-ink/70">
          {link.pendingChartNo ? "New patient · 새 환자 차트번호" : "Chart No · 차트번호로 연결"}
          <input value={chartNo} onChange={(e) => setChartNo(e.target.value)} placeholder="20431" className="bbip-line mt-1 w-40 font-mono text-[15px]" />
        </label>
        <label className="block text-[13px] text-ink/70">
          Alias · 별칭 (선택)
          <input value={alias} onChange={(e) => setAlias(e.target.value)} className="bbip-line mt-1 w-48 text-[15px]" />
        </label>
        <button type="submit" className={`pb-1 text-[14.5px] font-semibold ${LINK}`}>
          {link.pendingChartNo ? `Register #${link.pendingChartNo} · 등록` : "Link · 연결"}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-[14px] text-red-800">{error}</p>}
    </div>
  );
}
