import { describe, expect, it } from "vitest";
import { jrpgLibrary } from "@jforge/content/jrpg";
import { content, type BattleSetup } from "@jforge/melee/shared";
import { encounterLabel, enemySummary, gearSummary } from "../labels";
import type { Encounter } from "../run";

const gear = (id: string) => jrpgLibrary().gear.find((g) => g.id === id)!;

const cursed = {
  ...gear("gear-sword"),
  bonuses: [{ stat: "maxHp" as const, op: "add" as const, value: -5 }],
};

describe("gearSummary", () => {
  it.each([
    ["the iron sword", gear("gear-sword"), "+6 attack"],
    ["chain mail", gear("gear-mail"), "+8 defense, ×0.9 speed"],
    ["cursed gear", cursed, "−5 HP"],
    ["gear with no bonuses", { ...cursed, bonuses: [] }, "no bonuses"],
  ])("given %s, when it is summed up, then it reads %s", (_, item, text) => {
    const summary = gearSummary(item);

    expect(summary).toBe(text);
  });
});

describe("encounterLabel", () => {
  const battle = { kind: "battle", difficulty: "easy", seed: 1 } as const;

  it.each<[string, Encounter, string]>([
    ["a normal battle", { ...battle, rank: "normal" }, "Battle"],
    ["an elite battle", { ...battle, rank: "elite" }, "Elite battle"],
    ["a boss battle", { ...battle, rank: "boss" }, "Final battle"],
    ["a gear find", { kind: "gear", gearIds: ["x"] }, "Gear"],
    ["training", { kind: "training" }, "Training"],
    [
      "an ally",
      { kind: "ally", character: jrpgLibrary().characters[0]! },
      "Ally",
    ],
  ])("given %s, when it is labelled, then it reads %s", (_, stop, label) => {
    const text = encounterLabel(stop);

    expect(text).toBe(label);
  });
});

describe("enemySummary", () => {
  it("given a fighter against two slimes and a wolf, when the enemies are summed up, then they are counted by name and the party left out", () => {
    const { slime, wolf, fighter } = content;
    const position = { col: 0, row: 0 };
    const setup: BattleSetup = {
      placements: [
        { def: fighter, side: "player", position },
        { def: slime, side: "enemy", position },
        { def: wolf, side: "enemy", position },
        { def: slime, side: "enemy", position },
      ],
    };

    const summary = enemySummary(setup);

    expect(summary).toBe("2 × Slime, Wolf");
  });
});
