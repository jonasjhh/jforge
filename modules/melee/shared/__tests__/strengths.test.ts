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
  it("given a Blessing, when its strengths are taken, then they are its kind's defaults", () => {
    const strengths = strengthsOf(statusOf(blessing));

    expect(strengths).toEqual({ dealt: 1.2, taken: 0.8 });
  });

  it("given a Blessing with its own dealt, when its strengths are taken, then its own overrides the default", () => {
    const strengths = strengthsOf({ ...statusOf(blessing), dealt: 1.1 });

    expect(strengths).toEqual({ dealt: 1.1, taken: 0.8 });
  });

  it("given stealth, when its default is looked up, then the ambush doubles", () => {
    const defaults = STRENGTH_DEFAULTS.stealth;

    expect(defaults).toEqual({ ambush: 2 });
  });

  it("given a lesser Expose on a foe, when its slash resistance is taken, then it takes x1.1", () => {
    const s = battle();
    applyStatus(s, me(s), foe(s), { ...statusOf(expose), taken: 1.1 }, []);

    const taken = resistance(foe(s), "slash");

    expect(taken).toBeCloseTo(1.1);
  });

  it("given a lesser Blessing, when the blessed unit deals and takes damage, then its own factors apply", () => {
    const s = battle();
    const lesser = { ...statusOf(blessing), dealt: 1.1, taken: 0.9 };

    applyStatus(s, me(s), me(s), lesser, []);

    expect(dealtFactor(me(s))).toBeCloseTo(1.1);
    expect(resistance(me(s), "slash")).toBeCloseTo(0.9);
  });

  it("given a Stone Skin of defense 2, when the foe's defense is taken, then it doubles", () => {
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
  });

  it("given a Vanish of ambush 1.5, when an attack is previewed, then it deals x1.5", () => {
    const s = battle();
    const plain = previewDamage(me(s), foe(s))!.amount;

    applyStatus(s, me(s), me(s), { ...statusOf(vanish), ambush: 1.5 }, []);

    const ambush = previewDamage(me(s), foe(s))!.amount;
    expect(Math.abs(ambush - plain * 1.5)).toBeLessThanOrEqual(1);
  });

  it.each([
    ["the default threshold", {}, 1],
    ["a threshold of 0.5", { finishBelow: 0.5 }, 2.5],
  ])(
    "given a foe at 40%% HP and Coup de Grace with %s, when its finisher factor is taken, then it is %d",
    (_, change, factor) => {
      const s = battle();
      const f = foe(s);
      f.hp = f.base.maxHp * 0.4;
      const strike = coupDeGrace.effect as Extract<
        SkillEffect,
        { type: "strike" }
      >;

      const result = finisherFactor({ ...strike, ...change }, f);

      expect(result).toBe(factor);
    },
  );

  it("given a caster weakened to half, when it burns a foe, then the burn is half as strong", () => {
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
