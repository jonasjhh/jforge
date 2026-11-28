import { describe, expect, it } from "vitest";
import { fangs, fireball, heal, monsters, revive, sword } from "../content";
import {
  MIN_THREAT,
  durabilityOf,
  estimateThreat,
  offenseOf,
} from "@jforge/battle/engine/threat.ts";
import type { CombatantDef } from "@jforge/battle/engine/types.ts";
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
  it.each(monsters.map((m) => [m.name, m] as const))(
    "given the %s, when its threat is estimated, then it is within 0.6 of the hand-tuned value",
    (_, monster) => {
      const { threat, ...designed } = monster;

      const estimate = estimateThreat(designed);

      expect(Math.abs(estimate - threat!)).toBeLessThan(0.6);
    },
  );

  it("given a unit with every stat doubled, when its threat is estimated, then it doubles", () => {
    const base = estimateThreat(def("a", { attack: 20, maxHp: 200 }));

    const twice = estimateThreat(def("a", { attack: 40, maxHp: 400 }));

    expect(twice).toBeCloseTo(2 * base, 0);
  });

  it.each([
    ["HP", { maxHp: 90 }],
    ["attack", { attack: 22 }],
    ["speed", { speed: 24 }],
    ["defense", { defense: 30 }],
  ])(
    "given a goblin with more %s, when its threat is estimated, then it grows",
    (_, stats) => {
      const stronger = { ...goblin, stats: { ...goblin.stats, ...stats } };

      const threat = estimateThreat(stronger);

      expect(threat).toBeGreaterThan(estimateThreat(goblin));
    },
  );

  it("given a pebble with no attack, when its threat is estimated, then it is the minimum", () => {
    const pebble = def("pebble", { attack: 0, maxHp: 1 });

    const threat = estimateThreat(pebble);

    expect(threat).toBe(MIN_THREAT);
  });

  it("given goblins one to four times as big, when their threat is estimated, then it only grows", () => {
    const sizes = [1, 2, 3, 4];

    const threats = sizes.map((k) => estimateThreat(scaled(goblin, k)));

    expect(threats).toEqual([...threats].sort((a, b) => a - b));
  });
});

describe("offenseOf", () => {
  it("given a caster who can afford Fireball, when its offense is weighed, then the spell counts", () => {
    const caster = def("c", { magic: 30, maxMp: 100, attack: 5 }, sword);

    const offense = offenseOf({ ...caster, skills: [fireball] });

    expect(offense).toBeGreaterThan(offenseOf(caster));
  });

  it("given a caster who can never pay for Fireball, when its offense is weighed, then the spell doesn't count", () => {
    const caster = def("c", { magic: 30, maxMp: 1, attack: 5 }, sword);

    const offense = offenseOf({ ...caster, skills: [fireball] });

    expect(offense).toBe(offenseOf(caster));
  });

  it("given a healer, when its offense is weighed, then the support skill adds a bonus", () => {
    const healer = def("h", { magic: 10, maxMp: 50 }, sword);

    const offense = offenseOf({ ...healer, skills: [heal] });

    expect(offense).toBeGreaterThan(offenseOf(healer));
  });
});

describe("durabilityOf", () => {
  const priest = def("p", { maxMp: 40, magic: 10 });

  it.each<[string, CombatantDef, CombatantDef]>([
    ["defense", def("a"), def("a", { defense: 20 })],
    ["spirit", def("a"), def("a", { spirit: 20 })],
    ["resistances", def("a"), { ...def("a"), traits: ["stone"] }],
    ["a revive it can afford", priest, { ...priest, skills: [revive] }],
  ])(
    "given a unit gaining %s, when its durability is weighed, then it grows",
    (_, plain, unit) => {
      const durability = durabilityOf(unit);

      expect(durability).toBeGreaterThan(durabilityOf(plain));
    },
  );
});
