"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CodexEntry, CategoryDef, ContentTier } from "../lib/codex/types";
import { CONTENT_TIERS } from "../lib/codex/tiers";
import { TierBadge } from "./TierBadge";

interface TreeNode {
  def: CategoryDef;
  children: TreeNode[];
  /** Notes filed directly under this key. */
  count: number;
  /** Notes under this key or any descendant. */
  totalCount: number;
}

function buildTree(taxonomy: CategoryDef[], counts: Map<string, number>): TreeNode[] {
  const byParent = new Map<string | undefined, CategoryDef[]>();
  for (const def of taxonomy) {
    const list = byParent.get(def.parentKey) ?? [];
    list.push(def);
    byParent.set(def.parentKey, list);
  }
  const build = (def: CategoryDef): TreeNode => {
    const children = (byParent.get(def.key) ?? []).map(build);
    const count = counts.get(def.key) ?? 0;
    const totalCount = count + children.reduce((sum, c) => sum + c.totalCount, 0);
    return { def, children, count, totalCount };
  };
  return (byParent.get(undefined) ?? []).map(build);
}

function descendantKeys(node: TreeNode): string[] {
  return [node.def.key, ...node.children.flatMap(descendantKeys)];
}

function findNode(nodes: TreeNode[], key: string): TreeNode | null {
  for (const node of nodes) {
    if (node.def.key === key) return node;
    const found = findNode(node.children, key);
    if (found) return found;
  }
  return null;
}

/** One quiet icon per top-level shelf — glanceability, not decoration. */
const FOLDER_ICONS: Record<string, string> = {
  "procedure-technique": "💉",
  complications: "🚨",
  anatomy: "🫀",
  "dermatology-basics": "🧬",
  "patient-communication": "🗣️",
  "safety-screening": "✅",
  "skin-type-classification": "🌗",
  "marketing-assets": "📸",
  "wellness-injection": "💧",
  "weight-management": "⚖️",
  "skincare-program": "🧖",
};

/** First cropped-figure URL inside a note, for the tile thumbnail. */
function firstFigureUrl(content: string): string | null {
  const match = content.match(/!\[[^\]]*\]\((\/api\/figures\/[0-9a-f-]+)\)/);
  return match?.[1] ?? null;
}

/** The bold one-line overview our prompt asks for, if the note has one. */
function overviewLine(content: string): string | null {
  const firstLine = content.split("\n").find((l) => l.trim());
  const match = firstLine?.trim().match(/^\*\*(.+)\*\*$/);
  return match?.[1] ?? null;
}

