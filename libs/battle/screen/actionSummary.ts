import type { BattleEvent, BattleState } from "../engine";
import { describeEvent } from "./describeEvent";
import { resistanceNote, unitName } from "./labels";

type ActionEvent = Extract<
  BattleEvent,
  {
    type: "attack" | "skill" | "moved" | "castStarted" | "defended" | "waited";
  }
>;

const ACTIONS: BattleEvent["type"][] = [
  "attack",
  "skill",
  "moved",
  "castStarted",
  "defended",
  "waited",
];

/** The action in a step's events: an attack, skill, step, cast start, defend or wait. */
export function findAction(events: BattleEvent[]): ActionEvent | undefined {
  return events.find((e): e is ActionEvent => ACTIONS.includes(e.type));
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
  const name = (id: string) => unitName(state, id);
  const damaged = new Map<string, Extract<BattleEvent, { type: "damage" }>>();
  const healed = new Map<string, number>();
  const knockedOut: string[] = [];
  const revived: string[] = [];
  for (const e of events) {
    if (e.type === "damage") damaged.set(e.unitId, e);
    else if (e.type === "heal" && e.amount > 0)
      healed.set(e.unitId, (healed.get(e.unitId) ?? 0) + e.amount);
    else if (e.type === "knockedOut") knockedOut.push(e.unitId);
    else if (e.type === "revived") revived.push(e.unitId);
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
  for (const id of revived) parts.push(`${name(id)} revived`);
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
  return `${hit.amount}${resistanceNote(hit.multiplier)}`;
}
