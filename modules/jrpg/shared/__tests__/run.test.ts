import { describe, expect, it } from "vitest";
import { starterLibrary, type Library } from "@jforge/char/shared";
import { MAX_PARTY_SIZE, content, createBattle } from "@jforge/melee/shared";
import {
  BUDGET_SHARE,
  LEVEL_LENGTH,
  START_PARTY_SIZE,
  battleFor,
  canRecruit,
  changeGear,
  currentEncounter,
  enemyLevelBonus,
  generateLevel,
  levelCleared,
  loseBattle,
  monsterPool,
  nextLevel,
  parseRun,
  resolveAlly,
  resolveGear,
  runLibrary,
  startRun,
  threatBudget,
  winBattle,
  xpFor,
  type Encounter,
  type Run,
} from "../run";

const library = starterLibrary();
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

/** A run standing at the given encounters. */
const at = (encounters: Encounter[], changes: Partial<Run> = {}): Run => ({
  ...startRun(library, 1),
  encounters,
  position: 0,
  ...changes,
});
const battle: Encounter = {
  kind: "battle",
  difficulty: "easy",
  seed: 5,
  boss: false,
};
const ally: Encounter = {
  kind: "ally",
  character: {
    id: "new",
    name: "Nell",
    archetypeId: "type-sage",
    level: 1,
    xp: 0,
    gear: {},
  },
};
const ring: Encounter = { kind: "gear", gearId: "gear-ring" };

describe("startRun", () => {
  it("sets out with the library's first class characters", () => {
    const run = startRun(library, 1);
    expect(run.party.map((c) => c.name)).toEqual(["Aldric", "Mira"]);
    expect(run.party).toHaveLength(START_PARTY_SIZE);
    expect(run).toMatchObject({ depth: 1, position: 0, defeated: false });
    expect(run.baseLevel).toBe(3);
  });

  it("falls back to the starter library without a party to field", () => {
    const enemiesOnly: Library = {
      ...library,
      characters: library.characters.filter((c) => c.name === "Goblin"),
    };
    expect(runLibrary(enemiesOnly)).toEqual(starterLibrary());
    expect(runLibrary(null)).toEqual(starterLibrary());
    expect(runLibrary(library)).toBe(library);
  });
});

describe("generateLevel", () => {
  const level = (seed: number, depth = 1) =>
    generateLevel(library, startRun(library, seed).party, seed, depth);

  it("is the same for the same seed and depth, and differs otherwise", () => {
    expect(level(3)).toEqual(level(3));
    expect(level(3)).not.toEqual(level(3, 2));
  });

  it("opens with an easy battle and ends with a hard one that drops gear", () => {
    for (const seed of SEEDS) {
      const encounters = level(seed);
      expect(encounters).toHaveLength(LEVEL_LENGTH);
      expect(encounters[0]).toMatchObject({
        kind: "battle",
        difficulty: "easy",
      });
      const last = encounters[LEVEL_LENGTH - 1]!;
      expect(last).toMatchObject({ kind: "battle", boss: true });
      expect(last.kind === "battle" && last.loot).toBeTruthy();
    }
  });

  it("always has an ally to find, and never two finds in a row", () => {
    for (const seed of SEEDS) {
      const kinds = level(seed).map((e) => e.kind);
      expect(kinds).toContain("ally");
      for (let i = 1; i < kinds.length; i++) {
        expect(kinds[i] !== "battle" && kinds[i - 1] !== "battle").toBe(false);
      }
    }
  });

  it("offers a fresh character of a class, not one already in the party", () => {
    for (const seed of SEEDS) {
      const found = level(seed).flatMap((e) =>
        e.kind === "ally" ? [e.character] : [],
      );
      for (const character of found) {
        expect(["unit-1", "unit-2"]).not.toContain(character.id);
        expect(["type-knight", "type-sage"]).toContain(character.archetypeId);
      }
    }
  });

  it("has no gear to find or drop when the library has none", () => {
    const bare = { ...library, gear: [] };
    const encounters = generateLevel(bare, [], 1, 1);
    expect(encounters.some((e) => e.kind === "gear")).toBe(false);
    expect(encounters.some((e) => e.kind === "battle" && e.loot)).toBe(false);
  });
});

