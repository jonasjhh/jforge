import type { BattleSetup, CombatantDef } from "./types";

// Starter content so melee can set up a fight on its own. The four player
// types become class templates in char later. All attack with a basic
// physical attack until skills arrive in phase 2.

export const fighter: CombatantDef = {
  id: "fighter",
  name: "Fighter",
  stats: {
    maxHp: 120,
    maxMp: 10,
    attack: 22,
    magic: 4,
    defense: 18,
    spirit: 8,
    speed: 10,
  },
};

export const archer: CombatantDef = {
  id: "archer",
  name: "Archer",
  stats: {
    maxHp: 90,
    maxMp: 20,
    attack: 18,
    magic: 6,
    defense: 10,
    spirit: 10,
    speed: 13,
  },
};

export const mage: CombatantDef = {
  id: "mage",
  name: "Mage",
  stats: {
    maxHp: 70,
    maxMp: 60,
    attack: 6,
    magic: 24,
    defense: 6,
    spirit: 18,
    speed: 9,
  },
};

export const healer: CombatantDef = {
  id: "healer",
  name: "Healer",
  stats: {
    maxHp: 80,
    maxMp: 50,
    attack: 8,
    magic: 16,
    defense: 8,
    spirit: 20,
    speed: 11,
  },
};

export const slime: CombatantDef = {
  id: "slime",
  name: "Slime",
  stats: {
    maxHp: 60,
    maxMp: 0,
    attack: 12,
    magic: 0,
    defense: 6,
    spirit: 4,
    speed: 7,
  },
};

export const wolf: CombatantDef = {
  id: "wolf",
  name: "Wolf",
  stats: {
    maxHp: 50,
    maxMp: 0,
    attack: 16,
    magic: 0,
    defense: 6,
    spirit: 4,
    speed: 15,
  },
};

export const playerTypes = [fighter, archer, mage, healer];
export const monsters = [slime, wolf];

/** The four player types against a small mixed pack. */
export const sampleBattle: BattleSetup = {
  placements: [
    { def: fighter, side: "player", position: { col: 1, row: 0 } },
    { def: archer, side: "player", position: { col: 3, row: 1 } },
    { def: mage, side: "player", position: { col: 1, row: 2 } },
    { def: healer, side: "player", position: { col: 3, row: 2 } },
    { def: slime, side: "enemy", position: { col: 1, row: 0 } },
    { def: slime, side: "enemy", position: { col: 3, row: 0 } },
    { def: wolf, side: "enemy", position: { col: 2, row: 1 } },
  ],
};
