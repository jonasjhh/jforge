import {
  DAMAGE_TYPES,
  STAT_NAMES,
  STRENGTH_DEFAULTS,
  content,
  type Skill,
  type SkillEffect,
  type StatName,
  type StatusDef,
  type Strengths,
} from "@jforge/melee/shared";

// Every effect a skill can have, every option on it and every kind of
// status, described once as data. The skill designer draws its form from
// this, so a new option in melee is one entry here.

export type Option = readonly [string, string];

/** One input on the form: where it writes, and how it is shown. */
export type FieldSpec =
  | {
      kind: "number";
      /** Keys from the object the field edits (the effect, or the skill). */
      path: readonly string[];
      label: string;
      step?: number;
      min?: number;
      max?: number;
      /** Shown when the key is absent. */
      fallback?: number;
      /** An option: the key is left out when it equals `fallback`. */
      optional?: boolean;
    }
  | {
      kind: "flag";
      path: readonly string[];
      label: string;
      /** Written as false when off, for keys that must be there. */
      keep?: boolean;
    }
  | {
      kind: "select";
      path: readonly string[];
      label: string;
      options: readonly Option[];
      /** An option: the key is left out at this value. */
      omitAt?: string;
      fallback?: string;
    }
  | { kind: "text"; path: readonly string[]; label: string }
  /** The kind of a status: picking one resets the status to its defaults. */
  | { kind: "statusKind"; path: readonly string[]; label: string }
  /** A summon's creature: an enemy type and a level (needs the library). */
  | { kind: "creature"; path: readonly string[]; label: string };

const title = (text: string) => text[0]!.toUpperCase() + text.slice(1);

export const STAT_LABELS: Record<StatName, string> = {
  maxHp: "HP",
  maxMp: "MP",
  attack: "Attack",
  magic: "Magic",
  defense: "Defense",
  spirit: "Spirit",
  speed: "Speed",
};
export const STAT_OPTIONS = STAT_NAMES.map(
  (stat) => [stat, STAT_LABELS[stat]] as const,
);
export const DAMAGE_OPTIONS = DAMAGE_TYPES.map(
  (type) => [type, title(type)] as const,
);
export const TARGET_OPTIONS = [
  ["enemy", "An enemy"],
  ["ally", "An ally"],
  ["self", "Itself"],
  ["any", "Any cell"],
] as const;
export const AREA_OPTIONS = [
  ["single", "One unit"],
  ["plus", "Plus (5 cells)"],
  ["square", "Square (3×3)"],
  ["line", "Line of two"],
  ["row", "Whole row"],
  ["reach", "Everyone in weapon reach"],
] as const;
const OP_OPTIONS = [
  ["mul", "Multiply by"],
  ["add", "Add"],
] as const;
const SCALE_OPTIONS = [
  ["attack", "Attack"],
  ["magic", "Magic"],
] as const;
const HEAL_OPTIONS = [
  ["magic", "× caster's magic"],
  ["maxHp", "× target's max HP"],
] as const;

const num = (
  path: readonly string[],
  label: string,
  more: Omit<Extract<FieldSpec, { kind: "number" }>, "kind" | "path" | "label">,
): FieldSpec => ({ kind: "number", path, label, ...more });
/** A number option that is left out at 0. */
const opt = (
  path: readonly string[],
  label: string,
  step = 0.1,
  max?: number,
) => num(path, label, { step, min: 0, fallback: 0, optional: true, max });
const flag = (
  path: readonly string[],
  label: string,
  keep = false,
): FieldSpec => ({ kind: "flag", path, label, keep });

/** Fields of the skill itself, below name and description. */
export const SKILL_FIELDS: FieldSpec[] = [
  num(["mpCost"], "MP cost", { min: 0 }),
  num(["castTime"], "Cast time (0 = instant)", {
    min: 0,
    step: 10,
    fallback: 0,
    optional: true,
  }),
  {
    kind: "select",
    path: ["target"],
    label: "Target",
    options: TARGET_OPTIONS,
  },
  { kind: "select", path: ["area"], label: "Area", options: AREA_OPTIONS },
  num(["hpCost"], "HP cost", { min: 0, fallback: 0, optional: true }),
  flag(["notSelf"], "Not on itself"),
  flag(["adjacent"], "Only next to the caster"),
  flag(["notFromFront"], "Not from the front row"),
  flag(["halfTurn"], "Half a turn (like Move)"),
  flag(["ignoreCover"], "Can single out covered enemies"),
];

