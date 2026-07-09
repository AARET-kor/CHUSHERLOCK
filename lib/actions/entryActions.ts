"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as entryService from "../services/entryService";
import type { OverlapCandidate } from "../codex/overlap";

export async function previewOverlapsAction(
  title: string,
  categoryKey: string
): Promise<Array<OverlapCandidate & { similarity: number }>> {
  if (!title.trim() || !categoryKey) return [];
  return entryService.previewOverlaps(title, categoryKey);
}

export async function deleteEntryAction(id: string): Promise<void> {
  await entryService.deleteEntry(id);
  revalidatePath("/");
  redirect("/");
}
