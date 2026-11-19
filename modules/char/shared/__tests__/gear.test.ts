import { describe, expect, it } from "vitest";
import {
  applyBonuses,
  canUse,
  canWear,
  equip,
  equippedGear,
  unequip,
} from "../gear";
import { blankCharacter, emptyLibrary, flatStats } from "../library";
import { starterLibrary } from "../starter";
import { designedLibrary } from "./designed";
import type { Gear, StatBonus } from "../types";

const stats = { ...flatStats(10), maxHp: 100 };

describe("applyBonuses", () => {
  it("given no bonuses, when they are applied, then the stats are unchanged", () => {
    const result = applyBonuses(stats, []);

    expect(result).toEqual(stats);
  });

  it("given a multiplier listed before an addition, when they are applied, then the addition comes first", () => {
    const bonuses: StatBonus[] = [
      { stat: "attack", op: "mul", value: 2 },
      { stat: "attack", op: "add", value: 5 },
    ];

    const result = applyBonuses(stats, bonuses);

    expect(result.attack).toBe(30);
  });

  it("given several bonuses to one stat, when they are applied, then they stack and the other stats are left alone", () => {
    const bonuses: StatBonus[] = [
      { stat: "speed", op: "add", value: 2 },
      { stat: "speed", op: "add", value: 3 },
      { stat: "speed", op: "mul", value: 1.1 },
      { stat: "speed", op: "mul", value: 2 },
    ];

    const result = applyBonuses(stats, bonuses);

    expect(result.speed).toBe(33);
    expect(result.defense).toBe(10);
  });

  it("given bonuses that would drive stats under zero, when they are applied, then stats stop at 0 and HP at 1", () => {
    const bonuses: StatBonus[] = [
      { stat: "defense", op: "add", value: -99 },
      { stat: "maxHp", op: "mul", value: 0 },
    ];

    const result = applyBonuses(stats, bonuses);

    expect(result.defense).toBe(0);
    expect(result.maxHp).toBe(1);
  });
});

describe("equipping", () => {
  const library = starterLibrary();
  const knight = library.archetypes[0]!;
  const sword = library.gear.find((g) => g.id === "gear-sword")!;
  const bow = library.gear.find((g) => g.id === "gear-bow")!;
  const mail = library.gear.find((g) => g.id === "gear-mail")!;
  const bare = blankCharacter("c", knight);

  it("given a bare character, when a sword is equipped, then it goes in the weapon slot", () => {
    const armed = equip(bare, sword);

    expect(armed.gear).toEqual({ weapon: "gear-sword" });
  });

  it("given a character with a sword, when mail is equipped, then both are worn in their own slots", () => {
    const armed = equip(bare, sword);

    const dressed = equip(armed, mail);

    expect(dressed.gear).toEqual({ weapon: "gear-sword", armor: "gear-mail" });
  });

  it("given a character with a sword, when a bow is equipped, then it replaces the sword", () => {
    const armed = equip(bare, sword);

    const archer = equip(armed, bow);

    expect(archer.gear).toEqual({ weapon: "gear-bow" });
  });

  it("given a character with a sword, when the weapon slot is emptied, then nothing is worn", () => {
    const armed = equip(bare, sword);

    const emptied = unequip(armed, "weapon");

    expect(emptied.gear).toEqual({});
  });

  it("given a bare character, when an empty slot is emptied, then nothing changes", () => {
    const emptied = unequip(bare, "armor");

    expect(emptied.gear).toEqual({});
  });

  it("given a character, when gear is equipped, then the character given is unchanged", () => {
    equip(bare, sword);

    expect(bare.gear).toEqual({});
  });

  it("given mail put on before a sword, when worn gear is listed, then it comes in slot order", () => {
    const worn = equip(equip(bare, mail), sword);

    const gear = equippedGear(library, worn);

    expect(gear).toEqual([sword, mail]);
  });

  it("given gear ids that are gone or in the wrong slot, when worn gear is listed, then those slots count as empty", () => {
    const odd = { ...bare, gear: { weapon: "gone", armor: "gear-sword" } };

    const gear = equippedGear(library, odd);

    expect(gear).toEqual([]);
  });

  it("given armor filed under the accessory slot, when worn gear is listed, then that slot counts as empty", () => {
    const misfiled: Gear = { ...mail, id: "x" };
    const lib = { ...emptyLibrary(), gear: [misfiled] };

    const gear = equippedGear(lib, { ...bare, gear: { accessory: "x" } });

    expect(gear).toEqual([]);
  });
});

describe("gear restrictions", () => {
  const library = designedLibrary();
  const [aldric, mira] = library.characters;
  const gear = (id: string) => library.gear.find((g) => g.id === id)!;
  const plainBow = () => {
    const plain = { ...gear("gear-bow") };
    delete plain.category;
    return plain;
  };

  it.each([
    ["a squire", "a sword", 0, "gear-sword", true],
    ["a squire", "a bow", 0, "gear-bow", false],
    ["a scholar", "mail", 1, "gear-mail", false],
    ["a scholar", "a ring", 1, "gear-ring", true],
  ] as const)(
    "given %s and %s, when it is checked whether it can be worn, then the class's categories decide",
    (_, __, who, id, allowed) => {
      const character = [aldric, mira][who]!;

      const wearable = canWear(library, character, gear(id));

      expect(wearable).toBe(allowed);
    },
  );

  it("given gear with no category, when a class checks whether it can wear it, then it can", () => {
    const plain = plainBow();

    const wearable = canWear(library, aldric!, plain);

    expect(wearable).toBe(true);
  });

  it("given a class with no proficiency list, when it checks a bow, then it can use it", () => {
    const knight = library.archetypes.find((a) => a.id === "type-squire")!;
    const open = { ...knight };
    delete open.proficiencies;

    const usable = canUse(open, gear("gear-bow"));

    expect(usable).toBe(true);
  });

  it("given no class, when a bow is checked, then it can be used", () => {
    const usable = canUse(undefined, gear("gear-bow"));

    expect(usable).toBe(true);
  });

  it("given a squire who equips a bow, when worn gear is listed, then the bow stays in the slot but isn't counted", () => {
    const archer = equip(aldric!, gear("gear-bow"));

    const worn = equippedGear(library, archer);

    expect(archer.gear.weapon).toBe("gear-bow");
    expect(worn.map((g) => g.id)).toEqual(["gear-mail"]);
  });
});
