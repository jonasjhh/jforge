import { describe, expect, it } from "vitest";
import { act, advance, createBattle, validateCommand } from "../battle";
import { expose, knight, playerTypes, sage, shieldWall } from "../content";
import { EXPOSE_FACTOR, resistance } from "../damage";
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
  it("are melee player types with one skill each", () => {
    expect(playerTypes).toContain(knight);
    expect(playerTypes).toContain(sage);
    expect(knight.skills).toEqual([shieldWall]);
    expect(sage.skills).toEqual([expose]);
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
