import {
  archetypeOf,
  toCombatantDef,
  type Character,
  type Library,
} from "@jforge/rules/core";
import { meleeClassId, meleeCreatureId } from "@jforge/content/catalogue";
import {
  STAT_NAMES,
  content as c,
  estimateThreat,
  type CombatantDef,
  type Skill,
  type Stats,
} from "@jforge/melee/shared";
import { clampLevel, statsAtLevel } from "./progression";

// jrpg owns how everything grows with levels; char designs only level 1.
// One table of stat growth, a row per class and enemy type, and one of
// skill growth, a row per skill. A summoned creature grows like its enemy
// type, at its summoner's level.

/** What each level above 1 adds to a stat; fractions add up over levels. */
type StatRow = [
  maxHp: number,
  maxMp: number,
  attack: number,
  magic: number,
  defense: number,
  spirit: number,
  speed: number,
];
const row = ([
  maxHp,
  maxMp,
  attack,
  magic,
  defense,
  spirit,
  speed,
]: StatRow): Stats => ({ maxHp, maxMp, attack, magic, defense, spirit, speed });

/**
 * Stat growth per level, by class or enemy type id. Melee's classes and
 * creatures grow 8% of their level-1 stats per level, speed 2%: speed
 * decides how often a unit acts, so it barely moves.
 */
export const STAT_GROWTH: Record<string, Stats> = {
  [meleeClassId(c.fighter.id)]: row([9.6, 0.8, 1.76, 0.32, 1.44, 0.64, 0.2]),
  [meleeClassId(c.lancer.id)]: row([8.4, 1.28, 1.6, 0.32, 1.12, 0.64, 0.22]),
  [meleeClassId(c.archer.id)]: row([7.2, 1.6, 1.44, 0.48, 0.8, 0.8, 0.24]),
  [meleeClassId(c.mage.id)]: row([5.6, 4.8, 0.48, 1.92, 0.48, 1.44, 0.18]),
  [meleeClassId(c.healer.id)]: row([6.4, 4, 0.64, 1.28, 0.64, 1.6, 0.22]),
  [meleeClassId(c.chronomancer.id)]: row([6, 4, 0.64, 1.44, 0.64, 1.44, 0.24]),
  [meleeClassId(c.warlock.id)]: row([6.8, 2.88, 0.64, 1.6, 0.72, 1.12, 0.2]),
  [meleeClassId(c.rogue.id)]: row([6.4, 1.6, 1.52, 0.32, 0.72, 0.72, 0.3]),
  [meleeClassId(c.paladin.id)]: row([9.2, 1.92, 1.44, 1.12, 1.6, 1.28, 0.18]),
  [meleeClassId(c.geomancer.id)]: row([7.6, 2.72, 0.8, 1.36, 0.96, 1.12, 0.2]),
  [meleeClassId(c.knight.id)]: row([10, 1.44, 1.44, 0.48, 1.76, 0.96, 0.16]),
  [meleeClassId(c.sage.id)]: row([6, 3.6, 0.48, 1.44, 0.56, 1.6, 0.22]),
  [meleeCreatureId(c.imp.id)]: row([2.4, 0.96, 0.96, 0.96, 0.48, 0.64, 0.28]),
  [meleeCreatureId(c.boulder.id)]: row([3.2, 0, 0, 0, 4.8, 4.8, 0]),
  "enemy-wolf": row([5, 0, 1.6, 0, 0.5, 0.4, 0.5]),
  "enemy-slime": row([10, 0, 1, 0, 1, 0.8, 0.1]),
  "enemy-viper": row([4, 0, 1.2, 0, 0.3, 0.4, 0.5]),
  "enemy-bandit": row([5, 1, 1.5, 0, 0.5, 0.5, 0.3]),
  "enemy-witch": row([4, 4, 0.2, 1.6, 0.4, 1, 0.2]),
  "enemy-priest": row([5, 4, 0.3, 1.3, 0.5, 1.2, 0.2]),
  "enemy-golem": row([14, 0, 1.6, 0, 1.4, 0.5, 0.1]),
  "enemy-imp": row([4, 3, 0.8, 1.4, 0.4, 0.7, 0.4]),
  "enemy-raider": row([8, 1, 1.7, 0, 1, 0.5, 0.2]),
};

/** Growth for a designed type with no row: shares of its level-1 stats. */
export const DEFAULT_GROWTH = 0.08;
export const DEFAULT_SPEED_GROWTH = 0.02;

/** A type's growth per level: its row, or the default shares of `base`. */
export function statGrowth(id: string, base: Stats): Stats {
  const known = STAT_GROWTH[id];
  if (known) return known;
  const growth = {} as Stats;
  for (const stat of STAT_NAMES) {
    const share = stat === "speed" ? DEFAULT_SPEED_GROWTH : DEFAULT_GROWTH;
    growth[stat] = Math.round(base[stat] * share * 100) / 100;
  }
  return growth;
}

/**
 * What each level of the caster above 1 adds to a skill's numbers, by
 * path into the skill: { "effect.power": 0.05, mpCost: 1 }. Any number of
 * the skill can grow. An empty row: the skill grows only through the
 * caster's stats.
 */
