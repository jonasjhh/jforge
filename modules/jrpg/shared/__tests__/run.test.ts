import { describe, expect, it } from "vitest";
import { starterLibrary } from "@jforge/char/shared";
import {
  MAX_PARTY_SIZE,
  content,
  createBattle,
  simulate,
} from "@jforge/melee/shared";
import {
  BUDGET_SHARE,
  DEPTH_GROWTH,
  GEAR_CHOICES,
  LEVEL_LENGTH_SPREAD,
  MAX_PACK_KINDS,
  MIN_LEVEL_LENGTH,
  START_LEVEL,
  START_PARTY_SIZE,
  battleFor,
  battleSeed,
  canRecruit,
  changeGear,
  chooseFork,
  commitBattle,
  currentEncounter,
  enemyLevelBonus,
  generateLevel,
  heroes,
  leaveBattle,
  levelCleared,
  loseBattle,
  monsterPool,
  nextLevel,
  packFor,
  parseRun,
  resolveAlly,
  resolveGear,
  resolveTraining,
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
  party: library.characters.slice(0, 2),
  baseLevel: 3,
  encounters,
  position: 0,
  ...changes,
});
const battle: Encounter = {
  kind: "battle",
  difficulty: "easy",
  seed: 5,
  rank: "normal",
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
const ring: Encounter = { kind: "gear", gearIds: ["gear-ring", "gear-bow"] };
const training: Encounter = { kind: "training" };
/** Every encounter of a level, with the ways of its forks. */
const everything = (encounters: Encounter[]): Encounter[] =>
  encounters.flatMap((e) => (e.kind === "fork" ? [e, ...e.options] : [e]));

describe("startRun", () => {
  it("draws a different party for different seeds, the same for one seed", () => {
    expect(startRun(library, 7).party).toEqual(startRun(library, 7).party);
    const parties = new Set(
      SEEDS.map((seed) =>
        startRun(library, seed)
          .party.map((c) => c.name)
          .join("+"),
      ),
    );
    expect(parties.size).toBeGreaterThan(10);
  });

  it("draws two different heroes, designed ones among them", () => {
    const drawn = new Set<string>();
    for (const seed of SEEDS) {
      const run = startRun(library, seed);
      expect(run.party).toHaveLength(START_PARTY_SIZE);
      expect(new Set(run.party.map((c) => c.id)).size).toBe(START_PARTY_SIZE);
      expect(run).toMatchObject({ depth: 1, position: 0, defeated: false });
      for (const member of run.party) drawn.add(member.name);
    }
    expect(drawn).toContain("Aldric");
    expect(drawn.size).toBeGreaterThan(8);
  });

  it("raises the party to its highest level, at least the start level", () => {
    for (const seed of SEEDS) {
      const run = startRun(library, seed);
      expect(run.party.every((c) => c.level === START_LEVEL)).toBe(true);
      expect(run.baseLevel).toBe(START_LEVEL);
    }
    const veteran = {
      ...library,
      characters: library.characters.map((c) =>
        c.name === "Aldric" ? { ...c, level: 9, xp: 50 } : c,
      ),
    };
    const withHim = SEEDS.map((seed) => startRun(veteran, seed)).find((run) =>
      run.party.some((c) => c.name === "Aldric"),
    )!;
    expect(withHim.party.map((c) => c.level)).toEqual([9, 9]);
    expect(withHim.baseLevel).toBe(9);
    expect(withHim.party.find((c) => c.name === "Aldric")!.xp).toBe(50);
  });

  it("counts every melee class and designed class character as a hero", () => {
    const names = heroes(library).map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["Aldric", "Mira", "Brann"]));
    expect(names).not.toContain("Goblin");
    const classes = new Set(heroes(null).map((c) => c.archetypeId));
    for (const type of content.playerTypes) {
      expect(classes).toContain(`melee-${type.id}`);
    }
  });

  it("uses the starter library when nothing was designed", () => {
    expect(runLibrary(null)).toEqual(starterLibrary());
    expect(runLibrary(library)).toBe(library);
  });
});

describe("startRun and the world", () => {
  const run = startRun(library, 1);

  it("adds the world's enemies, classes, travellers and gear", () => {
    const kinds = (kind: string) =>
      run.library.archetypes.filter((a) => a.kind === kind).length;
    expect(kinds("enemy")).toBeGreaterThan(5);
    expect(kinds("class")).toBeGreaterThan(5);
    expect(run.library.gear.length).toBeGreaterThan(library.gear.length * 4);
    expect(parseRun(JSON.stringify(run))).toEqual(run);
  });

  it("keeps what was designed", () => {
    for (const key of ["gear", "archetypes", "characters", "skills"] as const) {
      const ids = new Set(run.library[key].map((x) => x.id));
      expect(library[key].every((x) => ids.has(x.id))).toBe(true);
    }
  });
});

