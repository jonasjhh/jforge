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
  LANES,
  LEVEL_LENGTH_SPREAD,
  MAX_PACK_KINDS,
  MIN_LEVEL_LENGTH,
  START_LEVEL,
  START_PARTY_SIZE,
  battleFor,
  battleSeed,
  canRecruit,
  changeGear,
  choices,
  commitBattle,
  currentEncounter,
  currentStop,
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
  roadOf,
  runLibrary,
  startRun,
  threatBudget,
  travel,
  winBattle,
  xpFor,
  type Encounter,
  type Run,
  type Stop,
} from "../run";

const library = starterLibrary();
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

/** A run standing at the given encounters. */
const at = (encounters: Encounter[], changes: Partial<Run> = {}): Run => ({
  ...startRun(library, 1),
  party: library.characters.slice(0, 2),
  baseLevel: 3,
  map: roadOf(encounters),
  position: 0,
  path: [0],
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
/** Every encounter on a map. */
const everything = (map: Stop[][]): Encounter[] =>
  map.flat().map((stop) => stop.encounter);
/** Takes the road to way `pick` (modulo the ways there are), if at one. */
const walk = (run: Run, pick: number): Run => {
  const ways = choices(run);
  return ways.length > 0 ? travel(run, ways[pick % ways.length]!) : run;
};

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
  const isFind = (stop: Stop) => stop.encounter.kind !== "battle";

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

  it("starts at one easy battle and ends at one hard one that drops gear", () => {
    for (const seed of SEEDS) {
      const map = level(seed);
      expect(map[0]).toHaveLength(1);
      expect(map[0]![0]!.encounter).toMatchObject({
        kind: "battle",
        difficulty: "easy",
        rank: "normal",
      });
      expect(map.at(-1)).toHaveLength(1);
      const last = map.at(-1)![0]!.encounter;
      expect(last).toMatchObject({ kind: "battle", rank: "boss" });
      expect(last.kind === "battle" && last.loot).toBeTruthy();
    }
  });

  it("has two or three stops per row in between, each on its own lane", () => {
    const widths = new Set<number>();
    for (const seed of SEEDS) {
      for (const row of level(seed).slice(1, -1)) {
        widths.add(row.length);
        const lanes = row.map((stop) => stop.lane);
        expect(new Set(lanes).size).toBe(lanes.length);
        expect(lanes.every((l) => l >= 0 && l < LANES)).toBe(true);
        expect(lanes).toEqual([...lanes].sort((a, b) => a - b));
      }
    }
    expect(widths).toEqual(new Set([2, 3]));
  });

  it("gives every stop a road on and a road in, to stops that exist", () => {
    for (const seed of SEEDS) {
      const map = level(seed);
      map.forEach((row, index) => {
        const next = map[index + 1];
        for (const stop of row) {
          if (!next) {
            expect(stop.next).toEqual([]);
            continue;
          }
          expect(stop.next.length).toBeGreaterThan(0);
          expect(stop.next.every((i) => i >= 0 && i < next.length)).toBe(true);
        }
        next?.forEach((_, i) =>
          expect(row.some((stop) => stop.next.includes(i))).toBe(true),
        );
      });
    }
  });

  it("splits the road: most stops lead to more than one", () => {
    const stops = SEEDS.flatMap((seed) => level(seed).slice(0, -2).flat());
    const split = stops.filter((stop) => stop.next.length > 1).length;
    expect(split / stops.length).toBeGreaterThan(0.6);
  });

  it("never has finds in two rows running", () => {
    for (const seed of SEEDS) {
      const finds = level(seed).map((row) => row.some(isFind));
      for (let i = 1; i < finds.length; i++) {
        expect(finds[i] && finds[i - 1]).toBe(false);
      }
    }
  });

  it("always has an ally, gear, training and an elite battle on the map", () => {
    for (const seed of SEEDS) {
      const map = level(seed);
      const all = everything(map);
      expect(all.map((e) => e.kind)).toEqual(
        expect.arrayContaining(["ally", "gear", "training"]),
      );
      const eliteRows = map.flatMap((row, i) =>
        row.some(
          (s) => s.encounter.kind === "battle" && s.encounter.rank === "elite",
        )
          ? [i]
          : [],
      );
      expect(eliteRows.length).toBeGreaterThan(0);
      expect(Math.min(...eliteRows)).toBeGreaterThanOrEqual(map.length / 2);
      for (const e of all) {
        if (e.kind !== "battle" || e.rank === "normal") continue;
        expect(e.difficulty).toBe("hard");
        expect(e.loot).toBeTruthy();
      }
    }
  });

  it("puts different finds on the roads of a row", () => {
    for (const seed of SEEDS) {
      for (const row of level(seed)) {
        const kinds = row.filter(isFind).map((s) => s.encounter.kind);
        expect(new Set(kinds).size).toBe(kinds.length);
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

describe("travelling the map", () => {
  const stop = (encounter: Encounter, lane: number, next: number[]): Stop => ({
    encounter,
    lane,
    next,
  });
  // One battle, then three ways (the first battle's road reaches two of
  // them... all three here), then one battle.
  const map: Stop[][] = [
    [stop(battle, 1, [0, 1, 2])],
    [stop(ally, 0, [0]), stop(training, 1, [0, 1]), stop(ring, 2, [1])],
    [stop(battle, 0, [0]), stop({ ...battle, seed: 9 }, 2, [0])],
    [stop(battle, 1, [])],
  ];
  const start: Run = { ...at([]), map, position: 0, path: [0] };

  it("stands at the first stop, with nowhere to choose", () => {
    expect(currentStop(start)).toBe(map[0]![0]);
    expect(choices(start)).toEqual([]);
  });

  it("stops at the roadside when the road splits", () => {
    const run = winBattle(start)!.run;
    expect(run.position).toBe(1);
    expect(currentEncounter(run)).toBeNull();
    expect(levelCleared(run)).toBe(false);
    expect(choices(run)).toEqual([0, 1, 2]);
  });

  it("takes the chosen road", () => {
    const run = travel(winBattle(start)!.run, 2);
    expect(currentEncounter(run)).toBe(ring);
    expect(run.path).toEqual([0, 2]);
    expect(choices(run)).toEqual([]);
  });

  it("only offers the roads that lead on from where it stands", () => {
    const viaAlly = resolveAlly(travel(winBattle(start)!.run, 0), false);
    // The ally's road has one way on: the party walks straight to it.
    expect(viaAlly.path).toEqual([0, 0, 0]);
    expect(currentStop(viaAlly)).toBe(map[2]![0]);

    const viaTraining = resolveTraining(travel(winBattle(start)!.run, 1), null);
    expect(choices(viaTraining)).toEqual([0, 1]);
    const viaGear = resolveGear(travel(winBattle(start)!.run, 2), null, null);
    expect(viaGear.path).toEqual([0, 2, 1]);
  });

  it("refuses a road that isn't there or isn't open", () => {
    const roadside = winBattle(start)!.run;
    expect(travel(roadside, 3)).toBe(roadside);
    expect(travel(start, 0)).toBe(start);
    const lost = loseBattle(start);
    expect(choices(lost)).toEqual([]);
  });

  it("clears the level past the last stop", () => {
    let run = start;
    for (let step = 0; step < 20 && !levelCleared(run); step++) {
      run = walk(run, step);
      const encounter = currentEncounter(run);
      if (encounter?.kind === "battle") run = winBattle(run)!.run;
      else if (encounter?.kind === "ally") run = resolveAlly(run, false);
      else if (encounter?.kind === "training") {
        run = resolveTraining(run, null);
      } else if (encounter?.kind === "gear") run = resolveGear(run, null, null);
    }
    expect(levelCleared(run)).toBe(true);
    expect(run.path).toHaveLength(map.length);
    expect(choices(run)).toEqual([]);
  });

  it("is a single road for roadOf", () => {
    const road = roadOf([battle, ally, training]);
    expect(road.map((row) => row.length)).toEqual([1, 1, 1]);
    expect(road.map((row) => row[0]!.next)).toEqual([[0], [0], []]);
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
        run = walk(run, step);
        const encounter = currentEncounter(run)!;
        const who = run.party[step % run.party.length]!.id;
        if (encounter.kind === "ally") run = resolveAlly(run, true);
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
    expect(next.map.length).toBeGreaterThanOrEqual(MIN_LEVEL_LENGTH);
    expect(next.path).toEqual([0]);
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
    expect(parseRun(JSON.stringify({ ...run, path: "0" }))).toBeNull();
    expect(
      parseRun(
        JSON.stringify({ ...run, map: roadOf([{ kind: "shop" } as never]) }),
      ),
    ).toBeNull();
  });
});

describe("a whole level", () => {
  it("can be walked from the first encounter to the next level", () => {
    let run = startRun(library, 4);
    while (!levelCleared(run)) {
      run = walk(run, 0);
      const encounter = currentEncounter(run)!;
      if (encounter.kind === "battle") run = winBattle(run)!.run;
      else if (encounter.kind === "ally") run = resolveAlly(run, true);
      else if (encounter.kind === "training") {
        run = resolveTraining(run, run.party[0]!.id);
      } else run = resolveGear(run, encounter.gearIds[0]!, run.party[0]!.id);
    }
    expect(run.party.length).toBeGreaterThan(START_PARTY_SIZE);
    expect(nextLevel(run).depth).toBe(2);
  });
});
