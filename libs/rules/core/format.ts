// The design format: what content is written in. Stats, damage types,
// traits, weapons, statuses and skills, and the creature a design
// compiles to. Every game builds its own units from these.

export const STAT_NAMES = [
  "maxHp",
  "maxMp",
  "attack",
  "magic",
  "defence",
  "spirit",
  "speed",
] as const;

export type StatName = (typeof STAT_NAMES)[number];
export type Stats = Record<StatName, number>;

/**
 * What a hit is made of; resistances key on this. Independent of delivery
 * (physical uses attack vs defence, magical uses magic vs spirit): a
 * Geomancer's thrown rock is magical delivery with an impact type.
 * One type per hit. See docs/design.md, "Damage types".
 */
const PHYSICAL_TYPES = ["slash", "pierce", "chop", "crush", "impact"] as const;
const MAGICAL_TYPES = [
  "fire",
  "cold",
  "lightning",
  "acid",
  "poison",
  "holy",
  "shadow",
  "arcane",
] as const;
export const DAMAGE_TYPES = [...PHYSICAL_TYPES, ...MAGICAL_TYPES] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

/**
 * Damage multipliers per type: 2 weak, 1 normal (the default for any type
 * not listed), 0.5 resistant, 0 immune.
 */
export type Resistances = Partial<Record<DamageType, number>>;

/**
 * What a creature is made of. Each trait brings default resistances (see
 * traits.ts); a creature's own `resistances` override them.
 */
export const TRAITS = [
  "beast",
  "reptile",
  "ooze",
  "stone",
  "demon",
  "undead",
  "construct",
  "armoured",
] as const;
export type Trait = (typeof TRAITS)[number];

/**
 * What a combatant attacks with; decides which enemies it can reach.
 * Columns line up across the two grids: column 2 faces enemy column 2.
 */
export interface Weapon {
  id: string;
  name: string;
  /**
   * Enemy columns it reaches: this many on each side of the attacker's own
   * column (1 = its own column and both neighbours), or "any".
   */
  columns: number | "any";
  /**
   * How deep into a column it reaches, counting living units from the
   * front: 1 = only the front-most (cover blocks the rest), 2 = also the
   * one behind it, or "any" to ignore cover.
   */
  depth: number | "any";
  damageType: DamageType;
  /**
   * Melee hits depend on rows (weaker from and into the back); ranged
   * weapons ignore rows.
   */
  kind: "melee" | "ranged";
  /** A status every damaging hit puts on the target, e.g. venom. */
  onHit?: StatusDef;
  /**
   * The holder's gauge at the start of a battle; absent means 0. Below 0
   * it acts later than its speed alone would make it (a bow: -500).
   */
  startGauge?: number;
}

/**
 * An effect over time a skill can put on a unit: something happens every
 * `interval` of game time, `ticks` times. Game time, not turns, so haste
 * does not stretch it. More kinds (poison, burn) arrive later.
 */
export interface StatusDef {
  id: string;
  name: string;
  /** What each tick does to the unit carrying it. */
  /**
   * heal / damage: HP per tick. stealth: hidden until it ends. shield:
   * absorbs `power x stat` damage before HP. ward: can't be knocked out
   * (a lethal hit leaves 1 HP). taunt: enemies that single out a target
   * must pick it while they can. expose: takes more from every damage type
   * (its `taken` strength, see strengths.ts). guard: single-target hits from enemies land on
   * the unit that applied it instead, while it stands (see guard.ts).
   * weaken: every hit it deals is weaker (its `dealt` strength). The last
   * eight just last until they end. bomb: when it ends, or the unit falls
   * first, it explodes for its amount on the unit and its neighbours on
   * its side (see bomb.ts). coat: its weapon hits poison (see coat.ts).
   * smoke: enemies can't single it out, as with stealth, but it gives no
   * ambush and acting doesn't end it.
   */
  effect:
    | "heal"
    | "damage"
    | "stealth"
    | "shield"
    | "ward"
    | "taunt"
    | "expose"
    | "silence"
    | "guard"
    | "weaken"
    | "bomb"
    | "coat"
    | "smoke"
    | "bless"
    | "stoneSkin"
    | "petrify";
  /** Harmful statuses (poison) are removed by Cure; helpful ones (Regen) are not. */
  harmful: boolean;
  /** For damage ticks: the type resistances apply to. */
  damageType?: DamageType;
  /** Which of the applier's stats scales it. */
  stat: "attack" | "magic";
  /** Per tick: power x the applier's `stat`, worked out when applied. */
  power: number;
  interval: number;
  ticks: number;
  /**
   * Share of its first amount each later tick gains every time the unit
   * carrying it attacks, uses a skill or moves; defending and waiting
   * don't count (Bleeding: 0.5, see bleed.ts).
   */
  worsens?: number;
  /**
   * Strengths (see strengths.ts): damage dealt, damage taken, defence or
   * ambush, times. Read only for the kinds STRENGTH_DEFAULTS lists, and
   * its default when left out.
   */
  dealt?: number;
  taken?: number;
  defence?: number;
  ambush?: number;
}

