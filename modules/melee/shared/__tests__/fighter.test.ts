import { describe, expect, it } from "vitest";
import { chooseCommand } from "@jforge/battle/engine/ai.ts";
import {
  act,
  advance,
  createBattle,
  validateCommand,
} from "@jforge/battle/engine/battle.ts";
import { skillValue } from "@jforge/battle/engine/aiSkills.ts";
import {
  cleave,
  fighter,
  fireball,
  firebolt,
  ironStance,
  playerTypes,
  provoke,
  rend,
  secondWind,
  vanish,
  warCry,
} from "../content";
import { effectiveStat } from "@jforge/battle/engine/stats.ts";
import { applyStatus } from "@jforge/battle/engine/status.ts";
import type {
  BattleState,
  CombatantDef,
  StatusDef,
  Unit,
} from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

const statusOf = (skill: typeof provoke) =>
  (skill.effect as { type: "status"; status: StatusDef }).status;

const FIGHTER = "player-1-0";
const ALLY = "player-3-0";
const FOE = "enemy-2-0";

/**
 * The Fighter (fast) is ready; a soft ally stands beside it; a slow foe
 * reaches everyone and casts Firebolt and Fireball.
 */
function fighterTurn(foe: Partial<CombatantDef> = {}): BattleState {
  const fast = { ...fighter, stats: { ...fighter.stats, speed: 50 } };
  return advance(
    createBattle(
      {
        placements: [
          place(fast, "player", 1, 0),
          place(def("ally", { speed: 1, defense: 0 }), "player", 3, 0),
          place(
            {
              ...def("foe", { speed: 1, maxMp: 99, magic: 10 }),
              skills: [firebolt, fireball],
              ...foe,
            },
            "enemy",
            2,
            0,
          ),
        ],
      },
      1,
    ),
  ).state;
}

const unit = (s: BattleState, id: string): Unit =>
  s.units.find((u) => u.id === id)!;
const provoked = () =>
  act(fighterTurn(), {
    type: "skill",
    skillId: "provoke",
    cell: { side: "player", col: 1, row: 0 },
  }).state;

describe("Provoke", () => {
  it("given the Fighter, when it provokes, then a taunt is put on it for 5 MP", () => {
    const state = fighterTurn();

    const after = act(state, {
      type: "skill",
      skillId: "provoke",
      cell: { side: "player", col: 1, row: 0 },
    }).state;

    const self = unit(after, FIGHTER);
    expect(self.statuses[0]).toMatchObject({ id: "taunt", effect: "taunt" });
    expect(self.mp).toBe(fighter.stats.maxMp - provoke.mpCost);
  });

  it.each([
    ["attacks the ally", { type: "attack", targetId: ALLY }, /provoking/],
    ["attacks the Fighter", { type: "attack", targetId: FIGHTER }, null],
    [
      "casts a single-target skill at the ally",
      {
        type: "skill",
        skillId: firebolt.id,
        cell: { side: "player", col: 3, row: 0 },
      },
      /provoking/,
    ],
    [
      "casts an area skill at the ally",
      {
        type: "skill",
        skillId: fireball.id,
        cell: { side: "player", col: 3, row: 0 },
      },
      null,
    ],
  ] as const)(
    "given the Fighter provoking, when the foe %s, then the check gives %s",
    (_, command, problem) => {
      const state = provoked();

      const result = validateCommand(state, unit(state, FOE), command);

      if (problem) expect(result).toMatch(problem);
      else expect(result).toBeNull();
    },
  );

  it("given a foe that can't reach the provoking Fighter, when it attacks the ally, then it is allowed", () => {
    const short = { columns: 0, depth: 1 } as const;
    const state = fighterTurn({
      weapon: { ...def("x").weapon, ...short, kind: "melee" },
    });
    // The foe stands in column 3, facing the ally only.
    const foe = unit(state, FOE);
    foe.position = { col: 3, row: 0 };
    const self = unit(state, FIGHTER);
    applyStatus(state, self, self, statusOf(provoke), []);

    const problem = validateCommand(state, foe, {
      type: "attack",
      targetId: ALLY,
    });

    expect(problem).toBeNull();
  });

  it("given the provoking Fighter hidden, when the foe attacks the ally, then it is allowed", () => {
    const state = provoked();
    const self = unit(state, FIGHTER);
    applyStatus(state, self, self, statusOf(vanish), []);

    const problem = validateCommand(state, unit(state, FOE), {
      type: "attack",
      targetId: ALLY,
    });

    expect(problem).toBeNull();
  });

  it("given an AI that wants the soft ally, when the Fighter provokes, then it attacks the Fighter", () => {
    const state = provoked();
    const foe = unit(state, FOE);
    foe.skills = [];
    foe.targeting = { finish: 0, wounded: 0, soft: 10, noise: 0 };

    const command = chooseCommand(state, foe);

    expect(command).toEqual({ type: "attack", targetId: FIGHTER });
  });

  it("given the Fighter provoking, when the battle runs on, then the taunt expires after 150", () => {
    let state = provoked();
    const from = state.time;
    let expiredAt: number | null = null;

    while (expiredAt === null && state.time < from + 1000) {
      const step = advance(state, { stopAfterAction: true });
      state = step.state;
      if (
        step.events.some(
          (e) => e.type === "statusExpired" && e.statusId === "taunt",
        )
      ) {
        expiredAt = state.time;
      }
      if (state.ready.length > 0) state = act(state, { type: "wait" }).state;
    }

    expect(expiredAt).not.toBeNull();
    expect(expiredAt! - from).toBeCloseTo(150, 0);
  });

  it.each([
    ["an ally to cover", 1, true],
    ["no ally standing", 0, false],
  ])(
    "given an AI Fighter with %s, when it chooses, then it provokes: %s",
    (_, allyHp, provokes) => {
      const state = fighterTurn();
      const self = unit(state, FIGHTER);
      self.targeting = { finish: 0, wounded: 0, soft: 0, noise: 0 };
      self.skills = [provoke];
      if (!allyHp) unit(state, ALLY).hp = 0;

      const command = chooseCommand(state, self);

      expect(command?.type === "skill" && command.skillId === "provoke").toBe(
        provokes,
      );
    },
  );
});

