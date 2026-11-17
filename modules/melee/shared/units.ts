import { DEFAULT_TARGETING } from "./ai";
import { resistancesFor } from "./traits";
import type {
  BattleState,
  CombatantDef,
  Control,
  Modifier,
  Position,
  Side,
  Skill,
  Unit,
} from "./types";

/**
 * A fresh battle unit for `def`, at full HP and MP, its gauge empty or at
 * its weapon's `startGauge`.
 */
export function makeUnit(
  def: CombatantDef,
  side: Side,
  position: Position,
  control: Control,
  id: string,
  modifiers: Modifier[] = [],
): Unit {
  return {
    id,
    defId: def.id,
    name: def.name,
    side,
    control,
    position: { ...position },
    base: { ...def.stats },
    weapon: { ...def.weapon },
    skills: (def.skills ?? []).map((s) => structuredClone(s)),
    targeting: { ...(def.targeting ?? DEFAULT_TARGETING) },
    resistances: resistancesFor(def),
    statuses: [],
    hp: def.stats.maxHp,
    rewindHp: def.stats.maxHp,
    mp: def.stats.maxMp,
    gauge: def.weapon.startGauge ?? 0,
    modifiers: modifiers.map((m) => ({ ...m })),
    ...(def.obstacle ? { obstacle: true } : {}),
    ...(def.portrait ? { portrait: def.portrait } : {}),
  };
}

/** Takes a summon off the field: no body, no cell, no turn. */
export function vanish(unit: Unit): void {
  unit.vanished = true;
  unit.hp = 0;
  unit.gauge = 0;
  unit.statuses = [];
  unit.position = { col: -1, row: -1 };
}

/** Takes a unit out of the queue of units waiting to act. */
export function dropReady(state: BattleState, unitId: string): void {
  state.ready = state.ready.filter((id) => id !== unitId);
}

/** Heals up to `amount`, never past max HP. Returns the HP gained. */
export function restoreHp(unit: Unit, amount: number): number {
  const gained = Math.min(unit.base.maxHp - unit.hp, amount);
  unit.hp += gained;
  return gained;
}

/** The unit's own copy of a skill, by id. */
export function findSkill(unit: Unit, skillId: string): Skill | undefined {
  return unit.skills.find((s) => s.id === skillId);
}
