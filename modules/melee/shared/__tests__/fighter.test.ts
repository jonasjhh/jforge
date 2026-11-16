import { describe, expect, it } from "vitest";
import { chooseCommand } from "../ai";
import { act, advance, createBattle, validateCommand } from "../battle";
import { fighter, fireball, firebolt, provoke, vanish } from "../content";
import { applyStatus } from "../status";
import type { BattleState, CombatantDef, StatusDef, Unit } from "../types";
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
  it("is the Fighter's, and puts a taunt on it for 5 MP", () => {
    expect(fighter.skills).toContain(provoke);
    const state = provoked();
    const self = unit(state, FIGHTER);
    expect(self.statuses[0]).toMatchObject({ id: "taunt", effect: "taunt" });
    expect(self.mp).toBe(fighter.stats.maxMp - provoke.mpCost);
  });

  it("makes enemies attack the Fighter, not its allies", () => {
    const state = provoked();
    const foe = unit(state, FOE);
    expect(
      validateCommand(state, foe, { type: "attack", targetId: ALLY }),
    ).toMatch(/provoking/);
    expect(
      validateCommand(state, foe, { type: "attack", targetId: FIGHTER }),
    ).toBeNull();
  });

  it("binds single-target skills but not area ones", () => {
    const state = provoked();
    const foe = unit(state, FOE);
    const at = { side: "player", col: 3, row: 0 } as const;
    expect(
      validateCommand(state, foe, {
        type: "skill",
        skillId: firebolt.id,
        cell: at,
      }),
    ).toMatch(/provoking/);
    expect(
      validateCommand(state, foe, {
        type: "skill",
        skillId: fireball.id,
        cell: at,
      }),
    ).toBeNull();
  });

  it("doesn't bind an enemy that can't reach the Fighter", () => {
    const short = { columns: 0, depth: 1 } as const;
    const state = fighterTurn({
      weapon: { ...def("x").weapon, ...short, kind: "melee" },
    });
    // The foe stands in column 3, facing the ally only.
    const foe = unit(state, FOE);
    foe.position = { col: 3, row: 0 };
    const self = unit(state, FIGHTER);
    applyStatus(state, self, self, statusOf(provoke), []);
    expect(
      validateCommand(state, foe, { type: "attack", targetId: ALLY }),
    ).toBeNull();
  });

  it("doesn't bind while the Fighter is hidden", () => {
    const state = provoked();
    const self = unit(state, FIGHTER);
    applyStatus(state, self, self, statusOf(vanish), []);
    const foe = unit(state, FOE);
    expect(
      validateCommand(state, foe, { type: "attack", targetId: ALLY }),
    ).toBeNull();
  });

  it("turns an AI that wants the soft ally onto the Fighter", () => {
    const state = provoked();
    const foe = unit(state, FOE);
    foe.skills = [];
    foe.targeting = { finish: 0, wounded: 0, soft: 10, noise: 0 };
    expect(chooseCommand(state, foe)).toEqual({
      type: "attack",
      targetId: FIGHTER,
    });
  });

  it("wears off after a while", () => {
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

  it("is cast by the AI only with allies to cover", () => {
    const state = fighterTurn();
    const self = unit(state, FIGHTER);
    self.targeting = { finish: 0, wounded: 0, soft: 0, noise: 0 };
    self.skills = [provoke];
    expect(chooseCommand(state, self)).toMatchObject({ skillId: "provoke" });
    unit(state, ALLY).hp = 0;
    expect(chooseCommand(state, self)).not.toMatchObject({
      skillId: "provoke",
    });
  });
});