const SELF = { side: "player", col: 1, row: 0 } as const;
const cast = (skillId: string, state = fighterTurn()) =>
  act(state, { type: "skill", skillId, cell: SELF }).state;

describe("the Fighter's skills", () => {
  it("given the Fighter, when its skills are listed, then they are six, none of them another class's", () => {
    const others = playerTypes
      .filter((t) => t !== fighter)
      .flatMap((t) => t.skills ?? []);

    const skills = fighter.skills!;

    expect(skills).toEqual([
      cleave,
      provoke,
      ironStance,
      secondWind,
      warCry,
      rend,
    ]);
    expect(skills.filter((s) => others.includes(s))).toEqual([]);
  });
});

describe("Iron Stance", () => {
  it("given the Fighter beside an ally, when it takes Iron Stance, then only its own defense doubles, for the MP cost", () => {
    const state = fighterTurn();

    const after = cast(ironStance.id, state);

    expect(effectiveStat(unit(after, FIGHTER), "defense")).toBe(
      fighter.stats.defense * 2,
    );
    expect(effectiveStat(unit(after, ALLY), "defense")).toBe(0);
    expect(unit(after, FIGHTER).mp).toBe(
      fighter.stats.maxMp - ironStance.mpCost,
    );
  });
});

describe("Second Wind", () => {
  const hurt = (hp: number) => {
    const state = fighterTurn();
    unit(state, FIGHTER).hp = hp;
    return state;
  };

  it("given the Fighter at 30 HP, when it takes a Second Wind, then it heals a quarter of its max HP", () => {
    const state = hurt(30);

    const after = cast(secondWind.id, state);

    expect(unit(after, FIGHTER).hp).toBe(30 + fighter.stats.maxHp / 4);
  });

  it("given the Fighter 5 HP short, when it takes a Second Wind, then it stops at max HP", () => {
    const state = hurt(fighter.stats.maxHp - 5);

    const after = cast(secondWind.id, state);

    expect(unit(after, FIGHTER).hp).toBe(fighter.stats.maxHp);
  });

  it.each([
    ["hurt", () => hurt(30), true],
    ["unhurt", () => fighterTurn(), false],
  ])(
    "given the Fighter %s, when the AI values Second Wind, then it is worth casting: %s",
    (_, make, worth) => {
      const state = make();

      const value = skillValue(state, unit(state, FIGHTER), secondWind, SELF);

      expect(value > 0).toBe(worth);
    },
  );
});

describe("War Cry", () => {
  it("given the Fighter beside an ally, when it cries, then both their attacks rise x1.3 and the foe's doesn't", () => {
    const before = fighterTurn();

    const after = cast(warCry.id, before);

    const attack = (s: BattleState, id: string) =>
      effectiveStat(unit(s, id), "attack");
    expect(attack(after, FIGHTER)).toBeCloseTo(attack(before, FIGHTER) * 1.3);
    expect(attack(after, ALLY)).toBeCloseTo(attack(before, ALLY) * 1.3);
    expect(attack(after, FOE)).toBe(attack(before, FOE));
  });
});
