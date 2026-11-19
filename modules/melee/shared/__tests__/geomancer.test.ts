import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import {
  geomancer,
  raiseBoulder,
  shatter,
  sword,
  upheaval,
  vanish,
} from "../content";
import { unitAt } from "../grid";
import { reachableTargets } from "../reach";
import { skillVictims } from "../skills";
import { applyStatus } from "../status";
import type {
  BattleEvent,
  BattleState,
  Cell,
  Placement,
  StatusDef,
} from "../types";
import { def, place } from "./helpers";

type Damage = Extract<BattleEvent, { type: "damage" }>;
const statusOf = (skill: { effect: unknown }) =>
  (skill.effect as { status: StatusDef }).status;

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

const asCommander = (s: BattleState, unitId: string): BattleState => ({
  ...s,
  phase: { kind: "awaitingCommand", unitId },
});

describe("Raise Boulder", () => {
  it("given an empty enemy cell, when the Geomancer raises a boulder there, then an enemy-side obstacle it summoned stands there, for 6 MP", () => {
    const state = geoTurn();

    const { state: after } = cast(state, "raise-boulder", E(2, 0));

    expect(unitAt(after, E(2, 0))).toMatchObject({
      defId: "boulder",
      side: "enemy",
      obstacle: true,
      summonedBy: "player-4-1",
    });
    expect(after.units[0]!.mp).toBe(100 - raiseBoulder.mpCost);
  });

  it("given an empty player cell, when the Geomancer raises a boulder there, then it stands on the player side", () => {
    const state = geoTurn();

    const { state: after } = cast(state, "raise-boulder", P(2, 0));

    expect(unitAt(after, P(2, 0))).toMatchObject({
      defId: "boulder",
      side: "player",
    });
  });

  it("given an occupied cell, when a boulder is raised there, then it is refused", () => {
    const state = geoTurn();

    const raise = () => cast(state, "raise-boulder", P(0, 0));

    expect(raise).toThrow(/occupied/);
  });

  it("given two boulders, when a third is raised, then it replaces the oldest", () => {
    let s = cast(geoTurn(), "raise-boulder", E(1, 0)).state;
    s = nextGeoTurn(cast(nextGeoTurn(s), "raise-boulder", E(2, 0)).state);

    const { state, events } = cast(s, "raise-boulder", E(3, 0));

    expect(
      boulders(state)
        .map((b) => b.position.col)
        .sort(),
    ).toEqual([2, 3]);
    expect(events.some((e) => e.type === "vanished")).toBe(true);
    expect(unitAt(state, E(1, 0))).toBeUndefined();
  });

  it("given only a boulder left on the player side, when the battle advances, then the enemy wins", () => {
    const s = cast(geoTurn(), "raise-boulder", P(2, 0)).state;
    for (const u of s.units) if (u.side === "player" && !u.summonedBy) u.hp = 0;

    const { state } = advance(s);

    expect(state.phase).toEqual({ kind: "over", winner: "enemy" });
  });

  it("given a boulder behind the ally, when the ally steps back onto it, then it is refused", () => {
    const s = cast(geoTurn(), "raise-boulder", P(0, 1)).state;

    const step = () =>
      act(asCommander(s, "player-0-0"), {
        type: "move",
        to: { col: 0, row: 1 },
      });

    expect(step).toThrow(/occupied/);
  });

  it("given a boulder in front of the Geomancer, when an enemy swordsman's targets are listed, then it reaches the boulder, not the Geomancer", () => {
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

  it("given a boulder at 1 HP, when it is attacked, then it vanishes, freeing its cell", () => {
    const s = cast(geoTurn(), "raise-boulder", E(1, 0)).state;
    const rock = unitAt(s, E(1, 0))!;
    rock.hp = 1;

    const { state, events } = act(asCommander(s, "player-0-0"), {
      type: "attack",
      targetId: rock.id,
    });

    expect(events).toContainEqual({ type: "vanished", unitId: rock.id });
    expect(unitAt(state, E(1, 0))).toBeUndefined();
  });

  it("given a boulder on the player side, when an ally-only skill targets it, then it is refused", () => {
    const s = cast(geoTurn(), "raise-boulder", P(2, 0)).state;
    s.units[0] = {
      ...s.units[0]!,
      skills: [
        {
          id: "h",
          name: "H",
          description: "",
          mpCost: 0,
          target: "ally",
          area: "single",
          effect: { type: "cleanse" },
        },
      ],
    };

    const help = () => cast(asCommander(s, "player-4-1"), "h", P(2, 0));

    expect(help).toThrow(/boulder/);
  });
});

describe("Shatter", () => {
  it("given a boulder among friends and foes, when it is shattered, then it goes and everyone around it takes impact damage", () => {
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

    const hits = events.filter((e): e is Damage => e.type === "damage");
    expect(events.some((e) => e.type === "shattered")).toBe(true);
    expect(hits.map((e) => e.unitId).sort()).toEqual([
      "enemy-2-1",
      "enemy-3-0",
      "player-2-0",
    ]);
    expect(hits[0]!.damageType).toBe("impact");
    expect(unitAt(state, E(2, 0))).toBeUndefined();
    expect(shatter.mpCost).toBe(8);
  });

  it("given a boulder beside a foe, when Shatter's victims are listed, then the boulder itself is not among them", () => {
    const s = nextGeoTurn(
      cast(
        geoTurn([place(def("near", { maxHp: 1000, speed: 1 }), "enemy", 2, 1)]),
        "raise-boulder",
        E(2, 0),
      ).state,
    );
    const caster = s.units.find((u) => u.id === "player-4-1")!;
    const skill = caster.skills.find((k) => k.id === "shatter")!;

    const victims = skillVictims(s, caster, skill, E(2, 0));

    expect(victims.map((u) => u.id)).toEqual(["enemy-2-1"]);
  });

  it("given no boulder of the Geomancer's, when it shatters a cell, then it is refused", () => {
    const state = geoTurn();

    const fire = () => cast(state, "shatter", E(0, 0));

    expect(fire).toThrow(/your boulders/);
  });
});

describe("Upheaval", () => {
  it("given an enemy, when it is heaved, then it is pushed one row back, for the MP cost", () => {
    const state = geoTurn();

    const { state: after, events } = cast(state, "upheaval", E(0, 0));

    expect(events).toContainEqual({
      type: "pushed",
      unitId: "enemy-0-0",
      from: { col: 0, row: 0 },
      to: { col: 0, row: 1 },
    });
    expect(after.units[0]!.mp).toBe(100 - upheaval.mpCost);
  });

  it("given an ally, when it is heaved, then it moves one row back", () => {
    const state = geoTurn();

    const { state: after } = cast(state, "upheaval", P(0, 0));

    expect(after.units.find((u) => u.id === "player-0-0")!.position).toEqual({
      col: 0,
      row: 1,
    });
  });

  it("given a boulder, when it is heaved, then it moves one row back", () => {
    const s = nextGeoTurn(cast(geoTurn(), "raise-boulder", E(3, 0)).state);

    const { state } = cast(s, "upheaval", E(3, 0));

    expect(boulders(state)[0]!.position).toEqual({ col: 3, row: 1 });
  });

  it("given the way back blocked, when an enemy is heaved, then it stays put and takes no damage", () => {
    const state = geoTurn([place(def("behind", { speed: 1 }), "enemy", 0, 1)]);

    const { events, state: after } = cast(state, "upheaval", E(0, 0));

    expect(events).toContainEqual({ type: "unmoved", unitId: "enemy-0-0" });
    expect(events.some((e) => e.type === "damage")).toBe(false);
    expect(after.units.find((u) => u.id === "enemy-0-0")!.position).toEqual({
      col: 0,
      row: 0,
    });
  });

  it("given a hidden enemy, when it is heaved, then it can't be seen", () => {
    const s = geoTurn();
    const foe = s.units.find((u) => u.id === "enemy-0-0")!;
    applyStatus(s, foe, foe, statusOf(vanish), []);

    const heave = () => cast(s, "upheaval", E(0, 0));

    expect(heave).toThrow(/can't be seen/);
  });

  it("given an empty cell, when it is heaved, then it is refused", () => {
    const state = geoTurn();

    const heave = () => cast(state, "upheaval", E(4, 2));

    expect(heave).toThrow(/needs a unit/);
  });
});

describe("Geomancer damage types", () => {
  it("given a target, when the Geomancer attacks with its Rod, then it deals crush damage", () => {
    const s = geoTurn([
      place(def("target", { maxHp: 1000, speed: 1 }), "enemy", 2, 0),
    ]);

    const { events } = act(s, { type: "attack", targetId: "enemy-2-0" });

    const hit = events.find((e): e is Damage => e.type === "damage")!;
    expect(hit.damageType).toBe("crush");
  });
});
