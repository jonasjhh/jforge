import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { skillValue } from "../aiSkills";
import { geomancer, petrifySkill, quicken } from "../content";
import { previewDamage } from "../preview";
import { validateSkill } from "../skills";
import { applyStatus } from "../status";
import { GAUGE_FULL, turnOrder } from "../timeline";
import type { BattleState, Cell, CombatantDef, StatusDef } from "../types";
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
  it("turns an enemy to stone for 60 game time, for 8 MP", () => {
    const { state } = act(geoTurn(), {
      type: "skill",
      skillId: petrifySkill.id,
      cell: foeCell,
    });
    expect(unit(state, FOE).statuses).toContainEqual(
      expect.objectContaining({ id: "petrified", effect: "petrify" }),
    );
    expect(unit(state, GEO).mp).toBe(geomancer.stats.maxMp - 8);
  });

  it("freezes the gauge until the stone wears off", () => {
    const s = geoTurn();
    stone(s);
    const foe = unit(s, FOE);
    const gauge = foe.gauge;
    const end = s.time + 60;
    // The Geomancer waits out its turns while time passes.
    let state = s;
    while (state.time < end - 1) {
      state = act(state, { type: "wait" }).state;
      state = advance(state).state;
      if (state.time < end - 1) {
        expect(unit(state, FOE).gauge).toBe(gauge);
      }
    }
    expect(
      unit(state, FOE).statuses.some((st) => st.effect === "petrify"),
    ).toBe(false);
  });

  it("breaks a cast in progress", () => {
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

  it("takes a unit waiting to act out of line, until it wears off", () => {
    const s = geoTurn();
    const foe = unit(s, FOE);
    foe.gauge = GAUGE_FULL;
    s.ready.push(FOE);
    stone(s);
    expect(s.ready).not.toContain(FOE);
    expect(turnOrder(s, 3)[0]).not.toBe(FOE);
  });

  it("halves the damage the stone takes", () => {
    const s = geoTurn();
    const before = previewDamage(unit(s, GEO), unit(s, FOE))!.amount;
    stone(s);
    const after = previewDamage(unit(s, GEO), unit(s, FOE))!.amount;
    expect(Math.abs(after - before * 0.5)).toBeLessThanOrEqual(1);
  });

  it("can't be quickened out of", () => {
    const s = geoTurn();
    stone(s, "player-1-0");
    expect(
      validateSkill(s, unit(s, GEO), quicken, {
        side: "player",
        col: 1,
        row: 0,
      }),
    ).toBe("ally is turned to stone");
  });

  it("the AI petrifies the dangerous foe, not the harmless one", () => {
    const s = geoTurn(def("brute", { maxHp: 1000, speed: 10, attack: 60 }));
    const value = (cell: Cell) =>
      skillValue(s, unit(s, GEO), petrifySkill, cell);
    expect(value(foeCell)).toBeGreaterThan(0);
    expect(value(foeCell)).toBeGreaterThan(
      value({ side: "enemy", col: 1, row: 0 }),
    );
  });

  it("the AI would rather finish a foe about to fall", () => {
    const s = geoTurn(def("brute", { maxHp: 1000, speed: 10, attack: 60 }));
    const healthy = skillValue(s, unit(s, GEO), petrifySkill, foeCell);
    unit(s, FOE).hp = 5;
    const dying = skillValue(s, unit(s, GEO), petrifySkill, foeCell);
    expect(dying).toBeLessThan(healthy);
  });
});
