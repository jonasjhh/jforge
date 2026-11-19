import { runFight } from "./fight";
import { BOARD_COLUMNS, BOARD_ROWS } from "./hex";
import { MAX_LEVEL, XP_COST } from "./economy";
import {
  boardLimit,
  buy,
  buyXp,
  costOf,
  finishRound,
  ownedUnits,
  place,
  reroll,
  roundFight,
  sell,
  toBench,
  type Run,
} from "./run";
import type { OwnedUnit } from "./units";

// A simple player for balance tests: buys what it can afford (copies of
// what it owns first), keeps some gold for interest, levels when rich,
// and fields its strongest units in their preferred rows.

/** Gold the bot keeps for interest once it has a board. */
const SAVINGS = 10;

const strength = (run: Run, u: OwnedUnit) =>
  u.stars * 10 + costOf(run, u.classId);

function shop(start: Run): Run {
  let run = start;
  const owned = () => new Set(ownedUnits(run).map((u) => u.classId));
  const keep = () => (run.board.length > 0 ? SAVINGS : 0);
  // Copies of owned classes first, then the dearest the gold allows.
  const order = () =>
    run.shop
      .map((id, slot) => ({ id, slot }))
      .filter((s): s is { id: string; slot: number } => s.id !== null)
      .sort(
        (a, b) =>
          Number(owned().has(b.id)) - Number(owned().has(a.id)) ||
          costOf(run, b.id) - costOf(run, a.id),
      );
  for (let guard = 0; guard < 40; guard++) {
    if (run.gold >= XP_COST + keep() + 4 && run.level < MAX_LEVEL) {
      run = buyXp(run) ?? run;
      continue;
    }
    const pick = order().find(
      (s) =>
        run.gold - costOf(run, s.id) >= keep() ||
        (owned().has(s.id) && run.gold >= costOf(run, s.id)),
    );
    if (pick) {
      const bought = buy(run, pick.slot);
      if (bought) {
        run = bought;
        continue;
      }
      // A full bench: make room by selling its weakest.
      const weakest = run.bench
        .filter((u): u is OwnedUnit => u !== null)
        .sort((a, b) => strength(run, a) - strength(run, b))[0];
      if (weakest) {
        run = sell(run, weakest.uid) ?? run;
        continue;
      }
    }
    if (run.gold >= keep() + 2 + 2 && run.board.length > 0) {
      run = reroll(run) ?? run;
      if (run.shop.every((id) => id === null)) break;
      continue;
    }
    break;
  }
  return run;
}

/** Fields the strongest units, each nearest its class's preferred row. */
function field(start: Run): Run {
  let run = start;
  for (const b of [...run.board]) {
    const slot = run.bench.indexOf(null);
    if (slot < 0) break;
    run = toBench(run, b.unit.uid, slot) ?? run;
  }
  const best = ownedUnits(run)
    .sort((a, b) => strength(run, b) - strength(run, a))
    .slice(0, boardLimit(run));
  for (const unit of best) {
    const row =
      run.library.archetypes.find((a) => a.id === unit.classId)?.preferredRow ??
      0;
    const rows = Array.from({ length: BOARD_ROWS }, (_, r) => r).sort(
      (a, b) => Math.abs(a - row) - Math.abs(b - row),
    );
    const cells = rows.flatMap((r) =>
      [3, 2, 4, 1, 5, 0, 6]
        .slice(0, BOARD_COLUMNS)
        .map((col) => ({ col, row: r })),
    );
    const free = cells.find(
      (c) =>
        !run.board.some(
          (b) => b.position.col === c.col && b.position.row === c.row,
        ),
    );
    if (free) run = place(run, unit.uid, free) ?? run;
  }
  return run;
}

/** One round as the bot plays it: shop, field, fight. */
export function botRound(run: Run): Run {
  const ready = field(shop(run));
  const fight = roundFight(ready);
  if (!fight) return finishRound(ready, false);
  return finishRound(ready, runFight(fight).winner === "player");
}

/** A whole run as the bot plays it, until it is won or lost. */
export function botRun(run: Run): Run {
  let next = run;
  while (next.outcome === "playing") next = botRound(next);
  return next;
}
