import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import {
  aegis,
  blessing,
  consecrate,
  fireball,
  judgment,
  lastRites,
  paladin,
  venomFangs,
} from "../content";
import { skillValue } from "../aiSkills";
import { previewDamage } from "../preview";
import { applyStatus } from "../status";
import type { BattleEvent, BattleState, Cell, StatusDef } from "../types";
import { def, place } from "./helpers";

type Damage = Extract<BattleEvent, { type: "damage" }>;
const statusOf = (skill: typeof aegis) =>
  (skill.effect as { type: "status"; status: StatusDef }).status;

/**
 * The Paladin (speed 50, magic 14: Aegis absorbs 28) is waiting; the ally
 * at player 0,0 has 100 HP; the brute hits for exactly `brute` damage.
 */
function paladinTurn(brute = 20): BattleState {
  const fast = { ...paladin, stats: { ...paladin.stats, speed: 50 } };
  return advance(
    createBattle(
      {
        placements: [
          place(fast, "player", 4, 2),
          place(
            def("ally", { maxHp: 100, speed: 1, defense: 0 }),
            "player",
            0,
            0,
          ),
          place(
            def("foe", { maxHp: 1000, speed: 1, attack: brute }),
            "enemy",
            0,
            0,
          ),
        ],
      },
      1,
    ),
  ).state;
}

const ally: Cell = { side: "player", col: 0, row: 0 };
const cast = (s: BattleState, skillId: string, cell: Cell) =>
  act(s, { type: "skill", skillId, cell });
const allyOf = (s: BattleState) => s.units.find((u) => u.id === "player-0-0")!;

/** Lets the foe (AI, sole reachable target: the ally) attack once. */
function foeHits(state: BattleState) {
  const foe = state.units.find((u) => u.id === "enemy-0-0")!;
  foe.base.speed = 100;
  foe.weapon = { ...foe.weapon, columns: "any", depth: "any" };
  // Always the soft ally (defense 0), never the armoured Paladin.
  foe.targeting = { finish: 0, wounded: 0, soft: 10, noise: 0 };
  state.units.find((u) => u.id === "player-4-2")!.base.speed = 0;
  return advance(state, { stopAfterAction: true });
}

