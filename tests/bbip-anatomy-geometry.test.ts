// tests/bbip-anatomy-geometry.test.ts
import { describe, expect, it } from "vitest";
import { mirrorShape, projectPoint, projectShape, smoothPath, viewOutline } from "../lib/bbip/anatomy/geometry";

describe("projectPoint", () => {
  it("is the identity in the front view", () => {
    expect(projectPoint([150, 200], "front")).toEqual([150, 200]);
  });

  it("moves the midline left and keeps lateral points visible in the oblique view", () => {
    const [mx] = projectPoint([120, 150], "oblique")!;
    const [lx] = projectPoint([200, 150], "oblique")!;
    expect(mx).toBeLessThan(lx);
    expect(mx).toBeLessThan(120);
  });

  it("puts the nose tip in front of the cheek in the lateral view", () => {
    const [tip] = projectPoint([120, 176], "lateral")!;
    const [cheek] = projectPoint([170, 176], "lateral")!;
    expect(tip).toBeLessThan(cheek);
  });

  it("hides far-side points that rotate behind the head", () => {
    expect(projectPoint([60, 150], "lateral")).toBeNull();
  });
});

describe("shapes and paths", () => {
  it("mirrors across the midline", () => {
    expect(mirrorShape({ kind: "point", at: [150, 10] })).toEqual({ kind: "point", at: [90, 10] });
  });

  it("drops a projected line with fewer than two visible points", () => {
    expect(projectShape({ kind: "line", pts: [[60, 150], [62, 160]] }, "lateral")).toBeNull();
  });

  it("builds a smooth SVG path", () => {
    expect(smoothPath([[0, 0], [10, 0]], false)).toBe("M0,0 L10,0");
    const d = smoothPath([[0, 0], [10, 10], [20, 0]], true);
    expect(d.startsWith("M0,0 C")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("produces a closed outline for every view", () => {
    for (const view of ["front", "oblique", "lateral"] as const) {
      expect(viewOutline(view).length).toBeGreaterThan(20);
    }
  });
});
