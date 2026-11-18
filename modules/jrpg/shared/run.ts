import {
  basicGear,
  blankCharacter,
  canWear,
  clampLevel,
  equip,
  gainXp,
  parseLibrary,
  starterKit,
  starterLibrary,
  toCombatantDef,
  unequip,
  type Character,
  type Gear,
  type GearSlot,
  type Library,
} from "@jforge/char/shared";
import {
  MAX_PARTY_SIZE,
  SAVE_VERSION,
  content,
  createRandom,
  estimateThreat,
  isBackLiner,
  randomEncounter,
  type BattleSetup,
  type CombatantDef,
  type Difficulty,
  type Placement,
  type Position,
} from "@jforge/melee/shared";
import { formationOf } from "./formation";
import { GEAR_TIERS, TRAVELLER_NAMES, tierId, withWorld } from "./world";

// A run: the party travels through levels, each a map of encounters
// generated from a seed, row by row along roads that split and merge. Everything here is pure; the screens
// only show a run and call these functions.

/** An ordinary fight, a tougher one mid-level, or the level's last. */
export type BattleRank = "normal" | "elite" | "boss";

export type Encounter =
  | {
      kind: "battle";
      difficulty: Difficulty;
      /** Seed of the encounter (who the enemies are and where they stand). */
      seed: number;
      rank: BattleRank;
      /** Gear the enemies drop, if any. */
      loot?: string;
    }
  | { kind: "ally"; character: Character }
  /** Gear lying about: take one piece of these. */
  | { kind: "gear"; gearIds: string[] }
  /** A place to train: one member gains a level. */
  | { kind: "training" };

/** A place on the level's map. */
export interface Stop {
  encounter: Encounter;
  /** Which of the LANES roads it lies on, for drawing the map. */
  lane: number;
  /** The stops of the next row its road leads to, by their index there. */
  next: number[];
}

export interface Run {
  version: typeof SAVE_VERSION;
  seed: number;
  /** The level the party is on, from 1. Enemies grow with it. */
  depth: number;
  /** The party's average level when it set out; enemies keep pace from it. */
  baseLevel: number;
  /** What the run is made of, copied at the start so edits don't break it. */
  library: Library;
  party: Character[];
  /** Gear ids nobody wears. */
  bag: string[];
  /** The level's map: rows of stops, travelled first row to last. */
  map: Stop[][];
  /**
   * The row the party is at; past the last, the level is cleared. It
   * stands at a stop once `path` names one for this row; until then it is
   * at the roadside, choosing where to go.
   */
  position: number;
  /** The stop taken in each row so far, by its index in the row. */
  path: number[];
  defeated: boolean;
  /**
   * The party has acted in the battle it stands at. From then on there is
   * no walking away: the fight is won, lost, or given up (which loses).
   */
  committed?: boolean;
  /** Where the player put party members, by character id (formation.ts). */
  formation?: Record<string, Position>;
}

/** What a won battle paid. */
export interface Reward {
  /** Experience each party member gained. */
  xp: number;
  levelUps: { name: string; level: number }[];
  loot?: Gear;
}

/** Roads side by side on the map. */
export const LANES = 3;
/** A level is this long, give or take: MIN to MIN + SPREAD rows. */
export const MIN_LEVEL_LENGTH = 12;
export const LEVEL_LENGTH_SPREAD = 3;
/** Pieces to choose from where gear lies about. */
export const GEAR_CHOICES = 3;
/** Kinds of enemy in one battle, at most. */
export const MAX_PACK_KINDS = 3;
/** Levels the enemies of a tougher battle have on ordinary ones. */
export const RANK_LEVELS: Record<BattleRank, number> = {
  normal: 0,
  elite: 2,
  boss: 3,
};
export const START_PARTY_SIZE = 2;
/** The lowest level a party sets out at. */
export const START_LEVEL = 3;
/** Chance that an ordinary battle drops gear; elites and the last always do. */
export const LOOT_CHANCE = 0.4;
/** Experience per point of enemy threat, shared out over the party. */
export const XP_PER_THREAT = 40;
/** Levels every enemy gains per level of the run after the first. */
export const ENEMY_LEVELS_PER_DEPTH = 1;
/**
 * The enemies' total threat as a share of the party's own estimated
 * threat, so encounters keep pace with levels, gear and party size.
 */
