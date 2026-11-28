import { describe, expect, it } from "vitest";
import {
  advance,
  applyStatus,
  createBattle,
  previewDamage,
  skillArea,
  type BattleState,
  type Cell,
  type Unit,
} from "@jforge/battle";
import { content } from "../../../shared";
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
} from "@jforge/battle/screen/turnMenu.ts";

const { cure, fireball, firebolt, heal, revive, venomFangs } = content;

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
  it("given nobody waits, when the turn key is taken, then it is null", () => {
    const { state } = waiting();

    const key = turnKey(state, null);

    expect(key).toBeNull();
  });

  it("given a unit waits, when the turn key is taken, then it names the unit and the moment", () => {
    const { state, active } = waiting();

    const key = turnKey(state, active);

    expect(key).toBe(`${active.id}@${state.time}`);
  });
});

describe("commandFor", () => {
  const { state, active } = waiting();
  const foe = unit(state, "foe");

  it("given the attack menu, when a cell with an enemy is chosen, then that enemy is attacked", () => {
    const command = commandFor(state, active, ATTACK, cell("enemy", 1));

    expect(command).toEqual({ type: "attack", targetId: foe.id });
  });

  it("given the attack menu, when an empty cell is chosen, then there is no command", () => {
    const command = commandFor(state, active, ATTACK, cell("enemy", 2));

    expect(command).toBeNull();
  });

  it("given the move menu, when a cell on the unit's own side is chosen, then it moves there", () => {
    const command = commandFor(
      state,
      active,
      { kind: "move" },
      cell("player", 3),
    );

    expect(command).toEqual({ type: "move", to: { col: 3, row: 0 } });
  });

  it("given the move menu, when a cell on the other side is chosen, then there is no command", () => {
    const command = commandFor(
      state,
      active,
      { kind: "move" },
      cell("enemy", 3),
    );

    expect(command).toBeNull();
  });

  it("given a chosen skill, when any cell is chosen, then the skill is cast there", () => {
    const command = commandFor(state, active, skillMenu(), cell("enemy", 2));

    expect(command).toEqual({
      type: "skill",
      skillId: "fireball",
      cell: cell("enemy", 2),
    });
  });

  it("given the skill list is open, when a cell is chosen, then there is no command", () => {
    const command = commandFor(
      state,
      active,
      { kind: "skills" },
      cell("enemy", 1),
    );

    expect(command).toBeNull();
  });
});

describe("canTarget", () => {
  const { state, active } = waiting();

  it.each<[string, Unit | null, Menu, Cell, boolean]>([
    ["nobody waits", null, ATTACK, cell("enemy", 1), false],
    ["an enemy that can be attacked", active, ATTACK, cell("enemy", 1), true],
    ["an empty cell to attack", active, ATTACK, cell("enemy", 2), false],
    [
      "a move onto the ally",
      active,
      { kind: "move" },
      cell("player", 1),
      false,
    ],
    ["a move too far", active, { kind: "move" }, cell("player", 2), false],
    [
      "a move to a free neighbouring cell",
      active,
      { kind: "move" },
      cell("player", 0, 1),
      true,
    ],
  ])(
    "given %s, when the cell is checked, then it is targetable: %s",
    (_, who, menu, at, expected) => {
      const ok = canTarget(state, who, menu, at);

      expect(ok).toBe(expected);
    },
  );
});

describe("tap", () => {
  const { state, active } = waiting();

  it("given the attack menu, when an enemy is tapped, then it is attacked at once", () => {
    const result = tap(state, active, ATTACK, cell("enemy", 1));

    expect(result).toEqual({
      type: "command",
      command: { type: "attack", targetId: unit(state, "foe").id },
    });
  });

  it("given the attack menu, when an empty cell is tapped, then nothing happens", () => {
    const result = tap(state, active, ATTACK, cell("enemy", 2));

    expect(result).toBeNull();
  });

  it("given a single-target skill, when its target is tapped, then it is cast at once", () => {
    const result = tap(state, active, skillMenu(heal), cell("player", 1));

    expect(result).toEqual({
      type: "command",
      command: { type: "skill", skillId: "heal", cell: cell("player", 1) },
    });
  });

  it("given an area skill not yet aimed, when a cell is tapped, then it is aimed there", () => {
    const result = tap(state, active, skillMenu(), cell("enemy", 2));

    expect(result).toEqual({
      type: "aim",
      menu: skillMenu(fireball, cell("enemy", 2)),
    });
  });

  it("given an area skill aimed at a cell, when that cell is tapped again, then it is cast", () => {
    const aimed = skillMenu(fireball, cell("enemy", 2));

    const result = tap(state, active, aimed, cell("enemy", 2));

    expect(result).toEqual({
      type: "command",
      command: { type: "skill", skillId: "fireball", cell: cell("enemy", 2) },
    });
  });

  it("given an area skill aimed at a cell, when a different cell is tapped, then it is aimed anew", () => {
    const aimed = skillMenu(fireball, cell("enemy", 2));

    const result = tap(state, active, aimed, cell("enemy", 3));

    expect(result).toEqual({
      type: "aim",
      menu: skillMenu(fireball, cell("enemy", 3)),
    });
  });
});

