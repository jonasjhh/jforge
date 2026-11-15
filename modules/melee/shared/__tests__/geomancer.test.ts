import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import {
  geomancer,
  raiseBoulder,
  shatter,
  sword,
  upheaval,
  viper,
} from "../content";
import { unitAt } from "../grid";
import { reachableTargets } from "../reach";
import type { BattleEvent, BattleState, Cell, Placement } from "../types";
import { def, place } from "./helpers";

type Damage = Extract<BattleEvent, { type: "damage" }>;

/** The Geomancer (speed 50, player 4,1; MP raised to 100) is waiting. */
function geoTurn(extra: Placement[] = []): BattleState {
  const fast = {
    ...geomancer,
    stats: { ...geomancer.stats, speed: 50, maxMp: 100 },
  };
  return advance(
    createBattle(
      {
        placements: [
          place(fast, "player", 4, 1),
          place(def("ally", { maxHp: 200, speed: 1 }), "player", 0, 0),
          place(
            def("foe", { maxHp: 1000, speed: 1, attack: 0 }),
            "enemy",
            0,
            0,
          ),
          ...extra,
        ],
      },
      1,
    ),
  ).state;
}

const P = (col: number, row: number): Cell => ({ side: "player", col, row });
const E = (col: number, row: number): Cell => ({ side: "enemy", col, row });
const cast = (s: BattleState, skillId: string, cell: Cell) =>
  act(s, { type: "skill", skillId, cell });
const boulders = (s: BattleState) =>
  s.units.filter((u) => u.obstacle && !u.vanished);

/** Plays on until the Geomancer is waiting again (others attack the foe). */
function nextGeoTurn(state: BattleState): BattleState {
  let s = state;
  for (let i = 0; i < 30; i++) {
    s = advance(s).state;
    if (s.phase.kind !== "awaitingCommand" || s.phase.unitId === "player-4-1")
      return s;
    s = act(s, { type: "attack", targetId: "enemy-0-0" }).state;
  }
  return s;
}

describe("Raise Boulder", () => {
  it("raises a boulder in an empty cell on either side, for 6 MP", () => {
    const one = cast(geoTurn(), "raise-boulder", E(2, 0));
    const rock = unitAt(one.state, E(2, 0))!;
    expect(rock).toMatchObject({
      defId: "boulder",
      side: "enemy",
      obstacle: true,
      summonedBy: "player-4-1",
    });
    expect(one.state.units[0]!.mp).toBe(100 - raiseBoulder.mpCost);
    const two = cast(nextGeoTurn(one.state), "raise-boulder", P(2, 0));
    expect(unitAt(two.state, P(2, 0))).toMatchObject({
      defId: "boulder",
      side: "player",
    });
  });

  it("is refused on an occupied cell", () => {
    expect(() => cast(geoTurn(), "raise-boulder", P(0, 0))).toThrow(/occupied/);
  });

  it("keeps at most two: a third replaces the oldest", () => {
    let s = cast(geoTurn(), "raise-boulder", E(1, 0)).state;
    s = cast(nextGeoTurn(s), "raise-boulder", E(2, 0)).state;
    const { state, events } = cast(nextGeoTurn(s), "raise-boulder", E(3, 0));
    expect(
      boulders(state)
        .map((b) => b.position.col)
        .sort(),
    ).toEqual([2, 3]);
    expect(events.some((e) => e.type === "vanished")).toBe(true);
    expect(unitAt(state, E(1, 0))).toBeUndefined();
  });

  it("never acts, and doesn't decide the battle", () => {
    const s = cast(geoTurn(), "raise-boulder", P(2, 0)).state;
    for (const u of s.units) if (u.side === "player" && !u.summonedBy) u.hp = 0;
    expect(advance(s).state.phase).toEqual({ kind: "over", winner: "enemy" });
  });

  it("blocks movement and gives cover to the unit behind it", () => {
    const s = cast(geoTurn(), "raise-boulder", P(0, 1)).state;
    // The ally at 0,0 can't step back onto the boulder.
    expect(() => {
      const turn = {
        ...s,
        phase: { kind: "awaitingCommand" as const, unitId: "player-0-0" },
      };
      act(turn, { type: "move", to: { col: 0, row: 1 } });
    }).toThrow(/occupied/);
    // An enemy swordsman facing column 4 can't reach the Geomancer behind a boulder at 4,0.
    const covered = cast(
      geoTurn([place(def("brute", { speed: 1 }, sword), "enemy", 4, 0)]),
      "raise-boulder",
      P(4, 0),
    ).state;
    const brute = covered.units.find((u) => u.id === "enemy-4-0")!;
    const reached = reachableTargets(covered, brute).map((u) => u.defId);
    expect(reached).toContain("boulder");
    expect(reached).not.toContain("geomancer");
  });

  it("can be attacked and vanishes when destroyed, freeing its cell", () => {
    const s = cast(geoTurn(), "raise-boulder", E(1, 0)).state;
    const rock = unitAt(s, E(1, 0))!;
    rock.hp = 1;
    const turn = {
      ...s,
      phase: { kind: "awaitingCommand" as const, unitId: "player-0-0" },
    };
    const { state, events } = act(turn, { type: "attack", targetId: rock.id });
    expect(events).toContainEqual({ type: "vanished", unitId: rock.id });
    expect(unitAt(state, E(1, 0))).toBeUndefined();
  });

  it("can't be helped by ally skills", () => {
    // Raise one on our side, then try to target it with an ally-only skill.
    const s = cast(geoTurn(), "raise-boulder", P(2, 0)).state;
    const healer = {
      ...s.units[0]!,
      skills: [
        {
          id: "h",
          name: "H",
          description: "",
          mpCost: 0,
          target: "ally" as const,
          area: "single" as const,
          effect: { type: "cleanse" as const },
        },
      ],
    };
    s.units[0] = healer;
    const turn = {
      ...s,
      phase: { kind: "awaitingCommand" as const, unitId: "player-4-1" },
    };
    expect(() => cast(turn, "h", P(2, 0))).toThrow(/boulder/);
  });
});