const modifierFields = (key: string): FieldSpec[] => [
  { kind: "text", path: [key, "name"], label: "Shown as" },
  { kind: "select", path: [key, "stat"], label: "Stat", options: STAT_OPTIONS },
  { kind: "select", path: [key, "op"], label: "Change", options: OP_OPTIONS },
  num([key, "value"], "Value", { step: 0.1 }),
  num([key, "duration"], "Duration (game time)", { step: 10, min: 0 }),
  flag([key, "harmful"], "Harmful (Cure removes it)", true),
];
const boost = {
  name: "Boost",
  stat: "attack" as StatName,
  op: "mul" as const,
  value: 1.5,
  duration: 100,
  harmful: false,
};

export type EffectType = SkillEffect["type"];

export interface EffectSpec {
  label: string;
  /** Where a new effect of the kind is usually aimed. */
  target: Skill["target"];
  /** A new effect of the kind; a summon gets its creature from the editor. */
  make: () => SkillEffect;
  fields: FieldSpec[];
}

/** Every effect kind, in the order the designer lists them. */
export const EFFECTS: Record<EffectType, EffectSpec> = {
  damage: {
    label: "Spell damage",
    target: "enemy",
    make: () => ({
      type: "damage",
      kind: "magical",
      element: "fire",
      power: 1,
    }),
    fields: [
      num(["power"], "Power (× magic)", { step: 0.1, min: 0 }),
      {
        kind: "select",
        path: ["element"],
        label: "Damage type",
        options: DAMAGE_OPTIONS,
      },
      opt(["drain"], "Drain (share healed)", 0.1, 1),
      opt(["burnMp"], "Burns MP", 1),
      opt(["vsEmpowered"], "Power vs empowered (×)"),
      opt(["split"], "Total power shared by all hit"),
      flag(["chill"], "Chills (slows a little)"),
    ],
  },
  strike: {
    label: "Weapon strike",
    target: "enemy",
    make: () => ({ type: "strike", power: 1.5 }),
    fields: [
      num(["power"], "Power (× attack)", { step: 0.1, min: 0 }),
      num(["push"], "Push rows (− pulls)", {
        min: -2,
        max: 2,
        fallback: 0,
        optional: true,
      }),
      opt(["armorPierce"], "Share of defense ignored", 0.1, 1),
      opt(["stagger"], "Share of gauge knocked off", 0.05, 1),
      opt(["weaken"], "Weakens: damage dealt ×", 0.05, 1),
      opt(["finisher"], "Finisher power (×)"),
      num(["finishBelow"], "Finisher below HP share", {
        step: 0.05,
        min: 0,
        max: 1,
        fallback: 0.3,
        optional: true,
      }),
      opt(["mend"], "Heals most-hurt ally (share)", 0.1, 1),
      flag(["advance"], "Charges to the front first"),
      flag(["pin"], "Pins (slows)"),
      flag(["ignite"], "Sets burning"),
    ],
  },
  heal: {
    label: "Heal",
    target: "ally",
    make: () => ({ type: "heal", power: 1 }),
    fields: [
      num(["power"], "Power", { step: 0.1, min: 0 }),
      {
        kind: "select",
        path: ["of"],
        label: "Scales with",
        options: HEAL_OPTIONS,
        omitAt: "magic",
        fallback: "magic",
      },
    ],
  },
  modify: {
    label: "Buff or debuff",
    target: "ally",
    make: () => ({ type: "modify", modifier: { ...boost } }),
    fields: modifierFields("modifier"),
  },
  status: {
    label: "Status",
    target: "enemy",
    make: () => ({ type: "status", status: makeStatus("damage") }),
    fields: [
      { kind: "statusKind", path: ["status", "effect"], label: "Status" },
      { kind: "text", path: ["status", "name"], label: "Shown as" },
      flag(["status", "harmful"], "Harmful (Cure removes it)", true),
    ],
  },
  cleanse: {
    label: "Cleanse (removes harm)",
    target: "ally",
    make: () => ({ type: "cleanse" }),
    fields: [],
  },
  teleport: {
    label: "Teleport (caster moves)",
    target: "any",
    make: () => ({ type: "teleport" }),
    fields: [],
  },
  gauge: {
    label: "Set turn gauge",
    target: "ally",
    make: () => ({ type: "gauge", to: 1 }),
    fields: [
      num(["to"], "Gauge set to (share)", { step: 0.1, min: 0, max: 1 }),
    ],
  },
  summon: {
    label: "Summon",
    target: "any",
    make: () => ({
      type: "summon",
      creature: {
        id: "nothing",
        name: "Nothing",
        stats: {
          maxHp: 1,
          maxMp: 0,
          attack: 0,
          magic: 0,
          defense: 0,
          spirit: 0,
          speed: 0,
        },
        weapon: structuredClone(content.noWeapon),
      },
    }),
    fields: [
      { kind: "creature", path: ["source"], label: "Creature" },
      num(["limit"], "How many at once", {
        min: 1,
        fallback: 1,
        optional: true,
      }),
      flag(["anySide"], "On either side"),
    ],
  },
  shatter: {
    label: "Shatter a boulder",
    target: "any",
    make: () => ({ type: "shatter", power: 1, element: "impact" }),
    fields: [
      num(["power"], "Power (× magic)", { step: 0.1, min: 0 }),
      {
        kind: "select",
        path: ["element"],
        label: "Damage type",
        options: DAMAGE_OPTIONS,
      },
    ],
  },
  heave: {
    label: "Heave back",
    target: "any",
    make: () => ({ type: "heave", rows: 1 }),
    fields: [num(["rows"], "Rows", { min: 1, max: 2 })],
  },
  revive: {
    label: "Revive",
    target: "ally",
    make: () => ({ type: "revive", power: 1 }),
    fields: [num(["power"], "HP (× magic)", { step: 0.1, min: 0 })],
  },
  rescue: {
    label: "Rescue (pull an ally back)",
    target: "ally",
    make: () => ({ type: "rescue" }),
    fields: [],
  },
  rewind: {
    label: "Rewind (HP lost since last turn)",
    target: "ally",
    make: () => ({ type: "rewind" }),
    fields: [],
  },
  sacrifice: {
    label: "Sacrifice a summon",
    target: "any",
    make: () => ({
      type: "sacrifice",
      modifier: { ...boost, name: "Sacrifice", stat: "magic" },
    }),
    fields: modifierFields("modifier"),
  },
  restoreMp: {
    label: "Restore MP",
    target: "self",
    make: () => ({ type: "restoreMp", amount: 10 }),
    fields: [num(["amount"], "MP", { min: 0 })],
  },
};

