import { describe, expect, it } from "vitest";
import {
  createBattle,
  GAUGE_FULL,
  type BattleEvent,
  type BattleState,
} from "@jforge/battle";
import { content } from "../../../shared";
import { def, place } from "../../../shared/__tests__/helpers";
import { describeEvent } from "@jforge/battle/screen/describeEvent.ts";

const state: BattleState = createBattle(
  {
    placements: [
      place(content.mage, "player", 0),
      place(content.fighter, "player", 1),
      place(def("Wolf"), "enemy", 0),
      place(content.boulder, "enemy", 1),
    ],
  },
  1,
);
const MAGE = "player-0-0";
const FIGHTER = "player-1-0";
const WOLF = "enemy-0-0";
const ROCK = "enemy-1-0";
const cell = { side: "enemy" as const, col: 0, row: 0 };
const at = (col: number, row: number) => ({ col, row });

const say = (event: BattleEvent) => describeEvent(state, event);

const skill = (
  extra: Partial<Extract<BattleEvent, { type: "skill" }>>,
): BattleEvent => ({
  type: "skill",
  unitId: MAGE,
  cell,
  area: [cell],
  skillId: "fireball",
  skillName: "Fireball",
  mp: 0,
  ...extra,
});
const damage = (amount: number, extra = {}): BattleEvent => ({
  type: "damage",
  unitId: WOLF,
  amount,
  hp: 10,
  damageType: "fire",
  multiplier: 1,
  ...extra,
});
const tick = (effect: "heal" | "damage", amount: number): BattleEvent => ({
  type: "statusTick",
  unitId: WOLF,
  statusId: "s",
  name: effect === "heal" ? "Regen" : "Poison",
  effect,
  amount,
  hp: 10,
  ...(effect === "damage" ? { damageType: "poison" as const } : {}),
});
const step = (to: { col: number; row: number }): BattleEvent => ({
  type: "moved",
  unitId: MAGE,
  from: at(1, 1),
  to,
});
const push = (toRow: number): BattleEvent => ({
  type: "pushed",
  unitId: WOLF,
  from: at(0, 1),
  to: at(0, toRow),
});
const status = { unitId: WOLF, statusId: "p", name: "Poison" };
const modifier = { unitId: WOLF, source: "Slow" };