export const BUDGET_SHARE: Record<Difficulty, number> = {
  easy: 0.6,
  normal: 0.8,
  hard: 0.9,
};

/** Every level deeper, the enemies' share grows by this much of itself. */
export const DEPTH_GROWTH = 0.06;

const isClass = (library: Library, character: Character) =>
  library.archetypes.some(
    (a) => a.id === character.archetypeId && a.kind === "class",
  );

const averageLevel = (party: Character[]) =>
  Math.round(party.reduce((sum, c) => sum + c.level, 0) / party.length);

/** The designs a run starts from: `library`, or the starter library. */
export function runLibrary(library: Library | null): Library {
  return library ?? starterLibrary();
}

/** Everyone who could set out: every class character of the run's world. */
export function heroes(source: Library | null): Character[] {
  const world = withWorld(runLibrary(source), 1);
  return world.characters.filter((c) => isClass(world, c));
}

/** START_PARTY_SIZE heroes drawn by the seed: who sets out if nobody chooses. */
export function drawParty(source: Library | null, seed: number): Character[] {
  const random = createRandom(seed ^ 0x9a27);
  const left = heroes(source);
  const drawn: Character[] = [];
  while (left.length > 0 && drawn.length < START_PARTY_SIZE) {
    drawn.push(left.splice(Math.floor(random() * left.length), 1)[0]!);
  }
  return drawn;
}

/**
 * A new run. The party is the heroes `chosen` by id (unknown ids and
 * repeats are skipped, at most START_PARTY_SIZE), or drawn by the seed if
 * none are, all raised to the level of the highest among them
 * (START_LEVEL at least).
 */
export function startRun(
  source: Library | null,
  seed: number,
  chosen: string[] = [],
): Run {
  const all = heroes(source);
  const picked = [...new Set(chosen)]
    .map((id) => all.find((c) => c.id === id))
    .filter((c): c is Character => !!c)
    .slice(0, START_PARTY_SIZE);
  const drawn = picked.length > 0 ? picked : drawParty(source, seed);
  const baseLevel = Math.max(START_LEVEL, ...drawn.map((c) => c.level));
  const party = drawn.map((c) =>
    c.level >= baseLevel ? c : { ...c, level: baseLevel, xp: 0 },
  );
  const library = withWorld(runLibrary(source), baseLevel);
  return {
    version: SAVE_VERSION,
    seed,
    depth: 1,
    baseLevel,
    library,
    party,
    bag: [],
    map: generateLevel(library, party, seed, 1),
    position: 0,
    path: [0],
    defeated: false,
  };
}

type Find = "ally" | "gear" | "training";
const FINDS: Find[] = ["ally", "gear", "training"];
/** Rows that offer finds, at most; never two such rows in a row. */
const FIND_ROWS = 6;
/** Chance that a battle row past the middle has a tougher fight on it. */
const ELITE_CHANCE = 0.35;

/**
 * A level's map. It starts at one easy battle and ends at one hard last
 * one; in between each row has two or three stops on roads that lead to
 * the neighbouring stops of the next row. Rows are either all battles
 * (past the middle, sometimes with a tougher one that is sure to drop
 * gear) or offer finds: an ally, gear, training, each on a different road
 * and sometimes beside a battle. Find rows never follow each other. The
 * same seed and depth give the same map.
 */
