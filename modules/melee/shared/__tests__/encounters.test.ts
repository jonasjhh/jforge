import { describe, expect, it } from "vitest";
import { createBattle } from "../battle";
import { playerTypes, slime, wolf } from "../content";
import {
  DIFFICULTIES,
  MAX_BACK_PER_FRONT,
  THREAT_BUDGET,
  isBackLiner,
  randomEncounter,
  type Difficulty,
} from "../encounters";
import { anywhere } from "./helpers";

const threatOf = (seed: number, difficulty: Difficulty) =>
  randomEncounter(seed, difficulty)
    .placements.filter((p) => p.side === "enemy")
    .reduce((sum, p) => sum + (p.def.threat ?? 1), 0);

describe("randomEncounter", () => {
  it("given the same seed and difficulty, when two encounters are made, then they are the same", () => {
    const first = randomEncounter(42, "normal");

    const second = randomEncounter(42, "normal");

    expect(second).toEqual(first);
  });

  it("given another seed, when an encounter is made, then it differs", () => {
    const first = randomEncounter(42, "normal");

    const other = randomEncounter(43, "normal");

    expect(other).not.toEqual(first);
  });

  it("given many seeds and each difficulty, when encounters are made, then each spends its budget without going over", () => {
    const cheapest = Math.min(slime.threat!, wolf.threat!);
    const wrong: string[] = [];

    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 50; seed++) {
        const threat = threatOf(seed, difficulty);
        const left = THREAT_BUDGET[difficulty] - threat;
        // Stops only when not even the cheapest monster fits.
        if (left < 0 || left >= cheapest)
          wrong.push(`${difficulty} ${seed}: ${threat}`);
      }
    }

    expect(wrong).toEqual([]);
  });

  it("given many seeds and each difficulty, when battles are built from the encounters, then each is valid", () => {
    const wrong: string[] = [];

    for (let seed = 0; seed < 100; seed++) {
      for (const difficulty of DIFFICULTIES) {
        try {
          createBattle(randomEncounter(seed, difficulty), seed);
        } catch {
          wrong.push(`${difficulty} ${seed}`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });

  it("given many seeds, when encounters are made, then each party is up to five distinct heroes in roster order and preferred rows, and line-ups vary", () => {
    const order = playerTypes.map((t) => t.id);
    const parties = new Set<string>();
    const wrong: number[] = [];

    for (let seed = 0; seed < 50; seed++) {
      const party = randomEncounter(seed, "normal").placements.filter(
        (p) => p.side === "player",
      );
      const ids = party.map((p) => p.def.id);
      const sorted = [...ids].sort(
        (a, b) => order.indexOf(a) - order.indexOf(b),
      );
      const ok =
        ids.length === Math.min(5, playerTypes.length) &&
        new Set(ids).size === ids.length &&
        sorted.join() === ids.join() &&
        party.every((p) => p.position.row === p.def.preferredRow);
      if (!ok) wrong.push(seed);
      parties.add(ids.join(","));
    }

    expect(wrong).toEqual([]);
    expect(parties.size).toBeGreaterThan(1);
  });

  it("given a pool of only wolves, when an easy encounter is made, then it is as many wolves as the budget buys", () => {
    const pool = { party: playerTypes, monsters: [wolf] };

    const setup = randomEncounter(1, "easy", pool);

    const enemies = setup.placements.filter((p) => p.side === "enemy");
    expect(enemies.every((p) => p.def.id === "wolf")).toBe(true);
    expect(enemies).toHaveLength(Math.floor(THREAT_BUDGET.easy / wolf.threat!));
  });

  it("given every monster costs more than the budget, when an encounter is made, then it still places one", () => {
    const giant = { ...wolf, id: "giant", threat: THREAT_BUDGET.hard + 1 };
    const pool = {
      party: playerTypes,
      monsters: [giant, { ...giant, id: "titan", threat: 40 }],
    };

    const setup = randomEncounter(1, "easy", pool);

    const enemies = setup.placements.filter((p) => p.side === "enemy");
    expect(enemies.map((p) => p.def.id)).toEqual(["giant"]);
  });

  describe("back-liners", () => {
    const cheap = { ...wolf, id: "cheap", threat: 1 };
    const shooter = { ...wolf, id: "shooter", threat: 1, preferredRow: 2 };
    const enemiesOf = (seed: number, monsters = [cheap, shooter]) =>
      randomEncounter(seed, "hard", { party: [], monsters }).placements;

    it.each([
      ["a front-row melee monster", wolf, false],
      ["a monster preferring the back row", shooter, true],
      ["a monster with a ranged weapon", { ...wolf, weapon: anywhere }, true],
    ])(
      "given %s, when it is checked, then it is a back-liner: %s",
      (_, monster, back) => {
        const result = isBackLiner(monster);

        expect(result).toBe(back);
      },
    );

    it("given many seeds, when encounters are made, then back-liners are at most two thirds of the monsters", () => {
      const wrong: number[] = [];

      for (let seed = 0; seed < 50; seed++) {
        const enemies = enemiesOf(seed);
        const back = enemies.filter((p) => isBackLiner(p.def)).length;
        if (back > MAX_BACK_PER_FRONT * (enemies.length - back))
          wrong.push(seed);
      }

      expect(wrong).toEqual([]);
    });

    it("given many seeds, when encounters are made, then a front-liner comes first", () => {
      const wrong: number[] = [];

      for (let seed = 0; seed < 20; seed++) {
        if (isBackLiner(enemiesOf(seed)[0]!.def)) wrong.push(seed);
      }

      expect(wrong).toEqual([]);
    });

    it("given a pool with no front-liner, when a hard encounter is made, then it fills the back row first, then the rows in front", () => {
      const pool = [shooter];

      const enemies = enemiesOf(1, pool);

      // A budget of 27 at 1 each fills all 15 cells, back row first.
      expect(enemies).toHaveLength(15);
      expect(enemies.slice(0, 5).every((p) => p.position.row === 2)).toBe(true);
    });
  });

  it("given room in every row, when an encounter is made, then monsters stand in their preferred rows", () => {
    // Five monsters at most, so no row runs out of room.
    const shooter = { ...wolf, id: "shooter", preferredRow: 2 };

    const enemies = randomEncounter(3, "easy", {
      party: [],
      monsters: [wolf, shooter],
    }).placements;

    expect(
      enemies.filter((p) => p.position.row !== (p.def.preferredRow ?? 0)),
    ).toEqual([]);
  });
});
