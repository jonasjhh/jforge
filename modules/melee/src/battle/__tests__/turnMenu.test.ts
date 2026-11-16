import { describe, expect, it } from "vitest";
import {
  advance,
  applyStatus,
  content,
  createBattle,
  previewDamage,
  skillArea,
  type BattleState,
  type Cell,
  type Unit,
} from "../../../shared";
import { def, place } from "../../../shared/__tests__/helpers";
import {
  actionName,
  aimedArea,
  ATTACK,
  canTarget,
  commandFor,
  emphasized,
  incomingCells,
  previewFor,
  tap,
  turnKey,
  type Menu,
} from "../turnMenu";

const { cure, fireball, firebolt, heal, venomFangs } = content;

// A fast caster waits for a command; one ally and two enemies stand by.
const caster = {
  ...def("caster", { magic: 20, maxMp: 99, speed: 50 }),
  skills: [fireball, firebolt, cure, heal],
};

function waiting(): { state: BattleState; active: Unit } {
  const state = advance(
    createBattle(
      {
        placements: [
          place(caster, "player", 0),
          place(def("ally", { speed: 1 }), "player", 1),
          place(def("foe", { maxHp: 500, speed: 1 }), "enemy", 1),
          place(def("other", { maxHp: 500, speed: 1 }), "enemy", 4, 2),
        ],
      },
      1,
    ),
  ).state;
  return { state, active: unit(state, "caster") };
}

const unit = (state: BattleState, name: string) =>
  state.units.find((u) => u.name === name)!;
const cell = (side: Cell["side"], col: number, row = 0): Cell => ({
  side,
  col,
  row,
});
const skillMenu = (skill = fireball, aim: Cell | null = null): Menu => ({
  kind: "skill",
  skill,
  aim,
});

describe("turnKey", () => {
  it("is null while nobody waits", () => {
    const { state } = waiting();
    expect(turnKey(state, null)).toBeNull();
  });

  it("names the unit and the moment", () => {
    const { state, active } = waiting();
    expect(turnKey(state, active)).toBe(`${active.id}@${state.time}`);
  });
});

describe("commandFor", () => {
  const { state, active } = waiting();
  const foe = unit(state, "foe");

  it("attacks whoever stands on the cell", () => {
    expect(commandFor(state, active, ATTACK, cell("enemy", 1))).toEqual({
      type: "attack",
      targetId: foe.id,
    });
  });

  it("has nothing to attack on an empty cell", () => {
    expect(commandFor(state, active, ATTACK, cell("enemy", 2))).toBeNull();
  });

  it("moves only on the unit's own side", () => {
    expect(
      commandFor(state, active, { kind: "move" }, cell("player", 3)),
    ).toEqual({ type: "move", to: { col: 3, row: 0 } });
    expect(
      commandFor(state, active, { kind: "move" }, cell("enemy", 3)),
    ).toBeNull();
  });

  it("casts a chosen skill on any cell", () => {
    expect(commandFor(state, active, skillMenu(), cell("enemy", 2))).toEqual({
      type: "skill",
      skillId: "fireball",
      cell: cell("enemy", 2),
    });
  });

  it("does nothing while the skill list is open", () => {
    expect(
      commandFor(state, active, { kind: "skills" }, cell("enemy", 1)),
    ).toBeNull();
  });
});

describe("canTarget", () => {
  const { state, active } = waiting();

  it("is false while nobody waits", () => {
    expect(canTarget(state, null, ATTACK, cell("enemy", 1))).toBe(false);
  });

  it("is true for an enemy that can be attacked", () => {
    expect(canTarget(state, active, ATTACK, cell("enemy", 1))).toBe(true);
  });

  it("is false where there is no command", () => {
    expect(canTarget(state, active, ATTACK, cell("enemy", 2))).toBe(false);
  });

  it("is false when the command is not allowed", () => {
    // The ally stands there.
    expect(canTarget(state, active, { kind: "move" }, cell("player", 1))).toBe(
      false,
    );
    // Too far, then a free neighbouring cell.
    expect(canTarget(state, active, { kind: "move" }, cell("player", 2))).toBe(
      false,
    );
    expect(
      canTarget(state, active, { kind: "move" }, cell("player", 0, 1)),
    ).toBe(true);
  });
});

describe("tap", () => {
  const { state, active } = waiting();

  it("attacks on the first tap", () => {
    expect(tap(state, active, ATTACK, cell("enemy", 1))).toEqual({
      type: "command",
      command: { type: "attack", targetId: unit(state, "foe").id },
    });
  });

  it("does nothing without a command", () => {
    expect(tap(state, active, ATTACK, cell("enemy", 2))).toBeNull();
  });

  it("casts a single-target skill on the first tap", () => {
    expect(tap(state, active, skillMenu(heal), cell("player", 1))).toEqual({
      type: "command",
      command: { type: "skill", skillId: "heal", cell: cell("player", 1) },
    });
  });

  it("aims an area skill first, then casts on the same cell", () => {
    const first = tap(state, active, skillMenu(), cell("enemy", 2));
    expect(first).toEqual({
      type: "aim",
      menu: skillMenu(fireball, cell("enemy", 2)),
    });
    const aimed = (first as { menu: Menu }).menu;
    expect(tap(state, active, aimed, cell("enemy", 2))).toEqual({
      type: "command",
      command: { type: "skill", skillId: "fireball", cell: cell("enemy", 2) },
    });
  });

  it("re-aims on a different cell", () => {
    const aimed = skillMenu(fireball, cell("enemy", 2));
    expect(tap(state, active, aimed, cell("enemy", 3))).toEqual({
      type: "aim",
      menu: skillMenu(fireball, cell("enemy", 3)),
    });
  });
});

