import { unitAt, type BattleEvent, type BattleState } from "../../shared";

/** One battle log line for an event, or null for events not worth showing. */
export function describeEvent(
  state: BattleState,
  event: BattleEvent,
): string | null {
  const name = (id: string) => state.units.find((u) => u.id === id)?.name ?? id;
  switch (event.type) {
    case "attack":
      return `${name(event.unitId)} attacks ${name(event.targetId)}`;
    case "castStarted":
      return `${name(event.unitId)} begins casting ${event.skillName}`;
    case "statusApplied":
      return `${name(event.unitId)} gains ${event.name}`;
    case "statusTick":
      // A tick that heals nothing (already at full HP) isn't worth a line.
      if (event.amount === 0) return null;
      return event.effect === "heal"
        ? `${name(event.unitId)} regains ${event.amount} HP (${event.name})`
        : `${name(event.unitId)} takes ${event.amount} ${event.damageType ?? ""} damage (${event.name})`;
    case "statusRemoved":
      return `${name(event.unitId)} is cured of ${event.name}`;
    case "statusExpired":
      return `${name(event.unitId)}'s ${event.name} wears off`;
    case "castFizzled":
      return `${name(event.unitId)}'s ${event.skillName} fizzles`;
    case "skill": {
      if (event.delayed) return `${event.skillName} strikes!`;
      const aimed = unitAt(state, event.cell);
      const caster = `${name(event.unitId)} casts ${event.skillName}`;
      if (!aimed) return caster;
      return event.area.length > 1
        ? `${caster} at ${aimed.name}`
        : `${caster} on ${aimed.name}`;
    }
    case "moved": {
      const direction =
        event.to.row < event.from.row
          ? "forward"
          : event.to.row > event.from.row
            ? "back"
            : event.to.col < event.from.col
              ? "left"
              : "right";
      return `${name(event.unitId)} steps ${direction}`;
    }
    case "heal":
      return `${name(event.unitId)} recovers ${event.amount} HP`;
    case "damage": {
      const note =
        event.multiplier === 0
          ? " (immune)"
          : event.multiplier > 1
            ? " (weak)"
            : event.multiplier < 1
              ? " (resisted)"
              : "";
      return `${name(event.unitId)} takes ${event.amount} ${event.damageType} damage${note}`;
    }
    case "knockedOut":
      return `${name(event.unitId)} is knocked out`;
    case "modifierExpired":
      return `${name(event.unitId)}'s ${event.source} wears off`;
    case "battleOver":
      return event.winner === "player"
        ? "Victory!"
        : event.winner === "enemy"
          ? "Defeat…"
          : "Draw";
    case "timeAdvanced":
    case "turnReady":
      return null;
  }
}
