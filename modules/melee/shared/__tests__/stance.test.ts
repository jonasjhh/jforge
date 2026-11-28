import { describe, expect, it } from "vitest";
import {
  act,
  advance,
  createBattle,
  validateCommand,
} from "@jforge/battle/engine/battle.ts";
import { expectedPhysicalDamage } from "@jforge/battle/engine/damage.ts";
import { previewDamage } from "@jforge/battle/engine/preview.ts";
import {
  DEFEND_FACTOR,
  WAIT_GAUGE_LEFT,
} from "@jforge/battle/engine/stance.ts";
import type { BattleState } from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

// The hero is fast and acts first; the brute hits hard but slowly.
function waiting(): BattleState {
  return advance(
    createBattle(
      {
        placements: [
          place(def("hero", { maxHp: 1000, speed: 100 }), "player", 0),
          place(
            def("brute", { maxHp: 1000, attack: 100, speed: 60 }),
            "enemy",
            0,
          ),
        ],
      },
      1,
    ),
  ).state;
}

const hero = (s: BattleState) => s.units[0]!;
const brute = (s: BattleState) => s.units[1]!;

describe("Defend", () => {
  it("given the hero waiting, when Defend is checked, then it is allowed", () => {
    const state = waiting();

    const problem = validateCommand(state, hero(state), { type: "defend" });

    expect(problem).toBeNull();
  });

  it("given the hero waiting, when it defends, then the whole turn is spent and it braces", () => {
    const state = waiting();

    const { state: after, events } = act(state, { type: "defend" });

    expect(hero(after).gauge).toBe(0);
    expect(hero(after).defending).toBe(true);
    expect(after.ready).toEqual([]);
    expect(events).toEqual([{ type: "defended", unitId: hero(after).id }]);
  });

  it("given a braced hero, when the brute's hit is weighed, then the expected damage and its preview are halved", () => {
    const before = waiting();
    const open = expectedPhysicalDamage(brute(before), hero(before));
    const { state } = act(before, { type: "defend" });

    const expected = expectedPhysicalDamage(brute(state), hero(state));
    const preview = previewDamage(brute(state), hero(state))?.amount;

    expect(expected).toBe(Math.round(open * DEFEND_FACTOR));
    expect(preview).toBe(Math.round(open * DEFEND_FACTOR));
  });

  it("given a braced and an open hero, when the brute hits each, then the braced one takes half", () => {
    // The brute's first hit, after the hero opened with `first`.
    const damageTaken = (first: "defend" | "wait") => {
      let step = act(waiting(), { type: first });
      for (;;) {
        const hit = step.events.find((e) => e.type === "damage");
        if (hit?.type === "damage") return hit.amount;
        step =
          step.state.phase.kind === "awaitingCommand"
            ? act(step.state, { type: "wait" })
            : advance(step.state, { stopAfterAction: true });
      }
    };

    const braced = damageTaken("defend");

    // Same seed, so the same random spread on both hits.
    expect(braced).toBe(Math.round(damageTaken("wait") * DEFEND_FACTOR));
  });

  describe("on the braced hero's next turn", () => {
    const again = advance(act(waiting(), { type: "defend" }).state).state;

    it("given the hero braced, when its next turn comes, then it is still braced", () => {
      const phase = again.phase.kind;

      expect(phase).toBe("awaitingCommand");
      expect(hero(again).defending).toBe(true);
    });

    it.each([
      ["waits", { type: "wait" }, undefined],
      ["attacks", { type: "attack", targetId: "enemy-0-0" }, undefined],
      ["defends again", { type: "defend" }, true],
    ] as const)(
      "given the hero braced, when it %s, then defending is %s",
      (_, command, defending) => {
        const { state } = act(again, command);

        expect(hero(state).defending).toBe(defending);
      },
    );
  });

  it("given a braced hero at 1 HP, when it is knocked out, then it stops bracing", () => {
    const { state } = act(waiting(), { type: "defend" });
    hero(state).hp = 1;

    const after = advance(state).state;

    expect(hero(after).hp).toBe(0);
    expect(hero(after).defending).toBeUndefined();
  });
});

describe("Wait", () => {
  it("given the hero waiting, when Wait is checked, then it is allowed", () => {
    const state = waiting();

    const problem = validateCommand(state, hero(state), { type: "wait" });

    expect(problem).toBeNull();
  });

  it("given the hero waiting, when it waits, then three quarters of the gauge stay and it doesn't brace", () => {
    const state = waiting();

    const { state: after, events } = act(state, { type: "wait" });

    expect(hero(after).gauge).toBe(WAIT_GAUGE_LEFT);
    expect(hero(after).defending).toBeUndefined();
    expect(after.ready).toEqual([]);
    expect(events).toEqual([{ type: "waited", unitId: hero(after).id }]);
  });

  it("given the hero waited, when the battle advances, then time moves on", () => {
    const before = waiting();
    const waited = act(before, { type: "wait" }).state;

    const after = advance(waited).state;

    expect(after.time).toBeGreaterThan(before.time);
  });
});