/** What a skill does to each unit it hits. More effect types arrive later. */
export type SkillEffect =
  | {
      type: "status";
      status: StatusDef;
    }
  /** Removes every harmful status and modifier from the target. */
  | { type: "cleanse" }
  /** Moves the caster to the aimed empty cell on its own side. */
  | { type: "teleport" }
  /** A timed stat modifier, e.g. Haste (speed x1.5) or Slow (x0.5). */
  | {
      type: "modify";
      modifier: {
        name: string;
        stat: StatName;
        op: "add" | "mul";
        value: number;
        /** Game time it lasts. */
        duration: number;
        harmful: boolean;
      };
    }
  /**
   * Sets the target's turn gauge to `to` (a share of full): 1 means it acts
   * right away. Not on a unit that is already ready or casting.
   */
  | { type: "gauge"; to: number }
  /**
   * A weapon attack: uses the attacker's weapon (reach, rows, damage type)
   * at `power` times normal. `push` moves the target that many rows back
   * (negative pulls it forward). If the way is blocked by a unit (knocked
   * out or not) or the edge of the grid, it doesn't move and takes a
   * collision instead: x1.5 damage. The skill's `ignoreCover` lets it
   * reach units behind others in their column (the weapon's column limit
   * still holds).
   * `advance` first runs the attacker to the front row of its column (the
   * way there must be clear, and it must not be there already), and it
   * strikes from there (see charge.ts). `pin` slows a target that
   * survives the hit (see pin.ts);
   * `ignite` sets it burning (see ignite.ts); `bleed` leaves it
   * bleeding (see bleed.ts).
   */
  | {
      type: "strike";
      power: number;
      push?: number;
      advance?: boolean;
      pin?: boolean;
      ignite?: boolean;
      bleed?: boolean;
      /** Share of the target's defence ignored (Armour Pierce: 0.5). */
      armourPierce?: number;
      /**
       * Power multiplier on a target below `finishBelow` of its max HP
       * (Coup de Grâce: 2.5, see finisher.ts).
       */
      finisher?: number;
      /** The finisher's HP share threshold (default FINISH_BELOW, 0.3). */
      finishBelow?: number;
      /**
       * Share of a full gauge a surviving target loses, unless casting
       * (Staggering Thrust: 0.25, see stagger.ts).
       */
      stagger?: number;
      /**
       * Weakens a target that survives the hit: it deals this much, times,
       * for a while (Weakening Strike: 0.75, see weaken.ts).
       */
      weaken?: number;
      /**
       * Share of the damage dealt that heals the caster's most-hurt ally
       * (Judgment: 0.5, see judgment.ts).
       */
      mend?: number;
    }
  | {
      type: "heal";
      /**
       * HP restored = power x the caster's magic, or with `of: "maxHp"`
       * power x the target's max HP (Second Wind: 0.25 is a quarter).
       */
      power: number;
      of?: "maxHp";
    }
  | {
      type: "damage";
      kind: "magical";
      element: DamageType;
      /** Damage = power x magic x K / (K + target's spirit), +-10%. */
      power: number;
      /** Share of the damage dealt that heals the caster, e.g. 0.5. */
      drain?: number;
      /** MP the target loses on a hit, as much as it has (Mana Burn). */
      burnMp?: number;
      /**
       * Power multiplier against a target that is empowered: casting, or
       * with a helpful status or modifier (Rebuke: 1.6).
       */
      vsEmpowered?: number;
      /**
       * Total power shared evenly by everyone hit; each gets that share,
       * at most `power` (Arcane Wave: 2 shared, at most 1.5 each).
       */
      split?: number;
      /** Slows a target that survives the hit a little (see chill.ts). */
      chill?: boolean;
    }
  /**
   * Puts `creature` in the aimed cell on the caster's own side, controlled
   * like the caster. One per caster: summoning again replaces the old one.
   * A summon vanishes (leaving no body) when knocked out.
   */
  | {
      type: "summon";
      creature: Creature;
      /** How many of this creature one caster may have; default 1. */
      limit?: number;
      /** May be placed on either side (boulders), not just the caster's. */
      anySide?: boolean;
      /**
       * The enemy type char made `creature` from; char compiles it again
       * from it, melee only reads `creature`.
       */
      source?: { archetypeId: string };
    }
  /**
   * Destroys one of the caster's obstacles (a boulder); every unit in the
   * plus around its cell takes magic damage, friend or foe.
   */
  | { type: "shatter"; power: number; element: DamageType }
  /** Moves the target `rows` back on its own side; blocked means no move. */
  | { type: "heave"; rows: number }
  /**
   * Brings a knocked-out ally back with power x the caster's magic in HP.
   * Its gauge starts empty. Not for summons (they vanish) or obstacles.
   */
  | { type: "revive"; power: number }
  /**
   * Pulls the aimed ally back: in its column the caster takes the middle
   * row and the ally the back row; the ally's gauge halves and the caster
   * braces (see rescue.ts).
   */
  | { type: "rescue" }
  /**
   * Gives the target back the HP it lost since its last turn ended (its
   * `rewindHp`). Not on a unit that has lost none since then.
   */
  | { type: "rewind" }
  /**
   * The caster gives up one of its own summons (the Imp), on the aimed
   * cell: the summon vanishes, the caster heals by the HP it had left and
   * gains `modifier` (Sacrifice's magic boost).
   */
  | {
      type: "sacrifice";
      modifier: Extract<SkillEffect, { type: "modify" }>["modifier"];
    }
  /**
   * The caster regains `amount` MP, never above its max (Mana Tap, paid
   * for with HP). Not while its MP is full.
   */
  | { type: "restoreMp"; amount: number };

