import { describe, expect, it } from "vitest";
import {
  BASE_INCOME,
  MAX_INTEREST,
  MAX_LEVEL,
  gainXp,
  income,
  interest,
  streakGold,
  xpToNext,
} from "../economy";

describe("streakGold", () => {
  it.each([
    [0, 0],
    [1, 0],
    [2, 1],
    [-3, 1],
    [4, 2],
    [-5, 3],
    [9, 3],
  ])(
    "given a streak of %i, when its gold is worked out, then it pays %i",
    (streak, gold) => {
      const paid = streakGold(streak);

      expect(paid).toBe(gold);
    },
  );
});

describe("interest", () => {
  it.each([
    [9, 0],
    [10, 1],
    [39, 3],
    [500, MAX_INTEREST],
  ])(
    "given %i gold, when interest is worked out, then it is %i",
    (gold, paid) => {
      const result = interest(gold);

      expect(result).toBe(paid);
    },
  );
});

describe("income", () => {
  it("given 20 gold on a 4-win streak, when a round pays, then it pays the base, interest and streak gold", () => {
    const paid = income(20, 4);

    expect(paid).toBe(BASE_INCOME + 2 + 2);
  });
});

describe("xpToNext", () => {
  it("given the first level, when the experience needed is asked, then it is 2", () => {
    const need = xpToNext(1);

    expect(need).toBe(2);
  });

  it("given the top level, when the experience needed is asked, then there is none", () => {
    const need = xpToNext(MAX_LEVEL);

    expect(need).toBeNull();
  });
});

describe("gainXp", () => {
  it("given too little experience for a level, when it is gained, then it is kept", () => {
    const grown = gainXp(3, 1, 4);

    expect(grown).toEqual({ level: 3, xp: 5 });
  });

  it("given enough experience for two levels, when it is gained, then both are reached with the rest kept", () => {
    const grown = gainXp(1, 0, 5);

    expect(grown).toEqual({ level: 3, xp: 1 });
  });

  it("given a level short of the top, when more than enough is gained, then the top is reached with no experience", () => {
    const grown = gainXp(MAX_LEVEL - 1, 80, 40);

    expect(grown).toEqual({ level: MAX_LEVEL, xp: 0 });
  });
});
