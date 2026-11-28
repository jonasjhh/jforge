import { describe, expect, it } from "vitest";
import {
  createBattle,
  type BattleEvent,
  type BattleState,
  type Cell,
  type Placement,
} from "@jforge/battle";
import { content } from "../../../shared";
import { def, place } from "../../../shared/__tests__/helpers";
import {
  coveredAfterMove,
  coveredFrom,
  coveredFromAction,
  isCoveredAt,
} from "@jforge/battle/screen/cover.ts";
import { ATTACK, type Menu } from "@jforge/battle/screen/turnMenu.ts";

const { aimedShot, bow, fireball, firebolt, sword } = content;

const caster = {
  ...def("archer", { magic: 20, maxMp: 99 }, bow),
  skills: [firebolt, fireball, aimedShot],
};

// The archer faces a column of two (front and guarded) and a lone back-row
// unit with nothing in front of it.
function battle(extra: Placement[] = []): BattleState {
  return createBattle(
    {
      placements: [
        place(caster, "player", 2),
        place(def("ally"), "player", 1),
        place(def("behind"), "player", 1, 1),
        place(def("front"), "enemy", 2),
        place(def("guarded"), "enemy", 2, 1),
        place(def("lone"), "enemy", 4, 2),
        ...extra,
      ],
    },
    1,
  );
}

const unit = (state: BattleState, name: string) =>
  state.units.find((u) => u.name === name)!;
const skill = (s = firebolt): Menu => ({ kind: "skill", skill: s, aim: null });
const MOVE: Menu = { kind: "move" };
const cell = (side: Cell["side"], col: number, row = 0): Cell => ({
  side,
  col,
  row,
});

describe("isCoveredAt", () => {
  it.each<[string, Cell["side"], { col: number; row: number }, boolean]>([
    ["behind a living enemy", "enemy", { col: 2, row: 1 }, true],
    ["with nothing in front", "enemy", { col: 4, row: 2 }, false],
    [
      "on the party side, nothing in front",
      "player",
      { col: 4, row: 1 },
      false,
    ],
  ])(
    "given a cell %s, when cover is checked, then it is %s",
    (_, side, at, covered) => {
      const state = battle();

      const result = isCoveredAt(state, side, at);

      expect(result).toBe(covered);
    },
  );

  it("given the unit in front is the one asking, when cover is checked, then it doesn't count", () => {
    const state = battle();
    const front = unit(state, "front").id;

    const result = isCoveredAt(state, "enemy", { col: 2, row: 1 }, front);

    expect(result).toBe(false);
  });

  it("given the unit in front is knocked out, when cover is checked, then it doesn't count", () => {
    const state = battle();
    unit(state, "front").hp = 0;

    const result = isCoveredAt(state, "enemy", { col: 2, row: 1 });

    expect(result).toBe(false);
  });
});

describe("coveredFrom", () => {
  const state = battle();
  const archer = unit(state, "archer");

  it.each<[string, Menu, string, boolean]>([
    ["an attack on the guarded enemy", ATTACK, "guarded", true],
    ["an attack on the front enemy", ATTACK, "front", false],
    ["an attack on the lone exposed enemy", ATTACK, "lone", false],
    ["a single-target skill on the guarded enemy", skill(), "guarded", true],
    ["a skill that ignores cover", skill(aimedShot), "guarded", false],
    ["an area skill", skill(fireball), "guarded", false],
    ["the move menu", MOVE, "guarded", false],
    ["an attack on an ally", ATTACK, "behind", false],
  ])(
    "given %s, when cover is marked, then it is %s",
    (_, menu, name, covered) => {
      const target = unit(state, name);

      const result = coveredFrom(state, archer, menu, target);

      expect(result).toBe(covered);
    },
  );

  it("given nobody active, when cover is marked, then nothing is", () => {
    const active = null;

    const result = coveredFrom(state, active, ATTACK, unit(state, "guarded"));

    expect(result).toBe(false);
  });

  it("given the guarded enemy knocked out, when cover is marked, then it isn't", () => {
    const down = battle();
    unit(down, "guarded").hp = 0;

    const result = coveredFrom(
      down,
      unit(down, "archer"),
      ATTACK,
      unit(down, "guarded"),
    );

    expect(result).toBe(false);
  });

  it("given an enemy out of a sword's reach anyway, when cover is marked, then it isn't", () => {
    // A sword at column 0 reaches columns 0-1; the column at 4 stays out
    // of reach with or without the unit in front.
    const swordsman = def("swordsman", {}, sword);
    const s = battle([
      place(swordsman, "player", 0, 2),
      place(def("far"), "enemy", 4),
      place(def("farBehind"), "enemy", 4, 1),
      place(def("near"), "enemy", 0),
    ]);

    const result = coveredFrom(
      s,
      unit(s, "swordsman"),
      ATTACK,
      unit(s, "farBehind"),
    );

    expect(result).toBe(false);
  });
});

