import { describe, expect, it } from "vitest";
import { act, advance, createBattle, validateCommand } from "../battle";
import {
  charge,
  expose,
  fireball,
  meteor,
  firebolt,
  guard,
  knight,
  rescue,
  playerTypes,
  sage,
  silence,
  shieldBash,
  shieldWall,
} from "../content";
import { EXPOSE_FACTOR, resistance } from "../damage";
import { skillValue } from "../aiSkills";
import { previewDamage } from "../preview";
import { skillArea } from "../skills";
import { effectiveStat } from "../stats";
import { cleanse } from "../status";
import type { BattleState, CombatantDef, Unit } from "../types";
import { def, place } from "./helpers";

const fast = (d: CombatantDef) => ({ ...d, stats: { ...d.stats, speed: 50 } });
const unit = (s: BattleState, id: string): Unit =>
  s.units.find((u) => u.id === id)!;

/** `hero` (fast) ready at player 2,0; allies beside it and behind it. */
function turnOf(hero: CombatantDef): BattleState {
  return advance(
    createBattle(
      {
        placements: [
          place(fast(hero), "player", 2, 0),
          place(def("beside", { speed: 1, defense: 10 }), "player", 0, 0),
          place(def("behind", { speed: 1, defense: 10 }), "player", 2, 1),
          place(
            {
              ...def("foe", { speed: 1 }),
              resistances: { fire: 0.5, holy: 0 },
            },
            "enemy",
            2,
            0,
          ),
        ],
      },
      1,
    ),
  ).state;
}

describe("Knight and Sage", () => {
  it("are melee player types with skills of their own", () => {
    expect(playerTypes).toContain(knight);
    expect(playerTypes).toContain(sage);
    expect(knight.skills).toEqual([
      shieldWall,
      guard,
      shieldBash,
      charge,
      rescue,
    ]);
    expect(sage.skills).toEqual([expose, silence]);
    const others = playerTypes
      .filter((t) => t !== knight && t !== sage)
      .flatMap((t) => t.skills ?? []);
    for (const skill of [...knight.skills!, ...sage.skills!]) {
      expect(others).not.toContain(skill);
    }
  });
});

describe("Shield Wall", () => {
  const cast = () =>
    act(turnOf(knight), {
      type: "skill",
      skillId: shieldWall.id,
      cell: { side: "player", col: 2, row: 0 },
    }).state;

  it("covers the Knight's whole row, on its own side only", () => {
    const state = turnOf(knight);
    const cells = skillArea(state, unit(state, "player-2-0"), shieldWall, {
      side: "player",
      col: 2,
      row: 0,
    });
    expect(cells).toEqual(
      [0, 1, 2, 3, 4].map((col) => ({ side: "player", col, row: 0 })),
    );
  });

  it("raises the defense of the Knight and its row, not the row behind", () => {
    const state = cast();
    expect(effectiveStat(unit(state, "player-0-0"), "defense")).toBe(15);
    expect(effectiveStat(unit(state, "player-2-0"), "defense")).toBe(
      Math.round(knight.stats.defense * 1.5),
    );
    expect(effectiveStat(unit(state, "player-2-1"), "defense")).toBe(10);
    expect(effectiveStat(unit(state, "enemy-2-0"), "defense")).toBe(0);
  });

  it("is aimed at the Knight only", () => {
    const state = turnOf(knight);
    const command = {
      type: "skill",
      skillId: shieldWall.id,
      cell: { side: "player", col: 0, row: 0 },
    } as const;
    expect(validateCommand(state, unit(state, "player-2-0"), command)).toMatch(
      /caster/,
    );
  });
});

describe("Expose", () => {
  const cast = () =>
    act(turnOf(sage), {
      type: "skill",
      skillId: expose.id,
      cell: { side: "enemy", col: 2, row: 0 },
    }).state;

  it("makes an enemy take more from every damage type; immune stays immune", () => {
    const before = unit(turnOf(sage), "enemy-2-0");
    const foe = unit(cast(), "enemy-2-0");
    expect(foe.statuses[0]).toMatchObject({ id: "exposed", harmful: true });
    expect(resistance(before, "slash")).toBe(1);
    expect(resistance(foe, "slash")).toBe(EXPOSE_FACTOR);
    expect(resistance(foe, "fire")).toBeCloseTo(0.5 * EXPOSE_FACTOR);
    expect(resistance(foe, "holy")).toBe(0);
  });

  it("costs 8 MP", () => {
    expect(unit(cast(), "player-2-0").mp).toBe(
      sage.stats.maxMp - expose.mpCost,
    );
  });
});

