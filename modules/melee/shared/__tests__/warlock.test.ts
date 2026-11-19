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
  it("given the Warlock at 40 HP, when it drains a foe, then it deals shadow and heals by half of it, for the MP cost", () => {
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

  it("given the Warlock at full HP, when it drains a foe, then it heals nothing", () => {
    const start = warlockTurn();

    const { events } = cast(start, "drain", foeCell);

    expect(events.some((e) => e.type === "heal")).toBe(false);
  });

  it("given a foe immune to shadow, when the hurt Warlock drains it, then it heals nothing", () => {
    const ghost = {
      ...def("ghost", { maxHp: 1000, speed: 1 }),
      resistances: { shadow: 0 },
    };
    const start = warlockTurn(ghost);
    warlockOf(start).hp = 40;

    const { events } = cast(start, "drain", foeCell);

    expect(events.some((e) => e.type === "heal")).toBe(false);
  });
});

describe("Blood Bolt", () => {
  it("given the Warlock, when it casts Blood Bolt, then it pays 15 HP and no MP", () => {
    const start = warlockTurn();

    const { events, state } = cast(start, "blood-bolt", foeCell);

    expect(bloodBolt.hpCost).toBe(15);
    expect(events).toContainEqual({
      type: "hpPaid",
      unitId: "player-4-2",
      amount: 15,
      hp: warlock.stats.maxHp - 15,
    });
    expect(warlockOf(state).mp).toBe(warlock.stats.maxMp);
  });

  it("given the Warlock at 15 HP, when it casts Blood Bolt, then it is refused so it can't kill itself", () => {
    const start = warlockTurn();
    warlockOf(start).hp = 15;

    const bolt = () => cast(start, "blood-bolt", foeCell);

    expect(bolt).toThrow(/Not enough HP/);
  });
});

