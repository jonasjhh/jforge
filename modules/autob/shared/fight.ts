import { DEFENCE_K, type UnitDef, type Side } from "./types";
import {
  resistancesFor,
  type DamageType,
  type Resistances,
  type Skill,
  type SkillEffect,
  type StatName,
} from "@jforge/rules/core";
import { distance, neighbours, sameHex, type Hex } from "./hex";
import { nextRandom } from "./random";

// Autob's own fight: real time in ticks, on the hex arena (see hex.ts).
// Every unit walks to the nearest enemy, attacks it whenever its attack
// is ready, and fills its mana by attacking and being hit; with full mana
// it casts its next skill instead. It fields the catalogue's designs (stats,
// weapons, skills) but none of the battle engine: only a subset of skill
// effects works here, the rest are skipped. Plain data, like melee's
// battle, so it can be stepped by the UI or run to the end at once.

/** A tick is a tenth of a second; melee's game time 100 is one second. */
export const TICKS_PER_SECOND = 10;
const GAME_TIME_PER_TICK = 10;
/** A fight still on after this long is a draw. */
export const FIGHT_TICKS = 30 * TICKS_PER_SECOND;
/** Ticks between attacks at speed 10; faster units attack more often. */
export const ATTACK_TICKS = 10;
const MIN_ATTACK_TICKS = 3;
/** Ticks a step to the next hex takes. */
export const MOVE_TICKS = 5;
/** Hexes a weapon reaches: melee next to it, ranged this far. */
export const RANGED_RANGE = 4;
export const MANA_PER_ATTACK = 10;
export const MANA_PER_HIT = 5;
/** Mana a skill needs: MANA_BASE + MANA_PER_MP x its MP cost. */
export const MANA_BASE = 30;
export const MANA_PER_MP = 5;
const VARIANCE = 0.1;
/** A finisher's default HP threshold, as in melee. */
const FINISH_BELOW = 0.3;

/** The effects autob's fight knows; skills with others are skipped. */
const SUPPORTED: SkillEffect["type"][] = [
  "strike",
  "damage",
  "heal",
  "modify",
  "status",
];
const SUPPORTED_STATUSES = ["heal", "damage", "shield"];

export interface TimedModifier {
  name: string;
  stat: StatName;
  op: "add" | "mul";
  value: number;
  /** The tick it ends at. */
  until: number;
}

/** Heal or damage over time. */
export interface Ticking {
  name: string;
  amount: number;
  damageType?: DamageType;
  /** Ticks between two of its ticks. */
  every: number;
  next: number;
  left: number;
  harm: boolean;
}

export interface Fighter {
  id: string;
  name: string;
  side: Side;
  def: UnitDef;
  hex: Hex;
  hp: number;
  mana: number;
  /** Damage absorbed before HP. */
  shield: number;
  resistances: Resistances;
  /** The tick it may next attack, and next step. */
  attackAt: number;
  moveAt: number;
  targetId: string | null;
  /** Which of its castable skills comes next. */
  skillIndex: number;
  modifiers: TimedModifier[];
  ticking: Ticking[];
}

export type FightEvent =
  | { kind: "attack"; source: string; target: string }
  | { kind: "cast"; source: string; skill: string }
  | { kind: "damage"; target: string; amount: number }
  | { kind: "heal"; target: string; amount: number }
  | { kind: "fall"; target: string };

export interface Fight {
  tick: number;
  fighters: Fighter[];
  random: number;
  winner: Side | "draw" | null;
  /** What happened in the last tick. */
  events: FightEvent[];
}

/** A unit and where it starts, in arena hexes. */
export interface FightEntry {
  def: UnitDef;
  side: Side;
  hex: Hex;
}

export function createFight(entries: FightEntry[], seed: number): Fight {
  const fighters = entries.map(({ def, side, hex }, i): Fighter => ({
    id: `${side}-${i}-${def.id}`,
    name: def.name,
    side,
    def,
    hex,
    hp: def.stats.maxHp,
    mana: 0,
    shield: 0,
    resistances: resistancesFor(def),
    attackAt: attackTicks(def.stats.speed),
    moveAt: 0,
    targetId: null,
    skillIndex: 0,
    modifiers: [],
    ticking: [],
  }));
  return { tick: 0, fighters, random: seed >>> 0, winner: null, events: [] };
}

