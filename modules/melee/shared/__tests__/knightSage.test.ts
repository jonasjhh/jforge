import { describe, expect, it } from "vitest";
import { act, advance, createBattle, validateCommand } from "../battle";
import {
  expose,
  fireball,
  firebolt,
  guard,
  knight,
  playerTypes,
  sage,
  shieldBash,
  shieldWall,
} from "../content";
import { EXPOSE_FACTOR, resistance } from "../damage";
import { skillValue } from "../aiSkills";
import { skillArea } from "../skills";
import { effectiveStat } from "../stats";
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
    expect(knight.skills).toEqual([shieldWall, guard, shieldBash]);
    expect(sage.skills).toEqual([expose]);
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