export function generateLevel(
  library: Library,
  party: Character[],
  seed: number,
  depth: number,
): Stop[][] {
  const random = createRandom(seed + depth * 7919);
  const roll = (n: number) => Math.floor(random() * n);
  const pick = <T>(items: readonly T[]): T => items[roll(items.length)]!;
  const take = <T>(items: T[]): T => items.splice(roll(items.length), 1)[0]!;
  const length = MIN_LEVEL_LENGTH + roll(LEVEL_LENGTH_SPREAD + 1);

  // Gear is stored at every tier; the plain pieces are the ones to draw,
  // except the basic gear heroes set out in.
  const basic = new Set(basicGear().map((g) => g.id));
  const plain = library.gear.filter(
    (g) => !/\+\d$/.test(g.id) && !basic.has(g.id),
  );
  const has = new Set(library.gear.map((g) => g.id));
  const gearId = (): string => {
    const base = pick(plain).id;
    const luck = random();
    const tier = Math.min(
      GEAR_TIERS.length - 1,
      depth - 1 + (luck < 0.7 ? 0 : luck < 0.95 ? 1 : 2),
    );
    const id = tierId(base, tier);
    return has.has(id) ? id : base;
  };

  const offered = new Set(party.map((c) => c.id));
  const names = new Set(library.characters.map((c) => c.name));
  const classes = library.archetypes.filter((a) => a.kind === "class");
  let fresh = 0;
  const ally = (): Encounter => {
    const known = library.characters.filter(
      (c) => isClass(library, c) && !offered.has(c.id),
    );
    let character: Character;
    if (known.length > 0) character = pick(known);
    else {
      const unused = TRAVELLER_NAMES.filter((n) => !names.has(n));
      const type = pick(classes);
      character = {
        ...blankCharacter(`ally-${depth}-${++fresh}`, type),
        name: unused.length > 0 ? pick(unused) : type.name,
      };
      names.add(character.name);
    }
    offered.add(character.id);
    return { kind: "ally", character };
  };
  const gear = (): Encounter => {
    const gearIds: string[] = [];
    for (
      let i = 0;
      i < GEAR_CHOICES * 3 && gearIds.length < GEAR_CHOICES;
      i++
    ) {
      const id = gearId();
      if (!gearIds.includes(id)) gearIds.push(id);
    }
    return { kind: "gear", gearIds };
  };
  const battle = (rank: BattleRank, early: boolean): Encounter => {
    const seedHere = roll(1_000_000);
    const drops =
      plain.length > 0 && (random() < LOOT_CHANCE || rank !== "normal");
    return {
      kind: "battle",
      difficulty: rank !== "normal" ? "hard" : early ? "easy" : "normal",
      seed: seedHere,
      rank,
      ...(drops ? { loot: gearId() } : {}),
    };
  };
  const found = (kind: Find): Encounter => {
    if (kind === "ally") return ally();
    if (kind === "gear" && plain.length > 0) return gear();
    return { kind: "training" };
  };

  // Which rows offer finds: between the first and the last, never two
  // in a row.
  const findRows = new Set<number>();
  const open = Array.from({ length: length - 2 }, (_, i) => i + 1);
  while (open.length > 0 && findRows.size < FIND_ROWS) {
    const at = take(open);
    if (!findRows.has(at - 1) && !findRows.has(at + 1)) findRows.add(at);
  }
  // One battle row past the middle is sure to have a tougher fight.
  const later = Array.from({ length }, (_, i) => i).filter(
    (i) => i >= length / 2 && i < length - 1 && !findRows.has(i),
  );
  const eliteRow = later.length > 0 ? pick(later) : -1;

  // Every find comes up before any comes up again.
  let finds: Find[] = [];
  const nextFind = (not: Find[]): Find => {
    if (finds.every((f) => not.includes(f))) finds = [...finds, ...FINDS];
    const fresh = finds.filter((f) => !not.includes(f));
    const find = pick(fresh);
    finds.splice(finds.indexOf(find), 1);
    return find;
  };

  const rows = Array.from({ length }, (_, index): Stop[] => {
    const stop = (encounter: Encounter, lane: number): Stop => ({
      encounter,
      lane,
      next: [],
    });
    const middle = Math.floor(LANES / 2);
    if (index === 0) return [stop(battle("normal", true), middle)];
    if (index === length - 1) return [stop(battle("boss", false), middle)];
    const lanes = Array.from({ length: LANES }, (_, lane) => lane);
    if (random() < 0.5) take(lanes);
    const early = index < length / 3;
    if (findRows.has(index)) {
      // Finds on all roads, or a battle on one of them.
      const fight = random() < 0.5 ? pick(lanes) : -1;
      // A different find on every road of the row.
      const here: Find[] = [];
      return lanes.map((lane) => {
        if (lane === fight) return stop(battle("normal", early), lane);
        const find = nextFind(here);
        here.push(find);
        return stop(found(find), lane);
      });
    }
    const elite =
      index === eliteRow || (index >= length / 2 && random() < ELITE_CHANCE)
        ? pick(lanes)
        : -1;
    return lanes.map((lane) =>
      stop(battle(lane === elite ? "elite" : "normal", early), lane),
    );
  });

  // Roads lead to the neighbouring lanes of the next row; every stop has
  // a way on and a way in.
  for (let index = 0; index < length - 1; index++) {
    const here = rows[index]!;
    const there = rows[index + 1]!;
    const nearest = (lane: number, stops: Stop[]) =>
      stops.reduce(
        (best, s, i) =>
          Math.abs(s.lane - lane) < Math.abs(stops[best]!.lane - lane)
            ? i
            : best,
        0,
      );
    for (const from of here) {
      from.next = there.flatMap((to, i) =>
        here.length === 1 ||
        there.length === 1 ||
        Math.abs(to.lane - from.lane) <= 1
          ? [i]
          : [],
      );
      if (from.next.length === 0) from.next = [nearest(from.lane, there)];
    }
    there.forEach((to, i) => {
      if (here.some((from) => from.next.includes(i))) return;
      const from = here[nearest(to.lane, here)]!;
      from.next = [...from.next, i].sort((a, b) => a - b);
    });
  }
  return rows;
}