describe("Shatter", () => {
  it("destroys the boulder and hits everyone around it, friend or foe", () => {
    const s = cast(
      geoTurn([
        place(def("near", { maxHp: 1000, speed: 1 }), "enemy", 2, 1),
        place(def("side", { maxHp: 1000, speed: 1 }), "enemy", 3, 0),
        place(def("far", { maxHp: 1000, speed: 1 }), "enemy", 4, 2),
        place(def("friend", { maxHp: 1000, speed: 1 }), "player", 2, 0),
      ]),
      "raise-boulder",
      E(2, 0),
    ).state;
    const { state, events } = cast(nextGeoTurn(s), "shatter", E(2, 0));
    expect(events.some((e) => e.type === "shattered")).toBe(true);
    const hit = events
      .filter((e): e is Damage => e.type === "damage")
      .map((e) => e.unitId)
      .sort();
    expect(hit).toEqual(["enemy-2-1", "enemy-3-0", "player-2-0"]);
    expect(
      events.find((e): e is Damage => e.type === "damage")!.damageType,
    ).toBe("earth");
    expect(unitAt(state, E(2, 0))).toBeUndefined();
    expect(shatter.mpCost).toBe(8);
  });

  it("needs one of the Geomancer's own boulders", () => {
    expect(() => cast(geoTurn(), "shatter", E(0, 0))).toThrow(/your boulders/);
  });
});

describe("Upheaval", () => {
  it("heaves an enemy, an ally or a boulder one row back", () => {
    const enemy = cast(geoTurn(), "upheaval", E(0, 0));
    expect(enemy.events).toContainEqual({
      type: "pushed",
      unitId: "enemy-0-0",
      from: { col: 0, row: 0 },
      to: { col: 0, row: 1 },
    });
    const ally = cast(geoTurn(), "upheaval", P(0, 0));
    expect(
      ally.state.units.find((u) => u.id === "player-0-0")!.position,
    ).toEqual({ col: 0, row: 1 });
    const s = cast(geoTurn(), "raise-boulder", E(3, 0)).state;
    const rock = cast(nextGeoTurn(s), "upheaval", E(3, 0));
    expect(boulders(rock.state)[0]!.position).toEqual({ col: 3, row: 1 });
    expect(enemy.state.units[0]!.mp).toBe(100 - upheaval.mpCost);
  });

  it("does nothing when the way is blocked, and deals no damage", () => {
    const { events, state } = cast(
      geoTurn([place(def("behind", { speed: 1 }), "enemy", 0, 1)]),
      "upheaval",
      E(0, 0),
    );
    expect(events).toContainEqual({ type: "unmoved", unitId: "enemy-0-0" });
    expect(events.some((e) => e.type === "damage")).toBe(false);
    expect(state.units.find((u) => u.id === "enemy-0-0")!.position).toEqual({
      col: 0,
      row: 0,
    });
  });

  it("needs a unit in the cell", () => {
    expect(() => cast(geoTurn(), "upheaval", E(4, 2))).toThrow(/needs a unit/);
  });
});

describe("Earth damage", () => {
  it("hits Vipers harder", () => {
    expect(viper.resistances?.earth).toBe(1.5);
    const hitOn = (foe: Placement) => {
      const s = geoTurn([foe]);
      return act(s, { type: "attack", targetId: "enemy-2-0" }).events.find(
        (e): e is Damage => e.type === "damage",
      )!;
    };
    const onViper = hitOn(
      place(
        { ...viper, stats: { ...viper.stats, maxHp: 1000, speed: 1 } },
        "enemy",
        2,
        0,
      ),
    );
    expect(onViper).toMatchObject({ damageType: "earth", multiplier: 1.5 });
  });
});
