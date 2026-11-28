import { describe, expect, it } from "vitest";
import type { BattleEvent } from "@jforge/battle";
import { hitsFrom } from "@jforge/battle/screen/hits.ts";

const damage = (amount: number, extra = {}): BattleEvent => ({
  type: "damage",
  unitId: "u",
  amount,
  hp: 10,
  damageType: "slash",
  multiplier: 1,
  ...extra,
});

const tick = (effect: "heal" | "damage", amount: number): BattleEvent => ({
  type: "statusTick",
  unitId: "u",
  statusId: "s",
  name: "S",
  effect,
  amount,
  hp: 10,
});

const counter = () => {
  let key = 0;
  return () => ++key;
};

describe("hitsFrom", () => {
  it("given a revived unit, when hits are floated, then its new HP floats as a heal", () => {
    const events: BattleEvent[] = [{ type: "revived", unitId: "v", hp: 30 }];

    const hits = hitsFrom(events, counter());

    expect(hits).toEqual([{ key: 1, unitId: "v", amount: 30, kind: "heal" }]);
  });

  it("given a hit and a heal, when hits are floated, then each gets a number with a fresh key", () => {
    const events = [
      damage(12),
      { type: "heal", unitId: "v", amount: 5, hp: 20 } as const,
    ];

    const hits = hitsFrom(events, counter());

    expect(hits).toEqual([
      { key: 1, unitId: "u", amount: 12, kind: "damage", tag: undefined },
      { key: 2, unitId: "v", amount: 5, kind: "heal" },
    ]);
  });

  it("given weak, resisted, immune and shielded hits, when hits are floated, then each is tagged", () => {
    const events = [
      damage(24, { multiplier: 2 }),
      damage(6, { multiplier: 0.5 }),
      damage(0, { multiplier: 0 }),
      damage(0, { absorbed: 8 }),
    ];

    const tags = hitsFrom(events, counter()).map((h) => h.tag);

    expect(tags).toEqual(["weak", "resist", "immune", "shield"]);
  });

  it("given a damage and a heal tick, when hits are floated, then damage is marked over time and the heal is a heal", () => {
    const events = [tick("damage", 3), tick("heal", 4)];

    const hits = hitsFrom(events, counter());

    expect(hits).toEqual([
      { key: 1, unitId: "u", amount: 3, kind: "damage", overTime: true },
      { key: 2, unitId: "u", amount: 4, kind: "heal" },
    ]);
  });

  it("given ticks and heals of nothing and other events, when hits are floated, then none float", () => {
    const events: BattleEvent[] = [
      tick("damage", 0),
      tick("heal", 0),
      { type: "heal", unitId: "u", amount: 0, hp: 10 },
      { type: "knockedOut", unitId: "u" },
    ];

    const hits = hitsFrom(events, counter());

    expect(hits).toEqual([]);
  });
});
