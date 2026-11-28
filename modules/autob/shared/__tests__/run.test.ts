import { describe, expect, it } from "vitest";
import { autobLibrary } from "@jforge/content/autob";
import { SAVE_VERSION } from "../save";
import {
  BASE_INCOME,
  REROLL_COST,
  WIN_GOLD,
  XP_COST,
  XP_PER_BUY,
  MAX_LEVEL,
} from "../economy";
import { BOARD_COLUMNS, BOARD_ROWS } from "../hex";
import { ROUNDS } from "../monsters";
import { BENCH_SIZE, POOL_COPIES, SHOP_SIZE } from "../shop";
import {
  START_LIVES,
  boardLimit,
  buy,
  buyXp,
  finishRound,
  ownedUnits,
  packOf,
  parseRun,
  place,
  reroll,
  roundFight,
  roundsCleared,
  runLibrary,
  sell,
  startRun,
  toBench,
  type Run,
} from "../run";
import type { OwnedUnit } from "../units";

const library = autobLibrary();
const knight = "melee-knight";

/** A fresh run with rich pockets and a shop of nothing but Knights. */
const fresh = (changes: Partial<Run> = {}): Run => ({
  ...startRun(library, 1),
  gold: 50,
  shop: Array.from({ length: SHOP_SIZE }, () => knight),
  ...changes,
});

const unit = (uid: string, stars = 1, classId = knight): OwnedUnit => ({
  uid,
  classId,
  stars,
});

const bench = (...units: OwnedUnit[]) =>
  Array.from({ length: BENCH_SIZE }, (_, i) => units[i] ?? null);

describe("runLibrary", () => {
  it("given no library, when the run's library is asked, then it is autob's content", () => {
    const result = runLibrary(null);

    expect(result).toEqual(autobLibrary());
  });

  it("given a library, when the run's library is asked, then it is that library", () => {
    const given = { ...autobLibrary(), characters: [] };

    const result = runLibrary(given);

    expect(result).toBe(given);
  });
});

describe("startRun", () => {
  it("given a seed, when a run starts, then it is round 1 with full lives, the first income and a full shop", () => {
    const run = startRun(library, 1);

    expect(run).toMatchObject({
      version: SAVE_VERSION,
      round: 1,
      lives: START_LIVES,
      gold: BASE_INCOME,
      level: 1,
      outcome: "playing",
    });
    expect(run.shop.filter(Boolean)).toHaveLength(SHOP_SIZE);
    expect(run.bench).toEqual(bench());
  });

  it("given the same seed twice, when runs start, then their shops match", () => {
    const first = startRun(library, 9);

    const second = startRun(library, 9);

    expect(second.shop).toEqual(first.shop);
  });

  it("given a library, when a run starts and the library changes later, then the run keeps its copy", () => {
    const source = autobLibrary();
    const run = startRun(source, 1);

    source.archetypes.length = 0;

    expect(run.library.archetypes.length).toBeGreaterThan(0);
  });
});

describe("buy", () => {
  it("given gold and a shop offer, when it is bought, then the unit sits on the bench and the gold and pool go down", () => {
    const run = fresh();

    const next = buy(run, 0)!;

    expect(next.bench[0]).toEqual(unit("u1"));
    expect(next.gold).toBe(50 - next.tiers[knight]!);
    expect(next.shop[0]).toBeNull();
    expect(next.pool[knight]).toBe(run.pool[knight]! - 1);
  });

  it("given too little gold, when an offer is bought, then it is refused", () => {
    const result = buy(fresh({ gold: 0 }), 0);

    expect(result).toBeNull();
  });

  it("given a sold-out slot, when it is bought, then it is refused", () => {
    const result = buy(fresh({ shop: [null] }), 0);

    expect(result).toBeNull();
  });

  it("given a finished run, when an offer is bought, then it is refused", () => {
    const result = buy(fresh({ outcome: "lost" }), 0);

    expect(result).toBeNull();
  });

  it("given two Knights owned, when a third is bought, then they merge into one 2-star Knight", () => {
    const run = fresh({ bench: bench(unit("a"), unit("b")), units: 2 });

    const next = buy(run, 0)!;

    expect(ownedUnits(next)).toEqual([unit("a", 2)]);
  });

  it("given a 2-star on the board and two more merges' worth, when the last copy is bought, then a 3-star stands on the board", () => {
    const run = fresh({
      board: [{ unit: unit("a", 2), position: { col: 0, row: 0 } }],
      bench: bench(unit("b", 2), unit("c"), unit("d")),
      units: 4,
    });

    const next = buy(run, 0)!;

    expect(next.board).toEqual([
      { unit: unit("a", 3), position: { col: 0, row: 0 } },
    ]);
    expect(next.bench).toEqual(bench());
  });

  it("given a full bench, when a copy that doesn't merge is bought, then it is refused", () => {
    const full = bench(
      ...Array.from({ length: BENCH_SIZE }, (_, i) =>
        unit(`x${i}`, 1, i % 2 ? "melee-archer" : "melee-mage"),
      ),
    );

    const result = buy(fresh({ bench: full }), 0);

    expect(result).toBeNull();
  });

  it("given a full bench holding two Knights, when a third is bought, then it merges", () => {
    const others = Array.from({ length: BENCH_SIZE - 2 }, (_, i) =>
      unit(`x${i}`, 1, i % 2 ? "melee-archer" : "melee-mage"),
    );
    const run = fresh({
      bench: bench(unit("a"), unit("b"), ...others),
      units: 9,
    });

    const next = buy(run, 0)!;

    expect(next.bench).toHaveLength(BENCH_SIZE);
    expect(next.bench[0]).toEqual(unit("a", 2));
  });
});

