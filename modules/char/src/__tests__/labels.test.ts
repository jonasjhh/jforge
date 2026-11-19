import { describe, expect, it } from "vitest";
import { content } from "@jforge/melee/shared";
import { PORTRAIT_OPTIONS, ROW_OPTIONS } from "../labels";

describe("PORTRAIT_OPTIONS", () => {
  it("offers every melee class and monster icon once, by name", () => {
    const defs = [...content.playerTypes, ...content.monsters];
    expect(PORTRAIT_OPTIONS).toEqual(defs.map((d) => [d.id, d.name]));
    expect(new Set(PORTRAIT_OPTIONS.map(([id]) => id)).size).toBe(defs.length);
  });
});

describe("ROW_OPTIONS", () => {
  it("names the three rows by their index", () => {
    expect(ROW_OPTIONS.map(([row]) => row)).toEqual(["0", "1", "2"]);
  });
});