describe("generateLevel", () => {
  const level = (seed: number, depth = 1) => {
    const run = startRun(library, seed);
    return generateLevel(run.library, run.party, seed, depth);
  };

  it("is the same for the same seed and depth, and differs otherwise", () => {
    expect(level(3)).toEqual(level(3));
    expect(level(3)).not.toEqual(level(3, 2));
  });

  it("varies in length within its bounds", () => {
    const lengths = new Set(SEEDS.map((seed) => level(seed).length));
    expect(lengths.size).toBeGreaterThan(1);
    for (const length of lengths) {
      expect(length).toBeGreaterThanOrEqual(MIN_LEVEL_LENGTH);
      expect(length).toBeLessThanOrEqual(
        MIN_LEVEL_LENGTH + LEVEL_LENGTH_SPREAD,
      );
    }
  });

  it("opens with an easy battle and ends with a hard one that drops gear", () => {
    for (const seed of SEEDS) {
      const encounters = level(seed);
      expect(encounters[0]).toMatchObject({
        kind: "battle",
        difficulty: "easy",
        rank: "normal",
      });
      const last = encounters.at(-1)!;
      expect(last).toMatchObject({ kind: "battle", rank: "boss" });
      expect(last.kind === "battle" && last.loot).toBeTruthy();
    }
  });

  it("has an elite battle past the middle that drops gear", () => {
    for (const seed of SEEDS) {
      const encounters = level(seed);
      const at = encounters.findIndex(
        (e) => e.kind === "battle" && e.rank === "elite",
      );
      expect(at).toBeGreaterThanOrEqual(encounters.length / 2);
      expect(encounters[at]).toMatchObject({ difficulty: "hard" });
      expect((encounters[at] as { loot?: string }).loot).toBeTruthy();
    }
  });

  it("always has an ally, gear and training, and never two finds in a row", () => {
    for (const seed of SEEDS) {
      const kinds = level(seed).map((e) => e.kind);
      expect(kinds).toEqual(
        expect.arrayContaining(["ally", "gear", "training"]),
      );
      for (let i = 1; i < kinds.length; i++) {
        expect(kinds[i] !== "battle" && kinds[i - 1] !== "battle").toBe(false);
      }
    }
  });

  it("brings every kind of encounter across seeds", () => {
    const all = SEEDS.flatMap((seed) => everything(level(seed)));
    expect(new Set(all.map((e) => e.kind))).toEqual(
      new Set(["battle", "ally", "gear", "training", "fork"]),
    );
  });

  it("forks into two different ways, never into another fork", () => {
    for (const seed of SEEDS) {
      for (const e of level(seed)) {
        if (e.kind !== "fork") continue;
        expect(e.options).toHaveLength(2);
        expect(e.options.every((o) => o.kind !== "fork")).toBe(true);
        expect(e.options[0]!.kind === e.options[1]!.kind).toBe(
          e.options[0]!.kind === "battle" && e.options[1]!.kind === "battle",
        );
      }
    }
  });

  it("offers different travellers, none already in the party", () => {
    for (const seed of SEEDS) {
      const found = everything(level(seed)).flatMap((e) =>
        e.kind === "ally" ? [e.character] : [],
      );
      expect(new Set(found.map((c) => c.id)).size).toBe(found.length);
      const party = startRun(library, seed).party.map((c) => c.id);
      for (const character of found) {
        expect(party).not.toContain(character.id);
      }
    }
  });

  it("offers a choice of different gear that exists", () => {
    const run = startRun(library, 1);
    const known = new Set(run.library.gear.map((g) => g.id));
    for (const seed of SEEDS) {
      for (const e of everything(level(seed))) {
        if (e.kind !== "gear") continue;
        expect(e.gearIds.length).toBeGreaterThan(1);
        expect(e.gearIds.length).toBeLessThanOrEqual(GEAR_CHOICES);
        expect(new Set(e.gearIds).size).toBe(e.gearIds.length);
        expect(e.gearIds.every((id) => known.has(id))).toBe(true);
      }
    }
  });

  it("finds better gear deeper in", () => {
    const tiers = (depth: number) =>
      SEEDS.flatMap((seed) => everything(level(seed, depth)))
        .flatMap((e) => (e.kind === "gear" ? e.gearIds : []))
        .map((id) => Number(/\+(\d)$/.exec(id)?.[1] ?? 0));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(tiers(3))).toBeGreaterThan(mean(tiers(1)) + 1);
    expect(Math.max(...tiers(1))).toBeLessThan(3);
  });
});

