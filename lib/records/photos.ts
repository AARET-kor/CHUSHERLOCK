// lib/records/photos.ts
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { PHOTOS_DIR } from "./files";
import { ANGLES, type Angle } from "./types";

export const MAX_PHOTO_MB = Number(process.env.CODEX_MAX_PHOTO_MB ?? 25);

export class PhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoError";
  }
}

const IMAGE = /^image\/(jpeg|png|webp|avif|heic|heif)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|avif|heic|heif)$/i;
const HEIC = (name: string, mime: string) => /heic|heif/i.test(mime) || /\.(heic|heif)$/i.test(name);

/** macOS ships `sips`, which reads HEIC; the bundled sharp does not. */
export async function heicToJpeg(input: Buffer): Promise<Buffer> {
  if (process.platform !== "darwin") throw new PhotoError("HEIC는 JPEG로 내보내서 올려 주세요.");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bbip-heic-"));
  try {
    const src = path.join(dir, "in.heic");
    const out = path.join(dir, "out.jpg");
    fs.writeFileSync(src, input);
    await promisify(execFile)("sips", ["-s", "format", "jpeg", src, "--out", out]);
    return fs.readFileSync(out);
  } catch {
    throw new PhotoError("HEIC 사진을 변환하지 못했습니다. JPEG로 올려 주세요.");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export interface ProcessedPhoto {
  file: string;
  thumb: string;
  width: number;
  height: number;
}

/** Re-encode to JPEG: orientation applied, every metadata block (EXIF, GPS,
 * XMP) dropped, long edge ≤ 2400; plus a ≤ 480 thumbnail. File names are
 * random — never a chart number. */
export async function processPhoto(
  input: Buffer,
  name: string,
  mime: string,
  deps: { heicToJpeg: (input: Buffer) => Promise<Buffer> } = { heicToJpeg }
): Promise<ProcessedPhoto> {
  if (input.length > MAX_PHOTO_MB * 1024 * 1024) throw new PhotoError(`사진은 장당 ${MAX_PHOTO_MB}MB까지 올릴 수 있습니다.`);
  if (!IMAGE.test(mime) && !IMAGE_EXT.test(name)) throw new PhotoError("사진 파일(JPEG·PNG·WebP·HEIC)만 올릴 수 있습니다.");
  const source = HEIC(name, mime) ? await deps.heicToJpeg(input) : input;
  const id = randomUUID();
  const file = `${id}.jpg`;
  const thumb = `${id}_t.jpg`;
  try {
    const full = await sharp(source, { failOn: "error" })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer({ resolveWithObject: true });
    const small = await sharp(full.data)
      .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
    fs.writeFileSync(path.join(PHOTOS_DIR, file), full.data);
    fs.writeFileSync(path.join(PHOTOS_DIR, thumb), small);
    return { file, thumb, width: full.info.width, height: full.info.height };
  } catch {
    throw new PhotoError("사진을 읽지 못했습니다. 다른 파일로 시도해 주세요.");
  }
}

/** Angles for `count` new photos: the previous visit's order first, then the
 * default order, skipping angles this visit already has. Extras repeat "close". */
export function guessAngles(count: number, previousOrder: Angle[], taken: Angle[]): Angle[] {
  const order = [...new Set([...previousOrder, ...ANGLES])].filter((a) => !taken.includes(a));
  return Array.from({ length: count }, (_, i) => order[i] ?? "close");
}
