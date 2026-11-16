import { describe, expect, it } from "vitest";
import type { BattleEvent } from "../../../shared";
import { hitsFrom } from "../hits";

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
  it("floats a number for each hit and heal, with fresh keys", () => {
    expect(
      hitsFrom(
        [damage(12), { type: "heal", unitId: "v", amount: 5, hp: 20 }],
        counter(),
      ),
    ).toEqual([
      { key: 1, unitId: "u", amount: 12, kind: "damage", tag: undefined },
      { key: 2, unitId: "v", amount: 5, kind: "heal" },
    ]);
  });

  it("tags weak, resisted and immune hits, and hits a shield took", () => {
    const tags = hitsFrom(
      [
        damage(24, { multiplier: 2 }),
        damage(6, { multiplier: 0.5 }),
        damage(0, { multiplier: 0 }),
        damage(0, { absorbed: 8 }),
      ],
      counter(),
    ).map((h) => h.tag);
    expect(tags).toEqual(["weak", "resist", "immune", "shield"]);
  });

  it("marks damage over time, and heals from statuses as heals", () => {
    expect(hitsFrom([tick("damage", 3), tick("heal", 4)], counter())).toEqual([
      { key: 1, unitId: "u", amount: 3, kind: "damage", overTime: true },
      { key: 2, unitId: "u", amount: 4, kind: "heal" },
    ]);
  });

  it("skips ticks and heals of nothing, and other events", () => {
    expect(
      hitsFrom(
        [
          tick("damage", 0),
          tick("heal", 0),
          { type: "heal", unitId: "u", amount: 0, hp: 10 },
          { type: "knockedOut", unitId: "u" },
        ],
        counter(),
      ),
    ).toEqual([]);
  });
});
