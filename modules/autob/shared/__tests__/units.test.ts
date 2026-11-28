import { describe, expect, it } from "vitest";
import { autobLibrary } from "@jforge/content/autob";
import {
  STAR_POWER,
  TIERS,
  copiesIn,
  costTiers,
  monsterDef,
  sellValue,
  shopClasses,
  starStats,
  unitDef,
  unitName,
} from "../units";

const library = autobLibrary();

describe("shopClasses", () => {
  it("given the starter library, when the shop's classes are listed, then they are its classes and no enemies", () => {
    const classes = shopClasses(library);

    expect(classes.length).toBeGreaterThan(0);
    expect(classes.every((a) => a.kind === "class")).toBe(true);
  });
});

describe("costTiers", () => {
  it("given the starter library, when tiers are set, then every tier has classes", () => {
    const tiers = costTiers(library);

    const used = new Set(Object.values(tiers));
    expect([...used].sort()).toEqual(
      Array.from({ length: TIERS }, (_, i) => i + 1),
    );
  });

  it("given the starter library, when tiers are set, then the Archer is cheaper than the Geomancer", () => {
    const tiers = costTiers(library);

    expect(tiers["melee-archer"]).toBeLessThan(tiers["melee-geomancer"]!);
  });

  it("given a library with no classes, when tiers are set, then there are none", () => {
    const tiers = costTiers({ ...library, archetypes: [] });

    expect(tiers).toEqual({});
  });
});

describe("copiesIn and sellValue", () => {
  it.each([
    [1, 1],
    [2, 3],
    [3, 9],
  ])(
    "given a %i-star unit, when its copies are counted, then it is %i",
    (stars, copies) => {
      const result = copiesIn(stars);

      expect(result).toBe(copies);
    },
  );

  it("given a 2-star unit of a 2-gold class, when it is sold, then it pays 6", () => {
    const value = sellValue(2, 2);

    expect(value).toBe(6);
  });
});

describe("starStats", () => {
  it("given a 2-star unit, when its stats are raised, then HP, attack and magic grow and the rest stay", () => {
    const base = {
      maxHp: 100,
      maxMp: 10,
      attack: 10,
      magic: 5,
      defence: 4,
      spirit: 3,
      speed: 10,
    };

    const stats = starStats(base, 2);

    expect(stats).toEqual({
      ...base,
      maxHp: 100 * STAR_POWER[1],
      attack: 10 * STAR_POWER[1],
      magic: Math.round(5 * STAR_POWER[1]),
    });
  });

  it("given an unknown star, when stats are raised, then they stay as they are", () => {
    const base = {
      maxHp: 100,
      maxMp: 10,
      attack: 10,
      magic: 5,
      defence: 4,
      spirit: 3,
      speed: 10,
    };

    const stats = starStats(base, 9);

    expect(stats).toEqual(base);
  });
});

describe("unitName", () => {
  it("given a 1-star unit, when it is named, then it is its class's name", () => {
    const name = unitName("Knight", 1);

    expect(name).toBe("Knight");
  });

  it("given a 3-star unit, when it is named, then three stars follow", () => {
    const name = unitName("Knight", 3);

    expect(name).toBe("Knight ★★★");
  });
});

describe("unitDef", () => {
  it("given a 2-star Knight, when its combatant is made, then it has the uid, the stars and stronger stats", () => {
    const one = unitDef(library, {
      uid: "u1",
      classId: "melee-knight",
      stars: 1,
    });

    const two = unitDef(library, {
      uid: "u2",
      classId: "melee-knight",
      stars: 2,
    });

    expect(two?.id).toBe("char-u2");
    expect(two?.name).toBe("Knight ★★");
    expect(two!.stats.maxHp).toBeGreaterThan(one!.stats.maxHp);
  });

  it("given a class no longer in the library, when its combatant is made, then there is none", () => {
    const def = unitDef(library, { uid: "u1", classId: "gone", stars: 1 });

    expect(def).toBeNull();
  });
});

describe("monsterDef", () => {
  it("given the Goblin, when it is made a monster, then it has a threat", () => {
    const goblin = library.archetypes.find((a) => a.name === "Goblin")!;

    const def = monsterDef(library, goblin.id);

    expect(def?.threat).toBeGreaterThan(0);
  });

  it("given an unknown creature, when it is made a monster, then there is none", () => {
    const def = monsterDef(library, "gone");

    expect(def).toBeNull();
  });
});