describe("Guard", () => {
  const KNIGHT = "player-2-0";
  const BESIDE = "player-0-0";
  const BEHIND = "player-2-1";
  const FOE = "enemy-2-0";
  const guardOn = (id: string, state = turnOf(knight)) => {
    const at = unit(state, id).position;
    return {
      state,
      command: {
        type: "skill",
        skillId: guard.id,
        cell: { side: "player", ...at },
      } as const,
    };
  };
  /** The Knight guards the ally behind it; then it is the foe's turn. */
  const foeTurn = () => {
    const { state, command } = guardOn(BEHIND);
    const after = act(state, command).state;
    const foe = unit(after, FOE);
    foe.skills = [firebolt, fireball];
    foe.mp = 99;
    foe.base.magic = 10;
    after.phase = { kind: "awaitingCommand", unitId: FOE };
    return after;
  };

  it("is aimed only at an ally next to the Knight", () => {
    const next = guardOn(BEHIND);
    expect(
      validateCommand(next.state, unit(next.state, KNIGHT), next.command),
    ).toBeNull();
    const far = guardOn(BESIDE);
    expect(
      validateCommand(far.state, unit(far.state, KNIGHT), far.command),
    ).toMatch(/next to you/);
    const self = guardOn(KNIGHT);
    expect(
      validateCommand(self.state, unit(self.state, KNIGHT), self.command),
    ).toMatch(/caster/);
  });

  it("puts the guard on the ally, from the Knight, for 5 MP", () => {
    const state = foeTurn();
    expect(unit(state, BEHIND).statuses[0]).toMatchObject({
      effect: "guard",
      sourceId: KNIGHT,
    });
    expect(unit(state, KNIGHT).mp).toBe(knight.stats.maxMp - guard.mpCost);
  });

  it("makes an attack on the ally land on the Knight", () => {
    const { state, events } = act(foeTurn(), {
      type: "attack",
      targetId: BEHIND,
    });
    expect(events).toContainEqual({
      type: "guarded",
      unitId: BEHIND,
      byId: KNIGHT,
    });
    expect(unit(state, BEHIND).hp).toBe(100);
    expect(unit(state, KNIGHT).hp).toBeLessThan(knight.stats.maxHp);
  });

  it("covers single-target spells but not area ones", () => {
    const at = { side: "player", col: 2, row: 1 } as const;
    const bolt = act(foeTurn(), {
      type: "skill",
      skillId: firebolt.id,
      cell: at,
    }).state;
    expect(unit(bolt, BEHIND).hp).toBe(100);
    expect(unit(bolt, KNIGHT).hp).toBeLessThan(knight.stats.maxHp);
    const ball = act(foeTurn(), {
      type: "skill",
      skillId: fireball.id,
      cell: at,
    }).state;
    expect(unit(ball, BEHIND).hp).toBeLessThan(100);
  });

  it("ends when the Knight falls", () => {
    const state = foeTurn();
    unit(state, KNIGHT).hp = 0;
    const after = act(state, { type: "attack", targetId: BEHIND }).state;
    expect(unit(after, BEHIND).hp).toBeLessThan(100);
  });

  it("is worth casting to the AI for a frail ally, not a tough one", () => {
    const value = (state: BattleState) =>
      skillValue(state, unit(state, KNIGHT), guard, {
        side: "player",
        col: 2,
        row: 1,
      });
    expect(value(turnOf(knight))).toBeGreaterThan(0);
    const tough = turnOf(knight);
    const ally = unit(tough, BEHIND);
    ally.base.maxHp = 500;
    ally.base.defense = 50;
    expect(value(tough)).toBeLessThanOrEqual(0);
  });
});

describe("Shield Bash", () => {
  it("strikes and knocks the enemy a row back", () => {
    const { state, events } = act(turnOf(knight), {
      type: "skill",
      skillId: shieldBash.id,
      cell: { side: "enemy", col: 2, row: 0 },
    });
    const foe = unit(state, "enemy-2-0");
    expect(foe.position).toEqual({ col: 2, row: 1 });
    expect(foe.hp).toBeLessThan(100);
    expect(events.some((e) => e.type === "pushed")).toBe(true);
    expect(unit(state, "player-2-0").mp).toBe(
      knight.stats.maxMp - shieldBash.mpCost,
    );
  });
});

