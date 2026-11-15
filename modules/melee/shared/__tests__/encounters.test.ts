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

  it("puts the whole party in its preferred rows", () => {
    for (let seed = 0; seed < 50; seed++) {
      const party = randomEncounter(seed, "normal").placements.filter(
        (p) => p.side === "player",
      );
      expect(party.map((p) => p.def.id)).toEqual(playerTypes.map((t) => t.id));
      for (const p of party) expect(p.position.row).toBe(p.def.preferredRow);
    }
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

  it("keeps each difficulty in its win-rate band (attacks only)", () => {
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
    expect(winRate("easy")).toBeGreaterThanOrEqual(0.85);
    expect(winRate("normal")).toBeGreaterThanOrEqual(0.6);
    expect(winRate("normal")).toBeLessThanOrEqual(0.88);
    expect(winRate("hard")).toBeGreaterThanOrEqual(0.3);
    expect(winRate("hard")).toBeLessThanOrEqual(0.6);
  });
});
