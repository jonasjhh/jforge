import { applyDamage, magicalHit, physicalHit } from "./damage";
import { COLLISION_POWER, moveBy, pushBlocker, pushDestination } from "./push";
import { canReach, reachableTargets } from "./reach";
import { breakStealth, isStealthed } from "./stealth";
import { charge, chargeBlock, charged } from "./charge";
import { guardianOf } from "./guard";
import { IGNITE_BURN } from "./ignite";
import { PIN_SLOW } from "./pin";
import { rescue, rescueBlock } from "./rescue";
import { tauntBlock } from "./taunt";
import {
  GRID_COLUMNS,
  GRID_ROWS,
  areaCells,
  cellOf,
  isCellOnGrid,
  unitAt,
} from "./grid";
import { applyModifier, applyStatus, cleanse, spellPower } from "./status";
import { GAUGE_FULL } from "./timeline";
import { effectiveStat, isAlive } from "./stats";
import { dropReady, findSkill, makeUnit, restoreHp, vanish } from "./units";
import type {
  BattleEvent,
  BattleState,
  Cell,
  Skill,
  SkillEffect,
  Unit,
} from "./types";

/**
 * The HP a heal restores to `target`: power x the caster's magic, or power
 * x the target's max HP for a heal `of` max HP. At least 1.
 */
export function healAmount(
  caster: Unit,
  target: Unit,
  effect: Extract<SkillEffect, { type: "heal" }>,
): number {
  const scale =
    effect.of === "maxHp"
      ? effectiveStat(target, "maxHp")
      : effectiveStat(caster, "magic");
  return Math.max(1, Math.round(effect.power * scale));
}

/** Enough MP, and more HP than an HP cost (it may never be fatal). */
export function canAfford(unit: Unit, skill: Skill): boolean {
  return unit.mp >= skill.mpCost && unit.hp > (skill.hpCost ?? 0);
}

/** Why `unit` cannot aim `skill` at `cell` right now, or null if it can. */
export function validateSkill(
  state: BattleState,
  unit: Unit,
  skill: Skill | undefined,
  cell: Cell,
): string | null {
  if (!skill) return "Unknown skill";
  if (unit.statuses.some((s) => s.effect === "silence")) {
    return `${unit.name} is silenced`;
  }
  if (unit.mp < skill.mpCost) return `Not enough MP for ${skill.name}`;
  if (!canAfford(unit, skill)) return `Not enough HP for ${skill.name}`;
  if (!isCellOnGrid(cell)) return "That cell is off the battlefield";
  if (skill.effect.type === "teleport") {
    if (cell.side !== unit.side) return "Move within your own side";
    if (unitAt(state, cell)) return "That cell is occupied";
    return null;
  }
  if (skill.effect.type === "summon") {
    // An empty cell (on the caster's side unless anySide), or the cell of
    // one of the caster's own summons of that kind, which it replaces.
    const { creature, anySide } = skill.effect;
    if (!anySide && cell.side !== unit.side) return "Summon on your own side";
    const there = unitAt(state, cell);
    const ownKind =
      there?.summonedBy === unit.id &&
      there.defId === creature.id &&
      isAlive(there);
    if (there && !ownKind) return "That cell is occupied";
    return null;
  }
  if (skill.effect.type === "heave") {
    const target = unitAt(state, cell);
    if (!target || !isAlive(target)) return `${skill.name} needs a unit there`;
    if (target.side !== unit.side && isStealthed(target)) {
      return `${target.name} can't be seen`;
    }
    return null;
  }
  if (skill.effect.type === "shatter") {
    const boulder = unitAt(state, cell);
    if (
      !boulder ||
      !boulder.obstacle ||
      !isAlive(boulder) ||
      boulder.summonedBy !== unit.id
    ) {
      return `${skill.name} needs one of your boulders`;
    }
    return null;
  }
  if (skill.effect.type === "revive") {
    const fallen = unitAt(state, cell);
    if (!fallen || fallen.side !== unit.side || fallen.obstacle) {
      return `${skill.name} needs a fallen ally`;
    }
    if (isAlive(fallen)) return `${fallen.name} is still standing`;
    return null;
  }
  if (skill.target === "any") return null;

  const target = unitAt(state, cell);
  if (!target) return `${skill.name} needs a target in that cell`;
  const sameSide = target.side === unit.side;
  if (target.obstacle && skill.target === "ally") {
    return `${skill.name} can't target a boulder`;
  }
  if ((skill.target === "ally" || skill.target === "self") && !sameSide) {
    return `${skill.name} targets an ally`;
  }
  if (skill.target === "enemy" && sameSide) {
    return `${skill.name} targets an enemy`;
  }
  if (!isAlive(target)) return "Target is knocked out";
  if (skill.target === "self" && target.id !== unit.id) {
    return `${skill.name} can only target its caster`;
  }
  if (!sameSide && skill.area === "single" && isStealthed(target)) {
    return `${target.name} can't be seen`;
  }
  if (skill.notSelf && target.id === unit.id) {
    return `${skill.name} can't target its caster`;
  }
  if (skill.notFromFront && unit.position.row === 0) {
    return `${skill.name} can't be used while locked in hand-to-hand combat in the front row`;
  }
  if (skill.adjacent) {
    const dc = Math.abs(target.position.col - unit.position.col);
    const dr = Math.abs(target.position.row - unit.position.row);
    if (!sameSide || dc + dr !== 1) {
      return `${skill.name} needs a unit next to you`;
    }
  }
  if (skill.effect.type === "rescue") return rescueBlock(state, unit, target);
  if (skill.effect.type === "gauge") {
    if (target.casting) return `${target.name} is busy casting`;
    if (state.ready.includes(target.id))
      return `${target.name} is already ready`;
  }
  // A charge reaches from the front row it runs to.
  const striker =
    skill.effect.type === "strike" && skill.effect.advance
      ? charged(unit)
      : unit;
  if (striker !== unit) {
    const blocked = chargeBlock(state, unit);
    if (blocked) return blocked;
  }
  if (
    skill.effect.type === "strike" &&
    !canReach(state, striker, target, {
      ignoreCover: skill.effect.ignoreCover,
    })
  ) {
    return "Target is out of reach";
  }
  if (!sameSide && skill.area === "single") {
    // Taunting enemies must be singled out while they can be.
    const candidates =
      skill.effect.type === "strike"
        ? reachableTargets(state, striker, {
            ignoreCover: skill.effect.ignoreCover,
          })
        : state.units.filter(
            (u) => u.side !== unit.side && isAlive(u) && !isStealthed(u),
          );
    return tauntBlock(candidates, target);
  }
  return null;
}

