// components/bbip/care/CareTable.tsx
"use client";

import { useState } from "react";
import { CARE_FIELDS, KIND_LABEL, newCareItem, PRIMARY_FIELD } from "../../../lib/bbip/care/fields";
import { orderLine } from "../../../lib/bbip/care/format";
import { canConfirm, itemIssues } from "../../../lib/bbip/care/lint";
import type { CareItem, CareKind } from "../../../lib/bbip/care/types";

const LINK = "underline decoration-ink/20 underline-offset-4 transition hover:decoration-ink";

function SourceMark({ item }: { item: CareItem }) {
  switch (item.source) {
    case "set":
      return <span className="text-[12.5px] font-medium text-[#0f5132]">내 세트</span>;
    case "doctor":
      return <span className="text-[12.5px] text-ink/65">직접 입력</span>;
    case "note":
      return <span className="font-mono text-[12.5px] text-[#0f5132]">노트 {item.cite}</span>;
    case "literature":
      return <span className="font-mono text-[12.5px] text-[#1d4e89]">{item.cite}</span>;
    default:
      return <span className="text-[12.5px] font-medium italic text-[#8a5a00]">AI</span>;
  }
}

function isBlank(item: CareItem): boolean {
  return Object.values(item.fields).every((value) => !value.trim()) && !item.patientText.trim();
}

function CareRow({
  item,
  context,
  onChange,
  onDelete,
}: {
  item: CareItem;
  context: string;
  onChange: (item: CareItem) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(() => isBlank(item));
  const [draft, setDraft] = useState(item);
  const issues = itemIssues(item, context);
  const label = item.fields[PRIMARY_FIELD[item.kind]] || KIND_LABEL[item.kind];

  if (editing) {
    const setField = (key: string, value: string) => setDraft({ ...draft, fields: { ...draft.fields, [key]: value } });
    return (
      <li className="border-b border-ink/[0.08] py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {CARE_FIELDS[item.kind].map((field) => (
            <label key={field.key} className="block text-[13px] text-ink/70">
              {field.label}
              {field.required ? " *" : ""}
              {field.options ? (
                <select
                  value={draft.fields[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="mt-1 block w-full border-b border-ink/20 bg-transparent py-1 text-[15px] text-ink"
                >
                  <option value="">선택</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={draft.fields[field.key] ?? ""}
                  placeholder={field.hint}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="bbip-line mt-1 text-[15px] text-ink"
                />
              )}
            </label>
          ))}
          <label className="block text-[13px] text-ink/70 sm:col-span-2">
            환자 안내 문장 (숫자 없이)
            <textarea
              value={draft.patientText}
              rows={2}
              onChange={(e) => setDraft({ ...draft, patientText: e.target.value })}
              className="mt-1 block w-full border border-ink/15 bg-transparent p-2 text-[15px] text-ink"
            />
          </label>
        </div>
        <div className="mt-3 flex gap-5 text-[14px]">
          <button
            type="button"
            onClick={() => {
              // Any edit needs a fresh confirmation.
              onChange({ ...draft, confirmed: false });
              setEditing(false);
            }}
            className={`font-semibold text-ink ${LINK}`}
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => {
              if (isBlank(item)) onDelete();
              setDraft(item);
              setEditing(false);
            }}
            className={`text-ink/70 ${LINK}`}
          >
            취소
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className={`flex gap-3 border-b border-ink/[0.08] py-3 ${item.removed ? "opacity-70" : ""}`}>
      <input
        type="checkbox"
        aria-label={`${label} 확인`}
        checked={item.confirmed}
        disabled={Boolean(item.removed) || !canConfirm(item, context)}
        onChange={(e) => onChange({ ...item, confirmed: e.target.checked })}
        className="mt-1.5 h-4 w-4 shrink-0 accent-[#0f5132]"
      />
      <div className="min-w-0 flex-1">
        <p className={`text-[15.5px] leading-relaxed text-ink ${item.removed ? "line-through" : ""}`}>{orderLine(item)}</p>
        {item.patientText && <p className="mt-0.5 text-[13.5px] text-ink/65">환자: {item.patientText}</p>}
        {item.removed && (
          <p className="mt-1 text-[13.5px] text-amber-900">이 케이스에서는 빼자는 제안 — {item.removed.reason}</p>
        )}
        {!item.removed && issues.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {issues.map((issue) => (
              <li key={issue.text} className={`text-[13.5px] ${issue.level === "error" ? "text-red-800" : "text-amber-900"}`}>
                {issue.text}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-[13.5px]">
        <SourceMark item={item} />
        {item.removed ? (
          <button
            type="button"
            onClick={() => onChange({ ...item, removed: undefined, confirmed: false })}
            className={`text-ink/70 ${LINK}`}
          >
            되살리기
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setDraft(item);
                setEditing(true);
              }}
              className={`text-ink/70 ${LINK}`}
            >
              수정
            </button>
            <button type="button" onClick={onDelete} className={`text-ink/70 ${LINK} hover:text-red-800`}>
              삭제
            </button>
          </>
        )}
      </div>
    </li>
  );
}

/** One kind's rows of the order (all rows are passed so edits return the whole list). */
export function CareTable({
  kind,
  items,
  context,
  onChange,
}: {
  kind: CareKind;
  items: CareItem[];
  context: string;
  onChange: (items: CareItem[]) => void;
}) {
  const rows = items.filter((item) => item.kind === kind);
  return (
    <div>
      <h3 className="mb-1 text-[13px] font-medium text-ink/65">{KIND_LABEL[kind]}</h3>
      {rows.length === 0 && <p className="border-b border-ink/[0.08] py-3 text-[14px] text-ink/65">없음</p>}
      <ul>
        {rows.map((item) => (
          <CareRow
            key={item.id}
            item={item}
            context={context}
            onChange={(next) => onChange(items.map((row) => (row.id === next.id ? next : row)))}
            onDelete={() => onChange(items.filter((row) => row.id !== item.id))}
          />
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...items, newCareItem(kind)])}
        className={`mt-2 text-[13.5px] font-medium text-ink ${LINK}`}
      >
        ＋ {KIND_LABEL[kind]} 행 추가
      </button>
    </div>
  );
}