describe("battleFor", () => {
  it("fields the party against the library's enemies", () => {
    const setup = battleFor(at([battle]))!;
    expect(() => createBattle(setup, 1)).not.toThrow();
    const names = (side: string) =>
      setup.placements.filter((p) => p.side === side).map((p) => p.def.name);
    expect(names("player").sort()).toEqual(["Aldric", "Mira"]);
    expect(names("enemy").length).toBeGreaterThan(0);
    expect(new Set(names("enemy"))).toEqual(new Set(["Goblin"]));
  });

  it("is null off a battle or after a defeat", () => {
    expect(battleFor(at([ally]))).toBeNull();
    expect(battleFor(at([battle], { defeated: true }))).toBeNull();
    expect(battleFor(at([]))).toBeNull();
  });

  it("spends more threat on harder battles and stronger parties", () => {
    const run = at([battle]);
    expect(threatBudget(run, "hard") / threatBudget(run, "easy")).toBeCloseTo(
      BUDGET_SHARE.hard / BUDGET_SHARE.easy,
    );
    const veterans = {
      ...run,
      party: run.party.map((c) => ({ ...c, level: 10 })),
    };
    expect(threatBudget(veterans, "easy")).toBeGreaterThan(
      threatBudget(run, "easy"),
    );
  });
});

describe("monsterPool", () => {
  it("levels enemies up with the party and the depth", () => {
    const run = at([battle]);
    expect(enemyLevelBonus(run)).toBe(0);
    const later = {
      ...run,
      depth: 2,
      party: run.party.map((c) => ({ ...c, level: c.level + 3 })),
    };
    expect(enemyLevelBonus(later)).toBe(4);
    expect(monsterPool(later)[0]!.stats.maxHp).toBeGreaterThan(
      monsterPool(run)[0]!.stats.maxHp,
    );
    expect(monsterPool(later)[0]!.threat!).toBeGreaterThan(
      monsterPool(run)[0]!.threat!,
    );
  });

  it("is melee's monsters when no enemy was designed", () => {
    const noEnemies = {
      ...library,
      characters: library.characters.filter((c) => c.name !== "Goblin"),
    };
    expect(monsterPool({ ...at([battle]), library: noEnemies })).toBe(
      content.monsters,
    );
  });
});

describe("winBattle", () => {
  it("gives every member the same experience and moves on", () => {
    const run = at([battle, ally]);
    const { run: after, reward } = winBattle(run)!;
    expect(reward.xp).toBe(xpFor(battleFor(run)!, 2));
    expect(reward.xp).toBeGreaterThan(0);
    expect(after.position).toBe(1);
    for (const [i, member] of after.party.entries()) {
      const before = run.party[i]!;
      expect(member.level * 1e6 + member.xp).toBeGreaterThan(
        before.level * 1e6 + before.xp,
      );
    }
  });

  it("reports who levelled up", () => {
    const nearly = at([battle]);
    nearly.party = nearly.party.map((c) => ({ ...c, xp: 299 }));
    const { reward } = winBattle(nearly)!;
    expect(reward.levelUps).toEqual([
      { name: "Aldric", level: 4 },
      { name: "Mira", level: 4 },
    ]);
  });

  it("puts dropped gear in the bag", () => {
    const { run, reward } = winBattle(at([{ ...battle, loot: "gear-ring" }]))!;
    expect(reward.loot?.name).toBe("Swift Ring");
    expect(run.bag).toEqual(["gear-ring"]);
    expect(winBattle(at([battle]))!.reward.loot).toBeUndefined();
  });

  it("shares experience out over a bigger party", () => {
    const setup = battleFor(at([battle]))!;
    expect(xpFor(setup, 4)).toBeLessThan(xpFor(setup, 2));
  });

  it("is null off a battle", () => {
    expect(winBattle(at([ally]))).toBeNull();
  });
});

describe("loseBattle", () => {
  it("ends the run where it stands", () => {
    const lost = loseBattle(at([battle]));
    expect(lost).toMatchObject({ defeated: true, position: 0 });
    expect(levelCleared(lost)).toBe(false);
  });
});

describe("resolveAlly", () => {
  it("adds a recruit at the party's lowest level", () => {
    const run = resolveAlly(at([ally]), true);
    expect(run.position).toBe(1);
    expect(run.party.at(-1)).toMatchObject({ name: "Nell", level: 3, xp: 0 });
  });

  it("keeps a recruit's own level when it is higher", () => {
    const veteran: Encounter = {
      kind: "ally",
      character: { ...ally.character, level: 9, xp: 40 },
    };
    expect(resolveAlly(at([veteran]), true).party.at(-1)).toMatchObject({
      level: 9,
      xp: 40,
    });
  });

  it("moves on without them when declined or when the party is full", () => {
    expect(resolveAlly(at([ally]), false).party).toHaveLength(2);
    const full = at([ally]);
    full.party = Array.from({ length: MAX_PARTY_SIZE }, (_, i) => ({
      ...full.party[0]!,
      id: `m${i}`,
    }));
    expect(canRecruit(full)).toBe(false);
    const after = resolveAlly(full, true);
    expect(after.party).toHaveLength(MAX_PARTY_SIZE);
    expect(after.position).toBe(1);
  });

  it("does nothing off an ally encounter", () => {
    const run = at([battle]);
    expect(resolveAlly(run, true)).toBe(run);
  });
});