/** A map with no choices: these encounters one after another. */
export function roadOf(encounters: Encounter[]): Stop[][] {
  return encounters.map((encounter, i) => [
    { encounter, lane: 0, next: i < encounters.length - 1 ? [0] : [] },
  ]);
}

/** The stop the party stands at; null at the roadside or past the end. */
export function currentStop(run: Run): Stop | null {
  const at = run.path[run.position];
  return at === undefined ? null : (run.map[run.position]?.[at] ?? null);
}

/**
 * Where the party can go from the roadside: stops of the row it is at, by
 * index. Empty while it stands at a stop, and when the level is cleared.
 */
export function choices(run: Run): number[] {
  const row = run.map[run.position];
  if (run.defeated || !row || run.path.length > run.position) return [];
  if (run.position === 0) return row.map((_, i) => i);
  const from = run.map[run.position - 1]?.[run.path[run.position - 1]!];
  return (from?.next ?? []).filter((i) => i < row.length);
}

/** The party takes the road to stop `index` of the row it is at. */
export function travel(run: Run, index: number): Run {
  if (!choices(run).includes(index)) return run;
  return { ...run, path: [...run.path.slice(0, run.position), index] };
}

/**
 * Past the stop the party stood at, to the roadside of the next row; with
 * only one way on, straight to that stop.
 */
function moveOn(run: Run): Run {
  const onward: Run = { ...run, position: run.position + 1 };
  const ways = choices(onward);
  return ways.length === 1 ? travel(onward, ways[0]!) : onward;
}

export function currentEncounter(run: Run): Encounter | null {
  return currentStop(run)?.encounter ?? null;
}

export function levelCleared(run: Run): boolean {
  return !run.defeated && run.position >= run.map.length;
}

export function gearOf(run: Run, id: string | undefined): Gear | undefined {
  return run.library.gear.find((g) => g.id === id);
}

