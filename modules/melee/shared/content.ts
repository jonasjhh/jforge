import { catalogue } from "@jforge/content/catalogue";
import * as starter from "@jforge/content/starter";
import { creatureOf, tune, type Creature } from "@jforge/rules/core";
import type { CombatantDef } from "@jforge/battle";

// Melee's test units: the catalogue's designs as melee fields them, to try
// the battle engine on. The weapons and skills are the starter designs as
// they are; each unit is compiled from its archetype in the catalogue and
// tuned here to melee's own version (its id, and for the monsters their
// stats, targeting and threat). No game fields these: each takes its own
// versions from the catalogue.

export * from "@jforge/content/starter";

const library = catalogue();

/** The catalogue's archetype `archetypeId` as melee's unit `changes`. */
function unit(
  archetypeId: string,
  changes: Partial<CombatantDef> & Pick<Creature, "id">,
): CombatantDef {
  const design = creatureOf(library, archetypeId);
  if (!design) throw new Error(`no archetype ${archetypeId}`);
  return tune<CombatantDef>(design, changes);
}

/**
 * A melee class as its unit: its own id, and its skills as designed, so a
 * summon calls the design's own creature.
 */
const classUnit = (def: Creature) =>
  unit(`melee-${def.id}`, {
    id: def.id,
    skills: def.skills ?? [],
  });

export const fighter = classUnit(starter.fighter);
export const lancer = classUnit(starter.lancer);
export const archer = classUnit(starter.archer);
export const mage = classUnit(starter.mage);
export const healer = classUnit(starter.healer);
export const chronomancer = classUnit(starter.chronomancer);
export const warlock = classUnit(starter.warlock);
export const rogue = classUnit(starter.rogue);
export const paladin = classUnit(starter.paladin);
export const geomancer = classUnit(starter.geomancer);
export const knight = classUnit(starter.knight);
export const sage = classUnit(starter.sage);

export const playerTypes = [
  fighter,
  lancer,
  archer,
  mage,
  healer,
  chronomancer,
  warlock,
  rogue,
  paladin,
  geomancer,
  knight,
  sage,
];

/** Clumsy: mostly flails at whatever is in reach. Tougher, slower to hit. */
export const slime = unit("enemy-slime", {
  id: "slime",
  stats: {
    maxHp: 60,
    maxMp: 0,
    attack: 12,
    magic: 0,
    defense: 6,
    spirit: 4,
    speed: 7,
  },
  targeting: { near: 1, finish: 1, wounded: 0.5, soft: 0.5, noise: 2 },
  threat: 2,
});

/** A finisher: goes for the wounded and the kill. */
export const wolf = unit("enemy-wolf", {
  id: "wolf",
  stats: {
    maxHp: 50,
    maxMp: 0,
    attack: 16,
    magic: 0,
    defense: 6,
    spirit: 4,
    speed: 15,
  },
  targeting: { near: 1, finish: 5, wounded: 3, soft: 1, noise: 0.3 },
  threat: 3,
});

/** Fast and frail; its bite poisons. Likes soft targets. */
export const viper = unit("enemy-viper", {
  id: "viper",
  stats: {
    maxHp: 40,
    maxMp: 0,
    attack: 10,
    magic: 0,
    defense: 4,
    spirit: 6,
    speed: 13,
  },
  targeting: { near: 1, finish: 2, wounded: 1, soft: 2, noise: 0.5 },
  threat: 2,
});

export const monsters = [slime, wolf, viper];
