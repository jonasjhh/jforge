import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import { fireball } from "../content";
import { DEFENCE_K } from "@jforge/battle/engine/damage.ts";
import { areaCells } from "@jforge/battle/engine/grid.ts";
import type {
  BattleEvent,
  Cell,
  Placement,
} from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

const at = (side: Cell["side"], col: number, row = 0): Cell => ({
  side,
  col,
  row,
});
const key = (c: Cell) => `${c.side}-${c.col}-${c.row}`;

describe("plus area", () => {
  it.each([
    [
      "the middle of the grid",
      at("enemy", 2, 1),
      ["enemy-1-1", "enemy-2-0", "enemy-2-1", "enemy-2-2", "enemy-3-1"],
    ],
    ["a corner", at("enemy", 0, 2), ["enemy-0-1", "enemy-0-2", "enemy-1-2"]],
  ])(
    "given a cell in %s, when its plus is taken, then it covers the cell and its neighbours on the grid",
    (_, cell, cells) => {
      const area = areaCells(cell, "plus").map(key).sort();

      expect(area).toEqual([...cells].sort());
    },
  );

  it.each([
    ["an enemy front-row cell", at("enemy", 2, 0), "player-2-0", true],
    ["a player front-row cell", at("player", 2, 0), "enemy-2-0", true],
    ["an enemy middle-row cell", at("enemy", 2, 1), "player-2-0", false],
  ])(
    "given %s, when its plus is taken, then it reaches %s across the front line: %s",
    (_, cell, other, reaches) => {
      const area = areaCells(cell, "plus").map(key);

      expect(area.includes(other)).toBe(reaches);
    },
  );
});

/** A mage that acts first, plus whatever else is placed. */
function cast(
  cell: Cell,
  others: Placement[],
  mage: { mp?: number; magic?: number } = {},
) {
  const caster = {
    ...def("mage", {
      magic: mage.magic ?? 20,
      maxMp: mage.mp ?? 30,
      speed: 50,
    }),
    skills: [fireball],
  };
  const waiting = advance(
    createBattle({ placements: [place(caster, "player", 4, 2), ...others] }, 1),
  ).state;
  return act(waiting, { type: "skill", skillId: "fireball", cell });
}

const damaged = (events: BattleEvent[]) =>
  events.flatMap((e) => (e.type === "damage" ? [e.unitId] : [])).sort();

const sturdy = (name: string) => def(name, { maxHp: 1000, speed: 1 });
const weak = (name: string) => def(name, { maxHp: 5, spirit: 0, speed: 1 });

describe("Fireball", () => {
  it("given units in and around the plus, when Fireball lands, then only those in it are hit", () => {
    const others = [
      place(sturdy("center"), "enemy", 2, 1),
      place(sturdy("left"), "enemy", 1, 1),
      place(sturdy("front"), "enemy", 2, 0),
      place(sturdy("corner"), "enemy", 1, 0),
      place(sturdy("ally"), "player", 2, 0),
    ];

    const { events } = cast(at("enemy", 2, 1), others);

    expect(damaged(events)).toEqual(["enemy-1-1", "enemy-2-0", "enemy-2-1"]);
  });

  it("given an ally opposite a front-row enemy, when Fireball lands on the enemy, then the ally burns too", () => {
    const others = [
      place(sturdy("foe"), "enemy", 2, 0),
      place(sturdy("opposite"), "player", 2, 0),
      place(sturdy("beside"), "player", 3, 0),
    ];

    const { events } = cast(at("enemy", 2, 0), others);

    expect(damaged(events)).toEqual(["enemy-2-0", "player-2-0"]);
  });

  it("given an empty cell beside a foe, when Fireball is aimed there, then the foe is hit, for the MP cost", () => {
    const others = [place(sturdy("foe"), "enemy", 2, 1)];

    const { events, state } = cast(at("enemy", 2, 2), others);

    expect(damaged(events)).toEqual(["enemy-2-1"]);
    expect(state.units[0]!.mp).toBe(30 - fireball.mpCost);
  });

  it("given magic 50 against spirit K and high defence, when Fireball lands, then it deals 30 within the 10% spread", () => {
    const foe = def("foe", {
      maxHp: 1000,
      spirit: DEFENCE_K,
      defence: 999,
      speed: 1,
    });

    const { events } = cast(at("enemy", 0), [place(foe, "enemy", 0)], {
      magic: 50,
    });

    // 1.2 x 50 x 50/100 = 30, +-10%. High defence doesn't matter.
    const hit = events.find((e) => e.type === "damage");
    const amount = hit?.type === "damage" && hit.amount;
    expect(amount).toBeGreaterThanOrEqual(27);
    expect(amount).toBeLessThanOrEqual(33);
  });

  it.each([
    ["too little MP", at("enemy", 0), 11, /Not enough MP/],
    ["a cell off the battlefield", at("enemy", 5), 30, /off the battlefield/],
  ])(
    "given %s, when Fireball is cast, then it is refused",
    (_, cell, mp, error) => {
      const others = [place(sturdy("foe"), "enemy", 0)];

      const fire = () => cast(cell, others, { mp });

      expect(fire).toThrow(error);
    },
  );

  it("given the last two foes weak, when Fireball hits both, then both are knocked out and the battle is won", () => {
    const others = [
      place(weak("a"), "enemy", 2, 1),
      place(weak("b"), "enemy", 1, 1),
    ];

    const { events, state } = cast(at("enemy", 2, 1), others);

    expect(events.filter((e) => e.type === "knockedOut")).toHaveLength(2);
    expect(state.phase).toEqual({ kind: "over", winner: "player" });
  });

  it("given a weak mage opposite the last weak foe, when it fireballs its own cell, then both fall and it is a draw", () => {
    const caster = {
      ...def("mage", { magic: 20, maxMp: 30, maxHp: 5, speed: 50 }),
      skills: [fireball],
    };
    const waiting = advance(
      createBattle(
        {
          placements: [
            place(caster, "player", 2, 0),
            place(weak("foe"), "enemy", 2, 0),
          ],
        },
        1,
      ),
    ).state;

    const { state } = act(waiting, {
      type: "skill",
      skillId: "fireball",
      cell: at("player", 2, 0),
    });

    expect(state.phase).toEqual({ kind: "over", winner: null });
  });
});
