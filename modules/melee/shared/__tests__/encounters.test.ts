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
  it("gives the same encounter for the same seed and difficulty", () => {
    expect(randomEncounter(42, "normal")).toEqual(
      randomEncounter(42, "normal"),
    );
    expect(randomEncounter(42, "normal")).not.toEqual(
      randomEncounter(43, "normal"),
    );
  });

  it("spends the threat budget without going over", () => {
    const cheapest = Math.min(slime.threat!, wolf.threat!);
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 50; seed++) {
        const threat = threatOf(seed, difficulty);
        expect(threat).toBeLessThanOrEqual(THREAT_BUDGET[difficulty]);
        // Stops only when not even the cheapest monster fits.
        expect(THREAT_BUDGET[difficulty] - threat).toBeLessThan(cheapest);
      }
    }
  });

  it("builds a valid battle every time", () => {
    for (let seed = 0; seed < 100; seed++) {
      for (const difficulty of DIFFICULTIES) {
        expect(() =>
          createBattle(randomEncounter(seed, difficulty), seed),
        ).not.toThrow();
      }
    }
  });

  it("picks a party of up to five from the roster, in preferred rows", () => {
    const parties = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      const party = randomEncounter(seed, "normal").placements.filter(
        (p) => p.side === "player",
      );
      const ids = party.map((p) => p.def.id);
      expect(ids).toHaveLength(Math.min(5, playerTypes.length));
      expect(new Set(ids).size).toBe(ids.length);
      // Kept in roster order.
      const order = playerTypes.map((t) => t.id);
      expect(
        [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
      ).toEqual(ids);
      for (const p of party) expect(p.position.row).toBe(p.def.preferredRow);
      parties.add(ids.join(","));
    }
    // Different seeds give different line-ups.
    expect(parties.size).toBeGreaterThan(1);
  });

  it("can use a custom monster pool", () => {
    const setup = randomEncounter(1, "easy", {
      party: playerTypes,
      monsters: [wolf],
    });
    const enemies = setup.placements.filter((p) => p.side === "enemy");
    expect(enemies.every((p) => p.def.id === "wolf")).toBe(true);
    expect(enemies).toHaveLength(Math.floor(THREAT_BUDGET.easy / wolf.threat!));
  });

  it("still places one monster when every one costs more than the budget", () => {
    const giant = { ...wolf, id: "giant", threat: THREAT_BUDGET.hard + 1 };
    const setup = randomEncounter(1, "easy", {
      party: playerTypes,
      monsters: [giant, { ...giant, id: "titan", threat: 40 }],
    });
    const enemies = setup.placements.filter((p) => p.side === "enemy");
    expect(enemies.map((p) => p.def.id)).toEqual(["giant"]);
  });

  describe("back-liners", () => {
    const cheap = { ...wolf, id: "cheap", threat: 1 };
    const shooter = { ...wolf, id: "shooter", threat: 1, preferredRow: 2 };
    const enemiesOf = (seed: number, monsters = [cheap, shooter]) =>
      randomEncounter(seed, "hard", { party: [], monsters }).placements;

    it("counts a ranged weapon or a row past the front", () => {
      expect(isBackLiner(wolf)).toBe(false);
      expect(isBackLiner(shooter)).toBe(true);
      expect(isBackLiner({ ...wolf, weapon: anywhere })).toBe(true);
    });

    it("are at most two thirds of the monsters", () => {
      for (let seed = 0; seed < 50; seed++) {
        const enemies = enemiesOf(seed);
        const back = enemies.filter((p) => isBackLiner(p.def)).length;
        expect(back).toBeLessThanOrEqual(
          MAX_BACK_PER_FRONT * (enemies.length - back),
        );
      }
    });

    it("come after a front-liner", () => {
      for (let seed = 0; seed < 20; seed++) {
        expect(isBackLiner(enemiesOf(seed)[0]!.def)).toBe(false);
      }
    });

    it("fill a pool with no front-liner, then the rows in front", () => {
      // A budget of 27 at 1 each fills all 15 cells, back row first.
      const enemies = enemiesOf(1, [shooter]);
      expect(enemies).toHaveLength(15);
      expect(enemies.slice(0, 5).every((p) => p.position.row === 2)).toBe(true);
    });
  });

  it("puts monsters in their preferred row while it has room", () => {
    // Five monsters at most, so no row runs out of room.
    const shooter = { ...wolf, id: "shooter", preferredRow: 2 };
    const enemies = randomEncounter(3, "easy", {
      party: [],
      monsters: [wolf, shooter],
    }).placements;
    for (const p of enemies) {
      expect(p.position.row).toBe(p.def.preferredRow ?? 0);
    }
  });
});