describe("packFor", () => {
  const pool = monsterPool(startRun(library, 1));

  it("picks a few different kinds, the same for the same seed", () => {
    const sizes = new Set<number>();
    for (const seed of SEEDS) {
      const pack = packFor(pool, seed);
      expect(pack).toEqual(packFor(pool, seed));
      expect(new Set(pack).size).toBe(pack.length);
      expect(pack.length).toBeGreaterThan(0);
      expect(pack.length).toBeLessThanOrEqual(MAX_PACK_KINDS);
      sizes.add(pack.length);
    }
    expect(sizes.size).toBe(MAX_PACK_KINDS);
  });

  it("meets every enemy sooner or later", () => {
    const met = new Set(
      SEEDS.flatMap((seed) => packFor(pool, seed).map((d) => d.name)),
    );
    expect(met.size).toBe(pool.length);
  });

  it("is the whole pool when it is small", () => {
    expect(packFor(pool.slice(0, 1), 3)).toEqual(pool.slice(0, 1));
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
    expect(new Set(names("enemy")).size).toBeLessThanOrEqual(MAX_PACK_KINDS);
  });

  it("is null off a battle or after a defeat", () => {
    expect(battleFor(at([ally]))).toBeNull();
    expect(battleFor(at([battle], { defeated: true }))).toBeNull();
    expect(battleFor(at([]))).toBeNull();
  });

  it("fields stronger enemies in elite and final battles", () => {
    const run = at([battle]);
    expect(monsterPool(run, 3)[0]!.stats.maxHp).toBeGreaterThan(
      monsterPool(run)[0]!.stats.maxHp,
    );
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

describe("difficulty", () => {
  it("gives the enemies a bigger share every level deeper", () => {
    const run = at([battle]);
    const deeper = (depth: number) =>
      threatBudget({ ...run, depth }, "normal") / threatBudget(run, "normal");
    expect(deeper(2)).toBeCloseTo(1 + DEPTH_GROWTH);
    expect(deeper(5)).toBeCloseTo(1 + 4 * DEPTH_GROWTH);
  });

  it("keeps the first level's battles in their win-rate bands", () => {
    // Auto-played runs. Every battle is counted, then taken as won, so
    // later battles aren't only fought by the parties that got lucky.
    const tally = { easy: [0, 0], normal: [0, 0], hard: [0, 0] };
    for (let seed = 0; seed < 60; seed++) {
      let run = startRun(null, seed);
      for (let step = 0; !levelCleared(run); step++) {
        const encounter = currentEncounter(run)!;
        const who = run.party[step % run.party.length]!.id;
        if (encounter.kind === "ally") run = resolveAlly(run, true);
        else if (encounter.kind === "fork") run = chooseFork(run, step % 2);
        else if (encounter.kind === "training") {
          run = resolveTraining(run, who);
        } else if (encounter.kind === "gear") {
          run = resolveGear(run, encounter.gearIds[0] ?? null, who);
        } else {
          const result = simulate(battleFor(run)!, seed * 100 + step);
          const count = tally[encounter.difficulty];
          count[1]!++;
          if (result.winner === "player") count[0]!++;
          run = winBattle(run)!.run;
        }
      }
    }
    const rate = (d: keyof typeof tally) => tally[d][0]! / tally[d][1]!;
    expect(rate("easy")).toBeGreaterThan(0.85);
    expect(rate("normal")).toBeGreaterThan(0.6);
    expect(rate("normal")).toBeLessThan(0.9);
    expect(rate("hard")).toBeGreaterThan(0.35);
    expect(rate("hard")).toBeLessThan(0.75);
    expect(rate("easy")).toBeGreaterThan(rate("normal"));
    expect(rate("normal")).toBeGreaterThan(rate("hard"));
  }, 60_000);
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

  it("is melee's monsters when the library has no enemy at all", () => {
    const run = at([battle]);
    const classes = new Set(
      run.library.archetypes.filter((a) => a.kind === "class").map((a) => a.id),
    );
    const noEnemies = {
      ...run.library,
      characters: run.library.characters.filter((c) =>
        classes.has(c.archetypeId),
      ),
    };
    expect(monsterPool({ ...run, library: noEnemies })).toBe(content.monsters);
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

describe("committing to a battle", () => {
  it("is free to leave before the party acts, and nothing changes", () => {
    const run = at([battle]);
    expect(leaveBattle(run)).toBe(run);
  });

  it("ends the run when left after the party has acted", () => {
    const committed = commitBattle(at([battle]));
    expect(committed.committed).toBe(true);
    expect(leaveBattle(committed)).toMatchObject({
      defeated: true,
      committed: false,
      position: 0,
    });
  });

  it("locks the party's gear while the fight is on", () => {
    const committed = commitBattle(at([battle], { bag: ["gear-ring"] }));
    expect(changeGear(committed, "unit-1", "accessory", "gear-ring")).toBe(
      committed,
    );
  });

  it("is over once the battle is won or lost", () => {
    const committed = commitBattle(at([battle, battle]));
    expect(winBattle(committed)!.run.committed).toBe(false);
    expect(loseBattle(committed).committed).toBe(false);
  });

  it("only happens at a battle, and survives saving", () => {
    const meeting = at([ally]);
    expect(commitBattle(meeting)).toBe(meeting);
    const committed = commitBattle(at([battle]));
    expect(commitBattle(committed)).toBe(committed);
    expect(parseRun(JSON.stringify(committed))?.committed).toBe(true);
  });

  it("fights an encounter with the same seed every time", () => {
    const run = at([battle, { ...battle, seed: 6 }]);
    expect(battleSeed(run)).toBe(battleSeed(at([battle])));
    expect(battleSeed({ ...run, position: 1 })).not.toBe(battleSeed(run));
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
  it("stows the chosen piece in the bag", () => {
    const run = resolveGear(at([ring]), "gear-ring", null);
    expect(run.bag).toEqual(["gear-ring"]);
    expect(run.position).toBe(1);
  });

  it("puts it on a character, whose old gear goes in the bag", () => {
    const run = resolveGear(at([ring]), "gear-bow", "unit-1");
    expect(run.party[0]!.gear.weapon).toBe("gear-bow");
    expect(run.bag).toEqual(["gear-sword"]);
  });

  it("moves on with nothing for no piece or one that isn't on offer", () => {
    for (const id of [null, "gear-mail"]) {
      const run = resolveGear(at([ring]), id, "unit-1");
      expect(run.bag).toEqual([]);
      expect(run.position).toBe(1);
    }
  });

  it("does nothing off a gear encounter", () => {
    const run = at([battle]);
    expect(resolveGear(run, "gear-ring", null)).toBe(run);
  });
});

describe("resolveTraining", () => {
  it("gives the chosen member a level and moves on", () => {
    const run = resolveTraining(at([training]), "unit-2");
    expect(run.party.map((c) => c.level)).toEqual([3, 4]);
    expect(run.position).toBe(1);
  });

  it("moves on without training anyone unknown", () => {
    const run = resolveTraining(at([training]), null);
    expect(run.party.map((c) => c.level)).toEqual([3, 3]);
    expect(run.position).toBe(1);
  });

  it("does nothing off a training encounter", () => {
    const run = at([battle]);
    expect(resolveTraining(run, "unit-1")).toBe(run);
  });
});

describe("chooseFork", () => {
  const fork: Encounter = { kind: "fork", options: [ally, training] };

  it("puts the chosen way where the party stands", () => {
    const run = chooseFork(at([fork, battle]), 1);
    expect(run.position).toBe(0);
    expect(run.encounters).toEqual([training, battle]);
  });

  it("does nothing for a way that isn't there, or off a fork", () => {
    const run = at([fork]);
    expect(chooseFork(run, 2)).toBe(run);
    const fight = at([battle]);
    expect(chooseFork(fight, 0)).toBe(fight);
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
    expect(next.encounters.length).toBeGreaterThanOrEqual(MIN_LEVEL_LENGTH);
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
    expect(parseRun(JSON.stringify({ ...run, version: 1 }))).toBeNull();
    const nested = { kind: "fork", options: [{ kind: "fork", options: [] }] };
    expect(
      parseRun(JSON.stringify({ ...run, encounters: [nested] })),
    ).toBeNull();
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
      else if (encounter.kind === "fork") run = chooseFork(run, 0);
      else if (encounter.kind === "training") {
        run = resolveTraining(run, run.party[0]!.id);
      } else run = resolveGear(run, encounter.gearIds[0]!, run.party[0]!.id);
    }
    expect(run.party.length).toBeGreaterThan(START_PARTY_SIZE);
    expect(nextLevel(run).depth).toBe(2);
  });
});
