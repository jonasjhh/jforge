import { forGame, starterLibrary, type Library } from "@jforge/char/shared";
import {
  SAVE_VERSION,
  createRandom,
  type Position,
} from "@jforge/melee/shared";
import {
  REROLL_COST,
  START_LEVEL,
  WIN_GOLD,
  XP_COST,
  XP_PER_BUY,
  XP_PER_ROUND,
  gainXp,
  income,
} from "./economy";
import { createFight, type Fight, type FightEntry } from "./fight";
import { isOnBoard, toArena } from "./hex";
import { ROUNDS, roundPack, type PackMonster } from "./monsters";
import {
  BENCH_SIZE,
  fullPool,
  returnToPool,
  rollShop,
  type Pool,
} from "./shop";
import {
  MAX_STARS,
  MERGE_COPIES,
  costTiers,
  sellValue,
  unitDef,
  type OwnedUnit,
} from "./units";

// A run: rounds of shopping and placing, each followed by a fight against
// a monster pack that both sides play on their own. Pure, like the
// engine: every change returns a new run, or null when it isn't allowed.

export const RUN_STORAGE_KEY = "jforge.autob.run";
export const START_LIVES = 3;

export interface BoardUnit {
  unit: OwnedUnit;
  /** On the player's side of the board (see hex.ts). */
  position: Position;
}

export interface Run {
  version: typeof SAVE_VERSION;
  seed: number;
  /** The designs the run started from, copied so later edits can't break it. */
  library: Library;
  /** Cost tier of each class, fixed at the start. */
  tiers: Record<string, number>;
  /** The round being planned or fought, from 1 to ROUNDS. */
  round: number;
  lives: number;
  gold: number;
  level: number;
  xp: number;
  /** Rounds won in a row (positive) or lost in a row (negative). */
  streak: number;
  pool: Pool;
  /** Class ids on offer; null where one was bought. */
  shop: (string | null)[];
  bench: (OwnedUnit | null)[];
  board: BoardUnit[];
  /** Shops rolled so far, so each roll draws anew from the seed. */
  rolls: number;
  /** The next unit's number, for its uid. */
  units: number;
  outcome: "playing" | "won" | "lost";
  /** The round fought last, and whether it was won. */
  last: { round: number; won: boolean } | null;
}

/**
 * The designs a run starts from: those of `library`, or of the starter
 * library, that autob is ticked for.
 */
export function runLibrary(library: Library | null): Library {
  return forGame(library ?? starterLibrary(), "autob");
}

const shopRandom = (seed: number, rolls: number) =>
  createRandom((seed + rolls * 1_000_003) >>> 0);

function rolled(run: Run): Run {
  const rolls = run.rolls + 1;
  const random = shopRandom(run.seed, rolls);
  return {
    ...run,
    rolls,
    shop: rollShop(run.pool, run.tiers, run.level, random),
  };
}

export function startRun(source: Library | null, seed: number): Run {
  const library = structuredClone(runLibrary(source));
  const tiers = costTiers(library);
  return rolled({
    version: SAVE_VERSION,
    seed,
    library,
    tiers,
    round: 1,
    lives: START_LIVES,
    gold: income(0, 0),
    level: START_LEVEL,
    xp: 0,
    streak: 0,
    pool: fullPool(tiers),
    shop: [],
    bench: Array.from({ length: BENCH_SIZE }, () => null),
    board: [],
    rolls: 0,
    units: 0,
    outcome: "playing",
    last: null,
  });
}

export const costOf = (run: Run, classId: string) => run.tiers[classId] ?? 1;

/** Every unit the player owns, board first. */
export const ownedUnits = (run: Run): OwnedUnit[] => [
  ...run.board.map((b) => b.unit),
  ...run.bench.filter((u): u is OwnedUnit => u !== null),
];

/** How many units may stand on the board: the level. */
export const boardLimit = (run: Run) => run.level;