/** The party as melee fights with it. */
export function partyDefs(run: Run): CombatantDef[] {
  return run.party.flatMap((c) => toCombatantDef(run.library, c) ?? []);
}

/** Levels the enemies have gained: the party's own, plus the depth's. */
export function enemyLevelBonus(run: Run): number {
  const gained = Math.max(0, averageLevel(run.party) - run.baseLevel);
  return gained + ENEMY_LEVELS_PER_DEPTH * (run.depth - 1);
}

/**
 * Who the party can meet: the library's enemies, levelled up as the party
 * and the run's depth grow, or melee's own monsters when none were
 * designed.
 */
export function monsterPool(run: Run, tougher = 0): CombatantDef[] {
  const extra = enemyLevelBonus(run) + tougher;
  const designed = run.library.characters
    .filter((c) => !isClass(run.library, c))
    .flatMap(
      (c) =>
        toCombatantDef(run.library, { ...c, level: c.level + extra }) ?? [],
    );
  return designed.length > 0 ? designed : content.monsters;
}

/**
 * The enemies' threat budget for a battle of this difficulty: a share of
 * the party's threat that grows with the run's depth.
 */
export function threatBudget(run: Run, difficulty: Difficulty): number {
  const party = partyDefs(run).reduce((sum, d) => sum + estimateThreat(d), 0);
  const deeper = 1 + DEPTH_GROWTH * (run.depth - 1);
  return party * BUDGET_SHARE[difficulty] * deeper;
}

/**
 * The kinds of enemy in the battle with this seed: up to MAX_PACK_KINDS
 * of the pool, so one battle is wolves and vipers, the next a golem. The
 * first is a front-liner when the pool has one, so back-liners always have
 * a line to stand behind.
 */
export function packFor(pool: CombatantDef[], seed: number): CombatantDef[] {
  const random = createRandom(seed ^ 0x5eed);
  const left = [...pool];
  const kinds = 1 + Math.floor(random() * MAX_PACK_KINDS);
  const pack: CombatantDef[] = [];
  const take = (from: CombatantDef[]) => {
    const def = from[Math.floor(random() * from.length)]!;
    left.splice(left.indexOf(def), 1);
    pack.push(def);
  };
  const front = left.filter((def) => !isBackLiner(def));
  if (front.length > 0) take(front);
  while (left.length > 0 && pack.length < kinds) take(left);
  return pack;
}

/** The battle at the party's position; null when it isn't one. */
export function battleFor(run: Run): BattleSetup | null {
  const encounter = currentEncounter(run);
  if (run.defeated || encounter?.kind !== "battle") return null;
  const pool = monsterPool(run, RANK_LEVELS[encounter.rank]);
  const drawn = randomEncounter(
    encounter.seed,
    encounter.difficulty,
    { party: [], monsters: packFor(pool, encounter.seed) },
    threatBudget(run, encounter.difficulty),
  );
  // The enemies stand where the seed puts them, the party in formation.
  const cells = formationOf(run);
  const party = run.party.flatMap((member): Placement[] => {
    const def = toCombatantDef(run.library, member);
    return def ? [{ def, side: "player", position: cells[member.id]! }] : [];
  });
  return { placements: [...party, ...drawn.placements] };
}

/**
 * The seed the battle at the party's position is fought with. Fixed per
 * encounter, so coming back to a fight never rerolls its luck.
 */
export function battleSeed(run: Run): number {
  const encounter = currentEncounter(run);
  return encounter?.kind === "battle" ? encounter.seed ^ 0xba77 : 0;
}

/** The party gives its first command in the battle it stands at. */
export function commitBattle(run: Run): Run {
  return battleFor(run) && !run.committed ? { ...run, committed: true } : run;
}

/**
 * Leaving a battle: free before the party has acted, the end of the run
 * after.
 */
export function leaveBattle(run: Run): Run {
  return run.committed ? loseBattle(run) : run;
}

