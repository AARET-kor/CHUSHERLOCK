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
      if (res.ok) onSaved(data.entryId);
      else if (res.status === 409 && data.entryId) onSaved(data.entryId);
      else setError(data.error ?? "저장에 실패했습니다.");
    } catch {
      setError("네트워크 오류로 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="promote-title"
      onClose={onClose}
      className="card m-auto w-[calc(100%-2rem)] max-w-md bg-white p-6 backdrop:bg-black/30"
    >
      <div>
        <h2 id="promote-title" className="mb-1 text-base font-bold text-ink">
          노트로 저장
        </h2>
        <p className="mb-4 text-xs text-ink/60">
          초안(draft)으로 저장되고 “검토 필요”로 표시됩니다. 검토 전에는 BBIP가 이 노트를 🤖AI 보충으로
          취급합니다.
        </p>

        {!loaded && !error && <p className="text-sm text-ink/60">불러오는 중…</p>}
        {loaded && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-ink">
              제목
              <input ref={titleRef} className="field mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-ink">
              카테고리
              <select
                className="field mt-1"
                value={categoryKey}
                onChange={(e) => setCategoryKey(e.target.value)}
              >
                {leafCategories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.labelKo}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-ink">
              분류
              <select
                className="field mt-1"
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
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary !px-4 !py-2" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn-primary !px-5 !py-2"
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
