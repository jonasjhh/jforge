import { describe, expect, it } from "vitest";
import { ALDRIC, MIRA, pair } from "./pair";
import { jrpgLibrary } from "@jforge/content/jrpg";
import {
  MAX_PARTY_SIZE,
  content,
  createBattle,
  isBackLiner,
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
  drawParty,
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
  recruitOf,
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
import { formationOf } from "../formation";
import { GEAR_TIERS } from "../world";

const library = jrpgLibrary();
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

/** A run standing at the given encounters. */
const at = (encounters: Encounter[], changes: Partial<Run> = {}): Run => ({
  ...startRun(library, 1),
  party: pair(library),
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
    archetypeId: "melee-sage",
    gear: {},
  },
};
const ring: Encounter = {
  kind: "gear",
  gearIds: ["accessory-ring", "weapon-spear", "weapon-bow"],
};
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
  it("given chosen heroes with a repeat, when the run starts, then the party is those heroes once each, in order", () => {
    const [first, , third] = heroes(library);

    const run = startRun(library, 7, [third!.id, first!.id, first!.id]);

    expect(run.party.map((c) => c.id)).toEqual([third!.id, first!.id]);
  });

  it("given only unknown heroes chosen, when the run starts, then the party is drawn as if none were", () => {
    const run = startRun(library, 7, ["nobody"]);

    expect(run.party).toEqual(startRun(library, 7).party);
  });

  it("given no heroes chosen, when the run starts, then the party is the one drawn for its seed", () => {
    const run = startRun(library, 7);

    expect(run.party.map((c) => c.id)).toEqual(
      drawParty(library, 7).map((c) => c.id),
    );
  });

  it("given one seed, when two runs start, then both draw the same party", () => {
    const first = startRun(library, 7);

    const second = startRun(library, 7);

    expect(second.party).toEqual(first.party);
  });

  it("given forty seeds, when runs start, then more than ten different parties are drawn", () => {
    const parties = new Set(
      SEEDS.map((seed) =>
        startRun(library, seed)
          .party.map((c) => c.name)
          .join("+"),
      ),
    );

    expect(parties.size).toBeGreaterThan(10);
  });

  it("given forty seeds, when runs start, then each draws two different heroes at the start", () => {
    const runs = SEEDS.map((seed) => startRun(library, seed));

    const wrong = runs.filter(
      (run) =>
        run.party.length !== START_PARTY_SIZE ||
        new Set(run.party.map((c) => c.id)).size !== START_PARTY_SIZE ||
        run.depth !== 1 ||
        run.position !== 0 ||
        run.defeated,
    );

    expect(wrong).toEqual([]);
  });

  it("given forty seeds, when runs start, then the heroes drawn include designed ones and vary", () => {
    const drawn = new Set(
      SEEDS.flatMap((seed) => startRun(library, seed).party.map((c) => c.name)),
    );

    expect(drawn).toContain("Aldric");
    expect(drawn.size).toBeGreaterThan(8);
  });

  it("given forty seeds, when runs start, then every party sets out at the start level with no XP", () => {
    const members = SEEDS.flatMap((seed) => startRun(library, seed).party);

    const wrong = members.filter((c) => c.level !== START_LEVEL || c.xp !== 0);

    expect(wrong).toEqual([]);
  });

  it("given the starter library, when its heroes are listed, then designed class characters count and enemies don't", () => {
    const names = heroes(library).map((c) => c.name);

    expect(names).toEqual(expect.arrayContaining(["Aldric", "Mira", "Brann"]));
    expect(names).not.toContain("Goblin");
  });

  it("given no library, when its heroes are listed, then every melee class is among them", () => {
    const classes = new Set(heroes(null).map((c) => c.archetypeId));

    const missing = content.playerTypes.filter(
      (type) => !classes.has(`melee-${type.id}`),
    );

    expect(missing).toEqual([]);
  });

  it("given no library, when the run's library is taken, then it is jrpg's content", () => {
    const used = runLibrary(null);

    expect(used).toEqual(jrpgLibrary());
  });

  it("given a library, when the run's library is taken, then it is that library", () => {
    const given = { ...jrpgLibrary(), characters: [] };

    const used = runLibrary(given);

    expect(used).toBe(given);
  });
});

