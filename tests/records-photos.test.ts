// tests/records-photos.test.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;
let photos: typeof import("../lib/records/photos");

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "records-photos-"));
  process.env.CODEX_PHOTOS_DIR = dir;
  photos = await import("../lib/records/photos");
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const jpeg = (width: number, height: number, orientation = 1) =>
  sharp({ create: { width, height, channels: 3, background: "#c08080" } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "chart 20431" } })
    .withMetadata({ orientation })
    .toBuffer();

describe("processPhoto", () => {
  it("re-encodes, strips metadata, caps size and writes a thumbnail", async () => {
    const out = await photos.processPhoto(await jpeg(3000, 2000), "a.jpg", "image/jpeg");
    expect(out).toMatchObject({ width: 2400, height: 1600 });
    const full = await sharp(path.join(dir, out.file)).metadata();
    expect(full.exif).toBeUndefined();
    expect(full.format).toBe("jpeg");
    const thumb = await sharp(path.join(dir, out.thumb)).metadata();
    expect(Math.max(thumb.width!, thumb.height!)).toBe(480);
    expect(out.file).not.toContain("20431");
  });

  it("applies EXIF orientation before stripping it", async () => {
    const out = await photos.processPhoto(await jpeg(300, 200, 6), "r.jpg", "image/jpeg");
    expect(out).toMatchObject({ width: 200, height: 300 });
  });

  it("routes HEIC through the converter and rejects other files", async () => {
    const converted = await jpeg(400, 300);
    const out = await photos.processPhoto(Buffer.from("heic"), "x.HEIC", "image/heic", {
      heicToJpeg: async () => converted,
    });
    expect(out.width).toBe(400);
    await expect(photos.processPhoto(Buffer.from("%PDF"), "x.pdf", "application/pdf")).rejects.toThrow(photos.PhotoError);
    await expect(photos.processPhoto(Buffer.from("not an image"), "x.jpg", "image/jpeg")).rejects.toThrow(photos.PhotoError);
  });
});

describe("guessAngles", () => {
  it("follows the previous visit's order, skipping taken angles", () => {
    expect(photos.guessAngles(3, [], [])).toEqual(["front", "left45", "right45"]);
    expect(photos.guessAngles(2, ["front", "close"], [])).toEqual(["front", "close"]);
    expect(photos.guessAngles(2, ["front", "close"], ["front"])).toEqual(["close", "left45"]);
    expect(photos.guessAngles(8, [], [])).toHaveLength(8);
  });
});
