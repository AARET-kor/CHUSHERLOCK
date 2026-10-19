import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import { entries, figures } from "../../db/schema";
import type { BbipSession } from "../types";
import { pickAnatomyFigures, type AnatomyFigure } from "./figures";
import { anatomyPlanFor } from "./regions";

/** Anatomy figures attached to the session's retrieved notes. */
export function listSessionAnatomyFigures(session: BbipSession): AnatomyFigure[] {
  const plan = anatomyPlanFor(session.chips);
  if (!plan || session.sourceNoteIds.length === 0) return [];
  const rows = db
    .select({
      id: figures.id,
      caption: figures.caption,
      kind: figures.kind,
      entryId: entries.id,
      entryTitle: entries.title,
    })
    .from(figures)
    .innerJoin(entries, eq(figures.entryId, entries.id))
    .where(inArray(figures.entryId, session.sourceNoteIds))
    .all();
  return pickAnatomyFigures(rows, plan.regions);
}
