import { describe, expect, it } from "vitest";
import { compileRoster, isCreature, parseLibrary } from "@jforge/rules/core";
import { jrpgLibrary } from "@jforge/content/jrpg";
import { createBattle } from "@jforge/melee/shared";
import { GEAR_TIERS, atTier, withGearTiers } from "../world";

const starter = jrpgLibrary();
const world = withGearTiers(starter);

describe("withGearTiers", () => {
  it("given jrpg's content at every tier, when it is saved and parsed, then it reads back unchanged", () => {
    const text = JSON.stringify(world);

    const back = parseLibrary(text);

    expect(back).toEqual(world);
  });

  it.each(["skills", "gear", "archetypes", "characters"] as const)(
    "given jrpg's content at every tier, when its %s are listed, then each id is unique",
    (key) => {
      const ids = world[key].map((x) => x.id);

      expect(new Set(ids).size).toBe(ids.length);
    },
  );

  it("given jrpg's content at every tier, when its roster is compiled, then every character becomes a combatant", () => {
    const roster = compileRoster(world);

    const all = [...roster.party, ...roster.monsters];
    expect(all).toHaveLength(world.characters.length);
    expect(all.every(isCreature)).toBe(true);
  });

  it("given jrpg's compiled roster, when a battle is set up from it, then melee accepts it", () => {
    const roster = compileRoster(world);
    const all = [...roster.party, ...roster.monsters];
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

    const start = () => createBattle({ placements }, 1);

    expect(start).not.toThrow();
  });

  it("given jrpg's content at every tier, when each type's skills are looked up, then the library has them all", () => {
    const skills = new Set(world.skills.map((s) => s.id));

    const unknown = world.archetypes.flatMap((type) =>
      type.skills.filter((id) => !skills.has(id)),
    );

    expect(unknown).toEqual([]);
  });

  it("given jrpg's content, when the tiers are added, then the plain pieces come first and nothing else changes", () => {
    const gear = world.gear.slice(0, starter.gear.length);

    expect(gear).toEqual(starter.gear);
    expect(world.characters).toEqual(starter.characters);
    expect(world.archetypes).toEqual(starter.archetypes);
  });

  it("given jrpg's content at every tier, when its gear is counted, then each piece is there at every tier", () => {
    const base = world.gear.length / GEAR_TIERS.length;

    expect(Number.isInteger(base)).toBe(true);
    expect(world.gear.some((g) => g.id === "weapon-sword+3")).toBe(true);
  });
});

describe("atTier", () => {
  const mail = starter.gear.find((g) => g.id === "armour-mail")!;
  const sword = starter.gear.find((g) => g.id === "weapon-sword")!;

  it("given chain mail, when it is taken at tier 0, then it is unchanged", () => {
    const plain = atTier(mail, 0);

    expect(plain).toBe(mail);
  });

  it("given chain mail, when it is taken at tier 1, then it is renamed and what it adds grows, not what it multiplies", () => {
    const fine = atTier(mail, 1);

    expect(fine).toMatchObject({
      id: "armour-mail+1",
      name: "Fine Chain Mail",
    });
    expect(fine.bonuses).toEqual([
      { stat: "defense", op: "add", value: 12 },
      { stat: "speed", op: "mul", value: 0.9 },
    ]);
  });

  it("given chain mail, when it is taken at tier 3, then its defense bonus is 20", () => {
    const best = atTier(mail, 3);

    expect(best.bonuses[0]!.value).toBe(20);
  });

  it("given a sword, when it is taken at tier 2, then it stays a weapon under its new name", () => {
    const superior = atTier(sword, 2);

    expect(superior.weapon).toMatchObject({
      id: "weapon-sword+2",
      name: "Superior Iron Sword",
    });
  });

  it("given gear with a drawback, when it is taken at tier 3, then the drawback is no deeper", () => {
    const heavy = {
      ...mail,
      bonuses: [{ stat: "speed" as const, op: "add" as const, value: -2 }],
    };

    const tiered = atTier(heavy, 3);

    expect(tiered.bonuses[0]!.value).toBe(-2);
  });
});