/** Every cell `unit` may aim `skill` at (empty if it cannot afford it). */
export function skillCells(
  state: BattleState,
  unit: Unit,
  skill: Skill,
): Cell[] {
  const cells: Cell[] = [];
  for (const side of ["enemy", "player"] as const) {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLUMNS; col++) {
        const cell = { side, col, row };
        if (validateSkill(state, unit, skill, cell) === null) cells.push(cell);
      }
    }
  }
  return cells;
}

/**
 * The cells `unit`'s skill aimed at `cell` covers. A "reach" area is every
 * enemy the unit's weapon can reach right now.
 */
export function skillArea(
  state: BattleState,
  unit: Unit,
  skill: Skill,
  cell: Cell,
): Cell[] {
  if (skill.area === "reach") {
    const ignoreCover =
      skill.effect.type === "strike" && skill.effect.ignoreCover;
    return reachableTargets(state, unit, { ignoreCover }).map(cellOf);
  }
  return areaCells(cell, skill.area);
}

/**
 * The living units `unit`'s skill aimed at `cell` would hit, friend or foe.
 * Shatter destroys its boulder before the blast, so the boulder isn't one.
 */
export function skillVictims(
  state: BattleState,
  unit: Unit,
  skill: Skill,
  cell: Cell,
): Unit[] {
  const spared = skill.effect.type === "shatter" ? unitAt(state, cell) : null;
  const victims = skillArea(state, unit, skill, cell).flatMap((c) => {
    const victim = unitAt(state, c);
    return victim && victim !== spared && isAlive(victim) ? [victim] : [];
  });
  const guardian = guardedHit(state, unit, skill, victims);
  return guardian ? [guardian] : victims;
}

/**
 * The guardian a single-target strike or damage spell lands on instead of
 * the one victim it was aimed at, or null if it lands as aimed.
 */
function guardedHit(
  state: BattleState,
  unit: Unit,
  skill: Skill,
  victims: Unit[],
): Unit | null {
  const { type } = skill.effect;
  if (skill.area !== "single" || (type !== "strike" && type !== "damage")) {
    return null;
  }
  const [aimed] = victims;
  return aimed && victims.length === 1 ? guardianOf(state, unit, aimed) : null;
}

/**
 * Uses a skill that has already been validated. An instant skill is paid
 * for and lands now; a delayed one is paid for and starts casting.
 */
