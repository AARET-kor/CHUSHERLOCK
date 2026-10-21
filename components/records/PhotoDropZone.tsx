// components/records/PhotoDropZone.tsx
"use client";

import { useRef, useState } from "react";
import type { Photo } from "../../lib/records/types";

interface Upload {
  key: string;
  name: string;
  state: "uploading" | "failed";
  message?: string;
  file: File;
}

/** Wraps any area: dropping image files on it uploads them to `visitId` at
 * once. A small "+ 사진" button opens the file picker for the same path.
 * Failed files stay listed with a retry. */
export function PhotoDropZone({
  visitId,
  onUploaded,
  children,
  className = "",
}: {
  visitId: string;
  onUploaded: (photos: Photo[]) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [over, setOver] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  async function send(files: File[]) {
    if (files.length === 0) return;
    const batch = files.map((file) => ({ key: crypto.randomUUID(), name: file.name, state: "uploading" as const, file }));
    setUploads((u) => [...u.filter((x) => !batch.some((b) => b.name === x.name)), ...batch]);
    const form = new FormData();
    for (const file of files) form.append("files", file);
    try {
      const res = await fetch(`/api/records/visits/${visitId}/photos`, { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { photos?: Photo[]; errors?: Array<{ name: string; message: string }>; error?: string };
      if (data.photos?.length) onUploaded(data.photos);
      const failed = new Map((data.errors ?? []).map((e) => [e.name, e.message]));
      setUploads((u) =>
        u.flatMap((x) => {
          if (!batch.some((b) => b.key === x.key)) return [x];
          const message = failed.get(x.name) ?? (res.ok ? undefined : (data.error ?? "올리지 못했습니다."));
          return message ? [{ ...x, state: "failed" as const, message }] : [];
        })
      );
    } catch {
      setUploads((u) => u.map((x) => (batch.some((b) => b.key === x.key) ? { ...x, state: "failed", message: "네트워크 오류" } : x)));
    }
  }

  return (
    <div
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        void send(Array.from(e.dataTransfer.files));
      }}
      className={`relative rounded-[6px] transition ${over ? "outline outline-2 outline-dashed outline-[#0f5132] bg-[#0f5132]/[0.04]" : ""} ${className}`}
    >
      {children}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px]">
        <button type="button" onClick={() => input.current?.click()} className="text-ink/70 underline decoration-ink/25 underline-offset-4 hover:text-ink">
          + Photos · 사진 추가
        </button>
        <span className="text-ink/60">{over ? "놓으면 바로 붙습니다" : "사진을 여기로 끌어다 놓아도 됩니다"}</span>
        <input
          ref={input}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="sr-only"
          aria-label="사진 파일 고르기"
          onChange={(e) => {
            void send(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {uploads.length > 0 && (
        <ul role="status" className="mt-2 space-y-1 text-[13px]">
          {uploads.map((u) => (
            <li key={u.key} className={u.state === "failed" ? "text-red-800" : "text-ink/65"}>
              {u.name} — {u.state === "uploading" ? "올리는 중…" : u.message}
              {u.state === "failed" && (
                <button type="button" onClick={() => void send([u.file])} className="ml-2 underline underline-offset-4">
                  다시 시도
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
