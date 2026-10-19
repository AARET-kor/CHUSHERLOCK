import { getRegion, type RegionKey } from "./regions";

// "내 자료 그림": figures already cropped from the doctor's ingested
// material, attached to the session's notes, whose captions look anatomical.

export interface FigureCandidate {
  id: string;
  caption: string;
  kind: string;
  entryId: string;
  entryTitle: string;
}

export interface AnatomyFigure extends FigureCandidate {
  score: number;
}

const ANATOMY_WORDS =
  /동맥|정맥|신경|혈관|해부|인대|지방|근육|근막|골막|위험\s*구역|주입\s*(층|평면|깊이)|캐뉼라|artery|arter|vein|nerve|vessel|anatom|ligament|fat\s*pad|fat\s*compartment|muscle|fascia|smas|periost|plane|layer|danger|cannula|foramen/i;

/** 0 = not an anatomy figure. A region match counts double. */
export function anatomyFigureScore(caption: string, regions: RegionKey[]): number {
  const anatomy = ANATOMY_WORDS.test(caption) ? 1 : 0;
  if (!anatomy) return 0;
  const region = regions.some((key) => getRegion(key).keywords.test(caption)) ? 2 : 0;
  return anatomy + region;
}

export function pickAnatomyFigures(
  rows: FigureCandidate[],
  regions: RegionKey[],
  limit = 12
): AnatomyFigure[] {
  return rows
    .map((row) => ({ ...row, score: anatomyFigureScore(row.caption, regions) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
