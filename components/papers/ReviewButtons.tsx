// components/papers/ReviewButtons.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { REVIEW_LABEL } from "../../lib/papers/labels";
import type { ReviewStatus } from "../../lib/papers/types";

const OPTIONS: ReviewStatus[] = ["unreviewed", "reviewed", "excluded"];

export function ReviewButtons({ pmid, value }: { pmid: string; value: ReviewStatus }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function save(next: ReviewStatus) {
    setSaving(true);
    await fetch(`/api/papers/${pmid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewStatus: next }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div role="group" aria-label="검토 상태" className="flex gap-1 rounded-full bg-mist p-1 text-[14px]">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          disabled={saving}
          aria-pressed={value === option}
          onClick={() => void save(option)}
          className={`rounded-full px-3 py-1 ${value === option ? "bg-inkdeep text-white" : "text-ink hover:bg-white"}`}
        >
          {REVIEW_LABEL[option].en} <span className="text-[0.8em]">{REVIEW_LABEL[option].ko}</span>
        </button>
      ))}
    </div>
  );
}
