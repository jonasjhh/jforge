import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { fireball } from "../content";
import { DEFENSE_K } from "../damage";
import { areaCells } from "../grid";
import type { BattleEvent, Cell, Placement } from "../types";
import { def, place } from "./helpers";

const at = (side: Cell["side"], col: number, row = 0): Cell => ({
  side,
  col,
  row,
});
const key = (c: Cell) => `${c.side}-${c.col}-${c.row}`;

describe("plus area", () => {
  it("covers the cell and its four neighbours", () => {
    expect(
      areaCells(at("enemy", 2, 1), "plus")
        .map(key)
        .sort(),
    ).toEqual(
      ["enemy-1-1", "enemy-2-0", "enemy-2-1", "enemy-2-2", "enemy-3-1"].sort(),
    );
  });

  it("is clipped at the edges of the battlefield", () => {
    expect(
      areaCells(at("enemy", 0, 2), "plus")
        .map(key)
        .sort(),
    ).toEqual(["enemy-0-1", "enemy-0-2", "enemy-1-2"].sort());
  });

  it("crosses the front line between the two sides", () => {
    expect(areaCells(at("enemy", 2, 0), "plus").map(key)).toContain(
      "player-2-0",
    );
    expect(areaCells(at("player", 2, 0), "plus").map(key)).toContain(
      "enemy-2-0",
    );
    expect(areaCells(at("enemy", 2, 1), "plus").map(key)).not.toContain(
      "player-2-0",
    );
  });
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

describe("Fireball", () => {
  it("hits every unit in the plus, and nothing outside it", () => {
    const { events } = cast(at("enemy", 2, 1), [
      place(sturdy("center"), "enemy", 2, 1),
      place(sturdy("left"), "enemy", 1, 1),
      place(sturdy("front"), "enemy", 2, 0),
      place(sturdy("corner"), "enemy", 1, 0),
      place(sturdy("ally"), "player", 2, 0),
    ]);
    expect(damaged(events)).toEqual(["enemy-1-1", "enemy-2-0", "enemy-2-1"]);
  });

  it("burns the ally standing opposite an enemy in the front row", () => {
    const { events } = cast(at("enemy", 2, 0), [
      place(sturdy("foe"), "enemy", 2, 0),
      place(sturdy("opposite"), "player", 2, 0),
      place(sturdy("beside"), "player", 3, 0),
    ]);
    expect(damaged(events)).toEqual(["enemy-2-0", "player-2-0"]);
  });

  it("can be aimed at an empty cell", () => {
    const { events, state } = cast(at("enemy", 2, 2), [
      place(sturdy("foe"), "enemy", 2, 1),
    ]);
    expect(damaged(events)).toEqual(["enemy-2-1"]);
    expect(state.units[0]!.mp).toBe(30 - fireball.mpCost);
  });

  it("deals power x magic against spirit", () => {
    const { events } = cast(
      at("enemy", 0),
      [
        place(
          def("foe", {
            maxHp: 1000,
            spirit: DEFENSE_K,
            defense: 999,
            speed: 1,
          }),
          "enemy",
          0,
        ),
      ],
      { magic: 50 },
    );
    const hit = events.find((e) => e.type === "damage");
    // 1.2 x 50 x 50/100 = 30, +-10%. High defense doesn't matter.
    expect(hit?.type === "damage" && hit.amount).toBeGreaterThanOrEqual(27);
    expect(hit?.type === "damage" && hit.amount).toBeLessThanOrEqual(33);
  });

  it("is refused without enough MP or off the battlefield", () => {
    expect(() =>
      cast(at("enemy", 0), [place(sturdy("foe"), "enemy", 0)], { mp: 11 }),
    ).toThrow(/Not enough MP/);
    expect(() =>
      cast(at("enemy", 5), [place(sturdy("foe"), "enemy", 0)]),
    ).toThrow(/off the battlefield/);
  });

  it("knocks out several units at once and can win the battle", () => {
    const weak = (name: string) => def(name, { maxHp: 5, spirit: 0, speed: 1 });
    const { events, state } = cast(at("enemy", 2, 1), [
      place(weak("a"), "enemy", 2, 1),
      place(weak("b"), "enemy", 1, 1),
    ]);
    expect(events.filter((e) => e.type === "knockedOut")).toHaveLength(2);
    expect(state.phase).toEqual({ kind: "over", winner: "player" });
  });

  it("ends in a draw when it wipes out both sides", () => {
    const weak = (name: string) => def(name, { maxHp: 5, spirit: 0, speed: 1 });
    // The mage stands in the blast itself: aimed at its own cell.
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
