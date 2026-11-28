import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import {
  aegis,
  cleave,
  fireball,
  heal,
  lastRites,
  shatter,
  vanish,
} from "../content";
import { previewDamage } from "@jforge/battle/engine/preview.ts";
import { applyStatus } from "@jforge/battle/engine/status.ts";
import type {
  BattleEvent,
  BattleState,
  StatusDef,
  Unit,
} from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

const statusOf = (skill: { effect: unknown }) =>
  (skill.effect as { status: StatusDef }).status;

/** A hero (player 0,0) waiting to act on a foe (enemy 0,0). */
function duel(foeStats = {}, resistances = {}): BattleState {
  const hero = def("hero", { speed: 50, attack: 30, magic: 20, maxMp: 99 });
  const foe = {
    ...def("foe", {
      maxHp: 10_000,
      defence: 10,
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

describe("previewDamage", () => {
  it.each([1, 2, 3, 4, 5])(
    "given seed %i, when the hero attacks, then the damage is within the random spread of the preview",
    (seed) => {
      const state = duel();
      state.rng = seed;
      const expected = previewDamage(heroOf(state), foeOf(state))!.amount;

      const { events } = act(state, { type: "attack", targetId: "enemy-0-0" });

      expect(Math.abs(dealt(events) - expected)).toBeLessThanOrEqual(
        Math.ceil(expected * 0.1),
      );
    },
  );

  it("given Cleave, when its damage is previewed, then it is the attack's times its power", () => {
    const state = duel();
    const attack = previewDamage(heroOf(state), foeOf(state))!.amount;

    const swing = previewDamage(heroOf(state), foeOf(state), cleave)!.amount;

    expect(swing).toBe(Math.round(attack * 0.7));
  });

  it("given Fireball, when its damage is previewed, then it uses magic against spirit", () => {
    const state = duel();

    const spell = previewDamage(heroOf(state), foeOf(state), fireball)!;

    // power x magic x K / (K + spirit), with magic 20 and spirit 5.
    const { power } = fireball.effect as { power: number };
    expect(spell.amount).toBe(Math.round(power * 20 * (50 / 55)));
  });

  it("given a foe weak to slash, when an attack is previewed, then the multiplier is 2", () => {
    const state = duel({}, { slash: 2, fire: 0 });

    const preview = previewDamage(heroOf(state), foeOf(state))!;

    expect(preview.multiplier).toBe(2);
  });

  it("given a foe immune to fire, when a Fireball is previewed, then it deals nothing and knocks no one out", () => {
    const state = duel({}, { slash: 2, fire: 0 });

    const spell = previewDamage(heroOf(state), foeOf(state), fireball)!;

    expect(spell).toMatchObject({ amount: 0, multiplier: 0, knocksOut: false });
  });

  it("given Heal, when its damage is previewed, then there is none", () => {
    const state = duel();

    const preview = previewDamage(heroOf(state), heroOf(state), heal);

    expect(preview).toBeNull();
  });

  it("given a foe at 10 HP, when an attack is previewed, then it knocks out", () => {
    const state = duel({ maxHp: 10 });

    const preview = previewDamage(heroOf(state), foeOf(state))!;

    expect(preview.knocksOut).toBe(true);
  });

  it.each([
    ["a shield", aegis],
    ["a ward", lastRites],
  ])(
    "given a foe at 10 HP with %s, when an attack is previewed, then it doesn't knock out",
    (_, skill) => {
      const state = duel({ maxHp: 10 });
      applyStatus(state, heroOf(state), foeOf(state), statusOf(skill), []);

      const preview = previewDamage(heroOf(state), foeOf(state))!;

      expect(preview.knocksOut).toBe(false);
    },
  );

  it("given a hidden hero, when Shatter is previewed, then stealth doesn't add to it", () => {
    const state = duel();
    const blast = previewDamage(heroOf(state), foeOf(state), shatter)!;
    applyStatus(state, heroOf(state), heroOf(state), statusOf(vanish), []);

    const hidden = previewDamage(heroOf(state), foeOf(state), shatter);

    expect(hidden).toEqual(blast);
    expect(blast.amount).toBeGreaterThan(0);
  });

  it("given a hidden hero, when an attack is previewed, then it is doubled", () => {
    const state = duel();
    const plain = previewDamage(heroOf(state), foeOf(state))!.amount;
    applyStatus(state, heroOf(state), heroOf(state), statusOf(vanish), []);

    const hidden = previewDamage(heroOf(state), foeOf(state))!.amount;

    expect(hidden).toBe(plain * 2);
  });
});
