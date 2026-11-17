import { describe, expect, it } from "vitest";
import { act, advance, createBattle, validateCommand } from "../battle";
import { skillValue } from "../aiSkills";
import { offenseOf } from "../threat";
import {
  bloodBolt,
  curse,
  drain,
  firebolt,
  sacrifice,
  summonImp,
  warlock,
} from "../content";
import { unitAt } from "../grid";
import type { BattleEvent, BattleState, Cell, CombatantDef } from "../types";
import { def, place } from "./helpers";

type Ev<T extends BattleEvent["type"]> = Extract<BattleEvent, { type: T }>;

/** The Warlock (speed 50, at player 4,2) is waiting for a command. */
function warlockTurn(
  foe: CombatantDef = def("foe", { maxHp: 1000, speed: 1, attack: 0 }),
): BattleState {
  const fast = { ...warlock, stats: { ...warlock.stats, speed: 50 } };
  return advance(
    createBattle(
      {
        placements: [
          place(fast, "player", 4, 2),
          place(def("ally", { maxHp: 200, speed: 1 }), "player", 0, 0),
          place(foe, "enemy", 0, 0),
        ],
      },
      1,
    ),
  ).state;
}

const foeCell: Cell = { side: "enemy", col: 0, row: 0 };
const mine = (col: number, row: number): Cell => ({ side: "player", col, row });
const cast = (s: BattleState, skillId: string, cell: Cell) =>
  act(s, { type: "skill", skillId, cell });
const warlockOf = (s: BattleState) =>
  s.units.find((u) => u.id === "player-4-2")!;
const imps = (s: BattleState) =>
  s.units.filter((u) => u.defId === "imp" && !u.vanished);

describe("Drain", () => {
  it("heals the Warlock by half the damage dealt", () => {
    const start = warlockTurn();
    warlockOf(start).hp = 40;
    const { events, state } = cast(start, "drain", foeCell);
    const dealt = events.find((e): e is Ev<"damage"> => e.type === "damage")!;
    const healed = events.find((e): e is Ev<"heal"> => e.type === "heal")!;
    expect(dealt.damageType).toBe("shadow");
    expect(healed).toMatchObject({
      unitId: "player-4-2",
      amount: Math.floor(dealt.amount / 2),
    });
    expect(warlockOf(state).hp).toBe(40 + healed.amount);
    expect(warlockOf(state).mp).toBe(warlock.stats.maxMp - drain.mpCost);
  });

  it("never heals above max HP, and nothing from an immune target", () => {
    const full = cast(warlockTurn(), "drain", foeCell);
    expect(full.events.some((e) => e.type === "heal")).toBe(false);

    const ghost = {
      ...def("ghost", { maxHp: 1000, speed: 1 }),
      resistances: { shadow: 0 },
    };
    const start = warlockTurn(ghost);
    warlockOf(start).hp = 40;
    const immune = cast(start, "drain", foeCell);
    expect(immune.events.some((e) => e.type === "heal")).toBe(false);
  });
});

describe("Blood Bolt", () => {
  it("costs 15 HP and no MP", () => {
    const { events, state } = cast(warlockTurn(), "blood-bolt", foeCell);
    expect(events).toContainEqual({
      type: "hpPaid",
      unitId: "player-4-2",
      amount: 15,
      hp: warlock.stats.maxHp - 15,
    });
    expect(warlockOf(state).mp).toBe(warlock.stats.maxMp);
    expect(bloodBolt.hpCost).toBe(15);
  });

  it("is refused at 15 HP or less, so it can't kill the Warlock", () => {
    const start = warlockTurn();
    warlockOf(start).hp = 15;
    expect(() => cast(start, "blood-bolt", foeCell)).toThrow(/Not enough HP/);
  });
});

