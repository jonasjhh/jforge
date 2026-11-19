import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { skillValue } from "../aiSkills";
import { BLEED, worsenOnAction } from "../bleed";
import { fighter, rend } from "../content";
import { previewDamage } from "../preview";
import { applyStatus, cleanse, runDueTicks } from "../status";
import type { BattleEvent, BattleState, Cell, Trait, Unit } from "../types";
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
  it("strikes at x0.8 and leaves a surviving target bleeding slash", () => {
    const state = fighterTurn();
    const [self, target] = state.units;
    const cut = previewDamage(self!, target!, rend)!.amount;
    const plain = previewDamage(self!, target!)!.amount;
    expect(Math.abs(cut - plain * 0.8)).toBeLessThan(1);
    const after = rended(state).state;
    const status = bleeding(unit(after, FOE))!;
    expect(status).toMatchObject({ damageType: "slash", ticksLeft: 5 });
    expect(status.amount).toBe(Math.round(BLEED.power * fighter.stats.attack));
    expect(status.growth).toBe(Math.round(status.amount * 0.5));
    expect(unit(after, FIGHTER).mp).toBe(fighter.stats.maxMp - rend.mpCost);
  });

  it("leaves no bleed on a target it knocks out", () => {
    const after = rended(fighterTurn(1)).state;
    expect(unit(after, FOE).statuses).toEqual([]);
  });

  it("bleeds half on a construct, which resists slash", () => {
    const after = rended(fighterTurn(10_000, ["construct"])).state;
    const foe = unit(after, FOE);
    const status = bleeding(foe)!;
    after.time = status.nextTickAt;
    const events: BattleEvent[] = [];
    runDueTicks(after, events);
    const tick = events.find((e): e is Tick => e.type === "statusTick")!;
    expect(tick.multiplier).toBe(0.5);
  });

  it("is worth more to the AI than the same cut without the bleed", () => {
    const state = fighterTurn();
    const self = unit(state, FIGHTER);
    const plain = {
      ...rend,
      id: "plain",
      effect: { type: "strike" as const, power: 0.8 },
    };
    expect(skillValue(state, self, rend, at(2, 0))).toBeGreaterThan(
      skillValue(state, self, plain, at(2, 0)),
    );
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

  it("worsens by half its first amount each time the unit attacks", () => {
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

  it("worsens when the unit moves, but not when it defends or waits", () => {
    const state = bleedingTurn();
    const first = amount(state);
    const moved = act(state, {
      type: "move",
      to: { col: 3, row: 0 },
    }).state;
    expect(amount(moved)).toBeGreaterThan(first);
    expect(amount(act(state, { type: "defend" }).state)).toBe(first);
    expect(amount(act(state, { type: "wait" }).state)).toBe(first);
  });

  it("keeps growing by the same step with every action", () => {
    const state = bleedingTurn();
    const victim = unit(state, "player-2-0");
    const status = bleeding(victim)!;
    const first = status.amount;
    worsenOnAction(victim, []);
    worsenOnAction(victim, []);
    expect(status.amount).toBe(first + 2 * status.growth!);
  });

  it("is removed by Cure, as other harmful statuses are", () => {
    const state = bleedingTurn();
    const victim = unit(state, "player-2-0");
    cleanse(victim, []);
    expect(bleeding(victim)).toBeUndefined();
  });
});
