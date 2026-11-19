import { describe, expect, it } from "vitest";
import { createBattle, type BattleEvent } from "../../../shared";
import { def, place } from "../../../shared/__tests__/helpers";
import { summarizeAction } from "../actionSummary";

const state = createBattle(
  {
    placements: [
      place(def("Mage", {}), "player", 0),
      place(def("Wolf", {}), "enemy", 0),
      place(def("Slime", {}), "enemy", 1),
    ],
  },
  1,
);
const [mage, wolf, slime] = state.units.map((u) => u.id) as [
  string,
  string,
  string,
];
const attack: BattleEvent = { type: "attack", unitId: wolf, targetId: mage };
const hit = (unitId: string, amount: number, extra = {}): BattleEvent => ({
  type: "damage",
  unitId,
  amount,
  hp: 50,
  damageType: "slash",
  multiplier: 1,
  ...extra,
});
const ko = (unitId: string): BattleEvent => ({ type: "knockedOut", unitId });

const meteor: BattleEvent = {
  type: "skill",
  unitId: mage,
  cell: { side: "enemy", row: 0, col: 0 },
  targetId: wolf,
  area: [
    { side: "enemy", row: 0, col: 0 },
    { side: "enemy", row: 0, col: 1 },
  ],
  skillId: "meteor",
  skillName: "Meteor",
  mp: 0,
};
const revive: BattleEvent = {
  type: "skill",
  unitId: slime,
  cell: { side: "enemy", col: 0, row: 0 },
  targetId: wolf,
  area: [{ side: "enemy", col: 0, row: 0 }],
  skillId: "revive",
  skillName: "Revive",
  mp: 0,
};
const heal = (unitId: string, amount = 5): BattleEvent => ({
  type: "heal",
  unitId,
  amount,
  hp: 50,
});

describe("summarizeAction", () => {
  it("given no action among the events, when they are summed up, then there is no summary", () => {
    const events: BattleEvent[] = [{ type: "turnReady", unitId: wolf }];

    const summary = summarizeAction(state, events);

    expect(summary).toBeNull();
  });

  it.each<[string, BattleEvent[], string]>([
    ["a single hit", [attack, hit(mage, 12)], "Wolf attacks Mage — 12"],
    [
      "a weak hit",
      [attack, hit(mage, 24, { multiplier: 2 })],
      "Wolf attacks Mage — 24 (weak)",
    ],
    [
      "a resisted hit",
      [attack, hit(mage, 6, { multiplier: 0.5 })],
      "Wolf attacks Mage — 6 (resisted)",
    ],
    [
      "an immune target",
      [attack, hit(mage, 0, { multiplier: 0 })],
      "Wolf attacks Mage — immune",
    ],
    [
      "a hit a shield took",
      [attack, hit(mage, 0, { absorbed: 12 })],
      "Wolf attacks Mage — absorbed",
    ],
    [
      "a lone target knocked out",
      [attack, hit(mage, 30), ko(mage)],
      "Wolf attacks Mage — 30, KO",
    ],
    [
      "an area hit with one knockout",
      [meteor, hit(wolf, 40), hit(slime, 9), ko(wolf)],
      "Mage casts Meteor at Wolf — 2 hit, Wolf KO",
    ],
    [
      "a heal after a hit from before the action",
      [hit(slime, 3), attack, heal(mage)],
      "Wolf attacks Mage — +5 HP",
    ],
    [
      "two healed",
      [attack, heal(wolf), heal(slime)],
      "Wolf attacks Mage — 2 healed",
    ],
    [
      "two hit and knocked out",
      [attack, hit(wolf, 50), hit(slime, 50), ko(wolf), ko(slime)],
      "Wolf attacks Mage — 2 hit, 2 KO",
    ],
    [
      "a step with no result",
      [
        {
          type: "moved",
          unitId: mage,
          from: { row: 0, col: 0 },
          to: { row: 1, col: 0 },
        },
      ],
      "Mage steps back",
    ],
    ["a defend", [{ type: "defended", unitId: mage }], "Mage defends"],
    ["a wait", [{ type: "waited", unitId: mage }], "Mage waits"],
  ])(
    "given %s, when the action is summed up, then it reads as expected",
    (_, events, expected) => {
      const summary = summarizeAction(state, events);

      expect(summary).toBe(expected);
    },
  );

  it("given a revive, when it is summed up, then it names who was revived", () => {
    const events: BattleEvent[] = [
      revive,
      { type: "revived", unitId: wolf, hp: 30 },
    ];

    const summary = summarizeAction(state, events);

    expect(summary).toMatch(/Wolf revived$/);
  });
});
