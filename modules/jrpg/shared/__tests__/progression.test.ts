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
  it("keeps levels whole and within 1..MAX_LEVEL", () => {
    expect([0, 1, 2.4, 2.5, MAX_LEVEL + 9, NaN].map(clampLevel)).toEqual([
      1,
      1,
      2,
      3,
      MAX_LEVEL,
      1,
    ]);
  });
});

describe("statsAtLevel", () => {
  const base = { ...flatStats(10), maxHp: 100 };
  const growth = { ...flatStats(1), maxHp: 8, speed: 0.5 };

  it("is the base stats at level 1", () => {
    expect(statsAtLevel(base, growth, 1)).toEqual(base);
  });

  it("adds growth for every level above the first, rounded", () => {
    const at4 = statsAtLevel(base, growth, 4);
    expect(at4.maxHp).toBe(124);
    expect(at4.attack).toBe(13);
    // 10 + 0.5 x 3 = 11.5, rounded.
    expect(at4.speed).toBe(12);
  });

  it("never drops below 0, or below 1 HP", () => {
    const shrinking = statsAtLevel(base, flatStats(-50), 10);
    expect(shrinking.attack).toBe(0);
    expect(shrinking.maxHp).toBe(1);
  });

  it("treats levels out of range as the nearest allowed", () => {
    expect(statsAtLevel(base, growth, 0)).toEqual(base);
    expect(statsAtLevel(base, growth, 999)).toEqual(
      statsAtLevel(base, growth, MAX_LEVEL),
    );
  });
});

describe("xpToNext", () => {
  it("costs more each level and nothing at the top", () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(5)).toBe(500);
    expect(xpToNext(MAX_LEVEL)).toBe(0);
  });
});

describe("gainXp", () => {
  it("gathers experience below the threshold", () => {
    expect(gainXp({ level: 1, xp: 20 }, 30)).toEqual({ level: 1, xp: 50 });
  });

  it("levels up and carries the rest over", () => {
    expect(gainXp({ level: 1, xp: 90 }, 30)).toEqual({ level: 2, xp: 20 });
  });

  it("can climb several levels at once", () => {
    // 100 + 200 + 300 = 600 to reach level 4.
    expect(gainXp({ level: 1, xp: 0 }, 650)).toEqual({ level: 4, xp: 50 });
  });

  it("stops at the top level and gathers nothing more", () => {
    expect(gainXp({ level: MAX_LEVEL - 1, xp: 0 }, 1e9)).toEqual({
      level: MAX_LEVEL,
      xp: 0,
    });
    expect(gainXp({ level: MAX_LEVEL, xp: 0 }, 500)).toEqual({
      level: MAX_LEVEL,
      xp: 0,
    });
  });

  it("ignores negative amounts", () => {
    expect(gainXp({ level: 2, xp: 10 }, -50)).toEqual({ level: 2, xp: 10 });
  });
});
