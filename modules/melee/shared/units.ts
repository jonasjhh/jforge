import { DEFAULT_TARGETING } from "./ai";
import type {
  CombatantDef,
  Control,
  Modifier,
  Position,
  Side,
  Unit,
} from "./types";

/** A fresh battle unit for `def`, at full HP and MP with an empty gauge. */
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
    resistances: { ...def.resistances },
    statuses: [],
    hp: def.stats.maxHp,
    mp: def.stats.maxMp,
    gauge: 0,
    modifiers: modifiers.map((m) => ({ ...m })),
    ...(def.obstacle ? { obstacle: true } : {}),
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