describe("sell", () => {
  it("given a 2-star unit, when it is sold, then it pays its copies' cost and they return to the pool", () => {
    const run = fresh({ bench: bench(unit("a", 2)) });

    const next = sell(run, "a")!;

    expect(next.gold).toBe(50 + 3 * run.tiers[knight]!);
    expect(next.pool[knight]).toBe(run.pool[knight]! + 3);
    expect(next.bench).toEqual(bench());
  });

  it("given a unit on the board, when it is sold, then it leaves the board", () => {
    const run = fresh({
      board: [{ unit: unit("a"), position: { col: 0, row: 0 } }],
    });

    const next = sell(run, "a")!;

    expect(next.board).toEqual([]);
  });

  it("given an unknown unit, when it is sold, then it is refused", () => {
    const result = sell(fresh(), "nobody");

    expect(result).toBeNull();
  });
});

describe("reroll", () => {
  it("given enough gold, when the shop is rerolled, then it costs REROLL_COST and rolls a new shop", () => {
    const run = fresh();

    const next = reroll(run)!;

    expect(next.gold).toBe(50 - REROLL_COST);
    expect(next.rolls).toBe(run.rolls + 1);
  });

  it("given too little gold, when the shop is rerolled, then it is refused", () => {
    const result = reroll(fresh({ gold: REROLL_COST - 1 }));

    expect(result).toBeNull();
  });
});

describe("buyXp", () => {
  it("given enough gold, when experience is bought, then it costs XP_COST and levels up as it pays for", () => {
    const next = buyXp(fresh())!;

    expect(next.gold).toBe(50 - XP_COST);
    expect(next).toMatchObject({ level: 3, xp: XP_PER_BUY - 4 });
  });

  it("given the top level, when experience is bought, then it is refused", () => {
    const result = buyXp(fresh({ level: MAX_LEVEL }));

    expect(result).toBeNull();
  });

  it("given too little gold, when experience is bought, then it is refused", () => {
    const result = buyXp(fresh({ gold: XP_COST - 1 }));

    expect(result).toBeNull();
  });
});

describe("place", () => {
  it("given room under the level, when a bench unit is placed on a free hex, then it stands there", () => {
    const run = fresh({ bench: bench(unit("a")) });

    const next = place(run, "a", { col: 2, row: 1 })!;

    expect(next.board).toEqual([
      { unit: unit("a"), position: { col: 2, row: 1 } },
    ]);
    expect(next.bench).toEqual(bench());
  });

  it("given a full board, when a bench unit is placed on a free hex, then it is refused", () => {
    const run = fresh({
      bench: bench(unit("b")),
      board: [{ unit: unit("a"), position: { col: 0, row: 0 } }],
    });

    const result = place(run, "b", { col: 1, row: 0 });

    expect(boardLimit(run)).toBe(1);
    expect(result).toBeNull();
  });

  it("given a full board, when a bench unit is placed on a taken hex, then the two swap", () => {
    const run = fresh({
      bench: bench(unit("b")),
      board: [{ unit: unit("a"), position: { col: 0, row: 0 } }],
    });

    const next = place(run, "b", { col: 0, row: 0 })!;

    expect(next.board).toEqual([
      { unit: unit("b"), position: { col: 0, row: 0 } },
    ]);
    expect(next.bench[0]).toEqual(unit("a"));
  });

  it("given two units on the board, when one is placed on the other's hex, then they swap hexes", () => {
    const run = fresh({
      level: 2,
      board: [
        { unit: unit("a"), position: { col: 0, row: 0 } },
        { unit: unit("b"), position: { col: 1, row: 0 } },
      ],
    });

    const next = place(run, "a", { col: 1, row: 0 })!;

    expect(next.board).toEqual([
      { unit: unit("a"), position: { col: 1, row: 0 } },
      { unit: unit("b"), position: { col: 0, row: 0 } },
    ]);
  });

  it.each([
    { col: BOARD_COLUMNS, row: 0 },
    { col: 0, row: BOARD_ROWS },
  ])(
    "given a hex off the board, %o, when a unit is placed there, then it is refused",
    (to) => {
      const result = place(fresh({ bench: bench(unit("a")) }), "a", to);

      expect(result).toBeNull();
    },
  );

  it("given an unknown unit, when it is placed, then it is refused", () => {
    const result = place(fresh(), "nobody", { col: 0, row: 0 });

    expect(result).toBeNull();
  });
});

