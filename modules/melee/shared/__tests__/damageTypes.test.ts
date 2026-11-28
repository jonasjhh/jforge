import { describe, expect, it } from "vitest";
import { chooseCommand } from "@jforge/battle/engine/ai.ts";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import { fireball, slime, sword, wolf } from "../content";
import type {
  BattleEvent,
  CombatantDef,
  Resistances,
} from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

/** One sword hit (attack 40, no defense) on a target with `resistances`. */
function swordHit(resistances: Resistances) {
  const hero = def("hero", { attack: 40, speed: 20 }, sword);
  const target: CombatantDef = {
    ...def("target", { maxHp: 1000, speed: 1 }),
    resistances,
  };
  const waiting = advance(
    createBattle(
      { placements: [place(hero, "player", 0), place(target, "enemy", 0)] },
      3,
    ),
  ).state;
  const { events } = act(waiting, { type: "attack", targetId: "enemy-0-0" });
  return events.find((e) => e.type === "damage") as Extract<
    BattleEvent,
    { type: "damage" }
  >;
}

describe("resistances", () => {
  const normal = swordHit({});

  it("given no resistances, when a sword hits, then it is slash damage at x1", () => {
    const hit = swordHit({});

    expect(hit).toMatchObject({ damageType: "slash", multiplier: 1 });
  });

  // Same seed, same random roll: only the multiplier differs.
  it("given a weakness to slash, when a sword hits, then it deals double", () => {
    const hit = swordHit({ slash: 2 });

    expect(hit.amount).toBe(normal.amount * 2);
    expect(hit.multiplier).toBe(2);
  });

  it("given a resistance to slash, when a sword hits, then it deals half", () => {
    const hit = swordHit({ slash: 0.5 });

    expect(hit.amount).toBe(Math.round(normal.amount / 2));
  });

  it("given multipliers for other types, when a sword hits, then they are ignored", () => {
    const hit = swordHit({ fire: 2, pierce: 0 });

    expect(hit.multiplier).toBe(1);
  });

  it("given immunity to slash, when a sword hits, then it deals nothing", () => {
    const hit = swordHit({ slash: 0 });

    expect(hit).toMatchObject({ amount: 0, multiplier: 0 });
  });
});

describe("starter content", () => {
  it("given a slime beside a wolf, when a Fireball lands, then the slime takes double fire damage", () => {
    const mage = {
      ...def("mage", { magic: 30, maxMp: 30, speed: 50 }),
      skills: [fireball],
    };
    const sturdy = (d: CombatantDef) => ({
      ...d,
      stats: { ...d.stats, maxHp: 1000 },
    });
    const waiting = advance(
      createBattle(
        {
          placements: [
            place(mage, "player", 4, 2),
            place(sturdy(slime), "enemy", 1, 1),
            place(sturdy(wolf), "enemy", 2, 1),
          ],
        },
        1,
      ),
    ).state;

    const { events } = act(waiting, {
      type: "skill",
      skillId: "fireball",
      cell: { side: "enemy", col: 1, row: 1 },
    });

    const hits = events.filter((e) => e.type === "damage");
    const onSlime = hits.find((e) => e.unitId === "enemy-1-1")!;
    const onWolf = hits.find((e) => e.unitId === "enemy-2-1")!;
    expect(onSlime).toMatchObject({ damageType: "fire", multiplier: 2 });
    expect(onSlime.amount).toBeGreaterThan(onWolf.amount * 1.5);
  });
});

describe("AI and resistances", () => {
  it("given two targets at 25 HP, one weak to slash, when a sword-wielding AI attacks, then it finishes the weak one", () => {
    // Expected sword hit: 20. The weak target at 25 HP dies (20 x 2 = 40);
    // the normal one at 25 HP does not.
    const brute = {
      ...def("brute", { attack: 20 }, sword),
      targeting: { finish: 3, wounded: 2, soft: 1, noise: 0 },
    };
    const state = createBattle(
      {
        placements: [
          place(brute, "enemy", 2),
          place({ ...def("plain", { maxHp: 100 }) }, "player", 1),
          place(
            { ...def("weak", { maxHp: 100 }), resistances: { slash: 2 } },
            "player",
            3,
          ),
        ],
      },
      1,
    );
    for (const u of state.units) if (u.side === "player") u.hp = 25;

    const command = chooseCommand(state, state.units[0]!);

    expect(command).toEqual({ type: "attack", targetId: "player-3-0" });
  });
});