describe("Charge", () => {
  /** The Knight (fast) at player 2,`row`, `blocker` ahead of it if given. */
  const knightAt = (row: number, blocker?: number) =>
    advance(
      createBattle(
        {
          placements: [
            place(fast(knight), "player", 2, row),
            ...(blocker === undefined
              ? []
              : [place(def("ally", { speed: 1 }), "player", 2, blocker)]),
            place(def("foe", { speed: 1 }), "enemy", 2, 0),
          ],
        },
        1,
      ),
    ).state;
  const command = {
    type: "skill",
    skillId: charge.id,
    cell: { side: "enemy", col: 2, row: 0 },
  } as const;
  const knightIn = (s: BattleState) =>
    s.units.find((u) => u.defId === "knight")!;

  it("runs the Knight to the front of its column and strikes", () => {
    const { state, events } = act(knightAt(2), command);
    const self = knightIn(state);
    expect(self.position).toEqual({ col: 2, row: 0 });
    expect(events).toContainEqual({
      type: "moved",
      unitId: "player-2-2",
      from: { col: 2, row: 2 },
      to: { col: 2, row: 0 },
    });
    expect(unit(state, "enemy-2-0").hp).toBeLessThan(100);
    expect(self.mp).toBe(knight.stats.maxMp - charge.mpCost);
  });

  it("hits as hard as a weapon attack from the front row", () => {
    const back = knightAt(2);
    const front = knightAt(0);
    const foe = unit(back, "enemy-2-0");
    expect(previewDamage(knightIn(back), foe, charge)!.amount).toBe(
      previewDamage(knightIn(front), foe)!.amount,
    );
    expect(previewDamage(knightIn(back), foe)!.amount).toBeLessThan(
      previewDamage(knightIn(front), foe)!.amount,
    );
  });

  it("needs a clear way and a Knight not at the front already", () => {
    const blocked = knightAt(2, 1);
    expect(validateCommand(blocked, knightIn(blocked), command)).toMatch(
      /blocked/,
    );
    const front = knightAt(0);
    expect(validateCommand(front, knightIn(front), command)).toMatch(
      /front row/,
    );
  });
});

describe("Rescue", () => {
  const KNIGHT = "player-1-0";
  const ALLY = "player-2-0";
  /** The Knight (fast) at player 1,0, a hurt ally beside it at 2,0. */
  const rescueTurn = (...others: [number, number][]) => {
    const state = advance(
      createBattle(
        {
          placements: [
            place(fast(knight), "player", 1, 0),
            place(def("ally", { speed: 1 }), "player", 2, 0),
            ...others.map(([col, row]) =>
              place(def("other", { speed: 1 }), "player", col, row),
            ),
            place(def("foe", { speed: 1 }), "enemy", 2, 0),
          ],
        },
        1,
      ),
    ).state;
    const ally = unit(state, ALLY);
    ally.hp = 30;
    ally.gauge = 600;
    return state;
  };
  const command = {
    type: "skill",
    skillId: rescue.id,
    cell: { side: "player", col: 2, row: 0 },
  } as const;

  it("puts the Knight in the ally's middle row and the ally behind it", () => {
    const { state, events } = act(rescueTurn(), command);
    const self = state.units.find((u) => u.defId === "knight")!;
    expect(self.position).toEqual({ col: 2, row: 1 });
    expect(unit(state, ALLY).position).toEqual({ col: 2, row: 2 });
    expect(events).toContainEqual({
      type: "rescued",
      unitId: ALLY,
      byId: KNIGHT,
    });
    expect(self.mp).toBe(knight.stats.maxMp - rescue.mpCost);
  });

  it("halves the ally's gauge and braces the Knight", () => {
    const before = rescueTurn();
    const defense = effectiveStat(unit(before, KNIGHT), "defense");
    const { state } = act(before, command);
    expect(unit(state, ALLY).gauge).toBe(300);
    const self = state.units.find((u) => u.defId === "knight")!;
    expect(self.modifiers).toContainEqual(
      expect.objectContaining({ source: "Braced", stat: "defense" }),
    );
    expect(effectiveStat(self, "defense")).toBeCloseTo(defense * 1.3, 0);
  });

  it("never raises a gauge still below 0 (a bow's late start)", () => {
    const before = rescueTurn();
    unit(before, ALLY).gauge = -400;
    expect(unit(act(before, command).state, ALLY).gauge).toBe(-400);
  });

  it("needs both cells free; a knocked-out body blocks too", () => {
    const taken = rescueTurn([2, 1]);
    expect(validateCommand(taken, unit(taken, KNIGHT), command)).toMatch(
      /No room/,
    );
    const body = rescueTurn([2, 2]);
    unit(body, "player-2-2").hp = 0;
    expect(validateCommand(body, unit(body, KNIGHT), command)).toMatch(
      /No room/,
    );
  });

  it("is aimed only at an ally next to the Knight, not one already behind", () => {
    const far = rescueTurn();
    unit(far, ALLY).position = { col: 3, row: 0 };
    expect(
      validateCommand(far, unit(far, KNIGHT), {
        ...command,
        cell: { side: "player", col: 3, row: 0 },
      }),
    ).toMatch(/next to you/);
    const placed = rescueTurn();
    unit(placed, KNIGHT).position = { col: 2, row: 1 };
    unit(placed, ALLY).position = { col: 2, row: 2 };
    expect(
      validateCommand(placed, unit(placed, KNIGHT), {
        ...command,
        cell: { side: "player", col: 2, row: 2 },
      }),
    ).toMatch(/already behind/);
  });

  it("is worth it to the AI for a hurt front-row ally, not a healthy one", () => {
    const value = (state: BattleState) =>
      skillValue(state, unit(state, KNIGHT), rescue, command.cell);
    expect(value(rescueTurn())).toBeGreaterThan(0);
    const healthy = rescueTurn();
    unit(healthy, ALLY).hp = 100;
    expect(value(healthy)).toBeLessThanOrEqual(0);
  });
});

