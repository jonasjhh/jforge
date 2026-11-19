import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { heal, healer, smite } from "../content";
import { skillCells } from "../skills";
import type { BattleEvent, BattleState, Cell, Skill } from "../types";
import { def, place } from "./helpers";

// The healer acts first; everyone else is too slow to matter.
function battle(options: { healerMp?: number; allyHp?: number } = {}) {
  const healer = {
    ...def("healer", { magic: 10, maxMp: options.healerMp ?? 20, speed: 20 }),
    skills: [heal],
  };
  const start = createBattle(
    {
      placements: [
        place(healer, "player", 0),
        place(def("ally", { maxHp: 100, speed: 1 }), "player", 1),
        place(def("foe", { speed: 1 }), "enemy", 0),
      ],
    },
    1,
  );
  const ally = start.units.find((u) => u.id === "player-1-0")!;
  ally.hp = options.allyHp ?? 50;
  return advance(start).state;
}

const at = (side: Cell["side"], col: number, row = 0): Cell => ({
  side,
  col,
  row,
});

const healAlly = (state: BattleState) =>
  act(state, { type: "skill", skillId: "heal", cell: at("player", 1) });

const hpOf = (state: BattleState, id: string) =>
  state.units.find((u) => u.id === id)!.hp;

describe("Heal", () => {
  it("given an ally at 50 HP, when it is healed, then it gains power x magic HP and MP is spent", () => {
    const state = battle();

    const { state: after, events } = healAlly(state);

    // 1.6 x 10 magic = 16.
    expect(hpOf(after, "player-1-0")).toBe(66);
    expect(after.units[0]!.mp).toBe(20 - heal.mpCost);
    expect(events).toContainEqual({
      type: "heal",
      unitId: "player-1-0",
      amount: 16,
      hp: 66,
    });
  });

  it("given an ally 5 HP short, when it is healed, then it stops at max HP and reports 5 healed", () => {
    const state = battle({ allyHp: 95 });

    const { state: after, events } = healAlly(state);

    expect(hpOf(after, "player-1-0")).toBe(100);
    expect(events).toContainEqual({
      type: "heal",
      unitId: "player-1-0",
      amount: 5,
      hp: 100,
    });
  });

  it("given the healer, when it heals itself, then it is allowed", () => {
    const waiting = battle();

    const healSelf = () =>
      act(waiting, { type: "skill", skillId: "heal", cell: at("player", 0) });

    expect(healSelf).not.toThrow();
  });

  it.each([
    [
      "too little MP",
      () => healAlly(battle({ healerMp: heal.mpCost - 1 })),
      /Not enough MP/,
    ],
    [
      "an enemy",
      () =>
        act(battle(), { type: "skill", skillId: "heal", cell: at("enemy", 0) }),
      /targets an ally/,
    ],
    [
      "a knocked-out ally",
      () => healAlly(battle({ allyHp: 0 })),
      /knocked out/,
    ],
    [
      "a skill the healer lacks",
      () =>
        act(battle(), {
          type: "skill",
          skillId: "fireball",
          cell: at("enemy", 0),
        }),
      /Unknown skill/,
    ],
    [
      "an empty cell",
      () =>
        act(battle(), {
          type: "skill",
          skillId: "heal",
          cell: at("player", 4),
        }),
      /needs a target/,
    ],
  ])(
    "given %s, when the healer casts, then it is refused",
    (_, cast, error) => {
      expect(cast).toThrow(error);
    },
  );

  it.each([
    ["enough MP", {}, [at("player", 0), at("player", 1)]],
    ["no MP", { healerMp: 0 }, []],
  ])(
    "given the healer with %s, when Heal's cells are listed, then they are the living allies it can afford",
    (_, options, cells) => {
      const waiting = battle(options);

      const result = skillCells(waiting, waiting.units[0]!, heal);

      expect(result).toEqual(cells);
    },
  );

  it("given the Heal definition, when it is cast, then the definition is unchanged", () => {
    const copy: Skill = structuredClone(heal);

    healAlly(battle());

    expect(heal).toEqual(copy);
  });
});

describe("Smite", () => {
  const caster = {
    ...def("healer", { magic: 10, maxMp: 20, speed: 20 }),
    skills: [smite],
  };
  const waiting = advance(
    createBattle(
      {
        placements: [
          place(caster, "player", 0),
          place(def("foe", { speed: 1 }), "enemy", 0),
          place(
            { ...def("ghost", { speed: 1 }), resistances: { holy: 2 } },
            "enemy",
            1,
          ),
        ],
      },
      1,
    ),
  ).state;
  const smiteAt = (col: number) =>
    act(waiting, { type: "skill", skillId: smite.id, cell: at("enemy", col) });
  const amount = (events: BattleEvent[]) =>
    events.flatMap((e) => (e.type === "damage" ? [e.amount] : []))[0]!;

  it("given the Healer, when its skills are listed, then Smite is the last", () => {
    const skills = healer.skills!;

    expect(skills.at(-1)).toBe(smite);
  });

  it("given a foe, when it is smitten, then it takes damage, for 6 MP", () => {
    const target = 0;

    const { state, events } = smiteAt(target);

    expect(state.units[0]!.mp).toBe(20 - smite.mpCost);
    expect(amount(events)).toBeGreaterThan(0);
  });

  it("given a foe weak to holy, when it is smitten, then it takes about twice the damage", () => {
    const plain = amount(smiteAt(0).events);

    const { events } = smiteAt(1);

    expect(amount(events)).toBeGreaterThan(1.5 * plain);
  });
});