describe("resolveGear", () => {
  it("stows the find in the bag", () => {
    const run = resolveGear(at([ring]), null);
    expect(run.bag).toEqual(["gear-ring"]);
    expect(run.position).toBe(1);
  });

  it("puts it on a character, whose old gear goes in the bag", () => {
    const sword: Encounter = { kind: "gear", gearId: "gear-bow" };
    const run = resolveGear(at([sword]), "unit-1");
    expect(run.party[0]!.gear.weapon).toBe("gear-bow");
    expect(run.bag).toEqual(["gear-sword"]);
  });

  it("does nothing off a gear encounter", () => {
    const run = at([battle]);
    expect(resolveGear(run, null)).toBe(run);
  });
});

describe("changeGear", () => {
  const run = at([battle], { bag: ["gear-ring", "gear-bow"] });

  it("swaps bag gear into a slot", () => {
    const after = changeGear(run, "unit-1", "weapon", "gear-bow");
    expect(after.party[0]!.gear.weapon).toBe("gear-bow");
    expect(after.bag.sort()).toEqual(["gear-ring", "gear-sword"]);
  });

  it("empties a slot into the bag", () => {
    const after = changeGear(run, "unit-1", "armor", null);
    expect(after.party[0]!.gear.armor).toBeUndefined();
    expect(after.bag).toContain("gear-mail");
  });

  it("refuses gear that isn't in the bag or fits another slot", () => {
    expect(changeGear(run, "unit-1", "weapon", "gear-staff")).toBe(run);
    expect(changeGear(run, "unit-1", "armor", "gear-ring")).toBe(run);
    expect(changeGear(run, "nobody", "accessory", "gear-ring")).toBe(run);
  });

  it("uses up one copy when the bag holds two", () => {
    const two = at([battle], { bag: ["gear-ring", "gear-ring"] });
    expect(changeGear(two, "unit-1", "accessory", "gear-ring").bag).toEqual([
      "gear-ring",
    ]);
  });
});

describe("nextLevel", () => {
  it("goes deeper once the level is cleared, keeping the party and bag", () => {
    const done = at([battle], { position: 1, bag: ["gear-ring"] });
    expect(levelCleared(done)).toBe(true);
    const next = nextLevel(done);
    expect(next).toMatchObject({ depth: 2, position: 0, bag: ["gear-ring"] });
    expect(next.party).toBe(done.party);
    expect(next.encounters).toHaveLength(LEVEL_LENGTH);
  });

  it("stays put before that", () => {
    const run = at([battle]);
    expect(nextLevel(run)).toBe(run);
  });
});

describe("parseRun", () => {
  it("reads back a saved run", () => {
    const run = winBattle(startRun(library, 9))!.run;
    expect(parseRun(JSON.stringify(run))).toEqual(run);
  });

  it("rejects anything else", () => {
    const run = startRun(library, 9);
    expect(parseRun(null)).toBeNull();
    expect(parseRun("{")).toBeNull();
    expect(parseRun("3")).toBeNull();
    expect(parseRun(JSON.stringify({ ...run, version: 2 }))).toBeNull();
    expect(parseRun(JSON.stringify({ ...run, party: [] }))).toBeNull();
    expect(parseRun(JSON.stringify({ ...run, library: {} }))).toBeNull();
    expect(
      parseRun(JSON.stringify({ ...run, encounters: [{ kind: "shop" }] })),
    ).toBeNull();
  });
});

describe("a whole level", () => {
  it("can be walked from the first encounter to the next level", () => {
    let run = startRun(library, 4);
    while (!levelCleared(run)) {
      const encounter = currentEncounter(run)!;
      if (encounter.kind === "battle") run = winBattle(run)!.run;
      else if (encounter.kind === "ally") run = resolveAlly(run, true);
      else run = resolveGear(run, run.party[0]!.id);
    }
    expect(run.party.length).toBeGreaterThan(START_PARTY_SIZE);
    expect(nextLevel(run).depth).toBe(2);
  });
});