describe("Summon Imp", () => {
  it("puts a player-controlled Imp in the chosen empty cell, for 10 HP and 6 MP", () => {
    const { events, state } = cast(warlockTurn(), "summon-imp", mine(2, 0));
    expect(events).toContainEqual({
      type: "summoned",
      unitId: "summon-1",
      byId: "player-4-2",
      cell: mine(2, 0),
    });
    const imp = unitAt(state, mine(2, 0))!;
    expect(imp).toMatchObject({
      id: "summon-1",
      defId: "imp",
      side: "player",
      control: "player",
      summonedBy: "player-4-2",
    });
    expect(warlockOf(state).hp).toBe(warlock.stats.maxHp - summonImp.hpCost!);
    expect(warlockOf(state).mp).toBe(warlock.stats.maxMp - summonImp.mpCost);
  });

  it("is refused on an occupied cell or the enemy side", () => {
    const start = warlockTurn();
    expect(() => cast(start, "summon-imp", mine(0, 0))).toThrow(/occupied/);
    expect(() =>
      cast(start, "summon-imp", { side: "enemy", col: 3, row: 0 }),
    ).toThrow(/own side/);
  });

  /** Summons once, then plays on to the Warlock's next turn. */
  const secondTurn = () => {
    let state = cast(warlockTurn(), "summon-imp", mine(2, 0)).state;
    for (let i = 0; i < 20; i++) {
      state = advance(state).state;
      if (
        state.phase.kind !== "awaitingCommand" ||
        state.phase.unitId === "player-4-2"
      )
        break;
      // Anyone else waiting (the ally or the Imp) attacks the foe.
      state = act(state, { type: "attack", targetId: "enemy-0-0" }).state;
    }
    return state;
  };

  it("replaces the old Imp: only one, fresh and at full HP", () => {
    const before = secondTurn();
    imps(before)[0]!.hp = 5;
    const { state, events } = cast(before, "summon-imp", mine(3, 0));
    expect(events).toContainEqual({ type: "vanished", unitId: "summon-1" });
    expect(imps(state)).toHaveLength(1);
    expect(imps(state)[0]).toMatchObject({
      id: "summon-2",
      hp: 30,
      position: { col: 3, row: 0 },
    });
    expect(unitAt(state, mine(2, 0))).toBeUndefined();
  });

  it("can replace the Imp in its own cell", () => {
    const { state } = cast(secondTurn(), "summon-imp", mine(2, 0));
    expect(imps(state).map((u) => u.id)).toEqual(["summon-2"]);
  });

  it("gets its own player turns, with Firebolt for enemies only", () => {
    let state = cast(warlockTurn(), "summon-imp", mine(2, 0)).state;
    for (let i = 0; i < 20; i++) {
      state = advance(state).state;
      if (
        state.phase.kind === "awaitingCommand" &&
        state.phase.unitId === "summon-1"
      )
        break;
      if (state.phase.kind === "awaitingCommand") {
        state = act(state, { type: "attack", targetId: "enemy-0-0" }).state;
      }
    }
    expect(state.phase).toEqual({
      kind: "awaitingCommand",
      unitId: "summon-1",
    });
    expect(() => cast(state, "firebolt", mine(0, 0))).toThrow(
      /targets an enemy/,
    );
    const { events, state: after } = cast(state, "firebolt", foeCell);
    expect(
      events.find((e): e is Ev<"damage"> => e.type === "damage"),
    ).toMatchObject({ damageType: "fire" });
    expect(after.units.find((u) => u.id === "summon-1")!.mp).toBe(
      12 - firebolt.mpCost,
    );
  });

  it("vanishes when knocked out, freeing its cell", () => {
    const killer = {
      ...def("killer", { attack: 100, speed: 30, maxHp: 1000 }),
      targeting: { finish: 9, wounded: 0, soft: 0, noise: 0 },
    };
    const summoned = cast(warlockTurn(killer), "summon-imp", mine(0, 1)).state;
    const imp = summoned.units.find((u) => u.id === "summon-1")!;
    imp.hp = 1;
    // Keep everyone else out of the killer's reach of a finishing blow.
    summoned.units.find((u) => u.id === "player-0-0")!.hp = 200;
    let state = summoned;
    const events: BattleEvent[] = [];
    for (let i = 0; i < 20 && !events.some((e) => e.type === "vanished"); i++) {
      const step = advance(state, { stopAfterAction: true });
      events.push(...step.events);
      state = step.state;
      if (state.phase.kind === "awaitingCommand") {
        state = act(state, {
          type: "skill",
          skillId: "drain",
          cell: foeCell,
        }).state;
      }
    }
    expect(events).toContainEqual({ type: "vanished", unitId: "summon-1" });
    expect(unitAt(state, mine(0, 1))).toBeUndefined();
  });

  it("doesn't keep a lost battle going", () => {
    const summoned = cast(warlockTurn(), "summon-imp", mine(2, 0)).state;
    for (const u of summoned.units)
      if (u.side === "player" && !u.summonedBy) u.hp = 0;
    expect(advance(summoned).state.phase).toEqual({
      kind: "over",
      winner: "enemy",
    });
  });
});

