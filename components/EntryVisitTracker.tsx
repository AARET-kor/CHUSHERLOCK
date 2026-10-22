"use client";
import { useEffect } from "react";
import { readKnowledgePrefs, writeKnowledgePrefs } from "../lib/knowledge/preferences";
export function EntryVisitTracker({ id }: { id: string }) {
  useEffect(() => {
    const prefs = readKnowledgePrefs();
    writeKnowledgePrefs({ ...prefs, recent: [id, ...prefs.recent.filter(v => v !== id)].slice(0, 50) });
  }, [id]);
  return null;
}