describe("describeEvent", () => {
  it.each<[string, BattleEvent, string]>([
    // Actions
    [
      "an attack",
      { type: "attack", unitId: WOLF, targetId: MAGE },
      "Wolf attacks Mage",
    ],
    [
      "a cast begun",
      {
        type: "castStarted",
        unitId: MAGE,
        skillId: "meteor",
        skillName: "Meteor",
        cell,
        area: [cell],
        readyAt: 10,
        mp: 0,
      },
      "Mage begins casting Meteor",
    ],
    ["a step forward", step(at(1, 0)), "Mage steps forward"],
    ["a step back", step(at(1, 2)), "Mage steps back"],
    ["a step left", step(at(0, 1)), "Mage steps left"],
    ["a step right", step(at(2, 1)), "Mage steps right"],
    ["a defend", { type: "defended", unitId: MAGE }, "Mage defends"],
    ["a wait", { type: "waited", unitId: MAGE }, "Mage waits"],
    // Skills
    [
      "a spell on one target",
      skill({ targetId: WOLF }),
      "Mage casts Fireball on Wolf",
    ],
    [
      "a spell on an area",
      skill({ targetId: WOLF, area: [cell, cell] }),
      "Mage casts Fireball at Wolf",
    ],
    ["a spell with no target", skill({}), "Mage casts Fireball"],
    [
      "a weapon skill",
      skill({
        unitId: FIGHTER,
        skillId: "cleave",
        skillName: "Cleave",
        targetId: WOLF,
      }),
      "Fighter uses Cleave on Wolf",
    ],
    [
      "a delayed skill landing",
      skill({ delayed: true, skillName: "Meteor" }),
      "Meteor strikes!",
    ],
    // Damage and healing
    ["a hit", damage(12), "Wolf takes 12 fire damage"],
    [
      "a weak hit",
      damage(24, { multiplier: 2 }),
      "Wolf takes 24 fire damage (weak)",
    ],
    [
      "a hit partly absorbed",
      damage(5, { absorbed: 7 }),
      "Wolf takes 5 fire damage, 7 absorbed",
    ],
    [
      "a hit wholly absorbed",
      damage(0, { absorbed: 7 }),
      "Wolf's shield absorbs 7 fire damage",
    ],
    [
      "a heal",
      { type: "heal", unitId: MAGE, amount: 9, hp: 50 },
      "Mage recovers 9 HP",
    ],
    [
      "a revive",
      { type: "revived", unitId: MAGE, hp: 24 },
      "Mage is back on their feet with 24 HP",
    ],
    ["a heal tick", tick("heal", 4), "Wolf regains 4 HP (Regen)"],
    ["a damage tick", tick("damage", 3), "Wolf takes 3 poison damage (Poison)"],
    [
      "an HP cost",
      { type: "hpPaid", unitId: MAGE, amount: 15, hp: 40 },
      "Mage pays 15 HP",
    ],
    // Statuses, modifiers and defenses
    [
      "a status gained",
      { type: "statusApplied", ...status, ticks: 3 },
      "Wolf gains Poison",
    ],
    [
      "a status cured",
      { type: "statusRemoved", ...status },
      "Wolf is cured of Poison",
    ],
    [
      "a status worn off",
      { type: "statusExpired", ...status },
      "Wolf's Poison wears off",
    ],
    [
      "a harmful modifier",
      { type: "modifierApplied", ...modifier, harmful: true },
      "Wolf suffers Slow",
    ],
    [
      "a helpful modifier",
      { type: "modifierApplied", ...modifier, harmful: false },
      "Wolf gains Slow",
    ],
    [
      "a modifier worn off",
      { type: "modifierExpired", ...modifier },
      "Wolf's Slow wears off",
    ],
    [
      "a broken shield",
      { type: "shieldBroken", unitId: MAGE, name: "Aegis" },
      "Mage's Aegis breaks",
    ],
    [
      "a ward",
      { type: "warded", unitId: MAGE, name: "Last Rites" },
      "Mage is held by Last Rites!",
    ],
    [
      "a worsening status",
      {
        type: "statusWorsened",
        unitId: WOLF,
        statusId: "poison",
        name: "Poison",
        amount: 8,
      },
      "Wolf's Poison worsens",
    ],
    [
      "an explosion",
      { type: "exploded", unitId: WOLF, name: "Bomb" },
      "Wolf's Bomb explodes!",
    ],
    // Stealth and teleports
    [
      "an ambush",
      { type: "ambush", unitId: WOLF },
      "Wolf strikes from the shadows!",
    ],
    [
      "a teleport",
      { type: "teleported", unitId: MAGE, from: at(0, 0), to: at(1, 1) },
      "Mage shadowsteps",
    ],
    // Summons
    [
      "a boulder raised",
      { type: "summoned", unitId: ROCK, byId: MAGE, cell },
      "Mage raises a Boulder",
    ],
    [
      "a creature summoned",
      { type: "summoned", unitId: WOLF, byId: MAGE, cell },
      "Mage summons Wolf",
    ],
    ["a boulder gone", { type: "vanished", unitId: ROCK }, "Boulder crumbles"],
    ["a creature gone", { type: "vanished", unitId: WOLF }, "Wolf vanishes"],
    [
      "a boulder shattered",
      { type: "shattered", unitId: ROCK, byId: MAGE },
      "Mage shatters the Boulder!",
    ],
    // Pushes and collisions
    ["a push back", push(2), "Wolf is pushed back"],
    ["a pull forward", push(0), "Wolf is pulled forward"],
    ["a unit unmoved", { type: "unmoved", unitId: WOLF }, "Wolf doesn't budge"],
    [
      "a collision with a unit",
      { type: "collided", unitId: WOLF, blockerId: ROCK },
      "Wolf crashes into Boulder!",
    ],
    [
      "a collision with the edge",
      { type: "collided", unitId: WOLF },
      "Wolf crashes against the edge!",
    ],
    // Gauge, casts and results
    [
      "a gauge filled to act now",
      { type: "gaugeChanged", unitId: WOLF, gauge: GAUGE_FULL },
      "Wolf acts now",
    ],
    [
      "a fizzled cast",
      { type: "castFizzled", unitId: MAGE, skillName: "Meteor" },
      "Mage's Meteor fizzles",
    ],
    ["a knockout", { type: "knockedOut", unitId: WOLF }, "Wolf is knocked out"],
    ["the battle won", { type: "battleOver", winner: "player" }, "Victory!"],
    // Guarding, rescuing and MP
    [
      "a guard",
      { type: "guarded", unitId: MAGE, byId: FIGHTER },
      "Fighter takes the blow for Mage",
    ],
    [
      "a rescue",
      { type: "rescued", unitId: MAGE, byId: FIGHTER },
      "Fighter pulls Mage back",
    ],
    [
      "MP restored",
      { type: "mpRestored", unitId: MAGE, amount: 6, mp: 20 },
      "Mage regains 6 MP",
    ],
    [
      "MP burned",
      { type: "mpBurned", unitId: MAGE, amount: 4, mp: 10 },
      "Mage loses 4 MP",
    ],
  ])("given %s, when it is described, then it reads %s", (_, event, text) => {
    const line = say(event);

    expect(line).toBe(text);
  });

  it.each<[string, BattleEvent]>([
    ["a heal tick of nothing", tick("heal", 0)],
    [
      "a gauge change that doesn't make it act",
      { type: "gaugeChanged", unitId: WOLF, gauge: 0 },
    ],
    ["time passing", { type: "timeAdvanced", time: 5 }],
    ["a turn coming up", { type: "turnReady", unitId: WOLF }],
  ])(
    "given %s, when it is described, then it is left out of the log",
    (_, event) => {
      const line = say(event);

      expect(line).toBeNull();
    },
  );
});
