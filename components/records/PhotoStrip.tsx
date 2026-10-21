// components/records/PhotoStrip.tsx
"use client";

import { ANGLE_LABEL, ANGLES, type Angle, type Photo } from "../../lib/records/types";

/** Thumbnails with a one-click angle picker and delete. */
export function PhotoStrip({
  photos,
  onChange,
  onRemove,
}: {
  photos: Photo[];
  onChange: (photo: Photo) => void;
  onRemove: (id: string) => void;
}) {
  async function setAngle(photo: Photo, angle: Angle) {
    const res = await fetch(`/api/records/photos/${photo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ angle }),
    });
    if (res.ok) onChange((await res.json()).photo);
  }

  async function remove(photo: Photo) {
    if (!window.confirm("이 사진을 지울까요? 되돌릴 수 없습니다.")) return;
    const res = await fetch(`/api/records/photos/${photo.id}`, { method: "DELETE" });
    if (res.ok) onRemove(photo.id);
  }

  if (photos.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-3">
      {photos.map((photo) => (
        <li key={photo.id} className="w-[132px]">
          <a href={`/api/records/photos/${photo.id}`} target="_blank" rel="noreferrer">
            <img
              src={`/api/records/photos/${photo.id}?size=thumb`}
              alt={`${ANGLE_LABEL[photo.angle].ko} 사진`}
              className="h-[132px] w-[132px] rounded-[4px] border border-ink/10 object-cover"
            />
          </a>
          <div className="mt-1 flex items-center justify-between gap-1">
            <select
              aria-label="사진 각도"
              value={photo.angle}
              onChange={(e) => void setAngle(photo, e.target.value as Angle)}
              className="min-w-0 flex-1 border-b border-ink/20 bg-transparent py-0.5 text-[12.5px] text-ink"
            >
              {ANGLES.map((a) => (
                <option key={a} value={a}>
                  {ANGLE_LABEL[a].en} · {ANGLE_LABEL[a].ko}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void remove(photo)} aria-label="사진 삭제" className="px-1 text-[13px] text-ink/60 hover:text-red-800">
              ×
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