describe("Silence", () => {
  const SAGE = "player-2-0";
  const FOE = "enemy-2-0";
  /** The Sage's turn, its foe a caster with MP to spare. */
  const sageTurn = () => {
    const state = turnOf(sage);
    const foe = unit(state, FOE);
    foe.skills = [firebolt, meteor];
    foe.mp = 99;
    return state;
  };
  const command = {
    type: "skill",
    skillId: silence.id,
    cell: { side: "enemy", col: 2, row: 0 },
  } as const;
  /** The foe silenced; then it is the foe's turn. */
  const foeTurn = () => {
    const after = act(sageTurn(), command).state;
    after.phase = { kind: "awaitingCommand", unitId: FOE };
    return after;
  };

  it("stops the enemy using skills but not attacking, for 9 MP", () => {
    const state = foeTurn();
    const foe = unit(state, FOE);
    expect(foe.statuses[0]).toMatchObject({ id: "silenced", harmful: true });
    expect(unit(state, SAGE).mp).toBe(sage.stats.maxMp - silence.mpCost);
    const bolt = {
      type: "skill",
      skillId: firebolt.id,
      cell: { side: "player", col: 2, row: 0 },
    } as const;
    expect(validateCommand(state, foe, bolt)).toMatch(/silenced/);
    expect(
      validateCommand(state, foe, { type: "attack", targetId: SAGE }),
    ).toBeNull();
  });

  it("wears off after a while, and Cure removes it", () => {
    let state = act(sageTurn(), command).state;
    const until = state.time + 150;
    while (state.time <= until && state.phase.kind !== "over") {
      state = advance(state).state;
      if (state.phase.kind === "awaitingCommand") {
        state = act(state, { type: "defend" }).state;
      }
    }
    expect(unit(state, FOE).statuses).toEqual([]);
    const cured = foeTurn();
    cleanse(unit(cured, FOE), []);
    expect(unit(cured, FOE).statuses).toEqual([]);
  });

  it("makes a cast in progress fizzle", () => {
    const state = sageTurn();
    const cell = { side: "player", col: 2, row: 0 } as const;
    unit(state, FOE).casting = {
      skillId: meteor.id,
      skillName: meteor.name,
      cell,
      area: [cell],
      startedAt: state.time,
      readyAt: state.time + 60,
    };
    const { state: after, events } = act(state, command);
    expect(unit(after, FOE).casting).toBeUndefined();
    expect(events).toContainEqual({
      type: "castFizzled",
      unitId: FOE,
      skillName: meteor.name,
    });
  });

  it("is worth it to the AI on a foe with skills, more on one casting", () => {
    const value = (state: BattleState) =>
      skillValue(state, unit(state, SAGE), silence, command.cell);
    const idle = sageTurn();
    expect(value(idle)).toBeGreaterThan(0);
    const casting = sageTurn();
    const cell = { side: "player", col: 2, row: 0 } as const;
    unit(casting, FOE).casting = {
      skillId: meteor.id,
      skillName: meteor.name,
      cell,
      area: [cell],
      startedAt: casting.time,
      readyAt: casting.time + 60,
    };
    expect(value(casting)).toBeGreaterThan(value(idle));
    expect(value(turnOf(sage))).toBeLessThanOrEqual(0);
  });
});