/**
 * Merges every three of a class at a star into one a star higher, until
 * none are left to merge. The merged unit keeps the place of the first of
 * them (board before bench), so a unit on the board stays there.
 */
function merged(run: Run): Run {
  for (let stars = 1; stars < MAX_STARS; stars++) {
    const all = ownedUnits(run);
    const classes = [...new Set(all.map((u) => u.classId))];
    for (const classId of classes) {
      const same = all.filter(
        (u) => u.classId === classId && u.stars === stars,
      );
      if (same.length < MERGE_COPIES) continue;
      const [kept, ...used] = same.slice(0, MERGE_COPIES);
      const gone = new Set(used.map((u) => u!.uid));
      const up = (u: OwnedUnit): OwnedUnit =>
        u.uid === kept!.uid ? { ...u, stars: stars + 1 } : u;
      return merged({
        ...run,
        board: run.board
          .filter((b) => !gone.has(b.unit.uid))
          .map((b) => ({ ...b, unit: up(b.unit) })),
        bench: run.bench.map((u) => (u && !gone.has(u.uid) ? up(u) : null)),
      });
    }
  }
  return run;
}

/**
 * Buys the unit in shop slot `slot` onto the bench. Refused without the
 * gold, or with a full bench unless the new copy merges at once.
 */
export function buy(run: Run, slot: number): Run | null {
  const classId = run.shop[slot];
  if (!classId || run.outcome !== "playing") return null;
  const cost = costOf(run, classId);
  if (run.gold < cost) return null;
  const unit: OwnedUnit = { uid: `u${run.units + 1}`, classId, stars: 1 };
  const free = run.bench.indexOf(null);
  // A full bench still takes a copy that completes a merge: it is held
  // in a spare slot just long enough to merge.
  const bench = free >= 0 ? [...run.bench] : [...run.bench, null];
  bench[free >= 0 ? free : bench.length - 1] = unit;
  const next = merged({
    ...run,
    gold: run.gold - cost,
    units: run.units + 1,
    pool: returnToPool(run.pool, classId, 1, -1),
    shop: run.shop.map((id, i) => (i === slot ? null : id)),
    bench,
  });
  if (next.bench.length > BENCH_SIZE) {
    const spare = next.bench.pop();
    if (spare) return null;
  }
  return next;
}

/** Sells a unit for what its copies cost, putting them back in the pool. */
export function sell(run: Run, uid: string): Run | null {
  const unit = ownedUnits(run).find((u) => u.uid === uid);
  if (!unit || run.outcome !== "playing") return null;
  return {
    ...run,
    gold: run.gold + sellValue(costOf(run, unit.classId), unit.stars),
    pool: returnToPool(run.pool, unit.classId, unit.stars),
    board: run.board.filter((b) => b.unit.uid !== uid),
    bench: run.bench.map((u) => (u?.uid === uid ? null : u)),
  };
}

export function reroll(run: Run): Run | null {
  if (run.gold < REROLL_COST || run.outcome !== "playing") return null;
  return rolled({ ...run, gold: run.gold - REROLL_COST });
}

/** Buys XP_PER_BUY experience; refused at the top level or without gold. */
export function buyXp(run: Run): Run | null {
  if (run.gold < XP_COST || run.outcome !== "playing") return null;
  const grown = gainXp(run.level, run.xp, XP_PER_BUY);
  if (grown.level === run.level && grown.xp === run.xp) return null;
  return { ...run, gold: run.gold - XP_COST, ...grown };
}

/**
 * Puts a unit on a board cell. A unit already there swaps places with
 * it (to the bench, if the moved one came from there). A unit from the
 * bench onto an empty cell needs room under the board limit.
 */
