import { describe, expect, it } from "vitest";
import { chooseCommand } from "@jforge/battle/engine/ai.ts";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import { fireball, firebolt, rogue, shadowstep, vanish } from "../content";
import { MOVE_GAUGE_LEFT } from "@jforge/battle/engine/move.ts";
import { applyStatus } from "@jforge/battle/engine/status.ts";
import type {
  BattleEvent,
  BattleState,
  Cell,
  StatusDef,
} from "@jforge/battle/engine/types.ts";
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
  it("given an ally, when the Rogue vanishes onto it, then it is refused", () => {
    const start = rogueTurn();

    const vanishAlly = () => cast(start, "vanish", mine(0, 0));

    expect(vanishAlly).toThrow(/only target its caster/);
  });

  it("given the Rogue, when it vanishes, then it is stealthed, for the MP cost", () => {
    const start = rogueTurn();

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

  it("given a stealthed Rogue at time 20 and nobody acting, when time runs to 200, then the stealth expires", () => {
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
    // Lasts 150 from time 20.
    expect(state.time + 150).toBe(170);
  });
});

describe("Stealth", () => {
  it("given a stealthed Rogue at 1 HP, when an AI that loves finishing chooses, then it attacks the ally instead", () => {
    const state = rogueTurn();
    rogueOf(state).hp = 1;
    hide(state, "player-2-0");
    const foe = state.units.find((u) => u.id === "enemy-2-0")!;
    foe.weapon = { ...foe.weapon, columns: "any", depth: "any" };
    foe.targeting = { finish: 9, wounded: 9, soft: 0, noise: 0 };

    const command = chooseCommand(state, foe);

    expect(command).toEqual({ type: "attack", targetId: "player-0-0" });
  });

  describe("on a stealthed enemy", () => {
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

    it("given a stealthed enemy, when it is attacked, then it is out of reach", () => {
      const attack = () =>
        act(state, { type: "attack", targetId: "enemy-1-1" });

      expect(attack).toThrow(/out of reach/);
    });

    it("given a stealthed enemy, when a single-target skill is cast at it, then it can't be seen", () => {
      const bolt = () => cast(state, "firebolt", cell);

      expect(bolt).toThrow(/can't be seen/);
    });

    it("given a stealthed enemy, when an area skill lands on it, then it is hit", () => {
      const { events } = cast(state, "fireball", cell);

      expect(
        events.some((e) => e.type === "damage" && e.unitId === "enemy-1-1"),
      ).toBe(true);
    });
  });

  it("given a stealthed Rogue, when it attacks, then it ambushes for x2 and the stealth ends", () => {
    const amount = (events: BattleEvent[]) =>
      events.find((e): e is Damage => e.type === "damage")!.amount;
    const plain = act(rogueTurn(), { type: "attack", targetId: "enemy-2-0" });
    const hidden = rogueTurn();
    hide(hidden, "player-2-0");

    const ambush = act(hidden, { type: "attack", targetId: "enemy-2-0" });

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
  it("given an empty cell on its side, when the Rogue shadowsteps there, then it teleports for half a turn and the MP cost", () => {
    const start = rogueTurn();

    const { state, events } = cast(start, "shadowstep", mine(4, 2));

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

  it.each<[string, Cell, RegExp]>([
    ["an occupied cell", mine(0, 0), /occupied/],
    ["the enemy side", { side: "enemy", col: 4, row: 2 }, /own side/],
  ])(
    "given %s, when the Rogue shadowsteps there, then it is refused",
    (_, cell, error) => {
      const start = rogueTurn();

      const step = () => cast(start, "shadowstep", cell);

      expect(step).toThrow(error);
    },
  );

  it("given a stealthed Rogue, when it shadowsteps, then it stays hidden", () => {
    const start = rogueTurn();
    hide(start, "player-2-0");

    const { state } = cast(start, "shadowstep", mine(4, 2));

    expect(rogueOf(state).statuses.map((s) => s.id)).toEqual(["stealth"]);
  });
});
