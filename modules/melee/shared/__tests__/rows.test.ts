import { describe, expect, it } from "vitest";
import { chooseCommand } from "../ai";
import { act, advance, createBattle } from "../battle";
import { bow, fireball, sword } from "../content";
import type { BattleEvent, Weapon } from "../types";
import { def, place } from "./helpers";

/** Damage of one hit: attack 100, no defense, same seed and roll every time. */
function hit(weapon: Weapon, attackerRow: number, targetRow: number): number {
  const hero = def(
    "hero",
    { attack: 100, speed: 20 },
    { ...weapon, columns: "any", depth: "any" },
  );
  const waiting = advance(
    createBattle(
      {
        placements: [
          place(hero, "player", 2, attackerRow),
          place(
            def("target", { maxHp: 10_000, speed: 1 }),
            "enemy",
            2,
            targetRow,
          ),
        ],
      },
      5,
    ),
  ).state;
  const { events } = act(waiting, {
    type: "attack",
    targetId: `enemy-2-${targetRow}`,
  });
  const e = events.find((x) => x.type === "damage") as Extract<
    BattleEvent,
    { type: "damage" }
  >;
  return e.amount;
}

describe("rows and melee", () => {
  const base = hit(sword, 0, 0);

  it("deals x1 / x0.75 / x0.5 from the front / middle / back row", () => {
    expect(hit(sword, 1, 0)).toBe(Math.round(base * 0.75));
    expect(hit(sword, 2, 0)).toBe(Math.round(base * 0.5));
  });

  it("takes x1 / x0.75 / x0.5 in the front / middle / back row", () => {
    expect(hit(sword, 0, 1)).toBe(Math.round(base * 0.75));
    expect(hit(sword, 0, 2)).toBe(Math.round(base * 0.5));
  });

  it("stacks: back row hitting back row deals x0.25", () => {
    expect(hit(sword, 2, 2)).toBe(Math.round(base * 0.25));
  });

  it("does not apply to ranged weapons", () => {
    const arrow = hit(bow, 0, 0);
    expect(hit(bow, 2, 2)).toBe(arrow);
  });

  it("does not apply to spells", () => {
    const blast = (row: number) => {
      const mage = {
        ...def("mage", { magic: 50, maxMp: 30, speed: 50 }),
        skills: [fireball],
      };
      const waiting = advance(
        createBattle(
          {
            placements: [
              place(mage, "player", 4, 2),
              place(
                def("target", { maxHp: 10_000, speed: 1 }),
                "enemy",
                0,
                row,
              ),
            ],
          },
          5,
        ),
      ).state;
      const { events } = act(waiting, {
        type: "skill",
        skillId: "fireball",
        cell: { side: "enemy", col: 0, row },
      });
      return (
        events.find((e) => e.type === "damage") as Extract<
          BattleEvent,
          { type: "damage" }
        >
      ).amount;
    };
    expect(blast(2)).toBe(blast(0));
  });
});

describe("AI and rows", () => {
  it("knows a back-row target takes half and may survive", () => {
    // Expected sword hit: 20 in front, 10 at the back. Both targets have 15 HP:
    // only the front one can be finished.
    const brute = {
      ...def("brute", { attack: 20 }, sword),
      targeting: { finish: 3, wounded: 0, soft: 0, noise: 0 },
    };
    const state = createBattle(
      {
        placements: [
          place(brute, "enemy", 2),
          place(def("back", { maxHp: 100 }), "player", 1, 2),
          place(def("front", { maxHp: 100 }), "player", 3, 0),
        ],
      },
      1,
    );
    for (const u of state.units) if (u.side === "player") u.hp = 15;
    expect(chooseCommand(state, state.units[0]!)).toEqual({
      type: "attack",
      targetId: "player-3-0",
    });
  });
});
