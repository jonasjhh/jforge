import { describe, expect, it } from "vitest";
import {
  content,
  createBattle,
  GAUGE_FULL,
  type BattleEvent,
  type BattleState,
} from "../../../shared";
import { def, place } from "../../../shared/__tests__/helpers";
import { describeEvent } from "../describeEvent";

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

describe("describeEvent", () => {
  it("describes actions", () => {
    expect(say({ type: "attack", unitId: WOLF, targetId: MAGE })).toBe(
      "Wolf attacks Mage",
    );
    expect(
      say({
        type: "castStarted",
        unitId: MAGE,
        skillId: "meteor",
        skillName: "Meteor",
        cell,
        area: [cell],
        readyAt: 10,
        mp: 0,
      }),
    ).toBe("Mage begins casting Meteor");
  });

  it("names the direction of a step", () => {
    const step = (to: { col: number; row: number }) =>
      say({ type: "moved", unitId: MAGE, from: at(1, 1), to });
    expect(step(at(1, 0))).toBe("Mage steps forward");
    expect(step(at(1, 2))).toBe("Mage steps back");
    expect(step(at(0, 1))).toBe("Mage steps left");
    expect(step(at(2, 1))).toBe("Mage steps right");
  });

  describe("skills", () => {
    const skill = (extra: Partial<Extract<BattleEvent, { type: "skill" }>>) =>
      say({
        type: "skill",
        unitId: MAGE,
        cell,
        area: [cell],
        skillId: "fireball",
        skillName: "Fireball",
        mp: 0,
        ...extra,
      });

    it("says who a spell was cast on, or at for an area", () => {
      expect(skill({ targetId: WOLF })).toBe("Mage casts Fireball on Wolf");
      expect(skill({ targetId: WOLF, area: [cell, cell] })).toBe(
        "Mage casts Fireball at Wolf",
      );
      expect(skill({})).toBe("Mage casts Fireball");
    });

    it("says weapon skills are used", () => {
      expect(
        say({
          type: "skill",
          unitId: FIGHTER,
          cell,
          area: [cell],
          skillId: "cleave",
          skillName: "Cleave",
          mp: 0,
          targetId: WOLF,
        }),
      ).toBe("Fighter uses Cleave on Wolf");
    });

    it("announces a delayed skill landing", () => {
      expect(skill({ delayed: true, skillName: "Meteor" })).toBe(
        "Meteor strikes!",
      );
    });
  });

  describe("damage and healing", () => {
    const damage = (amount: number, extra = {}) =>
      say({
        type: "damage",
        unitId: WOLF,
        amount,
        hp: 10,
        damageType: "fire",
        multiplier: 1,
        ...extra,
      });

    it("gives the amount, type and resistance", () => {
      expect(damage(12)).toBe("Wolf takes 12 fire damage");
      expect(damage(24, { multiplier: 2 })).toBe(
        "Wolf takes 24 fire damage (weak)",
      );
      expect(damage(5, { absorbed: 7 })).toBe(
        "Wolf takes 5 fire damage, 7 absorbed",
      );
    });

    it("says when a shield took it all", () => {
      expect(damage(0, { absorbed: 7 })).toBe(
        "Wolf's shield absorbs 7 fire damage",
      );
    });

    it("describes heals and status ticks", () => {
      expect(say({ type: "heal", unitId: MAGE, amount: 9, hp: 50 })).toBe(
        "Mage recovers 9 HP",
      );
      const tick = (effect: "heal" | "damage", amount: number) =>
        say({
          type: "statusTick",
          unitId: WOLF,
          statusId: "s",
          name: effect === "heal" ? "Regen" : "Poison",
          effect,
          amount,
          hp: 10,
          ...(effect === "damage" ? { damageType: "poison" as const } : {}),
        });
      expect(tick("heal", 4)).toBe("Wolf regains 4 HP (Regen)");
      expect(tick("damage", 3)).toBe("Wolf takes 3 poison damage (Poison)");
      expect(tick("heal", 0)).toBeNull();
    });

    it("describes the HP cost of a skill", () => {
      expect(say({ type: "hpPaid", unitId: MAGE, amount: 15, hp: 40 })).toBe(
        "Mage pays 15 HP",
      );
    });
  });

  it("describes statuses, modifiers and defenses", () => {
    const status = { unitId: WOLF, statusId: "p", name: "Poison" };
    expect(say({ type: "statusApplied", ...status, ticks: 3 })).toBe(
      "Wolf gains Poison",
    );
    expect(say({ type: "statusRemoved", ...status })).toBe(
      "Wolf is cured of Poison",
    );
    expect(say({ type: "statusExpired", ...status })).toBe(
      "Wolf's Poison wears off",
    );
    const modifier = { unitId: WOLF, source: "Slow" };
    expect(say({ type: "modifierApplied", ...modifier, harmful: true })).toBe(
      "Wolf suffers Slow",
    );
    expect(say({ type: "modifierApplied", ...modifier, harmful: false })).toBe(
      "Wolf gains Slow",
    );
    expect(say({ type: "modifierExpired", ...modifier })).toBe(
      "Wolf's Slow wears off",
    );
    expect(say({ type: "shieldBroken", unitId: MAGE, name: "Aegis" })).toBe(
      "Mage's Aegis breaks",
    );
    expect(say({ type: "warded", unitId: MAGE, name: "Last Rites" })).toBe(
      "Mage is held by Last Rites!",
    );
  });

  it("describes stealth and teleports", () => {
    expect(say({ type: "ambush", unitId: WOLF })).toBe(
      "Wolf strikes from the shadows!",
    );
    expect(
      say({ type: "teleported", unitId: MAGE, from: at(0, 0), to: at(1, 1) }),
    ).toBe("Mage shadowsteps");
  });

  it("tells boulders from creatures when summoned or gone", () => {
    expect(say({ type: "summoned", unitId: ROCK, byId: MAGE, cell })).toBe(
      "Mage raises a Boulder",
    );
    expect(say({ type: "summoned", unitId: WOLF, byId: MAGE, cell })).toBe(
      "Mage summons Wolf",
    );
    expect(say({ type: "vanished", unitId: ROCK })).toBe("Boulder crumbles");
    expect(say({ type: "vanished", unitId: WOLF })).toBe("Wolf vanishes");
    expect(say({ type: "shattered", unitId: ROCK, byId: MAGE })).toBe(
      "Mage shatters the Boulder!",
    );
  });

  it("describes pushes, pulls and collisions", () => {
    const push = (toRow: number) =>
      say({ type: "pushed", unitId: WOLF, from: at(0, 1), to: at(0, toRow) });
    expect(push(2)).toBe("Wolf is pushed back");
    expect(push(0)).toBe("Wolf is pulled forward");
    expect(say({ type: "unmoved", unitId: WOLF })).toBe("Wolf doesn't budge");
    expect(say({ type: "collided", unitId: WOLF, blockerId: ROCK })).toBe(
      "Wolf crashes into Boulder!",
    );
    expect(say({ type: "collided", unitId: WOLF })).toBe(
      "Wolf crashes against the edge!",
    );
  });

  it("only mentions a gauge change that makes the unit act now", () => {
    expect(say({ type: "gaugeChanged", unitId: WOLF, gauge: GAUGE_FULL })).toBe(
      "Wolf acts now",
    );
    expect(say({ type: "gaugeChanged", unitId: WOLF, gauge: 0 })).toBeNull();
  });

  it("describes a fizzled cast, a knockout and the result", () => {
    expect(
      say({ type: "castFizzled", unitId: MAGE, skillName: "Meteor" }),
    ).toBe("Mage's Meteor fizzles");
    expect(say({ type: "knockedOut", unitId: WOLF })).toBe(
      "Wolf is knocked out",
    );
    expect(say({ type: "battleOver", winner: "player" })).toBe("Victory!");
  });

  it("skips time passing and turns coming up", () => {
    expect(say({ type: "timeAdvanced", time: 5 })).toBeNull();
    expect(say({ type: "turnReady", unitId: WOLF })).toBeNull();
  });
});