export function castSkill(
  state: BattleState,
  unit: Unit,
  skill: Skill,
  cell: Cell,
  events: BattleEvent[],
): void {
  unit.mp -= skill.mpCost;
  if (skill.hpCost) {
    unit.hp -= skill.hpCost;
    events.push({
      type: "hpPaid",
      unitId: unit.id,
      amount: skill.hpCost,
      hp: unit.hp,
    });
  }
  if (!skill.castTime) {
    applySkill(state, unit, skill, cell, events, false);
    return;
  }
  const area = skillArea(state, unit, skill, cell);
  const readyAt = state.time + skill.castTime;
  unit.casting = {
    skillId: skill.id,
    skillName: skill.name,
    cell,
    area,
    startedAt: state.time,
    readyAt,
  };
  events.push({
    type: "castStarted",
    unitId: unit.id,
    skillId: skill.id,
    skillName: skill.name,
    cell,
    area,
    readyAt,
    mp: unit.mp,
  });
}

/** Lands a delayed skill whose cast has finished. */
export function landCast(
  state: BattleState,
  unit: Unit,
  events: BattleEvent[],
): void {
  const casting = unit.casting;
  if (!casting) return;
  unit.casting = undefined;
  const skill = findSkill(unit, casting.skillId);
  if (skill) applySkill(state, unit, skill, casting.cell, events, true);
}

/** The skill's effect on everyone in its area, right now. */
function applySkill(
  state: BattleState,
  unit: Unit,
  skill: Skill,
  cell: Cell,
  events: BattleEvent[],
  delayed: boolean,
): void {
  const aimedAt = unitAt(state, cell);
  events.push({
    type: "skill",
    unitId: unit.id,
    cell,
    area: skillArea(state, unit, skill, cell),
    skillId: skill.id,
    skillName: skill.name,
    mp: unit.mp,
    ...(aimedAt ? { targetId: aimedAt.id } : {}),
    ...(delayed ? { delayed: true } : {}),
  });

  if (skill.effect.type === "summon") {
    summon(state, unit, skill.effect, cell, events);
    return;
  }
  if (skill.effect.type === "shatter") {
    const boulder = unitAt(state, cell);
    if (boulder) {
      vanish(boulder);
      events.push({ type: "shattered", unitId: boulder.id, byId: unit.id });
    }
    for (const target of skillVictims(state, unit, skill, cell)) {
      const hit = magicalHit(
        state,
        unit,
        target,
        skill.effect.power,
        skill.effect.element,
      );
      applyDamage(state, target, hit, events);
    }
    return;
  }
  if (skill.effect.type === "heave") {
    const target = unitAt(state, cell);
    if (target) {
      const to = pushDestination(state, target, skill.effect.rows);
      if (to) moveBy(target, to, events);
      else events.push({ type: "unmoved", unitId: target.id });
    }
    return;
  }
  if (skill.effect.type === "revive") {
    // A delayed revive finds its ally already up (or gone): nothing happens.
    const fallen = unitAt(state, cell);
    if (fallen && !isAlive(fallen) && !fallen.vanished) {
      revive(fallen, skill.effect.power * effectiveStat(unit, "magic"), events);
    }
    return;
  }
  if (skill.effect.type === "rescue") {
    if (aimedAt && isAlive(aimedAt)) rescue(state, unit, aimedAt, events);
    return;
  }
  if (skill.effect.type === "teleport") {
    const from = { ...unit.position };
    unit.position = { col: cell.col, row: cell.row };
    events.push({
      type: "teleported",
      unitId: unit.id,
      from,
      to: { ...unit.position },
    });
    return;
  }
  // The first damaging action out of stealth is an ambush.
  const ambush =
    skill.effect.type === "damage" || skill.effect.type === "strike"
      ? breakStealth(unit, events)
      : 1;

  if (skill.effect.type === "strike" && skill.effect.advance) {
    charge(unit, events);
  }
  // Victims are fixed before any effect lands, so order doesn't matter.
  const victims = skillVictims(state, unit, skill, cell);
  const guardian = victims[0];
  if (aimedAt && skill.area === "single" && guardian && guardian !== aimedAt) {
    events.push({ type: "guarded", unitId: aimedAt.id, byId: guardian.id });
  }
  for (const target of victims) {
    const effect = skill.effect;
    switch (effect.type) {
      case "heal": {
        const amount = restoreHp(target, healAmount(unit, target, effect));
        events.push({ type: "heal", unitId: target.id, amount, hp: target.hp });
        break;
      }
      case "status":
        applyStatus(state, unit, target, effect.status, events);
        break;
      case "cleanse":
        cleanse(target, events);
        break;
      case "modify":
        applyModifier(state, target, effect.modifier, events);
        break;
      case "gauge":
        target.gauge = effect.to * GAUGE_FULL;
        events.push({
          type: "gaugeChanged",
          unitId: target.id,
          gauge: target.gauge,
        });
        // A full gauge means it acts next, right after this turn ends.
        if (target.gauge >= GAUGE_FULL && !state.ready.includes(target.id)) {
          state.ready.splice(state.ready[0] === unit.id ? 1 : 0, 0, target.id);
        }
        break;
      case "strike": {
        // Decide the move first: a blocked push hits harder instead, and
        // the crash is reported before the blow it causes.
        const to = effect.push
          ? pushDestination(state, target, effect.push)
          : undefined;
        const blocked = to === null;
        if (blocked && effect.push) {
          const blocker = pushBlocker(state, target, effect.push);
          events.push({
            type: "collided",
            unitId: target.id,
            ...(blocker ? { blockerId: blocker.id } : {}),
          });
        }
        const power = effect.power * (blocked ? COLLISION_POWER : 1) * ambush;
        applyDamage(
          state,
          target,
          physicalHit(
            state,
            unit,
            target,
            power,
            // A crash into something is impact damage.
            blocked ? "impact" : unit.weapon.damageType,
          ),
          events,
        );
        if (to && isAlive(target)) moveBy(target, to, events);
        if (effect.pin && isAlive(target) && !target.obstacle) {
          applyModifier(state, target, PIN_SLOW, events);
        }
        if (effect.ignite && isAlive(target) && !target.obstacle) {
          applyStatus(state, unit, target, IGNITE_BURN, events);
        }
        break;
      }
      case "damage": {
        const hit = magicalHit(
          state,
          unit,
          target,
          spellPower(effect, target, victims.length) * ambush,
          effect.element,
        );
        const suffered = applyDamage(state, target, hit, events);
        if (effect.burnMp && isAlive(target) && target.mp > 0) {
          const amount = Math.min(target.mp, effect.burnMp);
          target.mp -= amount;
          events.push({
            type: "mpBurned",
            unitId: target.id,
            amount,
            mp: target.mp,
          });
        }
        if (effect.drain && isAlive(unit)) {
          // Only damage that got through (not into a shield) is drained.
          const amount = restoreHp(
            unit,
            Math.floor(suffered.lost * effect.drain),
          );
          if (amount > 0) {
            events.push({ type: "heal", unitId: unit.id, amount, hp: unit.hp });
          }
        }
        break;
      }
    }
  }
}

