import type { BattleEvent, BattleState } from "../../shared";
import { describeEvent } from "./describeEvent";

type ActionEvent = Extract<
  BattleEvent,
  { type: "attack" | "skill" | "moved" | "castStarted" }
>;

/** The action in a step's events: an attack, skill, step or cast start. */
export function findAction(events: BattleEvent[]): ActionEvent | undefined {
  return events.find(
    (e): e is ActionEvent =>
      e.type === "attack" ||
      e.type === "skill" ||
      e.type === "moved" ||
      e.type === "castStarted",
  );
}

/**
 * One line for the action in a step and what it did, e.g. "Wolf attacks
 * Fighter — 12" or "Mage casts Meteor at Slime A — 3 hit, Slime A KO".
 * Null when the step holds no action.
 */
export function summarizeAction(
  state: BattleState,
  events: BattleEvent[],
): string | null {
  const action = findAction(events);
  if (!action) return null;
  const text = describeEvent(state, action);
  if (!text) return null;
  const result = outcome(state, events.slice(events.indexOf(action) + 1));
  return result ? `${text} — ${result}` : text;
}

/** What the events after an action did to the units it touched. */
function outcome(state: BattleState, events: BattleEvent[]): string | null {
  const name = (id: string) => state.units.find((u) => u.id === id)?.name ?? id;
  const damaged = new Map<string, Extract<BattleEvent, { type: "damage" }>>();
  const healed = new Map<string, number>();
  const knockedOut: string[] = [];
  for (const e of events) {
    if (e.type === "damage") damaged.set(e.unitId, e);
    else if (e.type === "heal" && e.amount > 0)
      healed.set(e.unitId, (healed.get(e.unitId) ?? 0) + e.amount);
    else if (e.type === "knockedOut") knockedOut.push(e.unitId);
  }

  const parts: string[] = [];
  if (damaged.size === 1) {
    const [hit] = damaged.values();
    parts.push(hitText(hit));
  } else if (damaged.size > 1) {
    parts.push(`${damaged.size} hit`);
  }
  if (healed.size === 1) {
    const [amount] = healed.values();
    parts.push(`+${amount} HP`);
  } else if (healed.size > 1) {
    parts.push(`${healed.size} healed`);
  }
  if (knockedOut.length === 1) {
    // A lone target's KO needs no name; in a crowd, say who fell.
    parts.push(damaged.size === 1 ? "KO" : `${name(knockedOut[0])} KO`);
  } else if (knockedOut.length > 1) {
    parts.push(`${knockedOut.length} KO`);
  }
  return parts.length ? parts.join(", ") : null;
}

function hitText(hit: Extract<BattleEvent, { type: "damage" }>): string {
  if (hit.multiplier === 0) return "immune";
  if (hit.amount === 0 && hit.absorbed) return "absorbed";
  const note =
    hit.multiplier > 1 ? " (weak)" : hit.multiplier < 1 ? " (resisted)" : "";
  return `${hit.amount}${note}`;
}