describe("actionName", () => {
  it.each<[string, Menu, string]>([
    ["the attack menu", ATTACK, "Attack"],
    ["the skill list", { kind: "skills" }, "Attack"],
    ["the move menu", { kind: "move" }, "Move to"],
    ["a single-target skill", skillMenu(heal), "Heal"],
    ["an area skill", skillMenu(fireball), "Aim Fireball at"],
  ])(
    "given %s, when its action is named, then it reads %s",
    (_, menu, name) => {
      const text = actionName(menu);

      expect(text).toBe(name);
    },
  );
});

describe("aimedArea", () => {
  const { state, active } = waiting();

  it.each<[string, Unit | null, Menu]>([
    ["the attack menu", active, ATTACK],
    ["an area skill not yet aimed", active, skillMenu()],
    ["nobody waiting", null, skillMenu(fireball, cell("enemy", 2))],
  ])(
    "given %s, when the aimed area is taken, then there is none",
    (_, who, menu) => {
      const area = aimedArea(state, who, menu);

      expect(area).toBeNull();
    },
  );

  it("given an area skill aimed at a cell, when the aimed area is taken, then it is the skill's area around that cell", () => {
    const aim = cell("enemy", 2);

    const area = aimedArea(state, active, skillMenu(fireball, aim));

    expect(area).toEqual(skillArea(state, active, fireball, aim));
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

  it("given nobody casts, when incoming cells are collected, then there are none", () => {
    const { state } = waiting();

    const cells = incomingCells(state);

    expect(cells).toEqual([]);
  });

  it("given a living caster and a fallen one, when incoming cells are collected, then only the living caster's zone shows", () => {
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

    const cells = incomingCells(withCasts);

    expect(cells).toEqual(zone);
  });
});

describe("emphasized", () => {
  const { state, active } = waiting();
  const ally = unit(state, "ally");
  const foe = unit(state, "foe");
  const poisoned = (u: Unit): Unit => {
    const copy = structuredClone(u);
    applyStatus(state, active, copy, venomFangs.onHit!, []);
    return copy;
  };

  it.each<[string, Menu, Unit, boolean]>([
    ["a cleanse and a harmed ally", skillMenu(cure), poisoned(ally), true],
    ["a cleanse and a healthy ally", skillMenu(cure), ally, false],
    ["a cleanse and a harmed enemy", skillMenu(cure), poisoned(foe), false],
    [
      "a cleanse and a harmed fallen ally",
      skillMenu(cure),
      { ...poisoned(ally), hp: 0 },
      false,
    ],
    ["a heal and a harmed ally", skillMenu(heal), poisoned(ally), false],
    ["a revive and a fallen ally", skillMenu(revive), { ...ally, hp: 0 }, true],
    ["a revive and a standing ally", skillMenu(revive), ally, false],
    [
      "a revive and a fallen enemy",
      skillMenu(revive),
      { ...foe, hp: 0 },
      false,
    ],
    [
      "a revive and a vanished ally",
      skillMenu(revive),
      { ...ally, hp: 0, vanished: true },
      false,
    ],
  ])(
    "given %s, when the unit is checked, then it is marked: %s",
    (_, menu, who, expected) => {
      const marked = emphasized(active, menu, who);

      expect(marked).toBe(expected);
    },
  );
});

describe("previewFor", () => {
  const { state, active } = waiting();
  const foe = unit(state, "foe");
  const other = unit(state, "other");
  const ally = unit(state, "ally");
  const aimed = skillMenu(fireball, cell("enemy", 1));

  it.each<[string, Unit | null, Menu, Unit]>([
    ["nobody waiting", null, ATTACK, foe],
    ["a fallen enemy", active, ATTACK, { ...foe, hp: 0 }],
    ["an attack on an ally", active, ATTACK, ally],
    ["the move menu", active, { kind: "move" }, foe],
    ["the skill list", active, { kind: "skills" }, foe],
    ["a single-target skill on an ally", active, skillMenu(firebolt), ally],
    ["an area skill not yet aimed", active, skillMenu(), foe],
    ["an aimed area skill and a unit outside it", active, aimed, other],
  ])(
    "given %s, when the preview is taken, then there is none",
    (_, who, menu, target) => {
      const preview = previewFor(state, who, menu, target);

      expect(preview).toBeNull();
    },
  );

  it.each<[string, Menu, typeof fireball | undefined]>([
    ["an attack on an enemy", ATTACK, undefined],
    ["a single-target skill on an enemy", skillMenu(firebolt), firebolt],
    ["an aimed area skill and a unit inside it", aimed, fireball],
  ])(
    "given %s, when the preview is taken, then it shows the damage",
    (_, menu, skill) => {
      const preview = previewFor(state, active, menu, foe);

      expect(preview).toEqual(previewDamage(active, foe, skill));
    },
  );
});
