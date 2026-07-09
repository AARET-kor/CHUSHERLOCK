"use client";

import { useEffect, useRef, useState } from "react";
import type { CategoryDef } from "../lib/codex/types";
import type { SuggestedEntry } from "../lib/ai/schemas";
import { SuggestionCard } from "./SuggestionCard";

const SOURCE_TYPES = [
  "paper",
  "textbook",
  "book",
  "course",
  "manufacturer_guideline",
  "personal_note",
  "website",
  "other",
] as const;

interface JobView {
  id: string;
  sourceLabel: string;
  sourceCitation: string;
  sourceType: string;
  sourceUrl: string | null;
  status: "pending" | "extracting" | "processing" | "completed" | "failed";
  totalChunks: number;
  processedChunks: number;
  suggestions: SuggestedEntry[] | null;
  error: string | null;
}

export function IngestClient({ leafCategories }: { leafCategories: CategoryDef[] }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [citation, setCitation] = useState("");
  const [sourceType, setSourceType] = useState<(typeof SOURCE_TYPES)[number]>("paper");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobView | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const response = await fetch(`/api/ingest/${jobId}`);
      if (!response.ok) return;
      const data = await response.json();
      setJob(data.job);
      if (data.job.status === "completed" || data.job.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 2000);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setJob(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      if (file) formData.append("file", file);
      formData.append("text", text);
      formData.append("sourceCitation", citation);
      formData.append("sourceType", sourceType);
      formData.append("sourceUrl", sourceUrl);

      const response = await fetch("/api/ingest", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "요청에 실패했습니다.");
        return;
      }
      startPolling(data.jobId);
      setJob({
        id: data.jobId,
        sourceLabel: file?.name ?? "붙여넣은 텍스트",
        sourceCitation: citation,
        sourceType,
        sourceUrl: sourceUrl || null,
        status: "pending",
        totalChunks: 0,
        processedChunks: 0,
        suggestions: null,
        error: null,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const inProgress =
    job && (job.status === "pending" || job.status === "extracting" || job.status === "processing");

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            파일 업로드 (PDF / DOCX / TXT / MD / 사진) — 스캔본 PDF와 책 페이지 사진은 자동 OCR
          </label>
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md,.markdown,.jpg,.jpeg,.png,.webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink/60 file:mr-3 file:rounded file:border-0 file:bg-mist file:px-3 file:py-2 file:text-ink"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            또는 텍스트 붙여넣기 {file && <span className="text-ink/50">(파일이 우선됩니다)</span>}
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="field font-mono"
            placeholder="논문 초록, 교과서 챕터, 파라미터 시트, 노하우 메모 등 원문을 그대로 붙여넣으세요."
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">출처 (Citation) — 필수</label>
            <input
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              className="field"
              placeholder="예: DeLorenzi C. Complications of injectable fillers. Aesthet Surg J. 2017"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">자료 종류</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as typeof sourceType)}
              className="field"
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">URL (선택)</label>
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="field"
            placeholder="https://..."
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting || Boolean(inProgress)}
          className="btn-primary"
        >
          {isSubmitting ? "업로드 중..." : "AI로 읽고 분류하기"}
        </button>
      </form>

      {inProgress && (
        <div className="card animate-pop-in p-5">
          <div className="flex items-center gap-3">
            <span className="dot-pulse flex items-center gap-1">
              <span />
              <span />
              <span />
            </span>
            <p className="text-sm font-medium">
              {job.status === "pending"
                ? "준비 중..."
                : job.status === "extracting"
                  ? "텍스트 추출 중... (스캔본/사진이면 OCR — 수 분 걸릴 수 있습니다)"
                  : `문서를 순서대로 읽는 중... (${job.processedChunks}/${job.totalChunks} 구간)`}
            </p>
          </div>
          {job.totalChunks > 0 && (
            <>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-mist">
                <div
                  className="progress-shimmer h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.max(4, (job.processedChunks / job.totalChunks) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-ink/50">
                문서 흐름을 따라 읽으며 맥락을 유지합니다. 큰 문서는 몇 분 걸릴 수 있습니다 — 이
                페이지를 열어두세요.
              </p>
            </>
          )}
        </div>
      )}

      {job?.status === "failed" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          처리 실패: {job.error}
        </div>
      )}

      {job?.status === "completed" && job.suggestions && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-inkdeep">
              정리 제안 {job.suggestions.length}건 — 확인 후 저장하세요
            </h2>
            <p className="text-sm text-ink/60">
              각 카드는 수정할 수 있습니다. 저장 시 같은 카테고리의 비슷한 기존 노트와 자동으로
              연결됩니다. 출처는 &quot;{job.sourceCitation}&quot;로 기록됩니다.
            </p>
          </div>
          {job.suggestions.map((suggestion, index) => (
            <div
              key={`${job.id}-${index}`}
              className="animate-fade-in-up"
              style={{ animationDelay: `${Math.min(index, 8) * 0.08}s` }}
            >
              <SuggestionCard
                suggestion={suggestion}
                leafCategories={leafCategories}
                source={{
                  citation: job.sourceCitation,
                  type: job.sourceType,
                  url: job.sourceUrl,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
