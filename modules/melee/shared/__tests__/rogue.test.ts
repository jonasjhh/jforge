import { describe, expect, it } from "vitest";
import { chooseCommand } from "../ai";
import { act, advance, createBattle } from "../battle";
import { fireball, firebolt, rogue, shadowstep, vanish } from "../content";
import { MOVE_GAUGE_LEFT } from "../move";
import { applyStatus } from "../status";
import type { BattleEvent, BattleState, Cell, StatusDef } from "../types";
import { def, place } from "./helpers";

type Damage = Extract<BattleEvent, { type: "damage" }>;
const stealth = (vanish.effect as { type: "status"; status: StatusDef }).status;

/** The Rogue (speed 50, player 2,0) is waiting for a command. */
function rogueTurn(): BattleState {
  const fast = { ...rogue, stats: { ...rogue.stats, speed: 50, attack: 100 } };
  return advance(
    createBattle(
      {
        placements: [
          place(fast, "player", 2, 0),
          place(def("ally", { maxHp: 200, speed: 1 }), "player", 0, 0),
          place(
            def("foe", { maxHp: 10_000, speed: 1, attack: 0 }),
            "enemy",
            2,
            0,
          ),
        ],
      },
      4,
    ),
  ).state;
}

const mine = (col: number, row: number): Cell => ({ side: "player", col, row });
const cast = (s: BattleState, skillId: string, cell: Cell) =>
  act(s, { type: "skill", skillId, cell });
const rogueOf = (s: BattleState) => s.units.find((u) => u.id === "player-2-0")!;
const hide = (s: BattleState, id: string) => {
  const u = s.units.find((x) => x.id === id)!;
  applyStatus(s, u, u, stealth, []);
};

describe("Vanish", () => {
  it("gives the Rogue Stealth, and only targets the Rogue", () => {
    const start = rogueTurn();
    expect(() => cast(start, "vanish", mine(0, 0))).toThrow(
      /only target its caster/,
    );
    const { state, events } = cast(start, "vanish", mine(2, 0));
    expect(events).toContainEqual({
      type: "statusApplied",
      unitId: "player-2-0",
      statusId: "stealth",
      name: "Stealth",
      ticks: 1,
    });
    expect(rogueOf(state).mp).toBe(rogue.stats.maxMp - vanish.mpCost);
  });

  it("wears off after 150 game time", () => {
    const { state } = cast(rogueTurn(), "vanish", mine(2, 0));
    // Freeze everyone so nobody acts (an attack would end the stealth).
    for (const u of state.units) u.base.speed = 0;
    const { events } = advance(state, { until: 200 });
    expect(events).toContainEqual({
      type: "statusExpired",
      unitId: "player-2-0",
      statusId: "stealth",
      name: "Stealth",
    });
    const expiredAt = state.time + 150;
    expect(expiredAt).toBe(170);
  });
});

describe("Stealth", () => {
  it("keeps the AI from picking the Rogue, even when it could finish it", () => {
    const state = rogueTurn();
    rogueOf(state).hp = 1;
    hide(state, "player-2-0");
    const foe = state.units.find((u) => u.id === "enemy-2-0")!;
    foe.weapon = { ...foe.weapon, columns: "any", depth: "any" };
    foe.targeting = { finish: 9, wounded: 9, soft: 0, noise: 0 };
    expect(chooseCommand(state, foe)).toEqual({
      type: "attack",
      targetId: "player-0-0",
    });
  });

  it("blocks single-target attacks and skills on a stealthed enemy, but not areas", () => {
    const mage = {
      ...def("mage", { magic: 30, maxMp: 50, speed: 50 }),
      skills: [firebolt, fireball],
    };
    const state = advance(
      createBattle(
        {
          placements: [
            place(mage, "player", 4, 2),
            place(def("sneak", { maxHp: 1000, speed: 1 }), "enemy", 1, 1),
          ],
        },
        1,
      ),
    ).state;
    hide(state, "enemy-1-1");
    const cell: Cell = { side: "enemy", col: 1, row: 1 };
    expect(() => act(state, { type: "attack", targetId: "enemy-1-1" })).toThrow(
      /out of reach/,
    );
    expect(() => cast(state, "firebolt", cell)).toThrow(/can't be seen/);
    const { events } = cast(state, "fireball", cell);
    expect(
      events.some((e) => e.type === "damage" && e.unitId === "enemy-1-1"),
    ).toBe(true);
  });

  it("makes the next attack an ambush for x2, and ends", () => {
    const plain = act(rogueTurn(), { type: "attack", targetId: "enemy-2-0" });
    const hidden = rogueTurn();
    hide(hidden, "player-2-0");
    const ambush = act(hidden, { type: "attack", targetId: "enemy-2-0" });
    const amount = (events: BattleEvent[]) =>
      events.find((e): e is Damage => e.type === "damage")!.amount;
    expect(ambush.events).toContainEqual({
      type: "ambush",
      unitId: "player-2-0",
    });
    expect(
      Math.abs(amount(ambush.events) - amount(plain.events) * 2),
    ).toBeLessThanOrEqual(1);
    expect(rogueOf(ambush.state).statuses).toEqual([]);
  });
});

describe("Shadowstep", () => {
  it("moves the Rogue to any empty cell on its side, for half a turn", () => {
    const { state, events } = cast(rogueTurn(), "shadowstep", mine(4, 2));
    expect(events).toContainEqual({
      type: "teleported",
      unitId: "player-2-0",
      from: { col: 2, row: 0 },
      to: { col: 4, row: 2 },
    });
    expect(rogueOf(state).position).toEqual({ col: 4, row: 2 });
    expect(rogueOf(state).gauge).toBe(MOVE_GAUGE_LEFT);
    expect(rogueOf(state).mp).toBe(rogue.stats.maxMp - shadowstep.mpCost);
  });

  it("is refused on an occupied cell or the enemy side", () => {
    const start = rogueTurn();
    expect(() => cast(start, "shadowstep", mine(0, 0))).toThrow(/occupied/);
    expect(() =>
      cast(start, "shadowstep", { side: "enemy", col: 4, row: 2 }),
    ).toThrow(/own side/);
  });

  it("keeps the Rogue hidden", () => {
    const start = rogueTurn();
    hide(start, "player-2-0");
    const { state } = cast(start, "shadowstep", mine(4, 2));
    expect(rogueOf(state).statuses.map((s) => s.id)).toEqual(["stealth"]);
  });
});
