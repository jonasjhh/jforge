import { describe, expect, it } from "vitest";
import { botBattles, digest } from "./bot";

// Pins the engine's exact behaviour across many whole battles, so
// refactors that should change nothing can prove it. If a rule changes on
// purpose, update the snapshot (vitest -u) after checking the diff.
describe("golden battles", () => {
  const battles = botBattles(12);

  it("plays every battle to the end", () => {
    for (const { steps } of battles) {
      expect(steps.at(-1)!.state.phase.kind).toBe("over");
    }
  });

  it("uses skills, attacks and moves", () => {
    const types = new Set(
      battles.flatMap(({ steps }) =>
        steps.flatMap((s) => s.events.map((e) => e.type)),
      ),
    );
    for (const type of [
      "attack",
      "skill",
      "castStarted",
      "moved",
      "heal",
      "statusTick",
      "summoned",
      "knockedOut",
    ]) {
      expect(types).toContain(type);
    }
  });

  it("produces the same events and final state", () => {
    expect(
      Object.fromEntries(
        battles.map(({ name, steps }) => [
          name,
          `${steps.length} steps, events ${digest(steps.map((s) => s.events))}, state ${digest(steps.at(-1)!.state)}`,
        ]),
      ),
    ).toMatchSnapshot();
  });
});