export function place(run: Run, uid: string, to: Position): Run | null {
  if (!isOnBoard(to) || run.outcome !== "playing") return null;
  const there = run.board.find(
    (b) => b.position.col === to.col && b.position.row === to.row,
  );
  const fromBoard = run.board.find((b) => b.unit.uid === uid);
  if (fromBoard) {
    return {
      ...run,
      board: run.board.map((b) =>
        b === fromBoard
          ? { ...b, position: to }
          : b === there
            ? { ...b, position: fromBoard.position }
            : b,
      ),
    };
  }
  const slot = run.bench.findIndex((u) => u?.uid === uid);
  if (slot < 0) return null;
  if (!there && run.board.length >= boardLimit(run)) return null;
  const unit = run.bench[slot]!;
  return {
    ...run,
    board: [...run.board.filter((b) => b !== there), { unit, position: to }],
    bench: run.bench.map((u, i) => (i === slot ? (there?.unit ?? null) : u)),
  };
}

/**
 * Moves a unit to a bench slot; one already there swaps with it (onto
 * the board, if the moved one came from there).
 */
export function toBench(run: Run, uid: string, slot: number): Run | null {
  if (slot < 0 || slot >= BENCH_SIZE || run.outcome !== "playing") return null;
  const there = run.bench[slot] ?? null;
  const fromBoard = run.board.find((b) => b.unit.uid === uid);
  if (fromBoard) {
    const bench = [...run.bench];
    bench[slot] = fromBoard.unit;
    return {
      ...run,
      bench,
      board: run.board
        .filter((b) => b !== fromBoard)
        .concat(there ? [{ unit: there, position: fromBoard.position }] : []),
    };
  }
  const from = run.bench.findIndex((u) => u?.uid === uid);
  if (from < 0) return null;
  const bench = [...run.bench];
  bench[slot] = run.bench[from]!;
  bench[from] = there;
  return { ...run, bench };
}

/** The seed a round's pack and fight are drawn with. */
export const battleSeed = (run: Run) =>
  (run.seed * 31 + run.round * 7919) >>> 0;

/** The round's monsters, where they will stand. */
export const packOf = (run: Run): PackMonster[] =>
  roundPack(run.library, run.round, battleSeed(run));

/**
 * The round's fight: the board against its pack, on the arena. Null with
 * nobody on the board.
 */
export function roundFight(run: Run): Fight | null {
  const party = run.board.flatMap(({ unit, position }): FightEntry[] => {
    const def = unitDef(run.library, unit);
    return def
      ? [{ def, side: "player", hex: toArena("player", position) }]
      : [];
  });
  if (party.length === 0) return null;
  const pack = packOf(run).map(({ def, position }): FightEntry => ({
    def,
    side: "enemy",
    hex: toArena("enemy", position),
  }));
  return createFight([...party, ...pack], battleSeed(run));
}

/**
 * After the fight. A win pays WIN_GOLD; a loss or draw costs a life.
 * Losing the last life loses the run; living through the last round
 * wins it.
 * Otherwise the next round pays its income and experience and rolls a
 * new shop.
 */
export function finishRound(run: Run, won: boolean): Run {
  const streak = won
    ? Math.max(run.streak, 0) + 1
    : Math.min(run.streak, 0) - 1;
  const after: Run = {
    ...run,
    streak,
    gold: run.gold + (won ? WIN_GOLD : 0),
    lives: won ? run.lives : run.lives - 1,
    last: { round: run.round, won },
  };
  if (after.lives <= 0) return { ...after, outcome: "lost" };
  if (run.round >= ROUNDS) return { ...after, outcome: "won" };
  return rolled({
    ...after,
    round: run.round + 1,
    gold: after.gold + income(after.gold, streak),
    ...gainXp(run.level, run.xp, XP_PER_ROUND),
  });
}

/** Rounds lived through: the run's score. */
export const roundsCleared = (run: Run) =>
  run.round - 1 + (run.outcome === "won" ? 1 : 0);

/** A saved run, or null if there is none or it is of another version. */
export function parseRun(text: string | null): Run | null {
  if (!text) return null;
  try {
    const run = JSON.parse(text) as Run;
    return run?.version === SAVE_VERSION ? run : null;
  } catch {
    return null;
  }
}
