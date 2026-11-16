import { describe, expect, it } from "vitest";
import { applyBonuses, equip, equippedGear, unequip } from "../gear";
import { blankCharacter, emptyLibrary, flatStats } from "../library";
import { starterLibrary } from "../starter";
import type { Gear } from "../types";

const stats = { ...flatStats(10), maxHp: 100 };

describe("applyBonuses", () => {
  it("changes nothing without bonuses", () => {
    expect(applyBonuses(stats, [])).toEqual(stats);
  });

  it("adds first, then multiplies", () => {
    const result = applyBonuses(stats, [
      { stat: "attack", op: "mul", value: 2 },
      { stat: "attack", op: "add", value: 5 },
    ]);
    expect(result.attack).toBe(30);
  });

  it("stacks several bonuses on one stat and leaves the others", () => {
    const result = applyBonuses(stats, [
      { stat: "speed", op: "add", value: 2 },
      { stat: "speed", op: "add", value: 3 },
      { stat: "speed", op: "mul", value: 1.1 },
      { stat: "speed", op: "mul", value: 2 },
    ]);
    expect(result.speed).toBe(33);
    expect(result.defense).toBe(10);
  });

  it("never drops below 0, or below 1 HP", () => {
    const result = applyBonuses(stats, [
      { stat: "defense", op: "add", value: -99 },
      { stat: "maxHp", op: "mul", value: 0 },
    ]);
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

  it("puts gear in its own slot", () => {
    expect(equip(bare, sword).gear).toEqual({ weapon: "gear-sword" });
    expect(equip(equip(bare, sword), mail).gear).toEqual({
      weapon: "gear-sword",
      armor: "gear-mail",
    });
  });

  it("replaces what the slot held", () => {
    expect(equip(equip(bare, sword), bow).gear).toEqual({ weapon: "gear-bow" });
  });

  it("empties a slot", () => {
    expect(unequip(equip(bare, sword), "weapon").gear).toEqual({});
    expect(unequip(bare, "armor").gear).toEqual({});
  });

  it("does not change the character it was given", () => {
    equip(bare, sword);
    expect(bare.gear).toEqual({});
  });

  it("lists worn gear in slot order", () => {
    const worn = equip(equip(bare, mail), sword);
    expect(equippedGear(library, worn)).toEqual([sword, mail]);
  });

  it("counts missing or misplaced gear as an empty slot", () => {
    const odd = { ...bare, gear: { weapon: "gone", armor: "gear-sword" } };
    expect(equippedGear(library, odd)).toEqual([]);
    const misfiled: Gear = { ...mail, id: "x" };
    const lib = { ...emptyLibrary(), gear: [misfiled] };
    expect(equippedGear(lib, { ...bare, gear: { accessory: "x" } })).toEqual(
      [],
    );
  });
});
