// A balance test: auto-played runs of whole battles. Mutation testing
// leaves out *.balance.test.ts files (see vitest.stryker.config.ts).
import { describe, expect, it } from "vitest";
import { simulate } from "@jforge/melee/shared";
import {
  battleFor,
  choices,
  currentEncounter,
  levelCleared,
  resolveAlly,
  resolveGear,
  resolveTraining,
  startRun,
  travel,
  winBattle,
  type Run,
} from "../run";

/** Takes the road to way `pick` (modulo the ways there are), if at one. */
const walk = (run: Run, pick: number): Run => {
  const ways = choices(run);
  return ways.length > 0 ? travel(run, ways[pick % ways.length]!) : run;
};

describe("first-level difficulty", () => {
  it("given many first levels played by the AI, when their battles are fought, then each difficulty wins within its band", () => {
    // Auto-played runs. Every battle is counted, then taken as won, so
    // later battles aren't only fought by the parties that got lucky.
    const tally = { easy: [0, 0], normal: [0, 0], hard: [0, 0] };
    for (let seed = 0; seed < 60; seed++) {
      let run = startRun(null, seed);
      for (let step = 0; !levelCleared(run); step++) {
        run = walk(run, step);
        const encounter = currentEncounter(run)!;
        const who = run.party[step % run.party.length]!.id;
        if (encounter.kind === "ally") run = resolveAlly(run, true);
        else if (encounter.kind === "training") {
          run = resolveTraining(run, who);
        } else if (encounter.kind === "gear") {
          run = resolveGear(run, encounter.gearIds[0] ?? null, who);
        } else {
          const result = simulate(battleFor(run)!, seed * 100 + step);
          const count = tally[encounter.difficulty];
          count[1]!++;
          if (result.winner === "player") count[0]!++;
          run = winBattle(run)!.run;
        }
      }
    }
    const rate = (d: keyof typeof tally) => tally[d][0]! / tally[d][1]!;
    expect(rate("easy")).toBeGreaterThan(0.85);
    expect(rate("normal")).toBeGreaterThan(0.6);
    expect(rate("normal")).toBeLessThan(0.9);
    expect(rate("hard")).toBeGreaterThan(0.35);
    expect(rate("hard")).toBeLessThan(0.75);
    expect(rate("easy")).toBeGreaterThan(rate("normal"));
    expect(rate("normal")).toBeGreaterThan(rate("hard"));
  }, 60_000);
});
