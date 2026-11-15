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
    case "skill": {
      const aimed = unitAt(state, event.cell);
      const caster = `${name(event.unitId)} casts ${event.skillName}`;
      if (!aimed) return caster;
      return event.area.length > 1
        ? `${caster} at ${aimed.name}`
        : `${caster} on ${aimed.name}`;
    }
    case "heal":
      return `${name(event.unitId)} recovers ${event.amount} HP`;
    case "damage":
      return `${name(event.unitId)} takes ${event.amount} damage`;
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
