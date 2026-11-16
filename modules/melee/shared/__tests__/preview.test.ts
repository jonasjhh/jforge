import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import {
  aegis,
  cleave,
  fireball,
  heal,
  lastRites,
  shatter,
  vanish,
} from "../content";
import { previewDamage } from "../preview";
import { applyStatus } from "../status";
import type { BattleEvent, BattleState, StatusDef, Unit } from "../types";
import { def, place } from "./helpers";

const statusOf = (skill: { effect: unknown }) =>
  (skill.effect as { status: StatusDef }).status;

/** A hero (player 0,0) waiting to act on a foe (enemy 0,0). */
function duel(foeStats = {}, resistances = {}): BattleState {
  const hero = def("hero", { speed: 50, attack: 30, magic: 20, maxMp: 99 });
  const foe = {
    ...def("foe", {
      maxHp: 10_000,
      defense: 10,
      spirit: 5,
      speed: 1,
      ...foeStats,
    }),
    resistances,
  };
  return advance(
    createBattle(
      {
        placements: [
          place({ ...hero, skills: [fireball, cleave, heal] }, "player", 0),
          place(foe, "enemy", 0),
        ],
      },
      1,
    ),
  ).state;
}
const heroOf = (s: BattleState): Unit => s.units[0]!;
const foeOf = (s: BattleState): Unit => s.units[1]!;
const dealt = (events: BattleEvent[]) =>
  events.flatMap((e) => (e.type === "damage" ? [e.amount] : []))[0]!;

describe("damage preview", () => {
  it("is within the random spread of a real attack", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const state = duel();
      state.rng = seed;
      const expected = previewDamage(heroOf(state), foeOf(state))!.amount;
      const real = dealt(
        act(state, { type: "attack", targetId: "enemy-0-0" }).events,
      );
      expect(Math.abs(real - expected)).toBeLessThanOrEqual(
        Math.ceil(expected * 0.1),
      );
    }
  });

  it("scales by skill power, and uses magic for spells", () => {
    const state = duel();
    const attack = previewDamage(heroOf(state), foeOf(state))!.amount;
    const swing = previewDamage(heroOf(state), foeOf(state), cleave)!.amount;
    expect(swing).toBe(Math.round(attack * 0.7));
    const spell = previewDamage(heroOf(state), foeOf(state), fireball)!;
    // power x magic x K / (K + spirit), with magic 20 and spirit 5.
    const { power } = fireball.effect as { power: number };
    expect(spell.amount).toBe(Math.round(power * 20 * (50 / 55)));
  });

  it("reports the target's resistance", () => {
    const state = duel({}, { slash: 2, fire: 0 });
    expect(previewDamage(heroOf(state), foeOf(state))!.multiplier).toBe(2);
    const spell = previewDamage(heroOf(state), foeOf(state), fireball)!;
    expect(spell).toMatchObject({ amount: 0, multiplier: 0, knocksOut: false });
  });

  it("is null for skills that deal no damage", () => {
    const state = duel();
    expect(previewDamage(heroOf(state), heroOf(state), heal)).toBeNull();
  });

  it("flags a knockout, unless a shield soaks it or a ward holds", () => {
    const state = duel({ maxHp: 10 });
    const hero = heroOf(state);
    const foe = foeOf(state);
    expect(previewDamage(hero, foe)!.knocksOut).toBe(true);
    applyStatus(state, hero, foe, statusOf(aegis), []);
    expect(previewDamage(hero, foe)!.knocksOut).toBe(false);
    foe.statuses = [];
    applyStatus(state, hero, foe, statusOf(lastRites), []);
    expect(previewDamage(hero, foe)!.knocksOut).toBe(false);
  });

  it("ignores stealth for Shatter, which isn't an ambush", () => {
    const state = duel();
    const blast = previewDamage(heroOf(state), foeOf(state), shatter)!;
    applyStatus(state, heroOf(state), heroOf(state), statusOf(vanish), []);
    expect(previewDamage(heroOf(state), foeOf(state), shatter)).toEqual(blast);
    expect(blast.amount).toBeGreaterThan(0);
  });

  it("doubles out of stealth", () => {
    const state = duel();
    const plain = previewDamage(heroOf(state), foeOf(state))!.amount;
    applyStatus(state, heroOf(state), heroOf(state), statusOf(vanish), []);
    expect(previewDamage(heroOf(state), foeOf(state))!.amount).toBe(plain * 2);
  });
});
