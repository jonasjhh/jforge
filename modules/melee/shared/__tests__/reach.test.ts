import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { bow, spear, staff, sword } from "../content";
import { reachableTargets } from "../reach";
import { simulate } from "../simulate";
import type { BattleState, Placement, Weapon } from "../types";
import { def, place, sampleBattle } from "./helpers";

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

describe("weapon reach", () => {
  it.each<[string, Weapon, number, Placement[], string[]]>([
    [
      "a sword in the middle facing a full front row",
      sword,
      2,
      fullFrontRow,
      ["enemy-1-0", "enemy-2-0", "enemy-3-0"],
    ],
    [
      "a sword at the edge facing a full front row",
      sword,
      0,
      fullFrontRow,
      ["enemy-0-0", "enemy-1-0"],
    ],
    [
      "a sword facing a unit covered by one in front",
      sword,
      2,
      [foe(2, 0), foe(2, 1)],
      ["enemy-2-0"],
    ],
    [
      "a sword facing units whose front cells are empty",
      sword,
      2,
      [foe(2, 1), foe(3, 2)],
      ["enemy-2-1", "enemy-3-2"],
    ],
    [
      "a sword with no unit in range",
      sword,
      0,
      [foe(4, 0), foe(3, 1)],
      ["enemy-3-1"],
    ],
    [
      "a sword with two columns equally near",
      sword,
      2,
      [foe(0, 0), foe(4, 0)],
      ["enemy-0-0", "enemy-4-0"],
    ],
    [
      "a spear facing a column of three",
      spear,
      2,
      [foe(2, 0), foe(2, 1), foe(2, 2)],
      ["enemy-2-0", "enemy-2-1"],
    ],
    [
      "a bow facing columns far and near",
      bow,
      0,
      [foe(4, 0), foe(4, 1), foe(2, 2)],
      ["enemy-2-2", "enemy-4-0"],
    ],
    [
      "a staff facing a column of three",
      staff,
      0,
      [foe(4, 0), foe(4, 1), foe(4, 2)],
      ["enemy-4-0"],
    ],
    [
      "a staff facing two columns",
      staff,
      0,
      [foe(4, 2), foe(1, 1)],
      ["enemy-1-1", "enemy-4-2"],
    ],
  ])(
    "given %s, when its targets are listed, then it reaches the front-most it can",
    (_, weapon, col, enemies, reached) => {
      const targets = reach(weapon, col, enemies);

      expect(targets).toEqual(reached);
    },
  );

  it("given the unit in front knocked out, when a sword's targets are listed, then the unit behind is open", () => {
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

    const targets = reachIn(state, "player-2-0");

    expect(targets).toEqual(["enemy-2-1"]);
  });
});

describe("reach in battle", () => {
  const waiting = advance(
    createBattle(
      {
        placements: [
          place(def("hero", { speed: 20 }, sword), "player", 2),
          foe(2, 0),
          foe(2, 1),
        ],
      },
      1,
    ),
  ).state;

  it.each([
    ["the covered target", "enemy-2-1", true],
    ["the target in front", "enemy-2-0", false],
  ])(
    "given a swordsman facing a covered target, when it attacks %s, then it is out of reach: %s",
    (_, targetId, refused) => {
      const attack = () => act(waiting, { type: "attack", targetId });

      if (refused) expect(attack).toThrow(/out of reach/);
      else expect(attack).not.toThrow();
    },
  );

  it("given two AI swordsmen facing a guard covering an archer, when they fight, then they knock out the guard before hitting the archer", () => {
    const brute = def("brute", { attack: 30, speed: 12 }, sword);
    const placements = [
      place(def("guard", { maxHp: 60, attack: 0 }), "player", 2, 0),
      place(def("archer", { maxHp: 60, attack: 0 }), "player", 2, 2),
      place(brute, "enemy", 1),
      place(brute, "enemy", 3),
    ].map((p) => ({ ...p, control: "ai" as const }));

    const battle = advance(createBattle({ placements }, 3));

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

  it("given many seeds, when the sample battle is simulated, then each has a winner", () => {
    const draws: number[] = [];

    for (let seed = 0; seed < 50; seed++) {
      if (simulate(sampleBattle, seed).winner === null) draws.push(seed);
    }

    expect(draws).toEqual([]);
  });
});