function plainPreview(content: string): string {
  return content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[#*>|`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function FolderRow({
  node,
  depth,
  expanded,
  toggle,
  select,
  selectedKey,
  dropTargetKey,
  setDropTargetKey,
  onDropNotes,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (key: string) => void;
  select: (key: string) => void;
  selectedKey: string;
  dropTargetKey: string | null;
  setDropTargetKey: (key: string | null) => void;
  onDropNotes: (categoryKey: string, e: React.DragEvent) => void;
}) {
  const isOpen = expanded.has(node.def.key);
  const isActive = selectedKey === node.def.key;
  const hasChildren = node.children.length > 0;
  const isLeaf = !hasChildren;
  const dim = node.totalCount === 0;
  const isDropTarget = dropTargetKey === node.def.key;

  return (
    <div>
      <div
        className={`group flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-all duration-150 ${
          isDropTarget
            ? "scale-[1.03] bg-emerald-600 text-white shadow-lg"
            : isActive
              ? "bg-ink text-white"
              : dim
                ? "text-ink/35 hover:bg-mist"
                : "text-ink/80 hover:bg-mist"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => {
          select(node.def.key);
          if (hasChildren && !isOpen) toggle(node.def.key);
        }}
        onDragOver={(e) => {
          if (!isLeaf) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropTargetKey(node.def.key);
        }}
        onDragLeave={() => {
          if (isDropTarget) setDropTargetKey(null);
        }}
        onDrop={(e) => {
          if (!isLeaf) return;
          e.preventDefault();
          setDropTargetKey(null);
          onDropNotes(node.def.key, e);
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggle(node.def.key);
            }}
            className={`inline-block w-4 shrink-0 text-center text-[10px] transition-transform duration-300 ${
              isOpen ? "rotate-90" : ""
            } ${isActive ? "text-white/70" : "text-ink/40"}`}
          >
            ▶
          </button>
        ) : (
          <span className={`inline-block w-4 shrink-0 text-center text-[10px] ${isActive ? "text-white/60" : "text-ink/30"}`}>
            ·
          </span>
        )}
        {depth === 0 && FOLDER_ICONS[node.def.key] && (
          <span className="shrink-0 text-[13px]">{FOLDER_ICONS[node.def.key]}</span>
        )}
        <span className="truncate">{node.def.labelKo}</span>
        {node.totalCount > 0 && (
          <span
            className={`ml-auto shrink-0 rounded-full px-1.5 text-[10px] tabular-nums ${
              isActive ? "bg-white/20 text-white" : "bg-mist text-ink/50 group-hover:bg-white"
            }`}
          >
            {node.totalCount}
          </span>
        )}
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {node.children.map((child) => (
            <FolderRow
              key={child.def.key}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              select={select}
              selectedKey={selectedKey}
              dropTargetKey={dropTargetKey}
              setDropTargetKey={setDropTargetKey}
              onDropNotes={onDropNotes}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function LibraryClient({
  entries,
  taxonomy,
}: {
  entries: CodexEntry[];
  taxonomy: CategoryDef[];
}) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTitle, setMergeTitle] = useState("");
  const [mergeTier, setMergeTier] = useState<ContentTier>("deep_study");
  const [mergeCategory, setMergeCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      map.set(entry.categoryKey, (map.get(entry.categoryKey) ?? 0) + 1);
    }
    return map;
  }, [entries]);

  const tree = useMemo(() => buildTree(taxonomy, counts), [taxonomy, counts]);

  const visibleEntries = useMemo(() => {
    if (selectedKey === "all") return entries;
    const node = findNode(tree, selectedKey);
    if (!node) return [];
    const keys = new Set(descendantKeys(node));
    return entries.filter((e) => keys.has(e.categoryKey));
  }, [entries, selectedKey, tree]);

  const parentByKey = useMemo(
    () => new Map(taxonomy.map((c) => [c.key, c.parentKey])),
    [taxonomy]
  );
  const labelByKey = useMemo(() => new Map(taxonomy.map((c) => [c.key, c.labelKo])), [taxonomy]);
  const taxOrder = useMemo(() => new Map(taxonomy.map((c, i) => [c.key, i])), [taxonomy]);

  /** Sections for the notes pane: 전체 보기 → 대분류별, 중간 폴더 → leaf별,
   * leaf 폴더 → 헤더 없는 단일 그룹. */
  const groups = useMemo(() => {
    const topAncestor = (key: string): string => {
      let current = key;
      while (parentByKey.get(current)) current = parentByKey.get(current)!;
      return current;
    };
    const node = selectedKey === "all" ? null : findNode(tree, selectedKey);
    const isLeafSelection = node ? node.children.length === 0 : false;
    if (isLeafSelection) {
      return [{ key: selectedKey, label: null as string | null, entries: visibleEntries }];
    }
    const keyFor = (e: CodexEntry) =>
      selectedKey === "all" ? topAncestor(e.categoryKey) : e.categoryKey;
    const map = new Map<string, CodexEntry[]>();
    for (const e of visibleEntries) {
      const k = keyFor(e);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries())
      .sort((a, b) => (taxOrder.get(a[0]) ?? 999) - (taxOrder.get(b[0]) ?? 999))
      .map(([k, list]) => ({
        key: k,
        label: labelByKey.get(k) ?? k,
        entries: list,
      }));
  }, [visibleEntries, selectedKey, tree, parentByKey, labelByKey, taxOrder]);

  const selectedEntries = entries.filter((e) => selection.has(e.id));
  const selectedLabel =
    selectedKey === "all" ? "전체 노트" : findNode(tree, selectedKey)?.def.labelKo ?? "";

  function toggleFolder(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openMerge() {
    const first = selectedEntries[0];
    if (!first) return;
    setMergeTitle(`${first.title} (통합)`);
    setMergeCategory(first.categoryKey);
    setMergeTier(first.tier);
    setError(null);
    setMergeOpen(true);
  }

  async function doMerge() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/entries/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryIds: selectedEntries.map((e) => e.id),
          title: mergeTitle,
          categoryKey: mergeCategory,
          tier: mergeTier,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "합치기에 실패했습니다.");
        return;
      }
      setMergeOpen(false);
      setSelection(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function moveNotes(categoryKey: string, e: React.DragEvent) {
    const raw = e.dataTransfer.getData("application/x-note-ids");
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    setBusy(true);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/entries/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ categoryKey }),
          })
        )
      );
      setSelection(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!confirm(`선택한 노트 ${selection.size}개를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    try {
      await Promise.all(
        Array.from(selection).map((id) => fetch(`/api/entries/${id}`, { method: "DELETE" }))
      );
      setSelection(new Set());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const leafCategories = taxonomy.filter(
    (c) => !taxonomy.some((other) => other.parentKey === c.key)
  );

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      {/* Folder tree */}
      <aside className="card h-fit p-3 md:sticky md:top-24">
        <div
          className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
            selectedKey === "all" ? "bg-ink text-white" : "text-ink/80 hover:bg-mist"
          }`}
          onClick={() => setSelectedKey("all")}
        >
          <span className="inline-block w-4 text-center text-[10px]">◈</span>
          <span>전체 노트</span>
          <span
            className={`ml-auto rounded-full px-1.5 text-[10px] tabular-nums ${
              selectedKey === "all" ? "bg-white/20 text-white" : "bg-mist text-ink/50"
            }`}
          >
            {entries.length}
          </span>
        </div>
        <div className="my-2 border-t border-ink/5" />
        {tree.map((node) => (
          <FolderRow
            key={node.def.key}
            node={node}
            depth={0}
            expanded={expanded}
            toggle={toggleFolder}
            select={setSelectedKey}
            selectedKey={selectedKey}
            dropTargetKey={dropTargetKey}
            setDropTargetKey={setDropTargetKey}
            onDropNotes={moveNotes}
          />
        ))}
      </aside>

      {/* Notes in the selected folder */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-serifa text-lg font-bold text-inkdeep">{selectedLabel}</h2>
          <span className="text-xs text-ink/40">{visibleEntries.length}개</span>
        </div>

        {visibleEntries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink/15 bg-mist/50 p-10 text-center text-sm text-ink/40">
            이 폴더에는 아직 노트가 없습니다.
          </p>
        ) : (
          <div key={selectedKey} className="space-y-8">
            {groups.map((group, groupIndex) => (
              <div
                key={group.key}
                className="animate-fade-in-up"
                style={{ animationDelay: `${Math.min(groupIndex, 6) * 0.07}s` }}
              >
                {group.label && (
                  <div className="mb-2.5 flex items-baseline gap-2 border-b border-ink/5 pb-1.5">
                    {FOLDER_ICONS[group.key] && (
                      <span className="text-sm">{FOLDER_ICONS[group.key]}</span>
                    )}
                    <h3 className="text-sm font-semibold text-inkdeep">{group.label}</h3>
                    <span className="text-[11px] tabular-nums text-ink/35">
                      {group.entries.length}
                    </span>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
            {group.entries.map((entry, index) => {
              const checked = selection.has(entry.id);
              return (
                <div
                  key={entry.id}
                  draggable
                  onDragStart={(e) => {
                    const ids = checked && selection.size > 0 ? Array.from(selection) : [entry.id];
                    e.dataTransfer.setData("application/x-note-ids", JSON.stringify(ids));
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingId(entry.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDropTargetKey(null);
                  }}
                  className={`animate-fade-in-up relative cursor-grab active:cursor-grabbing ${
                    draggingId === entry.id ? "opacity-40" : ""
                  }`}
                  style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSelect(entry.id)}
                    className={`absolute right-4 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border text-xs transition-all duration-200 ${
                      checked
                        ? "scale-110 border-ink bg-ink text-white"
                        : "border-ink/20 bg-white text-transparent hover:border-ink/50"
                    }`}
                    title="선택"
                  >
                    ✓
                  </button>
                  <Link
                    href={`/entries/${entry.id}`}
                    className={`card card-lift block h-full overflow-hidden transition-all ${
                      checked ? "ring-2 ring-ink" : ""
                    }`}
                  >
                    {firstFigureUrl(entry.content) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={firstFigureUrl(entry.content)!}
                        alt=""
                        className="h-24 w-full border-b border-ink/5 object-cover"
                      />
                    )}
                    <div className="p-5 pr-12">
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <TierBadge tier={entry.tier} />
                        {entry.status === "draft" && (
                          <span className="rounded-full border border-ink/10 px-2 py-0.5 text-[10px] text-ink/40">
                            초안
                          </span>
                        )}
                      </div>
                      <h3 className="font-serifa text-[15px] font-bold leading-snug text-ink">
                        {entry.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink/55">
                        {overviewLine(entry.content) ?? plainPreview(entry.content)}
                      </p>
                      {entry.tags.length > 0 && (
                        <p className="mt-2 truncate text-[10px] text-ink/35">
                          {entry.tags.slice(0, 4).map((t) => `#${t}`).join("  ")}
                        </p>
                      )}
                    </div>
                  </Link>
                </div>
              );
            })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Selection action bar */}
      <div
        className={`fixed bottom-24 left-1/2 z-40 -translate-x-1/2 transition-all duration-300 ${
          selection.size > 0
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <div
          className="flex items-center gap-3 rounded-full bg-inkdeep py-2 pl-5 pr-2 text-white"
          style={{ boxShadow: "0 12px 40px rgba(5,26,36,0.35)" }}
        >
          <span className="text-sm">{selection.size}개 선택</span>
          <button
            type="button"
            onClick={openMerge}
            disabled={selection.size < 2 || busy}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-ink transition hover:scale-105 disabled:opacity-40"
          >
            합치기
          </button>
          <button
            type="button"
            onClick={doDelete}
            disabled={busy}
            className="rounded-full bg-red-500/90 px-4 py-1.5 text-sm font-medium text-white transition hover:scale-105 disabled:opacity-40"
          >
            삭제
          </button>
          <button
            type="button"
            onClick={() => setSelection(new Set())}
            className="rounded-full px-3 py-1.5 text-sm text-white/60 hover:text-white"
          >
            해제
          </button>
        </div>
      </div>

      {/* Merge modal */}
      {mergeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={() => !busy && setMergeOpen(false)}
        >
          <div
            className="animate-pop-in w-full max-w-lg rounded-[24px] bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serifa text-lg font-bold text-inkdeep">
              노트 {selectedEntries.length}개 합치기
            </h3>
            <p className="mt-1 text-xs text-ink/50">
              내용은 순서대로 이어 붙고, 출처·태그·관련노트·그림은 모두 유지됩니다. 원본 노트는
              삭제됩니다.
            </p>
            <ol className="mt-3 max-h-32 space-y-1 overflow-y-auto rounded-xl bg-mist/60 p-3 text-xs text-ink/70">
              {selectedEntries.map((e, i) => (
                <li key={e.id}>
                  {i + 1}. {e.title}
                </li>
              ))}
            </ol>
            <div className="mt-4 space-y-3">
              <input
                value={mergeTitle}
                onChange={(e) => setMergeTitle(e.target.value)}
                className="field"
                placeholder="합쳐진 노트 제목"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={mergeCategory}
                  onChange={(e) => setMergeCategory(e.target.value)}
                  className="field"
                >
                  {leafCategories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.labelKo} / {c.labelEn}
                    </option>
                  ))}
                </select>
                <select
                  value={mergeTier}
                  onChange={(e) => setMergeTier(e.target.value as ContentTier)}
                  className="field"
                >
                  {CONTENT_TIERS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.labelKo}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMergeOpen(false)}
                disabled={busy}
                className="btn-secondary !px-4 !py-2"
              >
                취소
              </button>
              <button
                type="button"
                onClick={doMerge}
                disabled={busy}
                className="btn-primary !px-4 !py-2"
              >
                {busy ? "합치는 중..." : "합치기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
