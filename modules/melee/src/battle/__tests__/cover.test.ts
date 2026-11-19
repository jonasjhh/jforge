import { describe, expect, it } from "vitest";
import {
  content,
  createBattle,
  type BattleEvent,
  type BattleState,
  type Cell,
  type Placement,
} from "../../../shared";
import { def, place } from "../../../shared/__tests__/helpers";
import {
  coveredAfterMove,
  coveredFrom,
  coveredFromAction,
  isCoveredAt,
} from "../cover";
import { ATTACK, type Menu } from "../turnMenu";

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
  it("is true behind a living unit of the same side", () => {
    const state = battle();
    expect(isCoveredAt(state, "enemy", { col: 2, row: 1 })).toBe(true);
    expect(isCoveredAt(state, "enemy", { col: 4, row: 2 })).toBe(false);
    expect(isCoveredAt(state, "player", { col: 4, row: 1 })).toBe(false);
  });

  it("ignores knocked-out units and the given unit", () => {
    const state = battle();
    expect(
      isCoveredAt(state, "enemy", { col: 2, row: 1 }, unit(state, "front").id),
    ).toBe(false);
    unit(state, "front").hp = 0;
    expect(isCoveredAt(state, "enemy", { col: 2, row: 1 })).toBe(false);
  });
});

describe("coveredFrom", () => {
  const state = battle();
  const archer = unit(state, "archer");

  it("marks an enemy that only cover keeps out of an attack", () => {
    expect(coveredFrom(state, archer, ATTACK, unit(state, "guarded"))).toBe(
      true,
    );
  });

  it("leaves targets and exposed enemies unmarked", () => {
    expect(coveredFrom(state, archer, ATTACK, unit(state, "front"))).toBe(
      false,
    );
    expect(coveredFrom(state, archer, ATTACK, unit(state, "lone"))).toBe(false);
  });

  it("marks covered enemies for a single-target skill", () => {
    expect(coveredFrom(state, archer, skill(), unit(state, "guarded"))).toBe(
      true,
    );
  });

  it("marks nothing for a skill that ignores cover, or an area", () => {
    const guarded = unit(state, "guarded");
    expect(coveredFrom(state, archer, skill(aimedShot), guarded)).toBe(false);
    expect(coveredFrom(state, archer, skill(fireball), guarded)).toBe(false);
  });

  it("marks nothing in the move menu or with nobody active", () => {
    const guarded = unit(state, "guarded");
    expect(coveredFrom(state, archer, MOVE, guarded)).toBe(false);
    expect(coveredFrom(state, null, ATTACK, guarded)).toBe(false);
  });

  it("marks nothing on allies or knocked-out units", () => {
    expect(coveredFrom(state, archer, ATTACK, unit(state, "behind"))).toBe(
      false,
    );
    const down = battle();
    unit(down, "guarded").hp = 0;
    expect(
      coveredFrom(down, unit(down, "archer"), ATTACK, unit(down, "guarded")),
    ).toBe(false);
  });

  it("leaves an enemy out of reach for other reasons unmarked", () => {
    // A sword at column 0 reaches columns 0-1; the column at 4 stays out
    // of reach with or without the unit in front.
    const swordsman = def("swordsman", {}, sword);
    const s = battle([
      place(swordsman, "player", 0, 2),
      place(def("far"), "enemy", 4),
      place(def("farBehind"), "enemy", 4, 1),
      place(def("near"), "enemy", 0),
    ]);
    const attacker = unit(s, "swordsman");
    expect(coveredFrom(s, attacker, ATTACK, unit(s, "farBehind"))).toBe(false);
  });
});

describe("coveredAfterMove", () => {
  const state = battle();
  const archer = unit(state, "archer");

  it("marks a step that ends behind a living ally", () => {
    // The archer in the middle row, with the ally ahead of the cell to its right.
    const s = battle();
    const a = unit(s, "archer");
    a.position = { col: 2, row: 1 };
    s.units.find((u) => u.name === "ally")!.position = { col: 3, row: 0 };
    expect(coveredAfterMove(s, a, MOVE, cell("player", 3, 1))).toBe(true);
    expect(coveredAfterMove(s, a, MOVE, cell("player", 2, 0))).toBe(false);
  });

  it("does not count the moving unit as its own cover", () => {
    expect(coveredAfterMove(state, archer, MOVE, cell("player", 2, 1))).toBe(
      false,
    );
  });

  it("marks only valid steps, and only in the move menu", () => {
    // Column 1, middle row is taken by the ally behind; far cells are not steps.
    expect(coveredAfterMove(state, archer, MOVE, cell("player", 1, 1))).toBe(
      false,
    );
    expect(coveredAfterMove(state, archer, MOVE, cell("player", 4, 2))).toBe(
      false,
    );
    expect(coveredAfterMove(state, archer, ATTACK, cell("player", 2, 1))).toBe(
      false,
    );
    expect(coveredAfterMove(state, null, MOVE, cell("player", 2, 1))).toBe(
      false,
    );
  });
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

  it("lists the party members an enemy attack couldn't single out", () => {
    const attack: BattleEvent = {
      type: "attack",
      unitId: foeId,
      targetId: unit(state, "ally").id,
    };
    expect(coveredFromAction(state, attack)).toEqual([behind]);
  });

  it("lists them for a single-target skill", () => {
    expect(coveredFromAction(state, skillEvent("firebolt"))).toEqual([behind]);
  });

  it("lists nothing for an area, a delayed impact or other actions", () => {
    expect(coveredFromAction(state, skillEvent("fireball"))).toEqual([]);
    expect(
      coveredFromAction(state, skillEvent("firebolt", { delayed: true })),
    ).toEqual([]);
    expect(
      coveredFromAction(state, { type: "defended", unitId: foeId }),
    ).toEqual([]);
    expect(coveredFromAction(state, undefined)).toEqual([]);
  });

  it("lists nothing for a party member's action", () => {
    const attack: BattleEvent = {
      type: "attack",
      unitId: unit(state, "archer").id,
      targetId: unit(state, "front").id,
    };
    expect(coveredFromAction(state, attack)).toEqual([]);
  });
});
