import { starterLibrary } from "@jforge/char/shared";
import { pair } from "../../shared/__tests__/pair";
import { roadOf, startRun, type Encounter, type Run } from "../../shared";

export const library = starterLibrary();

/** A run of Aldric and Mira standing at the first of these encounters. */
export const at = (
  encounters: Encounter[],
  changes: Partial<Run> = {},
): Run => ({
  ...startRun(library, 1),
  party: pair(library),
  map: roadOf(encounters),
  position: 0,
  path: [0],
  ...changes,
});

export const battle: Encounter = {
  kind: "battle",
  difficulty: "easy",
  seed: 5,
  rank: "normal",
};
export const training: Encounter = { kind: "training" };
export const ally: Encounter = {
  kind: "ally",
  character: { id: "new", name: "Nell", archetypeId: "melee-sage", gear: {} },
};
