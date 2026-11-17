import { describe, expect, it } from "vitest";
import { advance, createBattle } from "../battle";
import { blessing, coupDeGrace, expose, rogue, vanish } from "../content";
import { resistance, dealtFactor } from "../damage";
import { finisherFactor } from "../finisher";
import { previewDamage } from "../preview";
import { effectiveStat } from "../stats";
import { applyStatus } from "../status";
import { STRENGTH_DEFAULTS, strengthsOf } from "../strengths";
import type { BattleState, SkillEffect, StatusDef } from "../types";
import { def, place } from "./helpers";

const statusOf = (skill: { effect: unknown }) =>
  (skill.effect as { status: StatusDef }).status;

/** A rogue and a foe, the rogue waiting. */
function battle(): BattleState {
  return advance(
    createBattle(
      {
        placements: [
          place(
            { ...rogue, stats: { ...rogue.stats, speed: 50 } },
            "player",
            0,
          ),
          place(def("foe", { maxHp: 1000, speed: 1 }), "enemy", 0),
        ],
      },
      1,
    ),
  ).state;
}
const [me, foe] = [
  (s: BattleState) => s.units.find((u) => u.side === "player")!,
  (s: BattleState) => s.units.find((u) => u.side === "enemy")!,
];

describe("status strengths", () => {
  it("default per kind, overridden by the status's own", () => {
    expect(strengthsOf(statusOf(blessing))).toEqual({ dealt: 1.2, taken: 0.8 });
    expect(strengthsOf({ ...statusOf(blessing), dealt: 1.1 })).toEqual({
      dealt: 1.1,
      taken: 0.8,
    });
    expect(STRENGTH_DEFAULTS.stealth).toEqual({ ambush: 2 });
  });

  it("a lesser Expose takes less", () => {
    const s = battle();
    applyStatus(s, me(s), foe(s), { ...statusOf(expose), taken: 1.1 }, []);
    expect(resistance(foe(s), "slash")).toBeCloseTo(1.1);
  });

  it("a lesser Blessing deals and takes its own factors", () => {
    const s = battle();
    const lesser = { ...statusOf(blessing), dealt: 1.1, taken: 0.9 };
    applyStatus(s, me(s), me(s), lesser, []);
    expect(dealtFactor(me(s))).toBeCloseTo(1.1);
    expect(resistance(me(s), "slash")).toBeCloseTo(0.9);
  });

  it("a stronger Stone Skin and a weaker Vanish ambush", () => {
    const s = battle();
    const skin: StatusDef = {
      id: "skin",
      name: "Skin",
      effect: "stoneSkin",
      harmful: false,
      stat: "magic",
      power: 0,
      interval: 100,
      ticks: 1,
      defense: 2,
    };
    applyStatus(s, me(s), foe(s), skin, []);
    expect(effectiveStat(foe(s), "defense")).toBe(2 * foe(s).base.defense);
    const plain = previewDamage(me(s), foe(s))!.amount;
    applyStatus(s, me(s), me(s), { ...statusOf(vanish), ambush: 1.5 }, []);
    const ambush = previewDamage(me(s), foe(s))!.amount;
    expect(Math.abs(ambush - plain * 1.5)).toBeLessThanOrEqual(1);
  });

  it("a finisher's threshold is per skill", () => {
    const s = battle();
    const f = foe(s);
    f.hp = f.base.maxHp * 0.4;
    const strike = coupDeGrace.effect as Extract<
      SkillEffect,
      { type: "strike" }
    >;
    expect(finisherFactor(strike, f)).toBe(1);
    expect(finisherFactor({ ...strike, finishBelow: 0.5 }, f)).toBe(2.5);
  });

  it("a weakened caster's damage over time is weaker too", () => {
    const s = battle();
    const burn: StatusDef = {
      id: "burn",
      name: "Burn",
      effect: "damage",
      harmful: true,
      stat: "attack",
      power: 1,
      interval: 30,
      ticks: 3,
    };
    applyStatus(s, me(s), foe(s), burn, []);
    const plain = foe(s).statuses.find((st) => st.id === "burn")!.amount;
    const weaken: StatusDef = {
      ...burn,
      id: "weak",
      effect: "weaken",
      dealt: 0.5,
    };
    applyStatus(s, foe(s), me(s), weaken, []);
    applyStatus(s, me(s), foe(s), burn, []);
    const weak = foe(s).statuses.find((st) => st.id === "burn")!.amount;
    expect(Math.abs(weak - plain * 0.5)).toBeLessThanOrEqual(1);
  });
});