/** A stat with its timed modifiers: adds first, then multiplies. */
export function statOf(f: Fighter, stat: StatName): number {
  let add = 0;
  let mul = 1;
  for (const m of f.modifiers) {
    if (m.stat !== stat) continue;
    if (m.op === "add") add += m.value;
    else mul *= m.value;
  }
  return Math.max(0, (f.def.stats[stat] + add) * mul);
}

export const maxHpOf = (f: Fighter) => f.def.stats.maxHp;

export function attackTicks(speed: number): number {
  if (speed <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(MIN_ATTACK_TICKS, Math.round((ATTACK_TICKS * 10) / speed));
}

export const rangeOf = (def: UnitDef) =>
  def.weapon.kind === "ranged" ? RANGED_RANGE : 1;

/** The skills a unit can cast here, in its own order. */
export function castable(def: UnitDef): Skill[] {
  return (def.skills ?? []).filter(
    (s) =>
      SUPPORTED.includes(s.effect.type) &&
      (s.effect.type !== "status" ||
        SUPPORTED_STATUSES.includes(s.effect.status.effect)),
  );
}

export const manaCost = (skill: Skill) =>
  MANA_BASE + MANA_PER_MP * skill.mpCost;

const alive = (f: Fighter) => f.hp > 0;

/** A fight, worked on in place within one tick. */
interface Work {
  tick: number;
  fighters: Fighter[];
  random: number;
  events: FightEvent[];
}

function roll(w: Work): number {
  const { value, state } = nextRandom(w.random);
  w.random = state;
  return value;
}

const byId = (w: Work, id: string | null) =>
  w.fighters.find((f) => f.id === id && alive(f));

const enemiesOf = (w: Work, f: Fighter) =>
  w.fighters.filter((o) => o.side !== f.side && alive(o));
const alliesOf = (w: Work, f: Fighter) =>
  w.fighters.filter((o) => o.side === f.side && alive(o));

/** The nearest of `among` to `f`; ties to the weakest, then the first. */
function nearest(f: Fighter, among: Fighter[]): Fighter | undefined {
  return [...among].sort(
    (a, b) =>
      distance(f.hex, a.hex) - distance(f.hex, b.hex) ||
      a.hp - b.hp ||
      a.id.localeCompare(b.id),
  )[0];
}

const mostHurt = (among: Fighter[]) =>
  [...among].sort(
    (a, b) => a.hp / maxHpOf(a) - b.hp / maxHpOf(b) || a.id.localeCompare(b.id),
  )[0];

function damage(
  w: Work,
  target: Fighter,
  amount: number,
  type: DamageType,
): number {
  const multiplier = target.resistances[type] ?? 1;
  if (multiplier === 0 || !alive(target)) return 0;
  const variance = 1 - VARIANCE + roll(w) * VARIANCE * 2;
  let left = Math.max(1, Math.round(amount * multiplier * variance));
  const dealt = left;
  const absorbed = Math.min(target.shield, left);
  target.shield -= absorbed;
  left -= absorbed;
  target.hp = Math.max(0, target.hp - left);
  target.mana += MANA_PER_HIT;
  w.events.push({ kind: "damage", target: target.id, amount: dealt });
  if (!alive(target)) w.events.push({ kind: "fall", target: target.id });
  return dealt;
}

function heal(w: Work, target: Fighter, amount: number) {
  if (!alive(target)) return;
  const healed = Math.min(Math.round(amount), maxHpOf(target) - target.hp);
  target.hp += healed;
  if (healed > 0)
    w.events.push({ kind: "heal", target: target.id, amount: healed });
}

/** A physical hit at `power`: attack x K / (K + defence). */
function physical(
  w: Work,
  source: Fighter,
  target: Fighter,
  power: number,
  pierce = 0,
): number {
  const defence = statOf(target, "defence") * (1 - pierce);
  const raw =
    statOf(source, "attack") * power * (DEFENCE_K / (DEFENCE_K + defence));
  return damage(w, target, raw, source.def.weapon.damageType);
}

/** A magical hit at `power`: magic x K / (K + spirit). */
function magical(
  w: Work,
  source: Fighter,
  target: Fighter,
  power: number,
  type: DamageType,
): number {
  const spirit = statOf(target, "spirit");
  const raw =
    statOf(source, "magic") * power * (DEFENCE_K / (DEFENCE_K + spirit));
  return damage(w, target, raw, type);
}

function attack(w: Work, f: Fighter, target: Fighter) {
  w.events.push({ kind: "attack", source: f.id, target: target.id });
  physical(w, f, target, 1);
  f.mana += MANA_PER_ATTACK;
}

/** Who a skill hits, centred on `target`. */
function area(w: Work, f: Fighter, skill: Skill, target: Fighter): Fighter[] {
  const side = w.fighters.filter((o) => o.side === target.side && alive(o));
  switch (skill.area) {
    case "plus":
    case "square":
      return side.filter((o) => distance(o.hex, target.hex) <= 1);
    case "line":
      return side.filter(
        (o) =>
          o === target ||
          (distance(o.hex, target.hex) === 1 &&
            distance(f.hex, o.hex) === distance(f.hex, target.hex) + 1),
      );
    case "row":
      return side.filter((o) => o.hex.row === target.hex.row);
    case "reach":
      return side.filter((o) => distance(f.hex, o.hex) <= rangeOf(f.def));
    default:
      return [target];
  }
}

const helps = (effect: SkillEffect) =>
  effect.type === "heal" ||
  (effect.type === "modify" && !effect.modifier.harmful) ||
  (effect.type === "status" && !effect.status.harmful);

/** Whom a skill aims at; undefined when there is nobody to aim at. */
function aimOf(w: Work, f: Fighter, skill: Skill): Fighter | undefined {
  if (skill.target === "self") return f;
  const friendly =
    skill.target === "ally" || (skill.target === "any" && helps(skill.effect));
  if (friendly) {
    const allies = alliesOf(w, f).filter((a) => !skill.notSelf || a !== f);
    return mostHurt(allies);
  }
  const current = byId(w, f.targetId);
  const target = current ?? nearest(f, enemiesOf(w, f));
  return target && distance(f.hex, target.hex) <= rangeOf(f.def)
    ? target
    : undefined;
}

function apply(w: Work, f: Fighter, skill: Skill, target: Fighter) {
  const effect = skill.effect;
  switch (effect.type) {
    case "strike": {
      const below = effect.finishBelow ?? FINISH_BELOW;
      const finishing =
        effect.finisher && target.hp / maxHpOf(target) < below
          ? effect.finisher
          : 1;
      physical(w, f, target, effect.power * finishing, effect.armourPierce);
      return;
    }
    case "damage": {
      const dealt = magical(w, f, target, effect.power, effect.element);
      if (effect.drain) heal(w, f, dealt * effect.drain);
      return;
    }
    case "heal":
      heal(
        w,
        target,
        effect.power *
          (effect.of === "maxHp" ? maxHpOf(target) : statOf(f, "magic")),
      );
      return;
    case "modify": {
      const m = effect.modifier;
      target.modifiers = [
        ...target.modifiers.filter((o) => o.name !== m.name),
        {
          name: m.name,
          stat: m.stat,
          op: m.op,
          value: m.value,
          until: w.tick + Math.round(m.duration / GAME_TIME_PER_TICK),
        },
      ];
      return;
    }
    case "status": {
      const s = effect.status;
      const amount = s.power * statOf(f, s.stat);
      if (s.effect === "shield") {
        target.shield = Math.max(target.shield, Math.round(amount));
        return;
      }
      const every = Math.max(1, Math.round(s.interval / GAME_TIME_PER_TICK));
      target.ticking = [
        ...target.ticking.filter((t) => t.name !== s.name),
        {
          name: s.name,
          amount,
          damageType: s.damageType,
          every,
          next: w.tick + every,
          left: s.ticks,
          harm: s.effect === "damage",
        },
      ];
      return;
    }
  }
}

/** Casts the next skill if the mana is there and it has a target. */
function tryCast(w: Work, f: Fighter): boolean {
  const skills = castable(f.def);
  if (skills.length === 0) return false;
  const skill = skills[f.skillIndex % skills.length]!;
  if (f.mana < manaCost(skill)) return false;
  const target = aimOf(w, f, skill);
  if (!target) return false;
  w.events.push({ kind: "cast", source: f.id, skill: skill.name });
  f.mana = 0;
  f.skillIndex += 1;
  for (const hit of area(w, f, skill, target)) apply(w, f, skill, hit);
  return true;
}

/**
 * The first step on a shortest way to any hex from which `f` reaches an
 * enemy; null when there is no way.
 */
function stepToward(w: Work, f: Fighter): Hex | null {
  const enemies = enemiesOf(w, f);
  const range = rangeOf(f.def);
  const taken = w.fighters.filter((o) => alive(o) && o !== f);
  const free = (h: Hex) => !taken.some((o) => sameHex(o.hex, h));
  const goal = (h: Hex) => enemies.some((e) => distance(h, e.hex) <= range);
  const key = (h: Hex) => `${h.col},${h.row}`;
  const seen = new Set([key(f.hex)]);
  let frontier: { hex: Hex; first: Hex }[] = neighbours(f.hex)
    .filter(free)
    .map((hex) => ({ hex, first: hex }));
  for (const n of frontier) seen.add(key(n.hex));
  while (frontier.length > 0) {
    const reached = frontier.find((n) => goal(n.hex));
    if (reached) return reached.first;
    const next: typeof frontier = [];
    for (const { hex, first } of frontier) {
      for (const h of neighbours(hex)) {
        if (seen.has(key(h)) || !free(h)) continue;
        seen.add(key(h));
        next.push({ hex: h, first });
      }
    }
    frontier = next;
  }
  return null;
}

function act(w: Work, f: Fighter) {
  // Speed 0 is an obstacle's: it never acts.
  if (!alive(f) || statOf(f, "speed") <= 0 || enemiesOf(w, f).length === 0) {
    return;
  }
  let target = byId(w, f.targetId);
  const inRange = (t: Fighter | undefined) =>
    t !== undefined && distance(f.hex, t.hex) <= rangeOf(f.def);
  if (!inRange(target)) {
    const near = nearest(f, enemiesOf(w, f));
    target = inRange(near) ? near : undefined;
    f.targetId = near?.id ?? null;
  }
  if (target) {
    if (w.tick < f.attackAt) return;
    f.attackAt = w.tick + attackTicks(statOf(f, "speed"));
    if (!tryCast(w, f)) attack(w, f, target);
    return;
  }
  if (w.tick < f.moveAt) return;
  const step = stepToward(w, f);
  if (step) {
    f.hex = step;
    f.moveAt = w.tick + MOVE_TICKS;
  }
}

function tickOver(w: Work, f: Fighter) {
  f.modifiers = f.modifiers.filter((m) => m.until > w.tick);
  for (const t of f.ticking) {
    if (t.next !== w.tick || !alive(f)) continue;
    if (t.harm) damage(w, f, t.amount, t.damageType ?? "poison");
    else heal(w, f, t.amount);
    t.left -= 1;
    t.next += t.every;
  }
  f.ticking = f.ticking.filter((t) => t.left > 0);
}

function winnerOf(fighters: Fighter[], tick: number): Fight["winner"] {
  const standing = (side: Side) =>
    fighters.some((f) => f.side === side && alive(f));
  const player = standing("player");
  const enemy = standing("enemy");
  if (player && enemy) return tick >= FIGHT_TICKS ? "draw" : null;
  if (player) return "player";
  if (enemy) return "enemy";
  return "draw";
}

/** The fight one tick on; a finished fight stays as it is. */
export function step(fight: Fight): Fight {
  if (fight.winner) return fight;
  const w: Work = {
    tick: fight.tick + 1,
    fighters: fight.fighters.map((f) => ({
      ...f,
      hex: { ...f.hex },
      modifiers: [...f.modifiers],
      ticking: f.ticking.map((t) => ({ ...t })),
    })),
    random: fight.random,
    events: [],
  };
  for (const f of w.fighters) tickOver(w, f);
  for (const f of w.fighters) act(w, f);
  return {
    tick: w.tick,
    fighters: w.fighters,
    random: w.random,
    winner: winnerOf(w.fighters, w.tick),
    events: w.events,
  };
}

/** A fight played to its end. */
export function runFight(fight: Fight): Fight {
  let next = fight;
  while (!next.winner) next = step(next);
  return next;
}
