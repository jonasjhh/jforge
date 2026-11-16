import { describe, expect, it } from "vitest";
import { starterLibrary } from "@jforge/char/shared";
import { content } from "@jforge/melee/shared";
import { encounterLabel, enemySummary, gearSummary } from "../labels";

const gear = (id: string) => starterLibrary().gear.find((g) => g.id === id)!;

describe("gearSummary", () => {
  it("lists what the gear adds and multiplies", () => {
    expect(gearSummary(gear("gear-sword"))).toBe("+6 attack");
    expect(gearSummary(gear("gear-mail"))).toBe("+8 defense, ×0.9 speed");
  });

  it("shows losses and gear that does nothing", () => {
    const cursed = {
      ...gear("gear-sword"),
      bonuses: [{ stat: "maxHp" as const, op: "add" as const, value: -5 }],
    };
    expect(gearSummary(cursed)).toBe("−5 HP");
    expect(gearSummary({ ...cursed, bonuses: [] })).toBe("no bonuses");
  });
});

describe("encounterLabel", () => {
  it("names each kind of stop", () => {
    const battle = { kind: "battle", difficulty: "easy", seed: 1 } as const;
    expect(encounterLabel({ ...battle, rank: "normal" })).toBe("Battle");
    expect(encounterLabel({ ...battle, rank: "elite" })).toBe("Elite battle");
    expect(encounterLabel({ ...battle, rank: "boss" })).toBe("Final battle");
    expect(encounterLabel({ kind: "gear", gearIds: ["x"] })).toBe("Gear");
    expect(encounterLabel({ kind: "training" })).toBe("Training");
    expect(encounterLabel({ kind: "fork", options: [] })).toBe(
      "Fork in the road",
    );
    expect(
      encounterLabel({
        kind: "ally",
        character: starterLibrary().characters[0]!,
      }),
    ).toBe("Ally");
  });
});

describe("enemySummary", () => {
  it("counts the enemies by name and leaves the party out", () => {
    const { slime, wolf, fighter } = content;
    const position = { col: 0, row: 0 };
    expect(
      enemySummary({
        placements: [
          { def: fighter, side: "player", position },
          { def: slime, side: "enemy", position },
          { def: wolf, side: "enemy", position },
          { def: slime, side: "enemy", position },
        ],
      }),
    ).toBe("2 × Slime, Wolf");
  });
});
