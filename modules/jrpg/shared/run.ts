import {
  blankCharacter,
  clampLevel,
  equip,
  gainXp,
  parseLibrary,
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
  content,
  createRandom,
  estimateThreat,
  randomEncounter,
  type BattleSetup,
  type CombatantDef,
  type Difficulty,
} from "@jforge/melee/shared";
import { GEAR_TIERS, TRAVELLER_NAMES, tierId, withWorld } from "./world";

// A run: the party travels through levels, each a fixed sequence of
// encounters generated from a seed. Everything here is pure; the screens
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
  | { kind: "training" }
  /** A fork in the road: the party picks which of these it meets. */
  | { kind: "fork"; options: Encounter[] };

export interface Run {
  version: 2;
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
  encounters: Encounter[];
  /** The encounter the party stands at; past the end, the level is cleared. */
  position: number;
  defeated: boolean;
}

/** What a won battle paid. */
export interface Reward {
  /** Experience each party member gained. */
  xp: number;
  levelUps: { name: string; level: number }[];
  loot?: Gear;
}

/** A level is this long, give or take: MIN to MIN + SPREAD encounters. */
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
  hard: 1.0,
};

const isClass = (library: Library, character: Character) =>
  library.archetypes.some(
    (a) => a.id === character.archetypeId && a.kind === "class",
  );

const averageLevel = (party: Character[]) =>
  Math.round(party.reduce((sum, c) => sum + c.level, 0) / party.length);

/** `library` if a party can set out from it, else the starter library. */
export function runLibrary(library: Library | null): Library {
  return library && library.characters.some((c) => isClass(library, c))
    ? library
    : starterLibrary();
}

/** A new run: the library's first class characters at the first level. */
export function startRun(source: Library | null, seed: number): Run {
  const designed = runLibrary(source);
  const party = designed.characters
    .filter((c) => isClass(designed, c))
    .slice(0, START_PARTY_SIZE);
  const baseLevel = averageLevel(party);
  const library = withWorld(designed, baseLevel);
  return {
    version: 2,
    seed,
    depth: 1,
    baseLevel,
    library,
    party,
    bag: [],
    encounters: generateLevel(library, party, seed, 1),
    position: 0,
    defeated: false,
  };
}

type Find = "ally" | "gear" | "training" | "fork";
/** Every level has these; two more are drawn from EXTRA_FINDS. */
const SURE_FINDS: Find[] = ["ally", "gear", "training"];
const EXTRA_FINDS: Find[] = [
  "gear",
  "gear",
  "fork",
  "fork",
  "ally",
  "training",
];
/** What a fork can lead to. */
const FORK_KINDS = ["ally", "gear", "training", "elite"] as const;

/**
 * A level: battles from easy to a hard last one, a tougher battle past
 * the middle, and finds in between (an ally, gear, training, forks; never
 * two in a row). The same seed and depth give the same level.
 */
export function generateLevel(
  library: Library,
  party: Character[],
  seed: number,
  depth: number,
): Encounter[] {
  const random = createRandom(seed + depth * 7919);
  const roll = (n: number) => Math.floor(random() * n);
  const pick = <T>(items: readonly T[]): T => items[roll(items.length)]!;
  const take = <T>(items: T[]): T => items.splice(roll(items.length), 1)[0]!;
  const length = MIN_LEVEL_LENGTH + roll(LEVEL_LENGTH_SPREAD + 1);

  // Gear is stored at every tier; the plain pieces are the ones to draw.
  const plain = library.gear.filter((g) => !/\+\d$/.test(g.id));
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
  const found = (kind: Find | "elite"): Encounter => {
    if (kind === "ally") return ally();
    if (kind === "gear" && plain.length > 0) return gear();
    if (kind === "elite") return battle("elite", false);
    if (kind === "fork") {
      const kinds = [...FORK_KINDS];
      return {
        kind: "fork",
        options: [found(take(kinds)), found(take(kinds))],
      };
    }
    return { kind: "training" };
  };

  // Finds go between the first and the last battle, never side by side.
  const finds = new Map<number, Find>();
  const wanted = [...SURE_FINDS, pick(EXTRA_FINDS), pick(EXTRA_FINDS)];
  const open = Array.from({ length: length - 2 }, (_, i) => i + 1);
  while (open.length > 0 && wanted.length > 0) {
    const at = take(open);
    if (finds.has(at - 1) || finds.has(at + 1)) continue;
    finds.set(at, wanted.shift()!);
  }
  // One battle past the middle is a tougher one.
  const later = Array.from({ length }, (_, i) => i).filter(
    (i) => i >= length / 2 && i < length - 1 && !finds.has(i),
  );
  const elite = later.length > 0 ? pick(later) : -1;

  return Array.from({ length }, (_, index): Encounter => {
    const find = finds.get(index);
    if (find) return found(find);
    const rank: BattleRank =
      index === length - 1 ? "boss" : index === elite ? "elite" : "normal";
    return battle(rank, index < length / 3);
  });
}