describe("Aegis", () => {
  it("given an ally, when the Paladin casts Aegis on it, then it is shielded for 2 x the Paladin's magic, for 8 MP", () => {
    const start = paladinTurn();

    const { state, events } = cast(start, "aegis", ally);

    expect(allyOf(state).statuses[0]).toMatchObject({
      id: "aegis",
      effect: "shield",
      amount: 28,
    });
    expect(events).toContainEqual({
      type: "statusApplied",
      unitId: "player-0-0",
      statusId: "aegis",
      name: "Aegis",
      ticks: 1,
    });
    expect(state.units.find((u) => u.id === "player-4-2")!.mp).toBe(
      paladin.stats.maxMp - aegis.mpCost,
    );
  });

  it("given a shielded ally, when a 20 hit lands, then the shield absorbs it before HP", () => {
    const shielded = cast(paladinTurn(), "aegis", ally).state;

    const { events, state } = foeHits(shielded);

    const hit = events.find((e): e is Damage => e.type === "damage")!;
    expect(hit.amount).toBe(0);
    expect(hit.absorbed).toBeGreaterThan(0);
    expect(allyOf(state).hp).toBe(100);
    expect(allyOf(state).statuses[0]!.amount).toBe(28 - hit.absorbed!);
  });

  it("given a shielded ally, when a 60 hit lands, then the shield breaks and the rest reaches HP", () => {
    const shielded = cast(paladinTurn(60), "aegis", ally).state;

    const { events, state } = foeHits(shielded);

    const hit = events.find((e): e is Damage => e.type === "damage")!;
    expect(hit.absorbed).toBe(28);
    expect(hit.amount).toBeGreaterThan(0);
    expect(allyOf(state).hp).toBe(100 - hit.amount);
    expect(events).toContainEqual({
      type: "shieldBroken",
      unitId: "player-0-0",
      name: "Aegis",
    });
    expect(allyOf(state).statuses).toEqual([]);
  });

  it("given a shielded, poisoned ally, when the poison ticks, then the shield absorbs it", () => {
    // A fresh (running) battle where nobody acts.
    const still = (name: string) =>
      def(name, { maxHp: 100, speed: 0, attack: 10, magic: 14 });
    const state = createBattle(
      {
        placements: [
          place(still("ally"), "player", 0, 0),
          place(still("viper"), "enemy", 0, 0),
        ],
      },
      1,
    );
    const [target, viper] = state.units;
    applyStatus(state, target!, target!, statusOf(aegis), []);
    applyStatus(state, viper!, target!, venomFangs.onHit!, []);

    const { events } = advance(state, { until: 31 });

    expect(events.find((e) => e.type === "statusTick")).toMatchObject({
      amount: 0,
      absorbed: 4,
    });
  });

  it("given a shielded ally, when a Fireball hits its cell, then the shield absorbs it", () => {
    const mage = {
      ...def("mage", { magic: 10, maxMp: 30, speed: 50 }),
      skills: [fireball],
    };
    const state = advance(
      createBattle(
        {
          placements: [
            place(mage, "player", 4, 2),
            place(def("ally", { maxHp: 100, speed: 1 }), "player", 0, 0),
            place(def("foe", { speed: 0 }), "enemy", 4, 0),
          ],
        },
        1,
      ),
    ).state;
    applyStatus(
      state,
      state.units[0]!,
      state.units[1]!,
      { ...statusOf(aegis), power: 100 },
      [],
    );

    const blast = cast(state, "fireball", ally);

    const onAlly = blast.events.find(
      (e): e is Damage => e.type === "damage" && e.unitId === "player-0-0",
    );
    expect(onAlly).toMatchObject({ amount: 0 });
    expect(onAlly!.absorbed).toBeGreaterThan(0);
  });

  it("given an ally with a worn Aegis, when it is cast again, then it refreshes to full", () => {
    const state = paladinTurn();
    const target = allyOf(state);
    applyStatus(state, state.units[0]!, target, statusOf(aegis), []);
    target.statuses[0]!.amount = 3;

    const recast = cast(state, "aegis", ally).state;

    expect(allyOf(recast).statuses).toHaveLength(1);
    expect(allyOf(recast).statuses[0]!.amount).toBe(28);
  });

  it("given a shielded ally, when 150 game time passes, then Aegis expires", () => {
    const { state } = cast(paladinTurn(), "aegis", ally);
    for (const u of state.units) u.base.speed = 0;

    const { events } = advance(state, { until: state.time + 151 });

    expect(events).toContainEqual({
      type: "statusExpired",
      unitId: "player-0-0",
      statusId: "aegis",
      name: "Aegis",
    });
  });
});

describe("Last Rites", () => {
  it("given Last Rites costs MP, when its cost is read, then it is 12", () => {
    const cost = lastRites.mpCost;

    expect(cost).toBe(12);
  });

  it("given a warded ally, when three killing blows land, then it is left at 1 HP each time instead of knocked out", () => {
    let state = cast(paladinTurn(500), "last-rites", ally).state;
    const events: BattleEvent[] = [];

    for (let i = 0; i < 3; i++) {
      const step = foeHits(state);
      events.push(...step.events);
      state = step.state;
    }

    expect(allyOf(state).hp).toBe(1);
    expect(events.filter((e) => e.type === "warded")).toHaveLength(3);
    expect(events.some((e) => e.type === "knockedOut")).toBe(false);
  });

  it("given the ward has expired, when a killing blow lands, then the ally is knocked out", () => {
    const { state } = cast(paladinTurn(500), "last-rites", ally);
    // Freeze the party only: with everyone frozen the battle would end in a
    // draw as soon as nothing more can happen.
    for (const u of state.units) if (u.side === "player") u.base.speed = 0;
    const expired = advance(state, { until: state.time + 121 });

    const { events } = foeHits(expired.state);

    expect(expired.events).toContainEqual({
      type: "statusExpired",
      unitId: "player-0-0",
      statusId: "last-rites",
      name: "Last Rites",
    });
    expect(
      events.some((e) => e.type === "knockedOut" && e.unitId === "player-0-0"),
    ).toBe(true);
  });
});

