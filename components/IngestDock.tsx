"use client";

import { useEffect, useRef, useState } from "react";
import type { CategoryDef } from "../lib/codex/types";
import type { SuggestedEntry } from "../lib/ai/schemas";
import { SuggestionCard, type FigureMeta } from "./SuggestionCard";

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

const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.markdown,.jpg,.jpeg,.png,.webp";

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
  figures?: FigureMeta[];
  error: string | null;
}

/** The front-and-center intake surface: drop a file (or paste text), confirm
 * the citation, and the AI reads/classifies it right on the dashboard. */
export function IngestDock({ leafCategories }: { leafCategories: CategoryDef[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [citation, setCitation] = useState("");
  const [sourceType, setSourceType] = useState<(typeof SOURCE_TYPES)[number]>("paper");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobView | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function pickFile(picked: File | null) {
    setFile(picked);
    if (picked && !citation.trim()) {
      setCitation(picked.name.replace(/\.[^.]+$/, ""));
    }
  }

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

  async function submit() {
    if (!file && !text.trim()) {
      setError("파일을 떨어뜨리거나 텍스트를 붙여넣어 주세요.");
      return;
    }
    if (!citation.trim()) {
      setError("출처(citation)를 입력해 주세요.");
      return;
    }
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
  const ready = Boolean(file) || text.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="card p-4 md:p-6">
        {/* Drop zone */}
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            dragDepth.current += 1;
            setIsDragging(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => {
            dragDepth.current -= 1;
            if (dragDepth.current <= 0) setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragDepth.current = 0;
            setIsDragging(false);
            pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`group cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-300 ${
            isDragging
              ? "scale-[1.01] border-ink bg-mist shadow-[0_12px_40px_rgba(5,26,36,0.15)]"
              : "border-ink/15 bg-white hover:border-ink/40 hover:bg-mist/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="animate-pop-in">
              <p className="font-medium text-inkdeep">{file.name}</p>
              <p className="mt-1 text-xs text-ink/50">
                {(file.size / 1024 / 1024).toFixed(1)}MB — 다른 파일을 떨어뜨리면 교체됩니다
              </p>
            </div>
          ) : (
            <>
              <p
                className={`text-base font-medium transition-transform duration-300 md:text-lg ${
                  isDragging ? "scale-105 text-inkdeep" : "text-ink/80"
                }`}
              >
                {isDragging ? "여기에 놓으세요" : "자료를 여기로 드래그"}
                {!isDragging && <span className="text-ink/40"> — 또는 클릭해서 선택</span>}
              </p>
              <p className="mt-2 text-xs tracking-wide text-ink/40">
                PDF · DOCX · PPTX · TXT · 사진 — 스캔본은 OCR, 그림·표·그래프는 원본 그대로 크롭
              </p>
            </>
          )}
        </div>

        {/* Paste toggle */}
        <button
          type="button"
          onClick={() => setShowPaste(!showPaste)}
          className="mt-3 text-xs text-ink/50 underline-offset-4 hover:text-ink hover:underline"
        >
          {showPaste ? "붙여넣기 닫기" : "파일 대신 텍스트 붙여넣기"}
        </button>
        {showPaste && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="field mt-2 font-mono animate-fade-in-up"
            style={{ animationDuration: "0.4s" }}
            placeholder="논문 초록, 파라미터 시트, 노하우 메모 등 원문을 그대로."
          />
        )}

        {/* Meta + submit — appears once material is ready */}
        {ready && (
          <div className="mt-4 grid gap-3 animate-fade-in-up sm:grid-cols-[1fr_auto_auto]" style={{ animationDuration: "0.4s" }}>
            <input
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              className="field"
              placeholder="출처 (필수) — 예: DeLorenzi 2017, Aesthet Surg J"
            />
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as typeof sourceType)}
              className="field sm:w-40"
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={submit}
              disabled={isSubmitting || Boolean(inProgress)}
              className="btn-primary whitespace-nowrap"
            >
              {isSubmitting ? "업로드 중..." : "AI로 읽고 분류"}
            </button>
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="field sm:col-span-3"
              placeholder="URL (선택)"
            />
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

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
                  ? "텍스트·그림 추출 중... (스캔본 OCR·figure crop — 수 분 걸릴 수 있습니다)"
                  : `문서를 순서대로 읽는 중... (${job.processedChunks}/${job.totalChunks} 구간)`}
            </p>
          </div>
          {job.totalChunks > 0 && (
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-mist">
              <div
                className="progress-shimmer h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${Math.max(4, (job.processedChunks / job.totalChunks) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {job?.status === "failed" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          처리 실패: {job.error}
        </div>
      )}

      {job?.status === "completed" && job.suggestions && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-inkdeep">
              정리 제안 <span className="font-serifa">{job.suggestions.length}건</span> — 확인 후
              저장하세요
            </h2>
            <p className="text-sm text-ink/60">
              수정 가능합니다. 저장 시 겹치는 기존 노트와 자동 연결되고, 잘라낸 그림·표는 노트에
              삽입됩니다. 출처: &quot;{job.sourceCitation}&quot;
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
                figures={job.figures ?? []}
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
