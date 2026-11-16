import { describe, expect, it } from "vitest";
import {
  compileRoster,
  parseLibrary,
  starterLibrary,
} from "@jforge/char/shared";
import { createBattle, isCombatantDef } from "@jforge/melee/shared";
import { GEAR_TIERS, atTier, withWorld } from "../world";

const starter = starterLibrary();
const world = withWorld(starter, 3);

describe("withWorld", () => {
  it("is a library char accepts, with unique ids", () => {
    expect(parseLibrary(JSON.stringify(world))).toEqual(world);
    for (const key of ["skills", "gear", "archetypes", "characters"] as const) {
      const ids = world[key].map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("compiles every character into a combatant that can fight", () => {
    const roster = compileRoster(world);
    const all = [...roster.party, ...roster.monsters];
    expect(all).toHaveLength(world.characters.length);
    expect(all.every(isCombatantDef)).toBe(true);
    const placements = all.slice(0, 5).map((def, col) => ({
      def,
      side: "player" as const,
      position: { col, row: 0 },
    }));
    placements.push({
      def: roster.monsters.at(-1)!,
      side: "enemy" as never,
      position: { col: 0, row: 0 },
    });
    expect(() => createBattle({ placements }, 1)).not.toThrow();
  });

  it("teaches every type only skills the library has", () => {
    const skills = new Set(world.skills.map((s) => s.id));
    for (const type of world.archetypes) {
      expect(type.skills.every((u) => skills.has(u.skillId))).toBe(true);
    }
  });

  it("puts what was designed first", () => {
    expect(world.characters.slice(0, 3)).toEqual(starter.characters);
    expect(world.gear.slice(0, starter.gear.length)).toEqual(starter.gear);
  });

  it("sets its enemies a level below the party", () => {
    const wolf = withWorld(starter, 6).characters.find(
      (c) => c.id === "world-wolf-1",
    );
    expect(wolf?.level).toBe(5);
    expect(withWorld(starter, 1).characters.at(-1)!.level).toBe(1);
  });

  it("holds every piece of gear at every tier", () => {
    const base = world.gear.length / GEAR_TIERS.length;
    expect(Number.isInteger(base)).toBe(true);
    expect(world.gear.some((g) => g.id === "gear-sword+3")).toBe(true);
  });
});

describe("atTier", () => {
  const mail = starter.gear.find((g) => g.id === "gear-mail")!;
  const sword = starter.gear.find((g) => g.id === "gear-sword")!;

  it("leaves plain gear alone", () => {
    expect(atTier(mail, 0)).toBe(mail);
  });

  it("grows what it adds, not what it multiplies, and renames it", () => {
    const fine = atTier(mail, 1);
    expect(fine).toMatchObject({ id: "gear-mail+1", name: "Fine Chain Mail" });
    expect(fine.bonuses).toEqual([
      { stat: "defense", op: "add", value: 12 },
      { stat: "speed", op: "mul", value: 0.9 },
    ]);
    expect(atTier(mail, 3).bonuses[0]!.value).toBe(20);
  });

  it("keeps a weapon a weapon under its new name", () => {
    expect(atTier(sword, 2).weapon).toMatchObject({
      id: "gear-sword+2",
      name: "Superior Iron Sword",
    });
  });

  it("doesn't deepen a drawback", () => {
    const heavy = {
      ...mail,
      bonuses: [{ stat: "speed" as const, op: "add" as const, value: -2 }],
    };
    expect(atTier(heavy, 3).bonuses[0]!.value).toBe(-2);
  });
});
