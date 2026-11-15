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

describe("summarizeAction", () => {
  it("is null without an action", () => {
    expect(summarizeAction(state, [{ type: "turnReady", unitId: wolf }])).toBe(
      null,
    );
  });

  it("adds the damage a single hit dealt", () => {
    expect(summarizeAction(state, [attack, hit(mage, 12)])).toBe(
      "Wolf attacks Mage — 12",
    );
  });

  it("notes weakness, resistance, immunity and shields", () => {
    expect(
      summarizeAction(state, [attack, hit(mage, 24, { multiplier: 2 })]),
    ).toBe("Wolf attacks Mage — 24 (weak)");
    expect(
      summarizeAction(state, [attack, hit(mage, 6, { multiplier: 0.5 })]),
    ).toBe("Wolf attacks Mage — 6 (resisted)");
    expect(
      summarizeAction(state, [attack, hit(mage, 0, { multiplier: 0 })]),
    ).toBe("Wolf attacks Mage — immune");
    expect(
      summarizeAction(state, [attack, hit(mage, 0, { absorbed: 12 })]),
    ).toBe("Wolf attacks Mage — absorbed");
  });

  it("marks a lone target's knockout", () => {
    expect(summarizeAction(state, [attack, hit(mage, 30), ko(mage)])).toBe(
      "Wolf attacks Mage — 30, KO",
    );
  });

  it("counts area hits and names who fell", () => {
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
    expect(
      summarizeAction(state, [meteor, hit(wolf, 40), hit(slime, 9), ko(wolf)]),
    ).toBe("Mage casts Meteor at Wolf — 2 hit, Wolf KO");
  });

  it("shows healing and ignores what happened before the action", () => {
    expect(
      summarizeAction(state, [
        hit(slime, 3),
        attack,
        { type: "heal", unitId: mage, amount: 5, hp: 55 },
      ]),
    ).toBe("Wolf attacks Mage — +5 HP");
  });

  it("leaves a step with no result as is", () => {
    expect(
      summarizeAction(state, [
        {
          type: "moved",
          unitId: mage,
          from: { row: 0, col: 0 },
          to: { row: 1, col: 0 },
        },
      ]),
    ).toBe("Mage steps back");
  });
});
