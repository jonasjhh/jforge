import { describe, expect, it } from "vitest";
import { starterLibrary } from "@jforge/char/shared";
import { BOARD_COLUMNS, BOARD_ROWS } from "../hex";
import {
  BASE_BUDGET,
  MAX_PACK,
  ROUNDS,
  ROUNDS_PER_STAGE,
  STAGE_END_BUDGET,
  isStageEnd,
  monsterPool,
  roundBudget,
  roundPack,
  stageOf,
} from "../monsters";

const library = starterLibrary();

describe("stageOf and isStageEnd", () => {
  it.each([
    [1, 1, false],
    [ROUNDS_PER_STAGE, 1, true],
    [ROUNDS_PER_STAGE + 1, 2, false],
    [ROUNDS, ROUNDS / ROUNDS_PER_STAGE, true],
  ])(
    "given round %i, when its stage is asked, then it is %i and its end is %s",
    (round, stage, end) => {
      const result = [stageOf(round), isStageEnd(round)];

      expect(result).toEqual([stage, end]);
    },
  );
});

describe("roundBudget", () => {
  it("given the first round, when its budget is asked, then it is the base budget", () => {
    const budget = roundBudget(1);

    expect(budget).toBe(BASE_BUDGET);
  });

  it("given a stage's last round, when its budget is asked, then it is raised over the round before's growth", () => {
    const before = roundBudget(ROUNDS_PER_STAGE - 1);

    const end = roundBudget(ROUNDS_PER_STAGE);

    expect(end).toBeGreaterThan(before * STAGE_END_BUDGET);
  });
});

describe("monsterPool", () => {
  it("given the starter library, when the pool is made, then it has no obstacles", () => {
    const pool = monsterPool(library, 1);

    expect(pool.length).toBeGreaterThan(0);
    expect(pool.some((m) => m.obstacle)).toBe(false);
  });

  it("given a later stage, when the pool is made, then the same monsters are stronger", () => {
    const first = monsterPool(library, 1);

    const third = monsterPool(library, 3);

    expect(third[0]!.stats.maxHp).toBeGreaterThan(first[0]!.stats.maxHp);
    expect(third[0]!.threat).toBe(first[0]!.threat);
  });
});

describe("roundPack", () => {
  it("given a round and seed, when the pack is drawn twice, then it is the same pack", () => {
    const first = roundPack(library, 7, 99);

    const second = roundPack(library, 7, 99);

    expect(second).toEqual(first);
  });

  it("given a round, when the pack is drawn, then its threat stays within the budget", () => {
    const pack = roundPack(library, 12, 3);

    const threat = pack.reduce((sum, m) => sum + (m.def.threat ?? 1), 0);
    expect(threat).toBeLessThanOrEqual(roundBudget(12));
    expect(pack.length).toBeGreaterThan(0);
  });

  it("given the last round, when the pack is drawn, then it has at most MAX_PACK monsters, each in its own hex on the board", () => {
    const pack = roundPack(library, ROUNDS, 5);

    const cells = new Set(
      pack.map((m) => `${m.position.col},${m.position.row}`),
    );
    expect(pack.length).toBeLessThanOrEqual(MAX_PACK);
    expect(cells.size).toBe(pack.length);
    expect(
      pack.every(
        (m) => m.position.col < BOARD_COLUMNS && m.position.row < BOARD_ROWS,
      ),
    ).toBe(true);
  });

  it("given a pack's monsters, when they are drawn, then each has its own id and keeps its portrait", () => {
    const pack = roundPack(library, 10, 1);

    const ids = new Set(pack.map((m) => m.def.id));
    expect(ids.size).toBe(pack.length);
    expect(pack.every((m) => m.def.portrait)).toBe(true);
  });
});
