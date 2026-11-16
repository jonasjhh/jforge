import { describe, expect, it } from "vitest";
import { act, advance, createBattle, validateCommand } from "../battle";
import { expectedPhysicalDamage } from "../damage";
import { previewDamage } from "../preview";
import { DEFEND_FACTOR, WAIT_GAUGE_LEFT } from "../stance";
import type { BattleState } from "../types";
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
  it("is always allowed", () => {
    const state = waiting();
    expect(validateCommand(state, hero(state), { type: "defend" })).toBeNull();
  });

  it("spends the whole turn and reports it", () => {
    const { state, events } = act(waiting(), { type: "defend" });
    expect(hero(state).gauge).toBe(0);
    expect(hero(state).defending).toBe(true);
    expect(state.ready).toEqual([]);
    expect(events).toEqual([{ type: "defended", unitId: hero(state).id }]);
  });

  it("halves the expected damage of hits, and their preview", () => {
    const before = waiting();
    const open = expectedPhysicalDamage(brute(before), hero(before));
    const { state } = act(before, { type: "defend" });
    expect(expectedPhysicalDamage(brute(state), hero(state))).toBe(
      Math.round(open * DEFEND_FACTOR),
    );
    expect(previewDamage(brute(state), hero(state))?.amount).toBe(
      Math.round(open * DEFEND_FACTOR),
    );
  });

  it("halves the damage actually taken", () => {
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
    // Same seed, so the same random spread on both hits.
    expect(damageTaken("defend")).toBe(
      Math.round(damageTaken("wait") * DEFEND_FACTOR),
    );
  });

  it("lasts until the unit acts again, whatever it does", () => {
    const defended = act(waiting(), { type: "defend" }).state;
    const again = advance(defended).state;
    expect(again.phase.kind).toBe("awaitingCommand");
    expect(hero(again).defending).toBe(true);
    expect(hero(act(again, { type: "wait" }).state).defending).toBeUndefined();
    expect(
      hero(act(again, { type: "attack", targetId: brute(again).id }).state)
        .defending,
    ).toBeUndefined();
    expect(hero(act(again, { type: "defend" }).state).defending).toBe(true);
  });

  it("ends when the unit is knocked out", () => {
    const { state } = act(waiting(), { type: "defend" });
    hero(state).hp = 1;
    const after = advance(state).state;
    expect(hero(after).hp).toBe(0);
    expect(hero(after).defending).toBeUndefined();
  });
});

describe("Wait", () => {
  it("is always allowed", () => {
    const state = waiting();
    expect(validateCommand(state, hero(state), { type: "wait" })).toBeNull();
  });

  it("keeps three quarters of the gauge and reports it", () => {
    const { state, events } = act(waiting(), { type: "wait" });
    expect(hero(state).gauge).toBe(WAIT_GAUGE_LEFT);
    expect(state.ready).toEqual([]);
    expect(events).toEqual([{ type: "waited", unitId: hero(state).id }]);
  });

  it("does not brace the unit", () => {
    const { state } = act(waiting(), { type: "wait" });
    expect(hero(state).defending).toBeUndefined();
  });

  it("lets time move on, so the unit is ready again later", () => {
    const before = waiting();
    const after = advance(act(before, { type: "wait" }).state).state;
    expect(after.time).toBeGreaterThan(before.time);
  });
});