/** Back on its feet with `amount` HP (at least 1), its turn starting over. */
function revive(unit: Unit, amount: number, events: BattleEvent[]): void {
  unit.hp = Math.min(unit.base.maxHp, Math.max(1, Math.round(amount)));
  unit.gauge = 0;
  events.push({ type: "revived", unitId: unit.id, hp: unit.hp });
}

/**
 * Puts a new unit for the effect's creature in `cell`, controlled like the
 * caster. If the aimed cell holds one of the caster's summons of that kind,
 * it is replaced; otherwise, at the limit, the oldest one vanishes.
 */
function summon(
  state: BattleState,
  caster: Unit,
  effect: Extract<SkillEffect, { type: "summon" }>,
  cell: Cell,
  events: BattleEvent[],
): void {
  const { creature } = effect;
  const limit = effect.limit ?? 1;
  const mine = () =>
    state.units.filter(
      (u) =>
        u.summonedBy === caster.id && u.defId === creature.id && !u.vanished,
    );
  const remove = (old: Unit) => {
    vanish(old);
    dropReady(state, old.id);
    events.push({ type: "vanished", unitId: old.id });
  };
  const inCell = unitAt(state, cell);
  if (inCell && mine().includes(inCell)) remove(inCell);
  // Oldest first: units are appended as they are summoned.
  while (mine().length >= limit) remove(mine()[0]!);

  state.summons += 1;
  const unit = makeUnit(
    creature,
    cell.side,
    { col: cell.col, row: cell.row },
    caster.control,
    `summon-${state.summons}`,
  );
  unit.summonedBy = caster.id;
  state.units.push(unit);
  events.push({ type: "summoned", unitId: unit.id, byId: caster.id, cell });
}