type SkillGrowth = Record<string, number>;

/** Skill growth per caster level, by skill id. */
export const SKILL_GROWTH: Record<string, SkillGrowth> = {
  cleave: {},
  provoke: {},
  "iron-stance": {},
  "second-wind": {},
  "war-cry": {},
  rend: {},
  skewer: {},
  hook: {},
  "armor-pierce": {},
  "staggering-thrust": {},
  "weakening-strike": {},
  "aimed-shot": {},
  volley: {},
  "pinning-shot": {},
  "quick-shot": {},
  "fire-arrow": {},
  fireball: {},
  meteor: {},
  "lightning-bolt": {},
  "mana-tap": {},
  "frost-lance": {},
  heal: {},
  regen: {},
  cure: {},
  revive: {},
  smite: {},
  haste: {},
  slow: {},
  quicken: {},
  timeBomb: {},
  rewind: {},
  drain: {},
  "blood-bolt": {},
  "summon-imp": {},
  curse: {},
  sacrifice: {},
  vanish: {},
  shadowstep: {},
  poisonBlade: {},
  smokeBomb: {},
  coupDeGrace: {},
  aegis: {},
  "last-rites": {},
  consecrate: {},
  judgment: {},
  blessing: {},
  "raise-boulder": {},
  shatter: {},
  upheaval: {},
  stoneSkin: {},
  petrify: {},
  "shield-wall": {},
  guard: {},
  "shield-bash": {},
  charge: {},
  rescue: {},
  expose: {},
  silence: {},
  "mana-burn": {},
  rebuke: {},
  "arcane-wave": {},
  firebolt: {},
};

/** Numbers that stay whole as they grow; the rest keep two decimals. */
const WHOLE = new Set([
  "mpCost",
  "hpCost",
  "ticks",
  "interval",
  "duration",
  "limit",
  "amount",
  "rows",
  "push",
  "burnMp",
]);

/** The number at `path` in `value`; undefined if there is none. */
export function numberAt(value: unknown, path: string): number | undefined {
  let at: unknown = value;
  for (const key of path.split(".")) {
    if (typeof at !== "object" || at === null) return undefined;
    at = (at as Record<string, unknown>)[key];
  }
  return typeof at === "number" ? at : undefined;
}

/** A copy of `value` with `number` at `path`. */
function withNumberAt<T>(value: T, path: string, number: number): T {
  const [key, ...rest] = path.split(".");
  const record = value as Record<string, unknown>;
  return {
    ...record,
    [key!]:
      rest.length === 0
        ? number
        : withNumberAt(record[key!], rest.join("."), number),
  } as T;
}

/**
 * `skill` as a caster of `level` uses it: its row of `growth` added once
 * per level above 1, and a summoned creature at the same level.
 */
export function skillAtLevel(
  skill: Skill,
  level: number,
  growth: Record<string, SkillGrowth> = SKILL_GROWTH,
): Skill {
  const steps = clampLevel(level) - 1;
  let grown = skill;
  for (const [path, perLevel] of Object.entries(growth[skill.id] ?? {})) {
    const base = numberAt(skill, path);
    if (base === undefined) continue;
    const raw = base + perLevel * steps;
    const whole = WHOLE.has(path.split(".").pop()!);
    grown = withNumberAt(
      grown,
      path,
      whole ? Math.round(raw) : Math.round(raw * 100) / 100,
    );
  }
  const { effect } = grown;
  return effect.type === "summon"
    ? {
        ...grown,
        effect: {
          ...effect,
          creature: creatureAtLevel(effect.creature, level, growth),
        },
      }
    : grown;
}

/**
 * A summoned creature at its summoner's level: grown from its enemy
 * type's level-1 stats by the type's row, its skills at that level too.
 */
export function creatureAtLevel(
  creature: CombatantDef,
  level: number,
  growth: Record<string, SkillGrowth> = SKILL_GROWTH,
): CombatantDef {
  return {
    ...creature,
    stats: statsAtLevel(
      creature.stats,
      statGrowth(creature.id, creature.stats),
      level,
    ),
    ...(creature.skills
      ? { skills: creature.skills.map((s) => skillAtLevel(s, level, growth)) }
      : {}),
  };
}

/**
 * A character as melee fights with it at `level`: its type's stats grown
 * to that level before gear, and its skills at that level. An enemy's
 * threat is estimated again from all of that. Null if its type is gone.
 */
export function levelledDef(
  library: Library,
  character: Character,
  level: number,
): CombatantDef | null {
  const archetype = archetypeOf(library, character);
  if (!archetype) return null;
  const base = statsAtLevel(
    archetype.baseStats,
    statGrowth(archetype.id, archetype.baseStats),
    level,
  );
  const def = toCombatantDef(library, character, base);
  if (!def) return null;
  const grown: CombatantDef = {
    ...def,
    ...(def.skills
      ? { skills: def.skills.map((s) => skillAtLevel(s, level)) }
      : {}),
  };
  return grown.threat === undefined
    ? grown
    : { ...grown, threat: estimateThreat(grown) };
}
