// lib/records/files.ts
import fs from "node:fs";
import path from "node:path";

/** Photos live only on this machine, outside public/; served through
 * /api/records/photos/[id] behind the access password. */
export const PHOTOS_DIR = process.env.CODEX_PHOTOS_DIR ?? "./data/photos";

export function photoPath(name: string): string {
  return path.join(PHOTOS_DIR, path.basename(name));
}

export function deletePhotoFiles(photo: { file: string; thumb: string }): void {
  for (const name of [photo.file, photo.thumb]) fs.rmSync(photoPath(name), { force: true });
}
