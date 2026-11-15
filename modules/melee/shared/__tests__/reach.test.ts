import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { bow, sampleBattle, spear, staff, sword } from "../content";
import { reachableTargets } from "../reach";
import { simulate } from "../simulate";
import type { BattleState, Placement, Weapon } from "../types";
import { def, place } from "./helpers";

const foe = (col: number, row: number) =>
  place(def(`foe${col}${row}`), "enemy", col, row);

/** Enemy unit IDs the attacker at player column `col` can reach. */
function reach(weapon: Weapon, col: number, enemies: Placement[]): string[] {
  const state = createBattle(
    { placements: [place(def("hero", {}, weapon), "player", col), ...enemies] },
    1,
  );
  return reachIn(state, `player-${col}-0`);
}

function reachIn(state: BattleState, attackerId: string): string[] {
  const attacker = state.units.find((u) => u.id === attackerId)!;
  return reachableTargets(state, attacker)
    .map((u) => u.id)
    .sort();
}

const fullFrontRow = [0, 1, 2, 3, 4].map((col) => foe(col, 0));

describe("sword", () => {
  it("reaches its own column and both neighbours", () => {
    expect(reach(sword, 2, fullFrontRow)).toEqual([
      "enemy-1-0",
      "enemy-2-0",
      "enemy-3-0",
    ]);
  });

  it("reaches two columns at the edge of the grid", () => {
    expect(reach(sword, 0, fullFrontRow)).toEqual(["enemy-0-0", "enemy-1-0"]);
  });

  it("cannot reach a unit covered by one in front", () => {
    expect(reach(sword, 2, [foe(2, 0), foe(2, 1)])).toEqual(["enemy-2-0"]);
  });

  it("reaches a unit whose front cell is empty", () => {
    expect(reach(sword, 2, [foe(2, 1), foe(3, 2)])).toEqual([
      "enemy-2-1",
      "enemy-3-2",
    ]);
  });

  it("opens the unit behind once the one in front is knocked out", () => {
    const state = createBattle(
      {
        placements: [
          place(def("hero", {}, sword), "player", 2),
          foe(2, 0),
          foe(2, 1),
        ],
      },
      1,
    );
    state.units.find((u) => u.id === "enemy-2-0")!.hp = 0;
    expect(reachIn(state, "player-2-0")).toEqual(["enemy-2-1"]);
  });

  it("attacks the nearest occupied column when none is in range", () => {
    expect(reach(sword, 0, [foe(4, 0), foe(3, 1)])).toEqual(["enemy-3-1"]);
    expect(reach(sword, 2, [foe(0, 0), foe(4, 0)])).toEqual([
      "enemy-0-0",
      "enemy-4-0",
    ]);
  });
});

describe("spear", () => {
  it("also reaches the unit behind the front-most, but no deeper", () => {
    expect(reach(spear, 2, [foe(2, 0), foe(2, 1), foe(2, 2)])).toEqual([
      "enemy-2-0",
      "enemy-2-1",
    ]);
  });
});

describe("bow", () => {
  it("reaches any column, but only the front-most unit in each", () => {
    expect(reach(bow, 0, [foe(4, 0), foe(4, 1), foe(2, 2)])).toEqual([
      "enemy-2-2",
      "enemy-4-0",
    ]);
  });
});

describe("staff", () => {
  it("ignores columns and cover", () => {
    expect(reach(staff, 0, [foe(4, 0), foe(4, 1), foe(4, 2)])).toEqual([
      "enemy-4-0",
      "enemy-4-1",
      "enemy-4-2",
    ]);
  });
});

describe("reach in battle", () => {
  it("rejects a player attack on a covered target", () => {
    const setup = {
      placements: [
        place(def("hero", { speed: 20 }, sword), "player", 2),
        foe(2, 0),
        foe(2, 1),
      ],
    };
    const waiting = advance(createBattle(setup, 1)).state;
    expect(() =>
      act(waiting, { type: "attack", targetId: "enemy-2-1" }),
    ).toThrow(/out of reach/);
    expect(() =>
      act(waiting, { type: "attack", targetId: "enemy-2-0" }),
    ).not.toThrow();
  });

  it("makes the AI hit the front line before what it covers", () => {
    // Two swordsmen attack a party where the guard covers the archer.
    const brute = def("brute", { attack: 30, speed: 12 }, sword);
    const setup = {
      placements: [
        place(def("guard", { maxHp: 60, attack: 0 }), "player", 2, 0),
        place(def("archer", { maxHp: 60, attack: 0 }), "player", 2, 2),
        place(brute, "enemy", 1),
        place(brute, "enemy", 3),
      ],
    };
    const battle = advance(
      createBattle(
        {
          placements: setup.placements.map((p) => ({
            ...p,
            control: "ai" as const,
          })),
        },
        3,
      ),
    );
    const hits = battle.events.flatMap((e) =>
      e.type === "attack" && e.unitId.startsWith("enemy") ? [e.targetId] : [],
    );
    const guardDown = battle.events.findIndex(
      (e) => e.type === "knockedOut" && e.unitId === "player-2-0",
    );
    const firstArcherHit = battle.events.findIndex(
      (e) => e.type === "attack" && e.targetId === "player-2-2",
    );
    expect(hits[0]).toBe("player-2-0");
    expect(guardDown).toBeGreaterThan(-1);
    expect(firstArcherHit).toBeGreaterThan(guardDown);
  });

  it("plays the sample battle to a winner for many seeds", () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(simulate(sampleBattle, seed).winner).not.toBeNull();
    }
  });
});