/**
 * Which cells a skill hits around the aimed cell. The two grids form one
 * battlefield 5 wide and 6 deep, front rows touching, so an area can spill
 * across the front line onto the other side. "row" is the aimed cell's whole
 * row on its own side. "reach" ignores the aimed cell's surroundings: it
 * covers every enemy the caster's weapon can reach.
 */
export type SkillArea = "single" | "plus" | "square" | "line" | "row" | "reach";

/** A skill is plain data, so char can design new ones later. */
export interface Skill {
  id: string;
  name: string;
  description: string;
  mpCost: number;
  /**
   * Where it may be aimed, relative to the caster: a living ally or enemy,
   * or "any" cell on either side (occupied or empty).
   */
  target: "ally" | "enemy" | "any" | "self";
  area: SkillArea;
  effect: SkillEffect;
  /**
   * Game time between choosing the skill and its impact. While casting the
   * unit cannot act; if it is knocked out the skill fizzles. Absent means
   * instant.
   */
  castTime?: number;
  /** True if the caster may not target itself (e.g. Quicken). */
  notSelf?: boolean;
  /**
   * True if it may only be aimed at a unit next to the caster: one cell
   * across or along, on the same side (e.g. Guard).
   */
  adjacent?: boolean;
  /**
   * True if it can't be used from the front row, where the caster is
   * locked in hand-to-hand combat (e.g. Aimed Shot).
   */
  notFromFront?: boolean;
  /** HP paid to use it. Refused unless the caster has more HP than this. */
  hpCost?: number;
  /** Costs only half a turn, like Move: the gauge drops to half. */
  halfTurn?: boolean;
  /**
   * May single out covered enemies. Without it a single-target skill aimed
   * at an enemy needs an exposed one (the front-most in its column), as a
   * bow does; a strike also reaches past cover (Aimed Shot, Volley).
   */
  ignoreCover?: boolean;
}

/**
 * A creature as designed and compiled: what a game builds its units from,
 * and what a summon puts in. Each game adds its own rules to it.
 */
export interface Creature {
  id: string;
  name: string;
  stats: Stats;
  weapon: Weapon;
  skills?: Skill[];
  /** Default resistances come from traits; `resistances` overrides them. */
  traits?: Trait[];
  resistances?: Resistances;
  /** Row it prefers when placed automatically: 0 front, 1 middle, 2 back. */
  preferredRow?: number;
  /**
   * An obstacle (a boulder): takes up its cell, gives cover and can be
   * attacked, but never acts.
   */
  obstacle?: boolean;
  /**
   * Whose icon it wears, as the id of a built-in type ("fighter", "slime").
   * For combatants designed elsewhere; built-in ones use their own id.
   */
  portrait?: string;
}

/** Below this share of max HP a target counts as badly hurt (a finisher's default). */
export const FINISH_BELOW = 0.3;