describe("actionName", () => {
  it("names the verb for each menu", () => {
    expect(actionName(ATTACK)).toBe("Attack");
    expect(actionName({ kind: "skills" })).toBe("Attack");
    expect(actionName({ kind: "move" })).toBe("Move to");
    expect(actionName(skillMenu(heal))).toBe("Heal");
    expect(actionName(skillMenu(fireball))).toBe("Aim Fireball at");
  });
});

describe("aimedArea", () => {
  const { state, active } = waiting();

  it("is null until an area skill is aimed", () => {
    expect(aimedArea(state, active, ATTACK)).toBeNull();
    expect(aimedArea(state, active, skillMenu())).toBeNull();
    expect(
      aimedArea(state, null, skillMenu(fireball, cell("enemy", 2))),
    ).toBeNull();
  });

  it("is the skill's area around the aim", () => {
    const aim = cell("enemy", 2);
    expect(aimedArea(state, active, skillMenu(fireball, aim))).toEqual(
      skillArea(state, active, fireball, aim),
    );
  });
});

describe("incomingCells", () => {
  const casting = (u: Unit, area: Cell[]): Unit => ({
    ...u,
    casting: {
      skillId: "meteor",
      skillName: "Meteor",
      cell: area[0]!,
      area,
      startedAt: 0,
      readyAt: 100,
    },
  });

  it("is empty when nobody casts", () => {
    expect(incomingCells(waiting().state)).toEqual([]);
  });

  it("collects the zones of living casters only", () => {
    const { state } = waiting();
    const zone = [cell("player", 0), cell("player", 1)];
    const [a, b, c, d] = state.units;
    const withCasts: BattleState = {
      ...state,
      units: [
        casting(a!, zone),
        b!,
        { ...casting(c!, [cell("enemy", 0)]), hp: 0 },
        d!,
      ],
    };
    expect(incomingCells(withCasts)).toEqual(zone);
  });
});

describe("emphasized", () => {
  const { state, active } = waiting();
  const ally = unit(state, "ally");
  const poisoned = (u: Unit): Unit => {
    const copy = structuredClone(u);
    applyStatus(state, active, copy, venomFangs.onHit!, []);
    return copy;
  };

  it("marks harmed allies while choosing a cleanse", () => {
    expect(emphasized(active, skillMenu(cure), poisoned(ally))).toBe(true);
  });

  it("leaves healthy allies, enemies, the fallen and other menus alone", () => {
    expect(emphasized(active, skillMenu(cure), ally)).toBe(false);
    expect(
      emphasized(active, skillMenu(cure), poisoned(unit(state, "foe"))),
    ).toBe(false);
    expect(
      emphasized(active, skillMenu(cure), { ...poisoned(ally), hp: 0 }),
    ).toBe(false);
    expect(emphasized(active, skillMenu(heal), poisoned(ally))).toBe(false);
  });
});

describe("previewFor", () => {
  const { state, active } = waiting();
  const foe = unit(state, "foe");
  const other = unit(state, "other");
  const ally = unit(state, "ally");

  it("shows nothing while nobody waits, or on the fallen", () => {
    expect(previewFor(state, null, ATTACK, foe)).toBeNull();
    expect(previewFor(state, active, ATTACK, { ...foe, hp: 0 })).toBeNull();
  });

  it("shows an attack's damage on attackable enemies", () => {
    expect(previewFor(state, active, ATTACK, foe)).toEqual(
      previewDamage(active, foe),
    );
    expect(previewFor(state, active, ATTACK, ally)).toBeNull();
  });

  it("shows nothing while moving or choosing a skill", () => {
    expect(previewFor(state, active, { kind: "move" }, foe)).toBeNull();
    expect(previewFor(state, active, { kind: "skills" }, foe)).toBeNull();
  });

  it("shows a single-target skill on its targets", () => {
    const menu = skillMenu(firebolt);
    expect(previewFor(state, active, menu, foe)).toEqual(
      previewDamage(active, foe, firebolt),
    );
    expect(previewFor(state, active, menu, ally)).toBeNull();
  });

  it("waits for an area skill to be aimed, then shows it on its victims", () => {
    expect(previewFor(state, active, skillMenu(), foe)).toBeNull();
    const aimed = skillMenu(fireball, cell("enemy", 1));
    expect(previewFor(state, active, aimed, foe)).toEqual(
      previewDamage(active, foe, fireball),
    );
    expect(previewFor(state, active, aimed, other)).toBeNull();
  });
});