describe("startRun and the world", () => {
  const run = startRun(library, 1);
  const kinds = (kind: string) =>
    run.library.archetypes.filter((a) => a.kind === kind).length;

  it("given a new run, when its enemy types are counted, then the world's are added", () => {
    const enemies = kinds("enemy");

    expect(enemies).toBeGreaterThan(5);
  });

  it("given a new run, when its classes are counted, then the world's are added", () => {
    const classes = kinds("class");

    expect(classes).toBeGreaterThan(5);
  });

  it("given a new run, when its gear is counted, then each piece is there at every tier", () => {
    const gear = run.library.gear.length;

    expect(gear).toBe(library.gear.length * GEAR_TIERS.length);
  });

  it("given a new run, when it is saved and parsed, then it reads back unchanged", () => {
    const text = JSON.stringify(run);

    const back = parseRun(text);

    expect(back).toEqual(run);
  });

  it.each(["gear", "archetypes", "characters", "skills"] as const)(
    "given a new run, when its %s are listed, then everything jrpg uses is kept",
    (key) => {
      const ids = new Set(run.library[key].map((x) => x.id));

      const lost = library[key].filter((x) => !ids.has(x.id));

      expect(lost).toEqual([]);
    },
  );
});

describe("generateLevel", () => {
  const cache = new Map<string, Stop[][]>();
  /** The level for a seed and depth, made once and shared between tests. */
  const level = (seed: number, depth = 1) => {
    const key = `${seed}:${depth}`;
    if (!cache.has(key)) {
      const run = startRun(library, seed);
      cache.set(key, generateLevel(run.library, run.party, seed, depth));
    }
    return cache.get(key)!;
  };
  const levels = () => SEEDS.map((seed) => level(seed));
  const isFind = (stop: Stop) => stop.encounter.kind !== "battle";
  const isElite = (stop: Stop) =>
    stop.encounter.kind === "battle" && stop.encounter.rank === "elite";

  it("given one seed and depth, when the level is made twice, then both are the same", () => {
    const run = startRun(library, 3);
    const first = generateLevel(run.library, run.party, 3, 1);

    const second = generateLevel(run.library, run.party, 3, 1);

    expect(second).toEqual(first);
  });

  it("given one seed, when levels are made at two depths, then they differ", () => {
    const shallow = level(3);

    const deep = level(3, 2);

    expect(deep).not.toEqual(shallow);
  });

  it("given forty seeds, when levels are made, then their lengths vary within the bounds", () => {
    const lengths = new Set(levels().map((map) => map.length));

    expect(lengths.size).toBeGreaterThan(1);
    expect(Math.min(...lengths)).toBeGreaterThanOrEqual(MIN_LEVEL_LENGTH);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(
      MIN_LEVEL_LENGTH + LEVEL_LENGTH_SPREAD,
    );
  });

  it("given forty seeds, when levels are made, then each starts at one easy normal battle", () => {
    const firsts = levels().map((map) => map[0]!);

    const wrong = firsts.filter(
      (row) =>
        row.length !== 1 ||
        row[0]!.encounter.kind !== "battle" ||
        row[0]!.encounter.difficulty !== "easy" ||
        row[0]!.encounter.rank !== "normal",
    );

    expect(wrong).toEqual([]);
  });

  it("given forty seeds, when levels are made, then each ends at one boss battle that drops gear", () => {
    const lasts = levels().map((map) => map.at(-1)!);

    const wrong = lasts.filter(
      (row) =>
        row.length !== 1 ||
        row[0]!.encounter.kind !== "battle" ||
        row[0]!.encounter.rank !== "boss" ||
        !row[0]!.encounter.loot,
    );

    expect(wrong).toEqual([]);
  });

  it("given forty seeds, when levels are made, then the rows between have two or three stops", () => {
    const widths = new Set(
      levels().flatMap((map) => map.slice(1, -1).map((row) => row.length)),
    );

    expect(widths).toEqual(new Set([2, 3]));
  });

  it("given forty seeds, when levels are made, then each stop between is on its own lane, in order", () => {
    const rows = levels().flatMap((map) => map.slice(1, -1));

    const wrong = rows
      .map((row) => row.map((stop) => stop.lane))
      .filter(
        (lanes) =>
          new Set(lanes).size !== lanes.length ||
          lanes.some((l) => l < 0 || l >= LANES) ||
          lanes.some((l, i) => i > 0 && l < lanes[i - 1]!),
      );

    expect(wrong).toEqual([]);
  });

  it("given forty seeds, when levels are made, then every stop has a road on to a stop that exists, except at the end", () => {
    const wrong = levels().flatMap((map) =>
      map.flatMap((row, index) => {
        const next = map[index + 1];
        return row.filter((stop) =>
          next
            ? stop.next.length === 0 ||
              stop.next.some((i) => i < 0 || i >= next.length)
            : stop.next.length > 0,
        );
      }),
    );

    expect(wrong).toEqual([]);
  });

  it("given forty seeds, when levels are made, then every stop past the first has a road in", () => {
    const unreached = levels().flatMap((map) =>
      map
        .slice(1)
        .flatMap((row, index) =>
          row.filter((_, i) => !map[index]!.some((s) => s.next.includes(i))),
        ),
    );

    expect(unreached).toEqual([]);
  });

  it("given forty seeds, when levels are made, then most stops lead to more than one", () => {
    const stops = levels().flatMap((map) => map.slice(0, -2).flat());

    const split = stops.filter((stop) => stop.next.length > 1).length;

    expect(split / stops.length).toBeGreaterThan(0.6);
  });

  it("given forty seeds, when levels are made, then finds are never in two rows running", () => {
    const running = levels().filter((map) => {
      const finds = map.map((row) => row.some(isFind));
      return finds.some((find, i) => i > 0 && find && finds[i - 1]);
    });

    expect(running).toEqual([]);
  });

  it("given forty seeds, when levels are made, then each has an ally, gear and training", () => {
    const wrong = levels().filter((map) => {
      const kinds = new Set(everything(map).map((e) => e.kind));
      return !kinds.has("ally") || !kinds.has("gear") || !kinds.has("training");
    });

    expect(wrong).toEqual([]);
  });

  it("given forty seeds, when levels are made, then each has an elite battle, none in the first half", () => {
    const wrong = levels().filter((map) => {
      const rows = map.flatMap((row, i) => (row.some(isElite) ? [i] : []));
      return rows.length === 0 || Math.min(...rows) < map.length / 2;
    });

    expect(wrong).toEqual([]);
  });

  it("given forty seeds, when levels are made, then every elite and boss battle is hard and drops gear", () => {
    const ranked = levels()
      .flatMap(everything)
      .filter((e) => e.kind === "battle" && e.rank !== "normal");

    const wrong = ranked.filter(
      (e) => e.kind === "battle" && (e.difficulty !== "hard" || !e.loot),
    );

    expect(wrong).toEqual([]);
  });

  it("given forty seeds, when levels are made, then no row has the same find twice", () => {
    const rows = levels().flat();

    const wrong = rows
      .map((row) => row.filter(isFind).map((s) => s.encounter.kind))
      .filter((kinds) => new Set(kinds).size !== kinds.length);

    expect(wrong).toEqual([]);
  });

  it("given forty seeds, when levels are made, then the travellers on each differ and none is in the party", () => {
    const wrong = SEEDS.filter((seed) => {
      const found = everything(level(seed)).flatMap((e) =>
        e.kind === "ally" ? [e.character.id] : [],
      );
      const party = startRun(library, seed).party.map((c) => c.id);
      return (
        new Set(found).size !== found.length ||
        found.some((id) => party.includes(id))
      );
    });

    expect(wrong).toEqual([]);
  });

  it("given forty seeds, when levels are made, then each gear find offers a choice of different gear that exists", () => {
    const known = new Set(startRun(library, 1).library.gear.map((g) => g.id));

    const wrong = levels()
      .flatMap(everything)
      .flatMap((e) => (e.kind === "gear" ? [e.gearIds] : []))
      .filter(
        (ids) =>
          ids.length < 2 ||
          ids.length > GEAR_CHOICES ||
          new Set(ids).size !== ids.length ||
          ids.some((id) => !known.has(id)),
      );

    expect(wrong).toEqual([]);
  });

  it("given forty seeds, when levels are made at depths 1 and 3, then the gear found deeper is better", () => {
    const tiers = (depth: number) =>
      SEEDS.flatMap((seed) => everything(level(seed, depth)))
        .flatMap((e) => (e.kind === "gear" ? e.gearIds : []))
        .map((id) => Number(/\+(\d)$/.exec(id)?.[1] ?? 0));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

    const shallow = tiers(1);
    const deep = tiers(3);

    expect(mean(deep)).toBeGreaterThan(mean(shallow) + 1);
    expect(Math.max(...shallow)).toBeLessThan(3);
  });
});

