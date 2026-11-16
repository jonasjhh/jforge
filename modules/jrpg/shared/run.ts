import {
  blankCharacter,
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

// A run: the party travels through levels, each a fixed sequence of
// encounters generated from a seed. Everything here is pure; the screens
// only show a run and call these functions.

export type Encounter =
  | {
      kind: "battle";
      difficulty: Difficulty;
      /** Seed of the encounter (who the enemies are and where they stand). */
      seed: number;
      /** The last battle of a level. */
      boss: boolean;
      /** Gear the enemies drop, if any. */
      loot?: string;
    }
  | { kind: "ally"; character: Character }
  | { kind: "gear"; gearId: string };

export interface Run {
  version: 1;
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

export const LEVEL_LENGTH = 8;
export const START_PARTY_SIZE = 2;
/** Chance that an ordinary battle drops gear; the last one always does. */
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
  easy: 1,
  normal: 1.25,
  hard: 1.55,
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
  const library = runLibrary(source);
  const party = library.characters
    .filter((c) => isClass(library, c))
    .slice(0, START_PARTY_SIZE);
  return {
    version: 1,
    seed,
    depth: 1,
    baseLevel: averageLevel(party),
    library,
    party,
    bag: [],
    encounters: generateLevel(library, party, seed, 1),
    position: 0,
    defeated: false,
  };
}

/**
 * A level: battles from easy to a hard last one, with an ally to find and
 * gear lying about in between (never two finds in a row). The same seed
 * and depth give the same level.
 */
export function generateLevel(
  library: Library,
  party: Character[],
  seed: number,
  depth: number,
): Encounter[] {
  const random = createRandom(seed + depth * 7919);
  const pick = <T>(items: T[]): T =>
    items[Math.floor(random() * items.length)]!;
  const gear = library.gear;

  // Finds go between the first and the last battle, never side by side.
  const finds = new Map<number, "ally" | "gear">();
  const wanted: ("ally" | "gear")[] = ["ally", "gear", "gear"];
  const open = Array.from({ length: LEVEL_LENGTH - 2 }, (_, i) => i + 1);
  while (open.length > 0 && wanted.length > 0) {
    const at = open.splice(Math.floor(random() * open.length), 1)[0]!;
    if (finds.has(at - 1) || finds.has(at + 1)) continue;
    const kind = wanted.shift()!;
    if (kind === "gear" && gear.length === 0) continue;
    finds.set(at, kind);
  }

  const offered = new Set(party.map((c) => c.id));
  const classes = library.archetypes.filter((a) => a.kind === "class");
  const newAlly = (index: number): Character => {
    const known = library.characters.filter(
      (c) => isClass(library, c) && !offered.has(c.id),
    );
    const ally =
      known.length > 0
        ? pick(known)
        : blankCharacter(`ally-${depth}-${index}`, pick(classes));
    offered.add(ally.id);
    return ally;
  };

  return Array.from({ length: LEVEL_LENGTH }, (_, index): Encounter => {
    const find = finds.get(index);
    if (find === "ally") return { kind: "ally", character: newAlly(index) };
    if (find === "gear") return { kind: "gear", gearId: pick(gear).id };
    const boss = index === LEVEL_LENGTH - 1;
    const difficulty: Difficulty = boss
      ? "hard"
      : index < LEVEL_LENGTH / 2
        ? "easy"
        : "normal";
    const seedHere = Math.floor(random() * 1_000_000);
    const drops = gear.length > 0 && (random() < LOOT_CHANCE || boss);
    return {
      kind: "battle",
      difficulty,
      seed: seedHere,
      boss,
      ...(drops ? { loot: pick(gear).id } : {}),
    };
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
export function monsterPool(run: Run): CombatantDef[] {
  const extra = enemyLevelBonus(run);
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

/** The battle at the party's position; null when it isn't one. */
export function battleFor(run: Run): BattleSetup | null {
  const encounter = currentEncounter(run);
  if (run.defeated || encounter?.kind !== "battle") return null;
  return randomEncounter(
    encounter.seed,
    encounter.difficulty,
    { party: partyDefs(run), monsters: monsterPool(run) },
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
 * Leaves a gear encounter with the find: on `characterId` (what they wore
 * in that slot goes in the bag), or in the bag.
 */
export function resolveGear(run: Run, characterId: string | null): Run {
  const encounter = currentEncounter(run);
  if (run.defeated || encounter?.kind !== "gear") return run;
  const found = gearOf(run, encounter.gearId);
  const next = { ...run, position: run.position + 1 };
  if (!found) return next;
  const stowed = { ...next, bag: [...next.bag, found.id] };
  return characterId === null
    ? stowed
    : changeGear(stowed, characterId, found.slot, found.id);
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
    run.version !== 1 ||
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
      typeof e.boss === "boolean" &&
      (e.difficulty === "easy" ||
        e.difficulty === "normal" ||
        e.difficulty === "hard")
    );
  }
  if (e.kind === "gear") return typeof e.gearId === "string";
  return e.kind === "ally" && typeof e.character === "object" && !!e.character;
}
