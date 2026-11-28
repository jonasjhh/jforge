import { describe, expect, it } from "vitest";
import { createBattle } from "@jforge/battle/engine/battle.ts";
import { effectiveStat } from "@jforge/battle/engine/stats.ts";
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

  it("given an add and a multiply on attack, when attack is taken, then the add comes first", () => {
    const unit = unitWith({
      modifiers: [
        { stat: "attack", op: "add", value: 5, source: "x" },
        { stat: "attack", op: "mul", value: 2, source: "y" },
      ],
    });

    const attack = effectiveStat(unit, "attack");

    expect(attack).toBe(30);
  });

  it("given a big minus on attack, when attack is taken, then it is 0", () => {
    const unit = unitWith({
      modifiers: [{ stat: "attack", op: "add", value: -50, source: "x" }],
    });

    const attack = effectiveStat(unit, "attack");

    expect(attack).toBe(0);
  });

  it("given a modifier on speed, when attack is taken, then it is unchanged", () => {
    const unit = unitWith({
      modifiers: [{ stat: "speed", op: "mul", value: 3, source: "x" }],
    });

    const attack = effectiveStat(unit, "attack");

    expect(attack).toBe(10);
  });
});