describe("travelling the map", () => {
  const stop = (encounter: Encounter, lane: number, next: number[]): Stop => ({
    encounter,
    lane,
    next,
  });
  // One battle, then three ways, then two battles, then one.
  const map: Stop[][] = [
    [stop(battle, 1, [0, 1, 2])],
    [stop(ally, 0, [0]), stop(training, 1, [0, 1]), stop(ring, 2, [1])],
    [stop(battle, 0, [0]), stop({ ...battle, seed: 9 }, 2, [0])],
    [stop(battle, 1, [])],
  ];
  const start: Run = { ...at([]), map, position: 0, path: [0] };
  const roadside = winBattle(start)!.run;

  it("given a new level, when the current stop is looked up, then it is the first stop", () => {
    const current = currentStop(start);

    expect(current).toBe(map[0]![0]);
  });

  it("given a new level, when the ways on are listed, then there are none to choose", () => {
    const ways = choices(start);

    expect(ways).toEqual([]);
  });

  it("given a won battle before a split, when the run moves on, then it waits at the roadside with every way open", () => {
    const run = winBattle(start)!.run;

    expect(run.position).toBe(1);
    expect(currentEncounter(run)).toBeNull();
    expect(levelCleared(run)).toBe(false);
    expect(choices(run)).toEqual([0, 1, 2]);
  });

  it("given the roadside, when a road is taken, then the party meets its stop", () => {
    const run = travel(roadside, 2);

    expect(currentEncounter(run)).toBe(ring);
    expect(run.path).toEqual([0, 2]);
    expect(choices(run)).toEqual([]);
  });

  it("given an ally whose road has one way on, when the ally is passed, then the party walks straight on", () => {
    const met = travel(roadside, 0);

    const run = resolveAlly(met, false);

    expect(run.path).toEqual([0, 0, 0]);
    expect(currentStop(run)).toBe(map[2]![0]);
  });

  it("given training whose road has two ways on, when it is passed, then both are offered", () => {
    const met = travel(roadside, 1);

    const run = resolveTraining(met, null);

    expect(choices(run)).toEqual([0, 1]);
  });

  it("given gear whose road has one way on, when it is passed, then the party takes it", () => {
    const met = travel(roadside, 2);

    const run = resolveGear(met, null, null);

    expect(run.path).toEqual([0, 2, 1]);
  });

  it("given the roadside, when a road that isn't there is taken, then nothing changes", () => {
    const run = travel(roadside, 3);

    expect(run).toBe(roadside);
  });

  it("given a battle still to fight, when a road is taken, then nothing changes", () => {
    const run = travel(start, 0);

    expect(run).toBe(start);
  });

  it("given a lost battle, when the ways on are listed, then there are none", () => {
    const lost = loseBattle(start);

    const ways = choices(lost);

    expect(ways).toEqual([]);
  });

  it("given a level walked through every stop, when the last is passed, then the level is cleared", () => {
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

  it("given three encounters, when a road is made of them, then it is a single road", () => {
    const road = roadOf([battle, ally, training]);

    expect(road.map((row) => row.length)).toEqual([1, 1, 1]);
    expect(road.map((row) => row[0]!.next)).toEqual([[0], [0], []]);
  });
});

describe("packFor", () => {
  const pool = monsterPool(startRun(library, 1));
  const packs = SEEDS.map((seed) => packFor(pool, seed));

  it("given one seed, when the pack is picked twice, then both are the same", () => {
    const first = packFor(pool, 3);

    const second = packFor(pool, 3);

    expect(second).toEqual(first);
  });

  it("given forty seeds, when packs are picked, then each holds one to the most kinds, all different", () => {
    const wrong = packs.filter(
      (pack) =>
        pack.length === 0 ||
        pack.length > MAX_PACK_KINDS ||
        new Set(pack).size !== pack.length,
    );

    expect(wrong).toEqual([]);
  });

  it("given forty seeds, when packs are picked, then every size up to the most kinds turns up", () => {
    const sizes = new Set(packs.map((pack) => pack.length));

    expect(sizes.size).toBe(MAX_PACK_KINDS);
  });

  it("given a pool with front-liners, when packs are picked, then each starts with one", () => {
    const wrong = packs.filter((pack) => isBackLiner(pack[0]!));

    expect(wrong).toEqual([]);
  });

  it("given forty seeds, when packs are picked, then every enemy is met", () => {
    const met = new Set(packs.flatMap((pack) => pack.map((d) => d.name)));

    expect(met.size).toBe(pool.length);
  });

  it("given a pool of one, when the pack is picked, then it is the whole pool", () => {
    const small = pool.slice(0, 1);

    const pack = packFor(small, 3);

    expect(pack).toEqual(small);
  });
});

describe("battleFor", () => {
  it("given a run at a battle, when the battle is set up, then the party faces a few kinds of the library's enemies", () => {
    const setup = battleFor(at([battle]))!;

    const names = (side: string) =>
      setup.placements.filter((p) => p.side === side).map((p) => p.def.name);
    expect(() => createBattle(setup, 1)).not.toThrow();
    expect(names("player").sort()).toEqual(["Aldric", "Mira"]);
    expect(names("enemy").length).toBeGreaterThan(0);
    expect(new Set(names("enemy")).size).toBeLessThanOrEqual(MAX_PACK_KINDS);
  });

  it.each([
    ["at an ally", at([ally])],
    ["after a defeat", at([battle], { defeated: true })],
    ["at no stop", at([])],
  ])(
    "given a run %s, when the battle is set up, then there is none",
    (_, run) => {
      const setup = battleFor(run);

      expect(setup).toBeNull();
    },
  );

  it("given a run, when the enemies of a higher rank are pooled, then they are stronger", () => {
    const run = at([battle]);

    const elite = monsterPool(run, 3);

    expect(elite[0]!.stats.maxHp).toBeGreaterThan(
      monsterPool(run)[0]!.stats.maxHp,
    );
  });

  it("given a run, when the threat of a hard and an easy battle is weighed, then they keep their shares", () => {
    const run = at([battle]);

    const ratio = threatBudget(run, "hard") / threatBudget(run, "easy");

    expect(ratio).toBeCloseTo(BUDGET_SHARE.hard / BUDGET_SHARE.easy);
  });

  it("given a stronger party, when the threat of a battle is weighed, then it is bigger", () => {
    const run = at([battle]);
    const veterans = {
      ...run,
      party: run.party.map((c) => ({ ...c, level: 10 })),
    };

    const budget = threatBudget(veterans, "easy");

    expect(budget).toBeGreaterThan(threatBudget(run, "easy"));
  });
});

describe("threatBudget and depth", () => {
  const run = at([battle]);
  const base = threatBudget(run, "normal");

  it.each([
    [2, 1 + DEPTH_GROWTH],
    [5, 1 + 4 * DEPTH_GROWTH],
  ])(
    "given depth %i, when the threat is weighed, then it is %d times the first level's",
    (depth, share) => {
      const budget = threatBudget({ ...run, depth }, "normal");

      expect(budget / base).toBeCloseTo(share);
    },
  );
});

describe("monsterPool", () => {
  const run = at([battle], {
    party: pair(library).map((c) => ({ ...c, level: START_LEVEL })),
  });
  const later = {
    ...run,
    depth: 2,
    party: run.party.map((c) => ({ ...c, level: c.level + 3 })),
  };

  it("given a party at the start level on the first level, when the enemy level bonus is worked out, then it is 0", () => {
    const bonus = enemyLevelBonus(run);

    expect(bonus).toBe(0);
  });

  it("given a party three levels up, one level deeper, when the enemy level bonus is worked out, then it is 4", () => {
    const bonus = enemyLevelBonus(later);

    expect(bonus).toBe(4);
  });

  it("given a stronger party deeper in, when the enemies are pooled, then they have more HP and threat", () => {
    const [first] = monsterPool(later);

    expect(first!.stats.maxHp).toBeGreaterThan(
      monsterPool(run)[0]!.stats.maxHp,
    );
    expect(first!.threat!).toBeGreaterThan(monsterPool(run)[0]!.threat!);
  });

  it("given a library with no enemies, when the enemies are pooled, then they are melee's monsters", () => {
    const classes = new Set(
      run.library.archetypes.filter((a) => a.kind === "class").map((a) => a.id),
    );
    const noEnemies = {
      ...run.library,
      characters: run.library.characters.filter((c) =>
        classes.has(c.archetypeId),
      ),
    };

    const pool = monsterPool({ ...run, library: noEnemies });

    expect(pool).toBe(content.monsters);
  });
});

describe("winBattle", () => {
  it("given a battle, when it is won, then every member gains the battle's XP and the run moves on", () => {
    const run = at([battle, ally]);

    const { run: after, reward } = winBattle(run)!;

    expect(reward.xp).toBe(xpFor(battleFor(run)!, 2));
    expect(reward.xp).toBeGreaterThan(0);
    expect(after.position).toBe(1);
    const progress = (c: { level: number; xp: number }) => c.level * 1e6 + c.xp;
    const behind = after.party.filter(
      (member, i) => progress(member) <= progress(run.party[i]!),
    );
    expect(behind).toEqual([]);
  });

  it("given a party a point short of a level, when the battle is won, then the reward names who levelled up", () => {
    const nearly = at([battle]);
    nearly.party = nearly.party.map((c) => ({ ...c, xp: 299 }));

    const { reward } = winBattle(nearly)!;

    expect(reward.levelUps).toEqual([
      { name: "Aldric", level: 4 },
      { name: "Mira", level: 4 },
    ]);
  });

  it("given a battle that drops gear, when it is won, then the gear is in the bag", () => {
    const run = at([{ ...battle, loot: "accessory-ring" }]);

    const { run: after, reward } = winBattle(run)!;

    expect(reward.loot?.name).toBe("Swift Ring");
    expect(after.bag).toEqual(["accessory-ring"]);
  });

  it("given a battle that drops nothing, when it is won, then there is no loot", () => {
    const { reward } = winBattle(at([battle]))!;

    expect(reward.loot).toBeUndefined();
  });

  it("given a battle, when its XP is shared over four, then each gets less than over two", () => {
    const setup = battleFor(at([battle]))!;

    const shared = xpFor(setup, 4);

    expect(shared).toBeLessThan(xpFor(setup, 2));
  });

  it("given a run at an ally, when a battle is won, then there is nothing to win", () => {
    const won = winBattle(at([ally]));

    expect(won).toBeNull();
  });
});

describe("committing to a battle", () => {
  it("given a battle the party hasn't acted in, when it is left, then nothing changes", () => {
    const run = at([battle]);

    const left = leaveBattle(run);

    expect(left).toBe(run);
  });

  it("given a battle, when the party commits to it, then the run is committed", () => {
    const committed = commitBattle(at([battle]));

    expect(committed.committed).toBe(true);
  });

  it("given a committed battle, when it is left, then the run ends where it stands", () => {
    const committed = commitBattle(at([battle]));

    const left = leaveBattle(committed);

    expect(left).toMatchObject({
      defeated: true,
      committed: false,
      position: 0,
    });
  });

  it("given a committed battle, when gear is changed, then nothing changes", () => {
    const committed = commitBattle(at([battle], { bag: ["accessory-ring"] }));

    const changed = changeGear(
      committed,
      ALDRIC,
      "accessory",
      "accessory-ring",
    );

    expect(changed).toBe(committed);
  });

  it("given a committed battle, when it is won, then the run is no longer committed", () => {
    const committed = commitBattle(at([battle, battle]));

    const { run } = winBattle(committed)!;

    expect(run.committed).toBe(false);
  });

  it("given a committed battle, when it is lost, then the run is no longer committed", () => {
    const committed = commitBattle(at([battle]));

    const lost = loseBattle(committed);

    expect(lost.committed).toBe(false);
  });

  it("given a run at an ally, when the party commits, then nothing changes", () => {
    const meeting = at([ally]);

    const committed = commitBattle(meeting);

    expect(committed).toBe(meeting);
  });

  it("given a committed battle, when the party commits again, then nothing changes", () => {
    const committed = commitBattle(at([battle]));

    const again = commitBattle(committed);

    expect(again).toBe(committed);
  });

  it("given a committed battle, when the run is saved and parsed, then it is still committed", () => {
    const committed = commitBattle(at([battle]));

    const back = parseRun(JSON.stringify(committed));

    expect(back?.committed).toBe(true);
  });

  it("given one encounter on two runs, when its seed is taken, then it is the same", () => {
    const run = at([battle, { ...battle, seed: 6 }]);

    const seed = battleSeed(run);

    expect(seed).toBe(battleSeed(at([battle])));
  });

  it("given two encounters, when their seeds are taken, then they differ", () => {
    const run = at([battle, { ...battle, seed: 6 }]);

    const seed = battleSeed({ ...run, position: 1 });

    expect(seed).not.toBe(battleSeed(run));
  });
});

describe("loseBattle", () => {
  it("given a battle, when it is lost, then the run ends where it stands, the level not cleared", () => {
    const lost = loseBattle(at([battle]));

    expect(lost).toMatchObject({ defeated: true, position: 0 });
    expect(levelCleared(lost)).toBe(false);
  });
});

describe("resolveAlly", () => {
  const fullParty = (run: Run) => ({
    ...run,
    party: Array.from({ length: MAX_PARTY_SIZE }, (_, i) => ({
      ...run.party[0]!,
      id: `m${i}`,
      level: 4 + i,
    })),
  });

  it("given an ally, when they are recruited, then they join at the party's lowest level and the run moves on", () => {
    const run = resolveAlly(at([ally]), true);

    expect(run.position).toBe(1);
    expect(run.party.at(-1)).toMatchObject({ name: "Nell", level: 3, xp: 0 });
  });

  it("given an ally, when they are declined, then the party is unchanged", () => {
    const run = resolveAlly(at([ally]), false);

    expect(run.party).toHaveLength(2);
  });

  it("given a full party, when recruiting is checked, then it isn't possible", () => {
    const full = fullParty(at([ally]));

    const can = canRecruit(full);

    expect(can).toBe(false);
  });

  it("given a full party, when an ally is recruited with no one leaving, then the party is unchanged and the run moves on", () => {
    const full = fullParty(at([ally]));

    const after = resolveAlly(full, true);

    expect(after.party.map((c) => c.id)).toEqual(full.party.map((c) => c.id));
    expect(after.position).toBe(1);
  });

  it("given a run at a battle, when an ally is recruited, then nothing changes", () => {
    const run = at([battle]);

    const after = resolveAlly(run, true);

    expect(after).toBe(run);
  });

  it("given a run at a battle, when the recruit is looked up, then there is none", () => {
    const recruit = recruitOf(at([battle]));

    expect(recruit).toBeNull();
  });

  it("given an ally in their kit, when they are recruited, then they bring it along", () => {
    const kit = recruitOf(at([ally]))!.gear;

    const run = resolveAlly(at([ally]), true);

    expect(kit.armour).toBeDefined();
    expect(run.party.at(-1)!.gear).toEqual(kit);
  });

  it("given a full party, when an ally takes a member's place, then they stand where the member stood, at the lowest level of those staying, and the member's gear goes in the bag", () => {
    const full = fullParty(at([ally]));
    const leaving = full.party[2]!;
    const cell = formationOf(full)[leaving.id];

    const after = resolveAlly(full, true, leaving.id);

    expect(after.party.map((c) => c.id)).toEqual([
      "m0",
      "m1",
      "new",
      "m3",
      "m4",
    ]);
    expect(after.party[2]).toMatchObject({ name: "Nell", level: 4 });
    expect(formationOf(after)["new"]).toEqual(cell);
    expect(after.bag).toEqual([
      ...full.bag,
      ...Object.values(leaving.gear).filter((id) => id !== undefined),
    ]);
    expect(after.position).toBe(1);
  });

  it("given room in the party, when an ally replaces a member, then they join and the member stays", () => {
    const run = at([ally]);

    const after = resolveAlly(run, true, run.party[0]!.id);

    expect(after.party.map((c) => c.id)).toEqual([
      ...run.party.map((c) => c.id),
      "new",
    ]);
  });

  it("given room in the party, when an ally replaces a stranger, then they just join", () => {
    const after = resolveAlly(at([ally]), true, "nobody");

    expect(after.party).toHaveLength(3);
  });
});

describe("resolveGear", () => {
  it("given gear on offer, when a piece is taken for no one, then it goes in the bag and the run moves on", () => {
    const run = resolveGear(at([ring]), "accessory-ring", null);

    expect(run.bag).toEqual(["accessory-ring"]);
    expect(run.position).toBe(1);
  });

  it("given gear on offer, when a piece is taken for a member, then they wear it and their old gear goes in the bag", () => {
    const run = resolveGear(at([ring]), "weapon-spear", ALDRIC);

    expect(run.party[0]!.gear.weapon).toBe("weapon-spear");
    expect(run.bag).toEqual(["weapon-sword"]);
  });

  it("given a knight, when a bow is taken for them, then it goes in the bag instead", () => {
    // A knight takes blades and polearms, not bows.
    const run = resolveGear(at([ring]), "weapon-bow", ALDRIC);

    expect(run.party[0]!.gear.weapon).toBe("weapon-sword");
    expect(run.bag).toEqual(["weapon-bow"]);
  });

  it.each([
    ["no piece", null],
    ["a piece not on offer", "armour-mail"],
  ])(
    "given gear on offer, when %s is taken, then the run moves on with nothing",
    (_, id) => {
      const run = resolveGear(at([ring]), id, ALDRIC);

      expect(run.bag).toEqual([]);
      expect(run.position).toBe(1);
    },
  );

  it("given a run at a battle, when gear is taken, then nothing changes", () => {
    const run = at([battle]);

    const after = resolveGear(run, "accessory-ring", null);

    expect(after).toBe(run);
  });
});

describe("resolveTraining", () => {
  it("given training, when a member is trained, then they gain a level and the run moves on", () => {
    const run = resolveTraining(at([training]), MIRA);

    expect(run.party.map((c) => c.level)).toEqual([3, 4]);
    expect(run.position).toBe(1);
  });

  it("given training, when no one is trained, then the run moves on with the levels unchanged", () => {
    const run = resolveTraining(at([training]), null);

    expect(run.party.map((c) => c.level)).toEqual([3, 3]);
    expect(run.position).toBe(1);
  });

  it("given a run at a battle, when a member is trained, then nothing changes", () => {
    const run = at([battle]);

    const after = resolveTraining(run, ALDRIC);

    expect(after).toBe(run);
  });
});

describe("changeGear", () => {
  const run = at([battle], {
    bag: ["accessory-ring", "weapon-spear", "weapon-bow", "armour-plate"],
  });

  it("given a spear in the bag, when a knight wields it, then their sword goes in the bag", () => {
    const after = changeGear(run, ALDRIC, "weapon", "weapon-spear");

    expect(after.party[0]!.gear.weapon).toBe("weapon-spear");
    expect(after.bag.sort()).toEqual([
      "accessory-ring",
      "armour-plate",
      "weapon-bow",
      "weapon-sword",
    ]);
  });

  it("given a ring in the bag, when a sage wears it, then it is worn, as accessories fit anyone", () => {
    const after = changeGear(run, MIRA, "accessory", "accessory-ring");

    expect(after.party[1]!.gear.accessory).toBe("accessory-ring");
  });

  it("given worn armour, when the slot is emptied, then the armour goes in the bag", () => {
    const after = changeGear(run, ALDRIC, "armour", null);

    expect(after.party[0]!.gear.armour).toBeUndefined();
    expect(after.bag).toContain("armour-mail");
  });

  it.each([
    ["a bow for a knight", ALDRIC, "weapon", "weapon-bow"],
    ["plate for a sage", MIRA, "armour", "armour-plate"],
    ["gear not in the bag", ALDRIC, "weapon", "weapon-staff"],
    ["gear for another slot", ALDRIC, "armour", "accessory-ring"],
    ["gear for a stranger", "nobody", "accessory", "accessory-ring"],
  ] as const)(
    "given %s, when it is put on, then nothing changes",
    (_, member, slot, id) => {
      const after = changeGear(run, member, slot, id);

      expect(after).toBe(run);
    },
  );

  it("given two rings in the bag, when one is worn, then the other stays", () => {
    const two = at([battle], { bag: ["accessory-ring", "accessory-ring"] });

    const after = changeGear(two, ALDRIC, "accessory", "accessory-ring");

    expect(after.bag).toEqual(["accessory-ring"]);
  });
});

describe("nextLevel", () => {
  it("given a cleared level, when the run goes on, then it starts the next level deeper with the party and bag", () => {
    const done = at([battle], { position: 1, bag: ["accessory-ring"] });

    const next = nextLevel(done);

    expect(levelCleared(done)).toBe(true);
    expect(next).toMatchObject({
      depth: 2,
      position: 0,
      bag: ["accessory-ring"],
    });
    expect(next.party).toBe(done.party);
    expect(next.map.length).toBeGreaterThanOrEqual(MIN_LEVEL_LENGTH);
    expect(next.path).toEqual([0]);
  });

  it("given a level not yet cleared, when the run goes on, then nothing changes", () => {
    const run = at([battle]);

    const next = nextLevel(run);

    expect(next).toBe(run);
  });
});

describe("parseRun", () => {
  const run = startRun(library, 9);

  it("given a run with a battle won, when it is saved and parsed, then it reads back unchanged", () => {
    const won = winBattle(run)!.run;

    const back = parseRun(JSON.stringify(won));

    expect(back).toEqual(won);
  });

  it.each([
    ["nothing", null],
    ["broken JSON", "{"],
    ["a number", "3"],
    ["an old version", JSON.stringify({ ...run, version: 1 })],
    ["a path that isn't a list", JSON.stringify({ ...run, path: "0" })],
    [
      "an unknown encounter",
      JSON.stringify({ ...run, map: roadOf([{ kind: "shop" } as never]) }),
    ],
  ])("given %s, when it is parsed, then there is no run", (_, text) => {
    const back = parseRun(text);

    expect(back).toBeNull();
  });
});

describe("a whole level", () => {
  // One test walks the level: each step depends on the one before.
  it("given a new run, when every stop is passed on the first road, recruiting and taking all, then the party grows and the next level is deeper", () => {
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