export const EFFECT_TYPES = Object.keys(EFFECTS) as EffectType[];

export type StatusKind = StatusDef["effect"];

export interface StatusSpec {
  label: string;
  harmful: boolean;
  /** Its defaults, beside id, name, effect and harmful. */
  base: Pick<StatusDef, "stat" | "power" | "interval" | "ticks"> &
    Partial<Pick<StatusDef, "damageType">>;
  fields: FieldSpec[];
}

const S = (key: string) => ["status", key] as const;
const lasts = num(S("interval"), "Lasts (game time)", { step: 10, min: 1 });
const ticking = (label: string): FieldSpec[] => [
  {
    kind: "select",
    path: S("stat"),
    label: "Scales with",
    options: SCALE_OPTIONS,
  },
  num(S("power"), label, { step: 0.05, min: 0 }),
  num(S("interval"), "Every (game time)", { step: 10, min: 1 }),
  num(S("ticks"), "Ticks", { min: 1 }),
];
const timed = (base: Partial<StatusSpec["base"]> = {}) => ({
  stat: "magic" as const,
  power: 0,
  interval: 150,
  ticks: 1,
  ...base,
});
const STRENGTH_LABELS: Record<keyof Strengths, string> = {
  dealt: "Damage dealt ×",
  taken: "Damage taken ×",
  defense: "Defense ×",
  ambush: "Ambush power ×",
};

/** The strength fields a kind has, each showing its default. */
function strengthFields(kind: StatusKind): FieldSpec[] {
  const defaults = STRENGTH_DEFAULTS[kind];
  if (!defaults) return [];
  return Object.entries(defaults).map(([key, value]) =>
    num(S(key), STRENGTH_LABELS[key as keyof Strengths], {
      step: 0.05,
      min: 0,
      fallback: value,
      optional: true,
    }),
  );
}

const simple = (
  label: string,
  harmful: boolean,
  kind: StatusKind,
  interval = 150,
): StatusSpec => ({
  label,
  harmful,
  base: timed({ interval }),
  fields: [lasts, ...strengthFields(kind)],
});

