import {
  cellOf,
  isAlive,
  previewDamage,
  sameCell,
  skillArea,
  skillVictims,
  unitAt,
  validateCommand,
  type BattleState,
  type Cell,
  type Command,
  type DamagePreview,
  type Skill,
  type Unit,
} from "../../shared";

// What the waiting party member's turn menu means for the board: which
// cells a tap can choose, what a tap does, and what to preview. Kept out of
// the component so each rule can be tested on its own.

/** What the active party member is choosing. */
export type Menu =
  | { kind: "attack" }
  | { kind: "move" }
  | { kind: "skills" }
  /** `aim` is the previewed cell of an area skill, before it is cast. */
  | { kind: "skill"; skill: Skill; aim: Cell | null };

/** Every turn starts here. */
export const ATTACK: Menu = { kind: "attack" };

/**
 * Identifies the turn the menu belongs to. Game time stands still during a
 * turn and always differs between two turns of the same unit, so unit +
 * time is enough. Null while nobody is waiting.
 */
export function turnKey(
  state: BattleState,
  active: Unit | null,
): string | null {
  return active ? `${active.id}@${state.time}` : null;
}

/** The command a tap on `cell` would give in this menu, valid or not. */
export function commandFor(
  state: BattleState,
  active: Unit,
  menu: Menu,
  cell: Cell,
): Command | null {
  if (menu.kind === "attack") {
    const target = unitAt(state, cell);
    return target ? { type: "attack", targetId: target.id } : null;
  }
  if (menu.kind === "skill") {
    return { type: "skill", skillId: menu.skill.id, cell };
  }
  if (menu.kind === "move" && cell.side === active.side) {
    return { type: "move", to: { col: cell.col, row: cell.row } };
  }
  return null;
}

/** Whether a tap on `cell` does something: its command is allowed. */
export function canTarget(
  state: BattleState,
  active: Unit | null,
  menu: Menu,
  cell: Cell,
): boolean {
  if (!active) return false;
  const command = commandFor(state, active, menu, cell);
  return command !== null && validateCommand(state, active, command) === null;
}

/** What a tap on a target does: give a command, or aim an area skill. */
export type Tap =
  { type: "command"; command: Command } | { type: "aim"; menu: Menu };

/**
 * Area skills take two taps: the first aims and previews, a second tap on
 * the same cell casts. Everything else acts on the first tap.
 */
export function tap(
  state: BattleState,
  active: Unit,
  menu: Menu,
  cell: Cell,
): Tap | null {
  const command = commandFor(state, active, menu, cell);
  if (!command) return null;
  if (menu.kind === "skill" && menu.skill.area !== "single") {
    if (!menu.aim || !sameCell(menu.aim, cell)) {
      return { type: "aim", menu: { ...menu, aim: cell } };
    }
  }
  return { type: "command", command };
}

/** The verb in front of a target's name for screen readers: "Attack Slime". */
export function actionName(menu: Menu): string {
  if (menu.kind === "skill") {
    return menu.skill.area === "single"
      ? menu.skill.name
      : `Aim ${menu.skill.name} at`;
  }
  return menu.kind === "move" ? "Move to" : "Attack";
}

/** The cells an aimed area skill covers, or null when nothing is aimed. */
export function aimedArea(
  state: BattleState,
  active: Unit | null,
  menu: Menu,
): Cell[] | null {
  if (menu.kind !== "skill" || !menu.aim || !active) return null;
  return skillArea(state, active, menu.skill, menu.aim);
}

/** Cells where a delayed skill will land: every living caster's zone. */
export function incomingCells(state: BattleState): Cell[] {
  return state.units.flatMap((u) =>
    u.casting && isAlive(u) ? u.casting.area : [],
  );
}

/** While choosing a cleanse target, the allies who need it stand out. */
export function emphasized(
  active: Unit | null,
  menu: Menu,
  unit: Unit,
): boolean {
  return (
    menu.kind === "skill" &&
    menu.skill.effect.type === "cleanse" &&
    isAlive(unit) &&
    unit.side === active?.side &&
    unit.statuses.some((s) => s.harmful)
  );
}

/**
 * The expected damage to show on `unit`: on every attackable enemy, on
 * every target of a single-target skill, and once an area skill is aimed,
 * on everyone it would hit, allies included.
 */
export function previewFor(
  state: BattleState,
  active: Unit | null,
  menu: Menu,
  unit: Unit,
): DamagePreview | null {
  if (!active || !isAlive(unit)) return null;
  if (menu.kind === "attack") {
    return canTarget(state, active, menu, cellOf(unit))
      ? previewDamage(active, unit)
      : null;
  }
  if (menu.kind !== "skill") return null;
  if (menu.aim) {
    const victims = skillVictims(state, active, menu.skill, menu.aim);
    return victims.includes(unit)
      ? previewDamage(active, unit, menu.skill)
      : null;
  }
  return menu.skill.area === "single" &&
    canTarget(state, active, menu, cellOf(unit))
    ? previewDamage(active, unit, menu.skill)
    : null;
}
