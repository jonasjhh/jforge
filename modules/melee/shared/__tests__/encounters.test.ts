import { describe, expect, it } from "vitest";
import { createBattle } from "../battle";
import { playerTypes, slime, wolf } from "../content";
import {
  DIFFICULTIES,
  THREAT_BUDGET,
  randomEncounter,
  type Difficulty,
} from "../encounters";
import { simulate } from "../simulate";

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

  it("keeps each difficulty in its win-rate band", () => {
    const winRate = (difficulty: Difficulty) => {
      const runs = 300;
      let wins = 0;
      for (let seed = 0; seed < runs; seed++) {
        if (
          simulate(randomEncounter(seed, difficulty), seed + 1000).winner ===
          "player"
        )
          wins++;
      }
      return wins / runs;
    };
    expect(winRate("easy")).toBeGreaterThanOrEqual(0.95);
    expect(winRate("normal")).toBeGreaterThanOrEqual(0.8);
    expect(winRate("normal")).toBeLessThanOrEqual(0.95);
    expect(winRate("hard")).toBeGreaterThanOrEqual(0.45);
    expect(winRate("hard")).toBeLessThanOrEqual(0.7);
    // 900 whole battles with skills on both sides take a few seconds.
  }, 30_000);
});