describe("coveredAfterMove", () => {
  const state = battle();
  const archer = unit(state, "archer");
  /** The archer in the middle row, with the ally ahead of the cell to its right. */
  const besideAlly = () => {
    const s = battle();
    const a = unit(s, "archer");
    a.position = { col: 2, row: 1 };
    unit(s, "ally").position = { col: 3, row: 0 };
    return { s, a };
  };

  it.each<[string, Cell, boolean]>([
    ["behind the ally", cell("player", 3, 1), true],
    ["in the front row", cell("player", 2, 0), false],
  ])(
    "given the archer beside an ally, when it steps %s, then cover is %s",
    (_, to, covered) => {
      const { s, a } = besideAlly();

      const result = coveredAfterMove(s, a, MOVE, to);

      expect(result).toBe(covered);
    },
  );

  it.each<[string, Menu, Cell, boolean]>([
    ["behind itself", MOVE, cell("player", 2, 1), true],
    ["to a taken cell", MOVE, cell("player", 1, 1), true],
    ["to a cell too far", MOVE, cell("player", 4, 2), true],
    ["outside the move menu", ATTACK, cell("player", 2, 1), true],
    ["with nobody active", MOVE, cell("player", 2, 1), false],
  ])(
    "given a step %s, when cover is marked, then it isn't",
    (_, menu, to, active) => {
      const mover = active ? archer : null;

      const result = coveredAfterMove(state, mover, menu, to);

      expect(result).toBe(false);
    },
  );
});

describe("coveredFromAction", () => {
  // An enemy archer faces the party: the unit behind the ally is covered.
  const foe = {
    ...def("foe", { magic: 20, maxMp: 99 }, bow),
    skills: [firebolt, fireball],
  };
  const state = battle([place(foe, "enemy", 0)]);
  const foeId = unit(state, "foe").id;
  const behind = unit(state, "behind").id;
  const skillEvent = (
    skillId: string,
    extra: Partial<Extract<BattleEvent, { type: "skill" }>> = {},
  ): BattleEvent => ({
    type: "skill",
    unitId: foeId,
    cell: cell("player", 1),
    area: [cell("player", 1)],
    skillId,
    skillName: skillId,
    mp: 0,
    ...extra,
  });

  it.each<[string, BattleEvent]>([
    [
      "an enemy attack",
      { type: "attack", unitId: foeId, targetId: unit(state, "ally").id },
    ],
    ["an enemy single-target skill", skillEvent("firebolt")],
  ])(
    "given %s, when its cover is listed, then it is the party members it couldn't single out",
    (_, action) => {
      const covered = coveredFromAction(state, action);

      expect(covered).toEqual([behind]);
    },
  );

  it.each<[string, BattleEvent | undefined]>([
    ["an area skill", skillEvent("fireball")],
    ["a delayed impact", skillEvent("firebolt", { delayed: true })],
    ["a defend", { type: "defended", unitId: foeId }],
    ["no action", undefined],
    [
      "a party member's attack",
      {
        type: "attack",
        unitId: unit(state, "archer").id,
        targetId: unit(state, "front").id,
      },
    ],
  ])("given %s, when its cover is listed, then it is empty", (_, action) => {
    const covered = coveredFromAction(state, action);

    expect(covered).toEqual([]);
  });
});
