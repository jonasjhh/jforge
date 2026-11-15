import { describe, expect, it } from "vitest";
import { createBattle } from "../battle";
import { effectiveStat } from "../stats";
import { def, place } from "./helpers";

describe("effectiveStat", () => {
  const unitWith = (modifiers: Parameters<typeof place>[4]) =>
    createBattle(
      {
        placements: [
          place(def("a", { attack: 10 }), "player", 0, 0, modifiers),
          place(def("b"), "enemy", 0),
        ],
      },
      1,
    ).units[0]!;

  it("adds before multiplying", () => {
    const unit = unitWith({
      modifiers: [
        { stat: "attack", op: "add", value: 5, source: "x" },
        { stat: "attack", op: "mul", value: 2, source: "y" },
      ],
    });
    expect(effectiveStat(unit, "attack")).toBe(30);
  });

  it("never goes below 0", () => {
    const unit = unitWith({
      modifiers: [{ stat: "attack", op: "add", value: -50, source: "x" }],
    });
    expect(effectiveStat(unit, "attack")).toBe(0);
  });

  it("ignores modifiers for other stats", () => {
    const unit = unitWith({
      modifiers: [{ stat: "speed", op: "mul", value: 3, source: "x" }],
    });
    expect(effectiveStat(unit, "attack")).toBe(10);
  });
});