describe("Blessed Blade", () => {
  const fast = {
    ...paladin,
    stats: { ...paladin.stats, speed: 50, attack: 50 },
  };
  const hitOn = (holy?: number) => {
    const target = {
      ...def("t", { maxHp: 1000, speed: 1 }),
      ...(holy ? { resistances: { holy } } : {}),
    };
    const state = advance(
      createBattle(
        { placements: [place(fast, "player", 0), place(target, "enemy", 0)] },
        2,
      ),
    ).state;
    return act(state, { type: "attack", targetId: "enemy-0-0" }).events.find(
      (e): e is Damage => e.type === "damage",
    )!;
  };

  it("given a plain foe, when the Paladin attacks, then it deals holy damage", () => {
    const hit = hitOn();

    expect(hit.damageType).toBe("holy");
  });

  it("given a holy-weak foe, when the Paladin attacks, then it deals double", () => {
    const plain = hitOn().amount;

    const weak = hitOn(2).amount;

    expect(Math.abs(weak - plain * 2)).toBeLessThanOrEqual(1);
  });
});

describe("Consecrate", () => {
  /** The Paladin's turn with foes at enemy 1,1 (centre), 1,0 and 1,2. */
  function crowd(): BattleState {
    const fast = { ...paladin, stats: { ...paladin.stats, speed: 50 } };
    const foe = (row: number) =>
      place(def(`foe${row}`, { maxHp: 1000, speed: 1 }), "enemy", 1, row);
    return advance(
      createBattle(
        { placements: [place(fast, "player", 4, 2), foe(0), foe(1), foe(2)] },
        1,
      ),
    ).state;
  }
  const centre: Cell = { side: "enemy", col: 1, row: 1 };

  it("given three foes in a column, when the middle one is consecrated, then all three carry holy damage over time, for 10 MP", () => {
    const start = crowd();

    const { state } = cast(start, consecrate.id, centre);

    const unmarked = [0, 1, 2].filter(
      (row) =>
        !state.units
          .find((u) => u.id === `enemy-1-${row}`)!
          .statuses.some(
            (st) => st.id === "consecrated" && st.damageType === "holy",
          ),
    );
    expect(unmarked).toEqual([]);
    expect(state.units.find((u) => u.id === "player-4-2")!.mp).toBe(
      paladin.stats.maxMp - 10,
    );
  });
});

describe("Judgment", () => {
  /** The Paladin (front, 0,0) is waiting, a 100 HP ally at 1,0 and a foe. */
  function judgmentTurn(): BattleState {
    const fast = {
      ...paladin,
      stats: { ...paladin.stats, speed: 50, attack: 50 },
    };
    return advance(
      createBattle(
        {
          placements: [
            place(fast, "player", 0),
            place(def("ally", { maxHp: 100, speed: 1 }), "player", 1),
            place(def("foe", { maxHp: 1000, speed: 1 }), "enemy", 0),
          ],
        },
        2,
      ),
    ).state;
  }
  const PALADIN = "player-0-0";
  const ALLY = "player-1-0";
  const foeCell: Cell = { side: "enemy", col: 0, row: 0 };
  const hp = (s: BattleState, id: string) =>
    s.units.find((u) => u.id === id)!.hp;
  const setHp = (s: BattleState, id: string, value: number) => {
    s.units.find((u) => u.id === id)!.hp = value;
  };
  const judgmentValue = (s: BattleState) =>
    skillValue(
      s,
      s.units.find((u) => u.id === PALADIN)!,
      judgment,
      foeCell,
    );

  it("given the ally hurt more by HP share than the Paladin, when Judgment strikes, then the ally heals half the damage dealt", () => {
    const s = judgmentTurn();
    setHp(s, ALLY, 40); // 40% of 100
    setHp(s, PALADIN, 60); // ~52% of 115

    const { state, events } = cast(s, judgment.id, foeCell);

    const dealt = events.find((e): e is Damage => e.type === "damage")!;
    expect(dealt.amount).toBeGreaterThan(0);
    expect(hp(state, ALLY)).toBe(40 + Math.floor(dealt.amount / 2));
    expect(hp(state, PALADIN)).toBe(60);
  });

  it("given the Paladin the most hurt, when Judgment strikes, then the Paladin heals", () => {
    const s = judgmentTurn();
    setHp(s, ALLY, 90);
    setHp(s, PALADIN, 20);

    const { state } = cast(s, judgment.id, foeCell);

    expect(hp(state, PALADIN)).toBeGreaterThan(20);
    expect(hp(state, ALLY)).toBe(90);
  });

  it("given nobody hurt, when Judgment strikes, then it deals damage and heals no one", () => {
    const start = judgmentTurn();

    const { events } = cast(start, judgment.id, foeCell);

    expect(events.some((e) => e.type === "damage")).toBe(true);
    expect(events.some((e) => e.type === "heal")).toBe(false);
  });

  it("given a hurt ally, when the AI values Judgment, then it is worth more than with nobody hurt", () => {
    const healthy = judgmentValue(judgmentTurn());
    const hurt = judgmentTurn();
    setHp(hurt, ALLY, 20);

    const value = judgmentValue(hurt);

    expect(value).toBeGreaterThan(healthy);
  });
});