export function currentEncounter(run: Run): Encounter | null {
  return run.encounters[run.position] ?? null;
}

export function levelCleared(run: Run): boolean {
  return !run.defeated && run.position >= run.encounters.length;
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

/** The enemies' threat budget for a battle of this difficulty. */
export function threatBudget(run: Run, difficulty: Difficulty): number {
  const party = partyDefs(run).reduce((sum, d) => sum + estimateThreat(d), 0);
  return party * BUDGET_SHARE[difficulty];
}

/**
 * The kinds of enemy in the battle with this seed: up to MAX_PACK_KINDS
 * of the pool, so one battle is wolves and vipers, the next a golem.
 */
export function packFor(pool: CombatantDef[], seed: number): CombatantDef[] {
  const random = createRandom(seed ^ 0x5eed);
  const left = [...pool];
  const kinds = 1 + Math.floor(random() * MAX_PACK_KINDS);
  const pack: CombatantDef[] = [];
  while (left.length > 0 && pack.length < kinds) {
    pack.push(left.splice(Math.floor(random() * left.length), 1)[0]!);
  }
  return pack;
}

/** The battle at the party's position; null when it isn't one. */
export function battleFor(run: Run): BattleSetup | null {
  const encounter = currentEncounter(run);
  if (run.defeated || encounter?.kind !== "battle") return null;
  const pool = monsterPool(run, RANK_LEVELS[encounter.rank]);
  return randomEncounter(
    encounter.seed,
    encounter.difficulty,
    { party: partyDefs(run), monsters: packFor(pool, encounter.seed) },
    threatBudget(run, encounter.difficulty),
  );
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
    run: {
      ...run,
      party,
      bag: loot ? [...run.bag, loot.id] : run.bag,
      position: run.position + 1,
    },
    reward: { xp, levelUps, ...(loot ? { loot } : {}) },
  };
}

/** The battle is lost (or drawn): the run ends here. */
export function loseBattle(run: Run): Run {
  return { ...run, defeated: true };
}

export function canRecruit(run: Run): boolean {
  return run.party.length < MAX_PARTY_SIZE;
}

/**
 * Leaves an ally encounter. A recruit joins at the level of the party's
 * weakest member if that is higher than its own.
 */
export function resolveAlly(run: Run, recruit: boolean): Run {
  const encounter = currentEncounter(run);
  if (run.defeated || encounter?.kind !== "ally") return run;
  const next = { ...run, position: run.position + 1 };
  if (!recruit || !canRecruit(run)) return next;
  const lowest = Math.min(...run.party.map((c) => c.level));
  const ally = encounter.character;
  const joined =
    ally.level >= lowest ? ally : { ...ally, level: lowest, xp: 0 };
  return { ...next, party: [...run.party, joined] };
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
  const next = { ...run, position: run.position + 1 };
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
  return {
    ...run,
    position: run.position + 1,
    party: run.party.map((c) =>
      c.id === characterId ? { ...c, level: clampLevel(c.level + 1) } : c,
    ),
  };
}

/** At a fork: the party takes option `index`, which it then stands at. */
export function chooseFork(run: Run, index: number): Run {
  const encounter = currentEncounter(run);
  const chosen = encounter?.kind === "fork" ? encounter.options[index] : null;
  if (run.defeated || !chosen) return run;
  return {
    ...run,
    encounters: run.encounters.map((e, i) => (i === run.position ? chosen : e)),
  };
}

/**
 * Puts gear from the bag in a character's slot (`gearId`), or empties the
 * slot (null). Whatever was worn there goes back in the bag.
 */
export function changeGear(
  run: Run,
  characterId: string,
  slot: GearSlot,
  gearId: string | null,
): Run {
  const character = run.party.find((c) => c.id === characterId);
  if (!character) return run;
  const bag = [...run.bag];
  let changed: Character;
  if (gearId !== null) {
    const at = bag.indexOf(gearId);
    const gear = gearOf(run, gearId);
    if (at < 0 || !gear || gear.slot !== slot) return run;
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
    encounters: generateLevel(run.library, run.party, run.seed, depth),
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
    run.version !== 2 ||
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
    !Array.isArray(run.encounters) ||
    !run.encounters.every(isEncounter)
  ) {
    return null;
  }
  return { ...(run as Run), library };
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
  if (e.kind === "fork") {
    return (
      Array.isArray(e.options) &&
      e.options.length > 0 &&
      e.options.every((o) => isEncounter(o) && o.kind !== "fork")
    );
  }
  if (e.kind === "training") return true;
  return e.kind === "ally" && typeof e.character === "object" && !!e.character;
}
