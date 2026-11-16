import { describe, expect, it } from "vitest";
import { fangs, fireball, heal, monsters, revive, sword } from "../content";
import { MIN_THREAT, durabilityOf, estimateThreat, offenseOf } from "../threat";
import type { CombatantDef } from "../types";
import { def } from "./helpers";

const goblin = def("goblin", { maxHp: 45, attack: 11, speed: 12 }, fangs);
const scaled = (d: CombatantDef, k: number): CombatantDef => ({
  ...d,
  stats: {
    ...d.stats,
    maxHp: d.stats.maxHp * k,
    attack: d.stats.attack * k,
    defense: d.stats.defense * k,
  },
});

describe("estimateThreat", () => {
  it("rates the built-in monsters close to their hand-tuned threat", () => {
    for (const monster of monsters) {
      const { threat, ...designed } = monster;
      expect(Math.abs(estimateThreat(designed) - threat!)).toBeLessThan(0.6);
    }
  });

  it("doubles when every stat doubles", () => {
    const base = estimateThreat(def("a", { attack: 20, maxHp: 200 }));
    const twice = estimateThreat(def("a", { attack: 40, maxHp: 400 }));
    expect(twice).toBeCloseTo(2 * base, 0);
  });

  it("grows with each stat that matters", () => {
    const base = estimateThreat(goblin);
    for (const stats of [
      { maxHp: 90 },
      { attack: 22 },
      { speed: 24 },
      { defense: 30 },
    ]) {
      const stronger = { ...goblin, stats: { ...goblin.stats, ...stats } };
      expect(estimateThreat(stronger)).toBeGreaterThan(base);
    }
  });

  it("is never below the minimum", () => {
    expect(estimateThreat(def("pebble", { attack: 0, maxHp: 1 }))).toBe(
      MIN_THREAT,
    );
  });

  it("is monotonic over a range of sizes", () => {
    const threats = [1, 2, 3, 4].map((k) => estimateThreat(scaled(goblin, k)));
    expect(threats).toEqual([...threats].sort((a, b) => a - b));
  });
});

describe("offenseOf", () => {
  it("counts a damaging skill it can afford when it beats the weapon", () => {
    const caster = def("c", { magic: 30, maxMp: 100, attack: 5 }, sword);
    expect(offenseOf({ ...caster, skills: [fireball] })).toBeGreaterThan(
      offenseOf(caster),
    );
  });

  it("ignores a skill it can never pay for", () => {
    const caster = def("c", { magic: 30, maxMp: 1, attack: 5 }, sword);
    expect(offenseOf({ ...caster, skills: [fireball] })).toBe(
      offenseOf(caster),
    );
  });

  it("adds a bonus for support skills", () => {
    const healer = def("h", { magic: 10, maxMp: 50 }, sword);
    expect(offenseOf({ ...healer, skills: [heal] })).toBeGreaterThan(
      offenseOf(healer),
    );
  });
});

describe("durabilityOf", () => {
  it("grows with defense and spirit", () => {
    expect(durabilityOf(def("a", { defense: 20 }))).toBeGreaterThan(
      durabilityOf(def("a")),
    );
    expect(durabilityOf(def("a", { spirit: 20 }))).toBeGreaterThan(
      durabilityOf(def("a")),
    );
  });

  it("grows with resistances", () => {
    expect(durabilityOf({ ...def("a"), traits: ["stone"] })).toBeGreaterThan(
      durabilityOf(def("a")),
    );
  });

  it("counts a revive it can afford", () => {
    const priest = def("p", { maxMp: 40, magic: 10 });
    expect(durabilityOf({ ...priest, skills: [revive] })).toBeGreaterThan(
      durabilityOf(priest),
    );
  });
});