describe("Summon Imp", () => {
  it("given an empty cell, when the Warlock summons there, then a player-controlled Imp appears, for 10 HP and 6 MP", () => {
    const start = warlockTurn();

    const { events, state } = cast(start, "summon-imp", mine(2, 0));

    expect(events).toContainEqual({
      type: "summoned",
      unitId: "summon-1",
      byId: "player-4-2",
      cell: mine(2, 0),
    });
    expect(unitAt(state, mine(2, 0))).toMatchObject({
      id: "summon-1",
      defId: "imp",
      side: "player",
      control: "player",
      summonedBy: "player-4-2",
    });
    expect(warlockOf(state).hp).toBe(warlock.stats.maxHp - summonImp.hpCost!);
    expect(warlockOf(state).mp).toBe(warlock.stats.maxMp - summonImp.mpCost);
  });

  it.each<[string, Cell, RegExp]>([
    ["an occupied cell", mine(0, 0), /occupied/],
    ["the enemy side", { side: "enemy", col: 3, row: 0 }, /own side/],
  ])(
    "given %s, when the Warlock summons there, then it is refused",
    (_, cell, error) => {
      const start = warlockTurn();

      const summon = () => cast(start, "summon-imp", cell);

      expect(summon).toThrow(error);
    },
  );

  /** Summons once, then plays on until `unitId` is waiting. */
  const turnOf = (unitId: string) => {
    let state = cast(warlockTurn(), "summon-imp", mine(2, 0)).state;
    for (let i = 0; i < 20; i++) {
      state = advance(state).state;
      if (state.phase.kind !== "awaitingCommand") break;
      if (state.phase.unitId === unitId) break;
      // Anyone else waiting attacks the foe.
      state = act(state, { type: "attack", targetId: "enemy-0-0" }).state;
    }
    return state;
  };

  it("given a hurt Imp, when the Warlock summons again, then the old one vanishes and a fresh one stands in the new cell", () => {
    const before = turnOf("player-4-2");
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

  it("given an Imp, when the Warlock summons into the Imp's cell, then it is replaced", () => {
    const before = turnOf("player-4-2");

    const { state } = cast(before, "summon-imp", mine(2, 0));

    expect(imps(state).map((u) => u.id)).toEqual(["summon-2"]);
  });

  it("given an Imp, when the battle runs on, then it gets its own player turn", () => {
    const summoned = "summon-1";

    const state = turnOf(summoned);

    expect(state.phase).toEqual({
      kind: "awaitingCommand",
      unitId: "summon-1",
    });
  });

  it("given the Imp's turn, when it firebolts an ally, then it is refused", () => {
    const state = turnOf("summon-1");

    const bolt = () => cast(state, "firebolt", mine(0, 0));

    expect(bolt).toThrow(/targets an enemy/);
  });

  it("given the Imp's turn, when it firebolts the foe, then it deals fire, for the MP cost", () => {
    const state = turnOf("summon-1");

    const { events, state: after } = cast(state, "firebolt", foeCell);

    expect(
      events.find((e): e is Ev<"damage"> => e.type === "damage"),
    ).toMatchObject({ damageType: "fire" });
    expect(after.units.find((u) => u.id === "summon-1")!.mp).toBe(
      12 - firebolt.mpCost,
    );
  });

  it("given an Imp at 1 HP before a killer, when it is knocked out, then it vanishes, freeing its cell", () => {
    const killer = {
      ...def("killer", { attack: 100, speed: 30, maxHp: 1000 }),
      targeting: { finish: 9, wounded: 0, soft: 0, noise: 0 },
    };
    const summoned = cast(warlockTurn(killer), "summon-imp", mine(0, 1)).state;
    summoned.units.find((u) => u.id === "summon-1")!.hp = 1;
    // Keep everyone else out of the killer's reach of a finishing blow.
    summoned.units.find((u) => u.id === "player-0-0")!.hp = 200;
    let state = summoned;
    const events: BattleEvent[] = [];

    for (let i = 0; i < 20 && !events.some((e) => e.type === "vanished"); i++) {
      const step = advance(state, { stopAfterAction: true });
      events.push(...step.events);
      state = step.state;
      if (state.phase.kind === "awaitingCommand") {
        state = cast(state, "drain", foeCell).state;
      }
    }

    expect(events).toContainEqual({ type: "vanished", unitId: "summon-1" });
    expect(unitAt(state, mine(0, 1))).toBeUndefined();
  });

  it("given only an Imp left standing, when the battle advances, then the enemy wins", () => {
    const summoned = cast(warlockTurn(), "summon-imp", mine(2, 0)).state;
    for (const u of summoned.units)
      if (u.side === "player" && !u.summonedBy) u.hp = 0;

    const { state } = advance(summoned);

    expect(state.phase).toEqual({ kind: "over", winner: "enemy" });
  });
});

describe("Warlock skills", () => {
  it("given the Warlock, when its skills are listed, then they are Drain, Blood Bolt, Summon Imp, Curse and Sacrifice", () => {
    const skills = warlock.skills;

    expect(skills).toEqual([drain, bloodBolt, summonImp, curse, sacrifice]);
  });
});

describe("Curse", () => {
  it("given a foe, when it is cursed, then it takes no damage yet but 0.3 x magic shadow per tick, for the MP cost", () => {
    const start = warlockTurn();

    const { events, state } = cast(start, curse.id, foeCell);

    expect(events.some((e) => e.type === "damage")).toBe(false);
    expect(unitAt(state, foeCell)!.statuses[0]).toMatchObject({
      name: "Cursed",
      damageType: "shadow",
      amount: Math.round(0.3 * warlock.stats.magic),
      ticksLeft: 5,
    });
    expect(warlockOf(state).mp).toBe(warlock.stats.maxMp - curse.mpCost);
  });

  it("given a Warlock with Blood Bolt, when Curse is added, then its offense is unchanged, as Curse counts as weaker damage", () => {
    // Weaker than Blood Bolt, so it adds nothing; as support it would.
    const without = { ...warlock, skills: [drain, bloodBolt, summonImp] };
    const withCurse = { ...without, skills: [...without.skills, curse] };

    const offense = offenseOf(withCurse);

    expect(offense).toBe(offenseOf(without));
  });
});

describe("Sacrifice", () => {
  const impCell = mine(2, 2);
  /** The Warlock's next turn, with its Imp at player 2,2. */
  const withImp = (): BattleState =>
    advance(cast(warlockTurn(), summonImp.id, impCell).state).state;

  it("given an Imp at 20 HP and the Warlock at 30, when it is sacrificed, then it goes, the Warlock heals 20 and gains Dark Pact", () => {
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
    expect(
      warlockOf(state).modifiers.find((m) => m.source === "Dark Pact"),
    ).toMatchObject({ stat: "magic", op: "mul", value: 1.5 });
    expect(warlockOf(state).mp).toBe(warlock.stats.maxMp - summonImp.mpCost);
  });

  it.each([
    ["an ally", mine(0, 0)],
    ["an empty cell", mine(2, 2)],
  ])(
    "given %s, when the Warlock sacrifices it, then it is refused",
    (_, cell) => {
      const start = warlockTurn();

      const problem = validateCommand(start, warlockOf(start), {
        type: "skill",
        skillId: sacrifice.id,
        cell,
      });

      expect(problem).toBe("Sacrifice needs one of your summons");
    },
  );

  it("given a weak and a healthy Imp, when the AI values Sacrifice, then the weak one is worth more", () => {
    const value = (impHp: number) => {
      const state = withImp();
      warlockOf(state).hp = 30;
      unitAt(state, impCell)!.hp = impHp;
      return skillValue(state, warlockOf(state), sacrifice, impCell);
    };
    const healthy = value(30);

    const weak = value(5);

    expect(weak).toBeGreaterThan(healthy);
  });
});
