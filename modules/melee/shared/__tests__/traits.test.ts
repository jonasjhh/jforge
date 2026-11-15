import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { boulder, hook, imp, lancer, slime, viper, wolf } from "../content";
import { TRAIT_RESISTANCES, resistancesFor } from "../traits";
import type { BattleEvent, CombatantDef } from "../types";
import { DAMAGE_TYPES } from "../types";
import { def, place } from "./helpers";

describe("creature traits", () => {
  it("give each creature its trait defaults", () => {
    expect(resistancesFor(slime)).toEqual(TRAIT_RESISTANCES.ooze);
    expect(resistancesFor(wolf)).toEqual({ pierce: 1.5 });
    expect(resistancesFor(imp)).toMatchObject({ holy: 2, fire: 0.5 });
    expect(resistancesFor(boulder)).toMatchObject({ impact: 2, poison: 0 });
  });

  it("combine several traits, and let the creature override them", () => {
    // Viper: beast (pierce x1.5) + reptile (cold x1.5), immune to poison.
    expect(resistancesFor(viper)).toEqual({
      pierce: 1.5,
      cold: 1.5,
      poison: 0,
    });
    const both: CombatantDef = { ...def("x"), traits: ["ooze", "stone"] };
    // Pierce: ooze 0.5 x stone 0.5.
    expect(resistancesFor(both).pierce).toBe(0.25);
  });

  it("only use known damage types", () => {
    for (const table of Object.values(TRAIT_RESISTANCES)) {
      for (const type of Object.keys(table)) {
        expect(DAMAGE_TYPES).toContain(type);
      }
    }
  });
});

describe("collisions", () => {
  it("are impact damage", () => {
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
    // Hooking a front-row enemy crashes it against the edge.
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
