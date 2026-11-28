import { describe, expect, it } from "vitest";
import { chooseCommand } from "@jforge/battle/engine/ai.ts";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import { bow, fireball, sword } from "../content";
import type { BattleEvent, Weapon } from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

/** Damage of one hit: attack 100, no defence, same seed and roll every time. */
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

  it.each([
    ["the middle row at the front", 1, 0, 0.75],
    ["the back row at the front", 2, 0, 0.5],
    ["the front row at the middle", 0, 1, 0.75],
    ["the front row at the back", 0, 2, 0.5],
    ["the back row at the back", 2, 2, 0.25],
  ])(
    "given a sword swung from %s, when it hits, then it deals x%d",
    (_, from, to, factor) => {
      const damage = hit(sword, from, to);

      expect(damage).toBe(Math.round(base * factor));
    },
  );

  it("given a bow, when it shoots from the back row at the back row, then it deals full damage", () => {
    const arrow = hit(bow, 0, 0);

    const far = hit(bow, 2, 2);

    expect(far).toBe(arrow);
  });

  it("given a Fireball, when it lands on the back row, then it deals as much as on the front", () => {
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
    const front = blast(0);

    const back = blast(2);

    expect(back).toBe(front);
  });
});

describe("AI and rows", () => {
  it("given two targets at 15 HP, front and back, when a sword-wielding AI attacks, then it finishes the front one", () => {
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

    const command = chooseCommand(state, state.units[0]!);

    expect(command).toEqual({ type: "attack", targetId: "player-3-0" });
  });
});
