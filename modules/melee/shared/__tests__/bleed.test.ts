import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import { skillValue } from "@jforge/battle/engine/aiSkills.ts";
import { BLEED, worsenOnAction } from "@jforge/battle/engine/bleed.ts";
import { fighter, rend } from "../content";
import { previewDamage } from "@jforge/battle/engine/preview.ts";
import {
  applyStatus,
  cleanse,
  runDueTicks,
} from "@jforge/battle/engine/status.ts";
import type {
  BattleEvent,
  BattleState,
  Cell,
  Trait,
  Unit,
} from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

type Tick = Extract<BattleEvent, { type: "statusTick" }>;

const FIGHTER = "player-2-0";
const FOE = "enemy-2-0";
const at = (col: number, row: number): Cell => ({ side: "enemy", col, row });
const unit = (s: BattleState, id: string): Unit =>
  s.units.find((u) => u.id === id)!;

/** The Fighter (fast) is ready, facing a slow, sturdy foe. */
function fighterTurn(maxHp = 10_000, traits?: Trait[]): BattleState {
  const fast = { ...fighter, stats: { ...fighter.stats, speed: 50 } };
  return advance(
    createBattle(
      {
        placements: [
          place(fast, "player", 2),
          place(
            {
              ...def("foe", { maxHp, speed: 1 }),
              ...(traits ? { traits } : {}),
            },
            "enemy",
            2,
          ),
        ],
      },
      1,
    ),
  ).state;
}
const rended = (state = fighterTurn()) =>
  act(state, { type: "skill", skillId: rend.id, cell: at(2, 0) });
const bleeding = (u: Unit) => u.statuses.find((s) => s.id === BLEED.id);

describe("Rend", () => {
  it("given a sturdy foe, when Rend is previewed, then it strikes at x0.8", () => {
    const state = fighterTurn();
    const [self, target] = state.units;
    const plain = previewDamage(self!, target!)!.amount;

    const cut = previewDamage(self!, target!, rend)!.amount;

    expect(Math.abs(cut - plain * 0.8)).toBeLessThan(1);
  });

  it("given a sturdy foe, when the Fighter rends it, then it bleeds slash and the MP is spent", () => {
    const state = fighterTurn();

    const after = rended(state).state;

    const status = bleeding(unit(after, FOE))!;
    expect(status).toMatchObject({ damageType: "slash", ticksLeft: 5 });
    expect(status.amount).toBe(Math.round(BLEED.power * fighter.stats.attack));
    expect(status.growth).toBe(Math.round(status.amount * 0.5));
    expect(unit(after, FIGHTER).mp).toBe(fighter.stats.maxMp - rend.mpCost);
  });

  it("given a foe at 1 HP, when the Fighter rends it, then no bleed is left", () => {
    const state = fighterTurn(1);

    const after = rended(state).state;

    expect(unit(after, FOE).statuses).toEqual([]);
  });

  it("given a bleeding construct, when the bleed ticks, then it takes half, as it resists slash", () => {
    const after = rended(fighterTurn(10_000, ["construct"])).state;
    after.time = bleeding(unit(after, FOE))!.nextTickAt;
    const events: BattleEvent[] = [];

    runDueTicks(after, events);

    const tick = events.find((e): e is Tick => e.type === "statusTick")!;
    expect(tick.multiplier).toBe(0.5);
  });

  it("given the same cut without the bleed, when the AI values both, then Rend is worth more", () => {
    const state = fighterTurn();
    const self = unit(state, FIGHTER);
    const plain = {
      ...rend,
      id: "plain",
      effect: { type: "strike" as const, power: 0.8 },
    };
    const cut = skillValue(state, self, plain, at(2, 0));

    const value = skillValue(state, self, rend, at(2, 0));

    expect(value).toBeGreaterThan(cut);
  });
});

describe("Bleeding", () => {
  /** A fast foe bleeding from a slow attacker; the foe is ready to act. */
  function bleedingTurn(): BattleState {
    const state = advance(
      createBattle(
        {
          placements: [
            place(def("cutter", { speed: 1, attack: 20 }), "enemy", 2),
            place(def("victim", { speed: 50, maxHp: 10_000 }), "player", 2),
          ],
        },
        1,
      ),
    ).state;
    const victim = unit(state, "player-2-0");
    applyStatus(state, unit(state, "enemy-2-0"), victim, BLEED, []);
    return state;
  }
  const amount = (s: BattleState) => bleeding(unit(s, "player-2-0"))!.amount;

  it("given a bleeding unit, when it attacks, then the bleed worsens by half its first amount", () => {
    const state = bleedingTurn();
    const first = amount(state);

    const { state: after, events } = act(state, {
      type: "attack",
      targetId: "enemy-2-0",
    });

    expect(amount(after)).toBe(first + Math.round(first * 0.5));
    expect(events).toContainEqual(
      expect.objectContaining({ type: "statusWorsened", name: "Bleeding" }),
    );
  });

  it("given a bleeding unit, when it moves, then the bleed worsens", () => {
    const state = bleedingTurn();
    const first = amount(state);

    const { state: moved } = act(state, {
      type: "move",
      to: { col: 3, row: 0 },
    });

    expect(amount(moved)).toBeGreaterThan(first);
  });

  it.each(["defend", "wait"] as const)(
    "given a bleeding unit, when it chooses %s, then the bleed stays the same",
    (type) => {
      const state = bleedingTurn();
      const first = amount(state);

      const { state: after } = act(state, { type });

      expect(amount(after)).toBe(first);
    },
  );

  it("given a bleeding unit, when it acts twice, then the bleed grows by the same step each time", () => {
    const victim = unit(bleedingTurn(), "player-2-0");
    const status = bleeding(victim)!;
    const first = status.amount;

    worsenOnAction(victim, []);
    worsenOnAction(victim, []);

    expect(status.amount).toBe(first + 2 * status.growth!);
  });

  it("given a bleeding unit, when it is cured, then the bleed is removed", () => {
    const victim = unit(bleedingTurn(), "player-2-0");

    cleanse(victim, []);

    expect(bleeding(victim)).toBeUndefined();
  });
});
