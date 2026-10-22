export const KNOWLEDGE_PREFS = "bbip-knowledge-preferences-v1";
export type KnowledgePrefs = { pinned: string[]; recent: string[] };
export function readKnowledgePrefs(): KnowledgePrefs {
  try {
    const value = JSON.parse(localStorage.getItem(KNOWLEDGE_PREFS) ?? "{}");
    const ids = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string"))].slice(0, 100) : [];
    return { pinned: ids(value.pinned), recent: ids(value.recent) };
  } catch { return { pinned: [], recent: [] }; }
}
export function writeKnowledgePrefs(value: KnowledgePrefs): boolean {
  try { localStorage.setItem(KNOWLEDGE_PREFS, JSON.stringify(value)); window.dispatchEvent(new Event("knowledge-prefs")); return true; }
  catch { return false; }
}