describe("toBench", () => {
  it("given a unit on the board, when it goes to a free bench slot, then it leaves the board", () => {
    const run = fresh({
      board: [{ unit: unit("a"), position: { col: 0, row: 0 } }],
    });

    const next = toBench(run, "a", 3)!;

    expect(next.board).toEqual([]);
    expect(next.bench[3]).toEqual(unit("a"));
  });

  it("given a unit on the board, when it goes to a taken bench slot, then the bench unit takes its hex", () => {
    const run = fresh({
      board: [{ unit: unit("a"), position: { col: 2, row: 2 } }],
      bench: bench(unit("b")),
    });

    const next = toBench(run, "a", 0)!;

    expect(next.board).toEqual([
      { unit: unit("b"), position: { col: 2, row: 2 } },
    ]);
    expect(next.bench[0]).toEqual(unit("a"));
  });

  it("given two bench units, when one goes to the other's slot, then they swap", () => {
    const run = fresh({ bench: bench(unit("a"), unit("b")) });

    const next = toBench(run, "a", 1)!;

    expect(next.bench.slice(0, 2)).toEqual([unit("b"), unit("a")]);
  });

  it.each([-1, BENCH_SIZE])(
    "given slot %i, when a unit goes there, then it is refused",
    (slot) => {
      const result = toBench(fresh({ bench: bench(unit("a")) }), "a", slot);

      expect(result).toBeNull();
    },
  );

  it("given an unknown unit, when it goes to the bench, then it is refused", () => {
    const result = toBench(fresh(), "nobody", 0);

    expect(result).toBeNull();
  });
});

describe("roundFight", () => {
  it("given an empty board, when the round's fight is made, then there is none", () => {
    const fight = roundFight(fresh());

    expect(fight).toBeNull();
  });

  it("given a unit on the board, when the round's fight is made, then it faces the round's pack", () => {
    const run = fresh({
      board: [{ unit: unit("a"), position: { col: 3, row: 0 } }],
    });

    const fight = roundFight(run)!;

    expect(fight.fighters.filter((f) => f.side === "player")).toHaveLength(1);
    expect(fight.fighters.filter((f) => f.side === "enemy")).toHaveLength(
      packOf(run).length,
    );
    expect(fight.fighters[0]!.hex).toEqual({ col: 3, row: BOARD_ROWS });
  });

  it("given only a unit whose class is gone, when the round's fight is made, then there is none", () => {
    const run = fresh({
      board: [{ unit: unit("a", 1, "gone"), position: { col: 0, row: 0 } }],
    });

    const fight = roundFight(run);

    expect(fight).toBeNull();
  });
});

describe("finishRound", () => {
  it("given a win, when the round ends, then it pays the win and the next round's income and moves on", () => {
    const run = fresh({ gold: 0 });

    const next = finishRound(run, true);

    expect(next).toMatchObject({
      round: 2,
      lives: START_LIVES,
      streak: 1,
      gold: WIN_GOLD + BASE_INCOME,
      last: { round: 1, won: true },
    });
  });

  it("given a loss, when the round ends, then a life is lost and the streak turns", () => {
    const next = finishRound(fresh({ streak: 3 }), false);

    expect(next).toMatchObject({ lives: START_LIVES - 1, streak: -1 });
  });

  it("given the last life, when the round is lost, then the run is lost", () => {
    const next = finishRound(fresh({ lives: 1 }), false);

    expect(next.outcome).toBe("lost");
    expect(roundsCleared(next)).toBe(0);
  });

  it("given the last round, when it is lost with lives left, then the run is still won", () => {
    const next = finishRound(fresh({ round: ROUNDS, lives: 2 }), false);

    expect(next.outcome).toBe("won");
    expect(roundsCleared(next)).toBe(ROUNDS);
  });

  it("given a new round, when it begins, then the shop is rolled anew", () => {
    const run = fresh();

    const next = finishRound(run, true);

    expect(next.rolls).toBe(run.rolls + 1);
  });
});

describe("parseRun", () => {
  it("given a saved run, when it is read, then it is the same run", () => {
    const run = startRun(library, 3);

    const parsed = parseRun(JSON.stringify(run));

    expect(parsed).toEqual(run);
  });

  it.each([null, "", "nope", JSON.stringify({ version: -1 }), "null"])(
    "given %j, when it is read as a run, then there is none",
    (text) => {
      const parsed = parseRun(text);

      expect(parsed).toBeNull();
    },
  );
});

describe("the pool", () => {
  it("given a run's start, when the pool is read, then every class has its tier's copies, as a shop only shows them", () => {
    const run = startRun(library, 1);

    expect(run.pool[knight]).toBe(POOL_COPIES[run.tiers[knight]! - 1]);
  });
});