/** Every kind of status. */
export const STATUSES: Record<StatusKind, StatusSpec> = {
  damage: {
    label: "Damage over time",
    harmful: true,
    base: {
      stat: "magic",
      power: 0.3,
      interval: 30,
      ticks: 5,
      damageType: "poison",
    },
    fields: [
      {
        kind: "select",
        path: S("damageType"),
        label: "Damage type",
        options: DAMAGE_OPTIONS,
      },
      ...ticking("Damage per tick (×)"),
    ],
  },
  heal: {
    label: "Healing over time",
    harmful: false,
    base: { stat: "magic", power: 0.4, interval: 30, ticks: 5 },
    fields: ticking("Heal per tick (×)"),
  },
  bomb: {
    label: "Bomb (explodes at the end)",
    harmful: true,
    base: {
      stat: "magic",
      power: 1,
      interval: 90,
      ticks: 1,
      damageType: "fire",
    },
    fields: [
      {
        kind: "select",
        path: S("damageType"),
        label: "Damage type",
        options: DAMAGE_OPTIONS,
      },
      {
        kind: "select",
        path: S("stat"),
        label: "Scales with",
        options: SCALE_OPTIONS,
      },
      num(S("power"), "Blast (×)", { step: 0.1, min: 0 }),
      num(S("interval"), "Fuse (game time)", { step: 10, min: 1 }),
    ],
  },
  shield: {
    label: "Shield (absorbs damage)",
    harmful: false,
    base: timed({ power: 2 }),
    fields: [
      {
        kind: "select",
        path: S("stat"),
        label: "Scales with",
        options: SCALE_OPTIONS,
      },
      num(S("power"), "Absorbs (×)", { step: 0.1, min: 0 }),
      lasts,
    ],
  },
  stealth: simple("Stealth", false, "stealth"),
  smoke: simple("Smoke (can't be singled out)", false, "smoke", 100),
  ward: simple("Ward (can't be knocked out)", false, "ward", 120),
  taunt: simple("Taunt", false, "taunt"),
  guard: simple("Guard (takes hits for it)", false, "guard"),
  coat: simple("Poison coating", false, "coat", 450),
  bless: simple("Blessing", false, "bless"),
  stoneSkin: simple("Stone Skin (unpushable)", false, "stoneSkin"),
  expose: simple("Expose", true, "expose"),
  weaken: simple("Weaken", true, "weaken"),
  silence: simple("Silence", true, "silence"),
  petrify: simple("Petrify", true, "petrify", 60),
};

export const STATUS_KINDS = Object.keys(STATUSES) as StatusKind[];
export const STATUS_OPTIONS: Option[] = STATUS_KINDS.map((k) => [
  k,
  STATUSES[k].label,
]);

/** A status of a kind with its defaults; id and name as given. */
export function makeStatus(
  kind: StatusKind,
  id: string = kind,
  name = STATUSES[kind].label.split(" (")[0]!,
): StatusDef {
  const spec = STATUSES[kind];
  return { id, name, effect: kind, harmful: spec.harmful, ...spec.base };
}

/** The fields an effect shows: its kind's, and its status kind's. */
export function effectFields(effect: SkillEffect): FieldSpec[] {
  const own = EFFECTS[effect.type]?.fields ?? [];
  return effect.type === "status"
    ? [...own, ...(STATUSES[effect.status.effect]?.fields ?? [])]
    : own;
}

/** A field's value on `of`, or its fallback when absent. */
export function readField(of: object, spec: FieldSpec): unknown {
  let at: unknown = of;
  for (const key of spec.path) {
    at =
      at && typeof at === "object"
        ? (at as Record<string, unknown>)[key]
        : undefined;
  }
  if (at !== undefined) return at;
  if (spec.kind === "number" || spec.kind === "select") return spec.fallback;
  if (spec.kind === "flag") return false;
  return undefined;
}

/**
 * `of` with the field set to `value`, as a copy. An option at its default
 * (and a flag turned off) is left out, so saved skills stay minimal.
 */
export function writeField<T extends object>(
  of: T,
  spec: FieldSpec,
  value: unknown,
): T {
  const next = structuredClone(of);
  const keys = spec.path;
  let parent = next as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) {
    parent = parent[key] as Record<string, unknown>;
  }
  const last = keys.at(-1)!;
  if (spec.kind === "statusKind") {
    const old = parent as unknown as StatusDef;
    const kind = value as StatusKind;
    const fresh = makeStatus(kind, old.id);
    Object.keys(parent).forEach((k) => delete parent[k]);
    Object.assign(parent, fresh);
    return next;
  }
  const omit =
    (spec.kind === "flag" && !spec.keep && value === false) ||
    (spec.kind === "number" && spec.optional && value === spec.fallback) ||
    (spec.kind === "select" &&
      spec.omitAt !== undefined &&
      value === spec.omitAt);
  if (omit) delete parent[last];
  else parent[last] = value;
  return next;
}
