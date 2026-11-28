import { autobLibrary } from "@jforge/content/autob";
import {
  BENCH_SIZE,
  SHOP_SIZE,
  startRun,
  type OwnedUnit,
  type Run,
} from "../../shared";

export const library = autobLibrary();

export const unit = (
  uid: string,
  stars = 1,
  classId = "melee-knight",
): OwnedUnit => ({
  uid,
  classId,
  stars,
});

/** A run of rich pockets, a shop of Knights and these units on the bench. */
export const runWith = (
  bench: OwnedUnit[] = [],
  changes: Partial<Run> = {},
): Run => ({
  ...startRun(library, 1),
  gold: 30,
  shop: Array.from({ length: SHOP_SIZE }, () => "melee-knight"),
  bench: Array.from({ length: BENCH_SIZE }, (_, i) => bench[i] ?? null),
  ...changes,
});