/** Experience each member gets for beating the enemies of `setup`. */
export function xpFor(setup: BattleSetup, partySize: number): number {
  const threat = setup.placements
    .filter((p) => p.side === "enemy")
    .reduce((sum, p) => sum + (p.def.threat ?? 1), 0);
  return Math.round((XP_PER_THREAT * threat) / Math.max(1, partySize));
}

/** The battle is won: everyone gains experience, loot goes in the bag. */
export function winBattle(run: Run): { run: Run; reward: Reward } | null {
  const encounter = currentEncounter(run);
  const setup = battleFor(run);
  if (encounter?.kind !== "battle" || !setup) return null;
  const xp = xpFor(setup, run.party.length);
  const levelUps: Reward["levelUps"] = [];
  const party = run.party.map((c) => {
    const grown = { ...c, ...gainXp(c, xp) };
    if (grown.level > c.level) {
      levelUps.push({ name: c.name, level: grown.level });
    }
    return grown;
  });
  const loot = gearOf(run, encounter.loot);
  return {
    run: moveOn({
      ...run,
      party,
      bag: loot ? [...run.bag, loot.id] : run.bag,
      committed: false,
    }),
    reward: { xp, levelUps, ...(loot ? { loot } : {}) },
  };
}

/** The battle is lost (or drawn): the run ends here. */
export function loseBattle(run: Run): Run {
  return { ...run, defeated: true, committed: false };
}

export function canRecruit(run: Run): boolean {
  return run.party.length < MAX_PARTY_SIZE;
}

/** The traveller met here as they would join: in their starting kit. */
export function recruitOf(run: Run): Character | null {
  const encounter = currentEncounter(run);
  return encounter?.kind === "ally"
    ? starterKit(run.library, encounter.character)
    : null;
}

/**
 * Leaves an ally encounter. A recruit joins in their starting kit, at the
 * level of the party's weakest member if that is higher than its own. Only
 * if the party is full, the recruit can take the place of `replaceId`: that
 * member leaves, their gear goes in the bag and the recruit stands where
 * they stood.
 */
export function resolveAlly(
  run: Run,
  recruit: boolean,
  replaceId?: string,
): Run {
  const ally = recruitOf(run);
  if (run.defeated || !ally) return run;
  const next = moveOn(run);
  if (!recruit) return next;
  const room = canRecruit(run);
  // Someone makes way only when there is no room.
  const leaving = room ? undefined : run.party.find((c) => c.id === replaceId);
  if (!room && !leaving) return next;
  const staying = run.party.filter((c) => c !== leaving);
  const lowest = Math.min(...staying.map((c) => c.level));
  const joined =
    ally.level >= lowest ? ally : { ...ally, level: lowest, xp: 0 };
  if (!leaving) return { ...next, party: [...run.party, joined] };
  const cell = formationOf(run)[leaving.id];
  const formation = { ...run.formation };
  delete formation[leaving.id];
  if (cell) formation[joined.id] = cell;
  return {
    ...next,
    party: run.party.map((c) => (c === leaving ? joined : c)),
    bag: [
      ...next.bag,
      ...Object.values(leaving.gear).filter(
        (id): id is string => id !== undefined && !!gearOf(run, id),
      ),
    ],
    formation,
  };
}

/**
 * Leaves a gear encounter with one of its pieces (`gearId`; null takes
 * none): on `characterId` (what they wore in that slot goes in the bag),
 * or in the bag.
 */
export function resolveGear(
  run: Run,
  gearId: string | null,
  characterId: string | null,
): Run {
  const encounter = currentEncounter(run);
  if (run.defeated || encounter?.kind !== "gear") return run;
  const next = moveOn(run);
  const found =
    gearId !== null && encounter.gearIds.includes(gearId)
      ? gearOf(run, gearId)
      : undefined;
  if (!found) return next;
  const stowed = { ...next, bag: [...next.bag, found.id] };
  return characterId === null
    ? stowed
    : changeGear(stowed, characterId, found.slot, found.id);
}

