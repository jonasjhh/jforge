import { describe, expect, it } from "vitest";
import { content } from "@jforge/melee/shared";
import { PORTRAIT_OPTIONS, ROW_OPTIONS } from "../labels";

describe("PORTRAIT_OPTIONS", () => {
  it("given melee's classes and monsters, when the icon options are listed, then each comes once, by name", () => {
    const defs = [...content.playerTypes, ...content.monsters];

    const ids = new Set(PORTRAIT_OPTIONS.map(([id]) => id));

    expect(PORTRAIT_OPTIONS).toEqual(defs.map((d) => [d.id, d.name]));
    expect(ids.size).toBe(defs.length);
  });
});

describe("ROW_OPTIONS", () => {
  it("given the three rows, when their options are listed, then they are named by index", () => {
    const rows = ROW_OPTIONS.map(([row]) => row);

    expect(rows).toEqual(["0", "1", "2"]);
  });
});
