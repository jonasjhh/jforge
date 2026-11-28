import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import { skillValue } from "@jforge/battle/engine/aiSkills.ts";
import { geomancer, petrifySkill, quicken } from "../content";
import { previewDamage } from "@jforge/battle/engine/preview.ts";
import { validateSkill } from "@jforge/battle/engine/skills.ts";
import { applyStatus } from "@jforge/battle/engine/status.ts";
import { GAUGE_FULL, turnOrder } from "@jforge/battle/engine/timeline.ts";
import type {
  BattleState,
  Cell,
  CombatantDef,
  StatusDef,
} from "@jforge/battle/engine/types.ts";
import { def, place } from "./helpers";

const STONE = (petrifySkill.effect as { status: StatusDef }).status;

/** The Geomancer (speed 50, front 0,0) is waiting; foes at enemy 0,0 and 1,0. */
function geoTurn(foe: CombatantDef = def("foe", { maxHp: 1000, speed: 10 })) {
  const fast = {
    ...geomancer,
    stats: { ...geomancer.stats, speed: 50 },
    skills: [...(geomancer.skills ?? []), quicken],
  };
  return advance(
    createBattle(
      {
        placements: [
          place(fast, "player", 0),
          place(def("ally", { maxHp: 100, speed: 1 }), "player", 1),
          place(foe, "enemy", 0),
          place(def("weak", { maxHp: 1000, speed: 10, attack: 1 }), "enemy", 1),
        ],
      },
      1,
    ),
  ).state;
}

const GEO = "player-0-0";
const FOE = "enemy-0-0";
const foeCell: Cell = { side: "enemy", col: 0, row: 0 };
const unit = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;
const stone = (s: BattleState, id = FOE) =>
  applyStatus(s, unit(s, GEO), unit(s, id), STONE, []);

describe("Petrify", () => {
  it("given an enemy, when the Geomancer petrifies it, then it is stone, for 8 MP", () => {
    const state = geoTurn();

    const { state: after } = act(state, {
      type: "skill",
      skillId: petrifySkill.id,
      cell: foeCell,
    });

    expect(unit(after, FOE).statuses).toContainEqual(
      expect.objectContaining({ id: "petrified", effect: "petrify" }),
    );
    expect(unit(after, GEO).mp).toBe(geomancer.stats.maxMp - 8);
  });

  it("given a petrified enemy, when 60 game time passes, then its gauge stays frozen until the stone wears off", () => {
    const s = geoTurn();
    stone(s);
    const gauge = unit(s, FOE).gauge;
    const end = s.time + 60;
    const moved: number[] = [];
    let state = s;

    // The Geomancer waits out its turns while time passes.
    while (state.time < end - 1) {
      state = advance(act(state, { type: "wait" }).state).state;
      if (state.time < end - 1 && unit(state, FOE).gauge !== gauge)
        moved.push(state.time);
    }

    expect(moved).toEqual([]);
    expect(
      unit(state, FOE).statuses.some((st) => st.effect === "petrify"),
    ).toBe(false);
  });

  it("given an enemy casting, when it is petrified, then the cast fizzles", () => {
    const s = geoTurn();
    const foe = unit(s, FOE);
    foe.casting = {
      skillId: "meteor",
      skillName: "Meteor",
      cell: { side: "player", col: 0, row: 0 },
      area: [],
      startedAt: s.time,
      readyAt: s.time + 100,
    };
    const events: Parameters<typeof applyStatus>[4] = [];

    applyStatus(s, unit(s, GEO), foe, STONE, events);

    expect(foe.casting).toBeUndefined();
    expect(events).toContainEqual({
      type: "castFizzled",
      unitId: FOE,
      skillName: "Meteor",
    });
  });

  it("given an enemy waiting to act, when it is petrified, then it is taken out of line", () => {
    const s = geoTurn();
    unit(s, FOE).gauge = GAUGE_FULL;
    s.ready.push(FOE);

    stone(s);

    expect(s.ready).not.toContain(FOE);
    expect(turnOrder(s, 3)[0]).not.toBe(FOE);
  });

  it("given an enemy, when it is petrified, then it takes half the damage", () => {
    const s = geoTurn();
    const before = previewDamage(unit(s, GEO), unit(s, FOE))!.amount;

    stone(s);

    const after = previewDamage(unit(s, GEO), unit(s, FOE))!.amount;
    expect(Math.abs(after - before * 0.5)).toBeLessThanOrEqual(1);
  });

  it("given a petrified ally, when it is quickened, then it is refused", () => {
    const s = geoTurn();
    stone(s, "player-1-0");

    const problem = validateSkill(s, unit(s, GEO), quicken, {
      side: "player",
      col: 1,
      row: 0,
    });

    expect(problem).toBe("ally is turned to stone");
  });

  it("given a dangerous and a harmless foe, when the AI values Petrify, then the dangerous one is worth it and more", () => {
    const s = geoTurn(def("brute", { maxHp: 1000, speed: 10, attack: 60 }));
    const value = (cell: Cell) =>
      skillValue(s, unit(s, GEO), petrifySkill, cell);
    const harmless = value({ side: "enemy", col: 1, row: 0 });

    const dangerous = value(foeCell);

    expect(dangerous).toBeGreaterThan(0);
    expect(dangerous).toBeGreaterThan(harmless);
  });

  it("given a dangerous foe about to fall, when the AI values Petrify, then it is worth less than on a healthy one", () => {
    const s = geoTurn(def("brute", { maxHp: 1000, speed: 10, attack: 60 }));
    const healthy = skillValue(s, unit(s, GEO), petrifySkill, foeCell);
    unit(s, FOE).hp = 5;

    const dying = skillValue(s, unit(s, GEO), petrifySkill, foeCell);

    expect(dying).toBeLessThan(healthy);
  });
});
