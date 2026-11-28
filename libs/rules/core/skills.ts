import {
  FINISH_BELOW,
  strengthsOf,
  type Skill,
  type StatusDef,
} from "@jforge/melee/shared";
import type { Library } from "./types";

// Skills in words, and what makes one unusable: for the codex to describe
// skills, and for the content's tests to check them.

const pct = (share: number) => `${Math.round(share * 100)}%`;

/** One line on what a skill does, from its data: "Fire damage x1.2, plus". */
export function effectSummary(skill: Skill): string {
  return `${effectText(skill)}${skill.ignoreCover ? ", past cover" : ""}`;
}

function effectText(skill: Skill): string {
  const { effect } = skill;
  const shape = skill.area === "single" ? "" : `, ${skill.area}`;
  switch (effect.type) {
    case "damage":
      return `${effect.element} damage ×${effect.power}${effect.split ? ` each, ×${effect.split} shared` : ""}${effect.vsEmpowered ? ` (×${effect.vsEmpowered} if empowered)` : ""}${effect.drain ? `, drains ${pct(effect.drain)}` : ""}${effect.burnMp ? `, burns ${effect.burnMp} MP` : ""}${effect.chill ? ", chills" : ""}${shape}`;
    case "strike":
      return `${effect.advance ? "charging " : ""}weapon strike ×${effect.power}${effect.push ? (effect.push > 0 ? `, pushes ${effect.push}` : `, pulls ${-effect.push}`) : ""}${effect.pin ? ", pins" : ""}${effect.ignite ? ", sets burning" : ""}${effect.bleed ? ", bleeds" : ""}${effect.weaken ? `, weakens to ×${effect.weaken}` : ""}${effect.stagger ? `, staggers ${pct(effect.stagger)}` : ""}${effect.armorPierce ? `, ignores ${pct(effect.armorPierce)} defense` : ""}${effect.finisher ? `, ×${effect.finisher} below ${pct(effect.finishBelow ?? FINISH_BELOW)} HP` : ""}${effect.mend ? `, heals the most-hurt ally ${pct(effect.mend)} of the damage` : ""}${shape}`;
    case "heal":
      return `heals ×${effect.power} ${effect.of === "maxHp" ? "max HP" : "magic"}${shape}`;
    case "modify": {
      const m = effect.modifier;
      return `${m.stat} ${change(m)} for ${m.duration}${shape}`;
    }
    case "status":
      return `${statusSummary(effect.status)}${shape}`;
    case "cleanse":
      return `removes harmful statuses and debuffs${shape}`;
    case "teleport":
      return "moves the caster to an empty cell on its side";
    case "gauge":
      return `sets the turn gauge to ${pct(effect.to)}${shape}`;
    case "summon": {
      const many =
        effect.limit && effect.limit > 1 ? `, up to ${effect.limit}` : "";
      return `summons a ${effect.creature.name}${many}${effect.anySide ? ", either side" : ""}`;
    }
    case "shatter":
      return `shatters a boulder: ${effect.element} damage ×${effect.power} around it`;
    case "heave":
      return `heaves back ${effect.rows} row${effect.rows === 1 ? "" : "s"}${shape}`;
    case "revive":
      return `revives with ×${effect.power} magic HP${shape}`;
    case "rescue":
      return "pulls an ally back, the caster takes its place";
    case "sacrifice": {
      const m = effect.modifier;
      return `gives up a summon: heals by its HP, ${m.stat} ${change(m)} for ${m.duration}`;
    }
    case "rewind":
      return `gives back the HP lost since its last turn${shape}`;
    case "restoreMp":
      return `restores ${effect.amount} MP${shape}`;
  }
}

function change(m: { op: "add" | "mul"; value: number }): string {
  return m.op === "mul" ? `×${m.value}` : signed(m.value);
}

/** What a status does, with its own strengths. */
function statusSummary(st: StatusDef): string {
  const s = strengthsOf(st);
  const lasts = `for ${st.interval}`;
  switch (st.effect) {
    case "damage":
      return `${st.damageType ?? ""} damage ×${st.power} ${st.stat} over ${st.ticks} ticks`;
    case "heal":
      return `heals ×${st.power} ${st.stat} over ${st.ticks} ticks`;
    case "bomb":
      return `bomb: ${st.damageType} damage ×${st.power} ${st.stat} after ${st.interval}`;
    case "shield":
      return `shield of ×${st.power} ${st.stat} ${lasts}`;
    case "stealth":
      return `stealth ${lasts}: ambush ×${s.ambush}`;
    case "smoke":
      return `hides an ally: can't be singled out ${lasts}`;
    case "ward":
      return `can't be knocked out ${lasts}`;
    case "taunt":
      return `taunts ${lasts}`;
    case "guard":
      return `guards ${lasts}`;
    case "coat":
      return `coats the blade: weapon hits poison ${lasts}`;
    case "bless":
      return `blesses: deals ×${s.dealt}, takes ×${s.taken} ${lasts}`;
    case "stoneSkin":
      return `stone skin: defense ×${s.defense}, unpushable ${lasts}`;
    case "expose":
      return `exposes: takes ×${s.taken} ${lasts}`;
    case "weaken":
      return `weakens: deals ×${s.dealt} ${lasts}`;
    case "silence":
      return `silences ${lasts}`;
    case "petrify":
      return `petrifies ${lasts}: can't act, takes ×${s.taken}`;
  }
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/**
 * What stops a skill from being usable, in words; empty when it is fine.
 * With the library, a summon's enemy type is checked too.
 */
export function skillProblems(skill: Skill, library?: Library): string[] {
  const problems: string[] = [];
  if (skill.name.trim() === "") problems.push("Give the skill a name.");
  if (skill.mpCost < 0) problems.push("MP cost can't be negative.");
  if ((skill.hpCost ?? 0) < 0) problems.push("HP cost can't be negative.");
  const { effect } = skill;
  if ("power" in effect && effect.power <= 0) {
    problems.push("Power must be above 0.");
  }
  if (effect.type === "strike" && skill.target !== "enemy") {
    problems.push("A weapon strike must target an enemy.");
  }
  if (
    (effect.type === "modify" || effect.type === "sacrifice") &&
    effect.modifier.duration <= 0
  ) {
    problems.push("A buff or debuff needs a duration.");
  }
  if (effect.type === "status") {
    if (effect.status.name.trim() === "") problems.push("Name the status.");
    if (effect.status.interval <= 0 || effect.status.ticks < 1) {
      problems.push("A status needs a duration.");
    }
  }
  if (effect.type === "gauge" && (effect.to <= 0 || effect.to > 1)) {
    problems.push("The gauge must be set above 0 and at most full.");
  }
  if (effect.type === "heave" && effect.rows < 1) {
    problems.push("Heave at least one row.");
  }
  if (effect.type === "restoreMp" && effect.amount <= 0) {
    problems.push("Restore at least 1 MP.");
  }
  if (effect.type === "summon") {
    if (!effect.source) problems.push("Pick an enemy type to summon.");
    else if (
      library &&
      !library.archetypes.some((a) => a.id === effect.source!.archetypeId)
    ) {
      problems.push("The enemy type it summons is gone.");
    }
  }
  return problems;
}
