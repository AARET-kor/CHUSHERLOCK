"use client";

import { useEffect, useRef, useState } from "react";
import type { PromoteDefaults } from "../../lib/bbip/promote";
import type { CategoryDef, ContentTier } from "../../lib/codex/types";
import { CONTENT_TIERS } from "../../lib/codex/tiers";

export function PromoteDialog({
  turnId,
  leafCategories,
  onClose,
  onSaved,
}: {
  turnId: string;
  leafCategories: CategoryDef[];
  onClose: () => void;
  onSaved: (entryId: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [categoryKey, setCategoryKey] = useState("");
  const [tier, setTier] = useState<ContentTier>("procedure_tip");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Native modal dialog: top layer, focus trap; Escape fires "close".
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (loaded) titleRef.current?.focus();
  }, [loaded]);

  useEffect(() => {
    fetch(`/api/bbip/turns/${turnId}/promote`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const defaults = (await res.json()) as PromoteDefaults;
        setTitle(defaults.title);
        setCategoryKey(
          leafCategories.some((c) => c.key === defaults.categoryKey)
            ? defaults.categoryKey
            : (leafCategories[0]?.key ?? defaults.categoryKey)
        );
        setTier(defaults.tier);
        setLoaded(true);
      })
      .catch(() => setError("기본값을 불러오지 못했습니다."));
  }, [turnId]);

  // Close through the element first so the browser returns focus to the
  // button that opened the dialog, then let the parent unmount it.
  function cancel() {
    if (dialogRef.current?.open) dialogRef.current.close();
    else onClose();
  }

  function finish(entryId: string) {
    dialogRef.current?.close();
    onSaved(entryId);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/bbip/turns/${turnId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, categoryKey, tier }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) finish(data.entryId);
      else if (res.status === 409 && data.entryId) finish(data.entryId);
      else setError(data.error ?? "저장에 실패했습니다.");
    } catch {
      setError("네트워크 오류로 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const fieldLabel = "block text-[11.5px] font-medium text-ink/65";
  const field = "bbip-line mt-1.5 pb-1.5 text-[15px] text-ink";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="promote-title"
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[20px] bg-white p-0 shadow-[0_30px_80px_rgba(5,26,36,0.22)] backdrop:bg-inkdeep/30 backdrop:backdrop-blur-[2px]"
    >
      <div className="px-7 pb-6 pt-7">
        <h2 id="promote-title" className="font-serifa text-[22px] font-bold text-inkdeep">
          노트로 저장
        </h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink/60">
          초안으로 저장되어 “검토 필요”로 표시됩니다. 검토 전까지 BBIP는 이 노트를{" "}
          <span className="italic text-[#8a5a00]">AI</span> 보충으로 취급합니다.
        </p>

        {!loaded && !error && <p className="mt-6 text-[13px] text-ink/65">불러오는 중…</p>}
        {loaded && (
          <div className="mt-6 space-y-5">
            <label className={fieldLabel}>
              제목
              <input ref={titleRef} className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className={fieldLabel}>
              카테고리
              <select className={field} value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)}>
                {leafCategories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.labelKo}
                  </option>
                ))}
              </select>
            </label>
            <label className={fieldLabel}>
              분류
              <select
                className={field}
                value={tier}
                onChange={(e) => setTier(e.target.value as ContentTier)}
              >
                {CONTENT_TIERS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.labelKo}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-red-800">
            {error}
          </p>
        )}

        <div className="mt-8 flex items-center justify-end gap-5">
          <button type="button" className="text-[13px] text-ink/60 transition hover:text-ink" onClick={cancel}>
            취소
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-full bg-ink px-6 text-[13px] font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(5,26,36,0.22)] disabled:translate-y-0 disabled:bg-ink/25 disabled:shadow-none"
            disabled={!loaded || saving || title.trim().length < 2}
            onClick={() => void save()}
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