describe("Blessing", () => {
  /** The Paladin (0,0) is waiting, an ally at 1,0 and a foe at enemy 0,0. */
  function blessingTurn(): BattleState {
    const fast = {
      ...paladin,
      stats: { ...paladin.stats, speed: 50, attack: 50 },
    };
    return advance(
      createBattle(
        {
          placements: [
            place(fast, "player", 0),
            place(def("ally", { maxHp: 100, speed: 1 }), "player", 1),
            place(
              def("foe", { maxHp: 1000, speed: 1, attack: 40 }),
              "enemy",
              0,
            ),
          ],
        },
        2,
      ),
    ).state;
  }
  const self: Cell = { side: "player", col: 0, row: 0 };
  const paladinOf = (s: BattleState) =>
    s.units.find((u) => u.id === "player-0-0")!;
  const foeOf = (s: BattleState) => s.units.find((u) => u.id === "enemy-0-0")!;
  const blessedTurn = () => {
    const blessed = blessingTurn();
    applyStatus(
      blessed,
      paladinOf(blessed),
      paladinOf(blessed),
      statusOf(blessing),
      [],
    );
    return blessed;
  };
  const dealt = (s: BattleState) =>
    previewDamage(paladinOf(s), foeOf(s))!.amount;
  const taken = (s: BattleState) =>
    previewDamage(foeOf(s), paladinOf(s))!.amount;

  it("given the Paladin, when it blesses itself, then it is blessed, for 6 MP", () => {
    const start = blessingTurn();

    const { state } = cast(start, blessing.id, self);

    expect(paladinOf(state).statuses).toContainEqual(
      expect.objectContaining({ id: "blessing", effect: "bless" }),
    );
    expect(paladinOf(state).mp).toBe(paladin.stats.maxMp - 6);
  });

  it("given a blessed Paladin, when its attack is previewed, then it deals x1.2", () => {
    const plain = dealt(blessingTurn());

    const blessed = dealt(blessedTurn());

    expect(Math.abs(blessed - plain * 1.2)).toBeLessThanOrEqual(1);
  });

  it("given a blessed Paladin, when the foe's attack on it is previewed, then it takes x0.8", () => {
    const plain = taken(blessingTurn());

    const blessed = taken(blessedTurn());

    expect(Math.abs(blessed - plain * 0.8)).toBeLessThanOrEqual(1);
  });

  it("given a blessed caster, when it puts damage over time on a foe, then the ticks hit harder", () => {
    const s = blessingTurn();
    const me = paladinOf(s);
    me.base.magic = 50; // big enough that x1.2 survives rounding
    const foe = foeOf(s);
    const burn = statusOf(consecrate);
    applyStatus(s, me, foe, burn, []);
    const plain = foe.statuses.find((st) => st.id === burn.id)!.amount;
    applyStatus(s, me, me, statusOf(blessing), []);

    applyStatus(s, me, foe, burn, []);

    const blessed = foe.statuses.find((st) => st.id === burn.id)!.amount;
    expect(blessed).toBeGreaterThan(plain);
  });

  it("given the Paladin, when its skills are listed, then Blessing is the fifth", () => {
    const skills = paladin.skills;

    expect(skills).toEqual([aegis, lastRites, consecrate, judgment, blessing]);
  });
});