/** Leaves a training encounter; `characterId` (if any) gains a level. */
export function resolveTraining(run: Run, characterId: string | null): Run {
  const encounter = currentEncounter(run);
  if (run.defeated || encounter?.kind !== "training") return run;
  return moveOn({
    ...run,
    party: run.party.map((c) =>
      c.id === characterId ? { ...c, level: clampLevel(c.level + 1) } : c,
    ),
  });
}

/**
 * Puts gear from the bag in a character's slot (`gearId`) if their class
 * can use it, or empties the slot (null). Whatever was worn there goes
 * back in the bag.
 */
export function changeGear(
  run: Run,
  characterId: string,
  slot: GearSlot,
  gearId: string | null,
): Run {
  const character = run.party.find((c) => c.id === characterId);
  // No changing gear once the fight is on.
  if (!character || run.committed) return run;
  const bag = [...run.bag];
  let changed: Character;
  if (gearId !== null) {
    const at = bag.indexOf(gearId);
    const gear = gearOf(run, gearId);
    if (
      at < 0 ||
      !gear ||
      gear.slot !== slot ||
      !canWear(run.library, character, gear)
    ) {
      return run;
    }
    bag.splice(at, 1);
    changed = equip(character, gear);
  } else {
    changed = unequip(character, slot);
  }
  const worn = character.gear[slot];
  if (worn !== undefined && gearOf(run, worn)) bag.push(worn);
  return {
    ...run,
    bag,
    party: run.party.map((c) => (c.id === characterId ? changed : c)),
  };
}

/** After a cleared level: on to the next, deeper one. */
export function nextLevel(run: Run): Run {
  if (!levelCleared(run)) return run;
  const depth = run.depth + 1;
  return {
    ...run,
    depth,
    position: 0,
    path: [0],
    map: generateLevel(run.library, run.party, run.seed, depth),
  };
}

export const RUN_STORAGE_KEY = "jforge.jrpg.run";

/** Reads a saved run; null unless it is well formed. */
export function parseRun(text: string | null): Run | null {
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const run = data as Partial<Run>;
  const library = parseLibrary(JSON.stringify(run.library ?? null));
  const whole = (n: unknown) => typeof n === "number" && Number.isInteger(n);
  if (
    run.version !== SAVE_VERSION ||
    !library ||
    !whole(run.seed) ||
    !whole(run.depth) ||
    !whole(run.baseLevel) ||
    !whole(run.position) ||
    typeof run.defeated !== "boolean" ||
    !Array.isArray(run.party) ||
    run.party.length === 0 ||
    !run.party.every((c) => toCombatantDef(library, c)) ||
    !Array.isArray(run.bag) ||
    !run.bag.every((id) => typeof id === "string") ||
    !Array.isArray(run.path) ||
    !run.path.every(whole) ||
    !Array.isArray(run.map) ||
    !run.map.every((row) => Array.isArray(row) && row.every(isStop))
  ) {
    return null;
  }
  return { ...(run as Run), library };
}

function isStop(v: unknown): boolean {
  if (typeof v !== "object" || v === null) return false;
  const stop = v as Record<string, unknown>;
  return (
    isEncounter(stop.encounter) &&
    typeof stop.lane === "number" &&
    Array.isArray(stop.next) &&
    stop.next.every((i) => typeof i === "number")
  );
}

function isEncounter(v: unknown): boolean {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  if (e.kind === "battle") {
    return (
      typeof e.seed === "number" &&
      (e.rank === "normal" || e.rank === "elite" || e.rank === "boss") &&
      (e.difficulty === "easy" ||
        e.difficulty === "normal" ||
        e.difficulty === "hard")
    );
  }
  if (e.kind === "gear") {
    return (
      Array.isArray(e.gearIds) &&
      e.gearIds.every((id) => typeof id === "string")
    );
  }
  if (e.kind === "training") return true;
  return e.kind === "ally" && typeof e.character === "object" && !!e.character;
}
