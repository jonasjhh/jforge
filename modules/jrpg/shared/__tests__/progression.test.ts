import { describe, expect, it } from "vitest";
import {
  MAX_LEVEL,
  clampLevel,
  gainXp,
  statsAtLevel,
  xpToNext,
} from "../progression";
import { flatStats } from "@jforge/char/shared";

describe("clampLevel", () => {
  it.each([
    [0, 1],
    [1, 1],
    [2.4, 2],
    [2.5, 3],
    [MAX_LEVEL + 9, MAX_LEVEL],
    [NaN, 1],
  ])("given level %d, when it is clamped, then it is %d", (level, clamped) => {
    const result = clampLevel(level);

    expect(result).toBe(clamped);
  });
});

describe("statsAtLevel", () => {
  const base = { ...flatStats(10), maxHp: 100 };
  const growth = { ...flatStats(1), maxHp: 8, speed: 0.5 };

  it("given base stats and growth, when taken at level 1, then they are the base stats", () => {
    const stats = statsAtLevel(base, growth, 1);

    expect(stats).toEqual(base);
  });

  it("given base stats and growth, when taken at level 4, then growth is added three times, rounded", () => {
    const at4 = statsAtLevel(base, growth, 4);

    expect(at4.maxHp).toBe(124);
    expect(at4.attack).toBe(13);
    // 10 + 0.5 x 3 = 11.5, rounded.
    expect(at4.speed).toBe(12);
  });

  it("given growth that shrinks stats, when taken at level 10, then stats stop at 0 and HP at 1", () => {
    const shrinking = statsAtLevel(base, flatStats(-50), 10);

    expect(shrinking.attack).toBe(0);
    expect(shrinking.maxHp).toBe(1);
  });

  it.each([
    [0, 1],
    [999, MAX_LEVEL],
  ])(
    "given level %i, out of range, when stats are taken at it, then they are those of level %i",
    (level, nearest) => {
      const stats = statsAtLevel(base, growth, level);

      expect(stats).toEqual(statsAtLevel(base, growth, nearest));
    },
  );
});

describe("xpToNext", () => {
  it.each([
    [1, 100],
    [5, 500],
    [MAX_LEVEL, 0],
  ])(
    "given level %i, when the XP to the next level is worked out, then it is %i",
    (level, xp) => {
      const needed = xpToNext(level);

      expect(needed).toBe(xp);
    },
  );
});

describe("gainXp", () => {
  it.each([
    ["XP below the threshold", { level: 1, xp: 20 }, 30, { level: 1, xp: 50 }],
    ["XP over the threshold", { level: 1, xp: 90 }, 30, { level: 2, xp: 20 }],
    // 100 + 200 + 300 = 600 to reach level 4.
    ["XP for three levels", { level: 1, xp: 0 }, 650, { level: 4, xp: 50 }],
    [
      "huge XP just below the top",
      { level: MAX_LEVEL - 1, xp: 0 },
      1e9,
      { level: MAX_LEVEL, xp: 0 },
    ],
    [
      "XP at the top level",
      { level: MAX_LEVEL, xp: 0 },
      500,
      { level: MAX_LEVEL, xp: 0 },
    ],
    ["negative XP", { level: 2, xp: 10 }, -50, { level: 2, xp: 10 }],
  ])(
    "given %s, when it is gained, then the level and XP are as expected",
    (_, from, amount, to) => {
      const result = gainXp(from, amount);

      expect(result).toEqual(to);
    },
  );
});