describe("Warlock skills", () => {
  it("are Drain, Blood Bolt, Summon Imp, Curse and Sacrifice", () => {
    expect(warlock.skills).toEqual([
      drain,
      bloodBolt,
      summonImp,
      curse,
      sacrifice,
    ]);
  });
});

describe("Curse", () => {
  it("puts shadow damage over time on one enemy, 0.3 x magic per tick", () => {
    const { events, state } = cast(warlockTurn(), curse.id, foeCell);
    expect(events.some((e) => e.type === "damage")).toBe(false);
    const foe = unitAt(state, foeCell)!;
    expect(foe.statuses[0]).toMatchObject({
      name: "Cursed",
      damageType: "shadow",
      amount: Math.round(0.3 * warlock.stats.magic),
      ticksLeft: 5,
    });
    expect(warlockOf(state).mp).toBe(warlock.stats.maxMp - curse.mpCost);
  });

  it("counts toward threat as damage, not as a support skill", () => {
    // Weaker than Blood Bolt, so it adds nothing; as support it would.
    const without = { ...warlock, skills: [drain, bloodBolt, summonImp] };
    const withCurse = { ...without, skills: [...without.skills, curse] };
    expect(offenseOf(withCurse)).toBe(offenseOf(without));
  });
});

describe("Sacrifice", () => {
  const impCell = mine(2, 2);
  /** The Warlock's next turn, with its Imp at player 2,2. */
  function withImp(): BattleState {
    const summoned = cast(warlockTurn(), summonImp.id, impCell).state;
    const next = advance(summoned).state;
    expect(next.phase).toEqual({
      kind: "awaitingCommand",
      unitId: "player-4-2",
    });
    return next;
  }

  it("gives up the Imp: the Warlock heals by its HP and gains Dark Pact", () => {
    const start = withImp();
    warlockOf(start).hp = 30;
    unitAt(start, impCell)!.hp = 20;
    const { events, state } = cast(start, sacrifice.id, impCell);
    expect(imps(state)).toEqual([]);
    expect(events).toContainEqual({
      type: "heal",
      unitId: "player-4-2",
      amount: 20,
      hp: 50,
    });
    const pact = warlockOf(state).modifiers.find(
      (m) => m.source === "Dark Pact",
    );
    expect(pact).toMatchObject({ stat: "magic", op: "mul", value: 1.5 });
    expect(warlockOf(state).mp).toBe(warlock.stats.maxMp - summonImp.mpCost);
  });

  it("needs one of the Warlock's own summons", () => {
    const start = warlockTurn();
    const refuse = (cell: Cell) =>
      validateCommand(start, warlockOf(start), {
        type: "skill",
        skillId: sacrifice.id,
        cell,
      });
    expect(refuse(mine(0, 0))).toBe("Sacrifice needs one of your summons");
    expect(refuse(mine(2, 2))).toBe("Sacrifice needs one of your summons");
  });

  it("is worth less to the AI the healthier the Imp it gives up", () => {
    const value = (impHp: number) => {
      const state = withImp();
      warlockOf(state).hp = 30;
      unitAt(state, impCell)!.hp = impHp;
      return skillValue(state, warlockOf(state), sacrifice, impCell);
    };
    expect(value(5)).toBeGreaterThan(value(30));
  });
});
