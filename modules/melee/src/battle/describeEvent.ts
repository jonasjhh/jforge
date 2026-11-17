import { GAUGE_FULL, type BattleEvent, type BattleState } from "../../shared";
import { resistanceNote, resultText, unitName } from "./labels";

/** One battle log line for an event, or null for events not worth showing. */
export function describeEvent(
  state: BattleState,
  event: BattleEvent,
): string | null {
  const unit = (id: string) => state.units.find((u) => u.id === id);
  const name = (id: string) => unitName(state, id);
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
    case "shieldBroken":
      return `${name(event.unitId)}'s ${event.name} breaks`;
    case "guarded":
      return `${name(event.byId)} takes the blow for ${name(event.unitId)}`;
    case "rescued":
      return `${name(event.byId)} pulls ${name(event.unitId)} back`;
    case "warded":
      return `${name(event.unitId)} is held by ${event.name}!`;
    case "ambush":
      return `${name(event.unitId)} strikes from the shadows!`;
    case "teleported":
      return `${name(event.unitId)} shadowsteps`;
    case "mpRestored":
      return `${name(event.unitId)} regains ${event.amount} MP`;
    case "mpBurned":
      return `${name(event.unitId)} loses ${event.amount} MP`;
    case "hpPaid":
      return `${name(event.unitId)} pays ${event.amount} HP`;
    case "summoned":
      return unit(event.unitId)?.obstacle
        ? `${name(event.byId)} raises a ${name(event.unitId)}`
        : `${name(event.byId)} summons ${name(event.unitId)}`;
    case "vanished":
      return unit(event.unitId)?.obstacle
        ? `${name(event.unitId)} crumbles`
        : `${name(event.unitId)} vanishes`;
    case "shattered":
      return `${name(event.byId)} shatters the ${name(event.unitId)}!`;
    case "unmoved":
      return `${name(event.unitId)} doesn't budge`;
    case "modifierApplied":
      return event.harmful
        ? `${name(event.unitId)} suffers ${event.source}`
        : `${name(event.unitId)} gains ${event.source}`;
    case "gaugeChanged":
      return event.gauge >= GAUGE_FULL
        ? `${name(event.unitId)} acts now`
        : null;
    case "pushed":
      return event.to.row < event.from.row
        ? `${name(event.unitId)} is pulled forward`
        : `${name(event.unitId)} is pushed back`;
    case "collided":
      return event.blockerId
        ? `${name(event.unitId)} crashes into ${name(event.blockerId)}!`
        : `${name(event.unitId)} crashes against the edge!`;
    case "statusRemoved":
      return `${name(event.unitId)} is cured of ${event.name}`;
    case "statusExpired":
      return `${name(event.unitId)}'s ${event.name} wears off`;
    case "castFizzled":
      return `${name(event.unitId)}'s ${event.skillName} fizzles`;
    case "skill": {
      if (event.delayed) return `${event.skillName} strikes!`;
      // The unit aimed at when it was used (it may have moved since). None
      // for an empty cell, even if a summon stands there now.
      const aimed = event.targetId
        ? state.units.find((u) => u.id === event.targetId)
        : undefined;
      // Weapon skills are "used"; spells are "cast".
      const skill = state.units
        .find((u) => u.id === event.unitId)
        ?.skills.find((s) => s.id === event.skillId);
      const verb = skill?.effect.type === "strike" ? "uses" : "casts";
      const caster = `${name(event.unitId)} ${verb} ${event.skillName}`;
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
    case "revived":
      return `${name(event.unitId)} is back on their feet with ${event.hp} HP`;
    case "damage": {
      const note = resistanceNote(event.multiplier);
      if (event.amount === 0 && event.absorbed) {
        return `${name(event.unitId)}'s shield absorbs ${event.absorbed} ${event.damageType} damage`;
      }
      const shield = event.absorbed ? `, ${event.absorbed} absorbed` : "";
      return `${name(event.unitId)} takes ${event.amount} ${event.damageType} damage${note}${shield}`;
    }
    case "defended":
      return `${name(event.unitId)} defends`;
    case "waited":
      return `${name(event.unitId)} waits`;
    case "knockedOut":
      return `${name(event.unitId)} is knocked out`;
    case "modifierExpired":
      return `${name(event.unitId)}'s ${event.source} wears off`;
    case "battleOver":
      return resultText(event.winner);
    case "timeAdvanced":
    case "turnReady":
      return null;
  }
}
