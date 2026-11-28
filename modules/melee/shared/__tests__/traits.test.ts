import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import { boulder, hook, imp, lancer, slime, viper, wolf } from "../content";
import { TRAIT_RESISTANCES, resistancesFor } from "@jforge/rules/core";
import type { BattleEvent, CombatantDef } from "@jforge/battle/engine/types.ts";
import { DAMAGE_TYPES } from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

describe("resistancesFor", () => {
  it.each([
    ["a slime", slime, TRAIT_RESISTANCES.ooze],
    ["a wolf", wolf, { pierce: 1.5 }],
  ])(
    "given %s, when its resistances are taken, then they are its trait's",
    (_, creature, table) => {
      const resistances = resistancesFor(creature);

      expect(resistances).toEqual(table);
    },
  );

  it.each([
    ["an imp", imp, { holy: 2, fire: 0.5 }],
    ["a boulder", boulder, { impact: 2, poison: 0 }],
  ])(
    "given %s, when its resistances are taken, then they include its trait's",
    (_, creature, table) => {
      const resistances = resistancesFor(creature);

      expect(resistances).toMatchObject(table);
    },
  );

  it("given a viper, a beast and reptile immune to poison, when its resistances are taken, then both traits combine and its own immunity wins", () => {
    const resistances = resistancesFor(viper);

    expect(resistances).toEqual({ pierce: 1.5, cold: 1.5, poison: 0 });
  });

  it("given an ooze that is also stone, when its pierce resistance is taken, then both multiply", () => {
    const both: CombatantDef = { ...def("x"), traits: ["ooze", "stone"] };

    const pierce = resistancesFor(both).pierce;

    // Ooze 0.5 x stone 0.5.
    expect(pierce).toBe(0.25);
  });

  it("given the trait tables, when their damage types are listed, then all are known", () => {
    const types = Object.values(TRAIT_RESISTANCES).flatMap(Object.keys);

    const unknown = types.filter(
      (type) => !(DAMAGE_TYPES as readonly string[]).includes(type),
    );

    expect(unknown).toEqual([]);
  });
});

describe("collisions", () => {
  it("given a front-row enemy, when it is hooked against the edge, then the crash is impact damage", () => {
    const fast = { ...lancer, stats: { ...lancer.stats, speed: 50 } };
    const state = advance(
      createBattle(
        {
          placements: [
            place(fast, "player", 2),
            place(def("front", { maxHp: 1000, speed: 1 }), "enemy", 2, 0),
          ],
        },
        1,
      ),
    ).state;

    const { events } = act(state, {
      type: "skill",
      skillId: hook.id,
      cell: { side: "enemy", col: 2, row: 0 },
    });

    const hit = events.find((e) => e.type === "damage") as Extract<
      BattleEvent,
      { type: "damage" }
    >;
    expect(hit.damageType).toBe("impact");
  });
});
