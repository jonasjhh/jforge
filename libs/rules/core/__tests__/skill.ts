import type { Skill, SkillEffect } from "../format";

/** A plain skill to change in tests: fire damage at one enemy for 5 MP. */
export const skill = (id: string, more: Partial<Skill> = {}): Skill => ({
  id,
  name: "New skill",
  description: "",
  mpCost: 5,
  target: "enemy",
  area: "single",
  effect: { type: "damage", kind: "magical", element: "fire", power: 1 },
  ...more,
});

const boost = {
  name: "Boost",
  stat: "attack" as const,
  op: "mul" as const,
  value: 1.5,
  duration: 100,
  harmful: false,
};

/** A sound effect of each kind tests change one field of. */
export const EFFECT = {
  damage: { type: "damage", kind: "magical", element: "fire", power: 1 },
  modify: { type: "modify", modifier: { ...boost } },
  sacrifice: {
    type: "sacrifice",
    modifier: { ...boost, name: "Sacrifice", stat: "magic" },
  },
  status: {
    type: "status",
    status: {
      id: "damage",
      name: "Damage over time",
      effect: "damage",
      harmful: true,
      stat: "magic",
      power: 0.3,
      interval: 30,
      ticks: 5,
      damageType: "poison",
    },
  },
  gauge: { type: "gauge", to: 1 },
  heave: { type: "heave", rows: 1 },
  restoreMp: { type: "restoreMp", amount: 10 },
} satisfies Record<string, SkillEffect>;
