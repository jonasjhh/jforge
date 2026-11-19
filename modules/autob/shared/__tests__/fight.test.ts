import { describe, expect, it } from "vitest";
import {
  FIGHT_TICKS,
  MANA_BASE,
  MANA_PER_ATTACK,
  MANA_PER_HIT,
  MANA_PER_MP,
  MOVE_TICKS,
  RANGED_RANGE,
  attackTicks,
  castable,
  createFight,
  manaCost,
  rangeOf,
  runFight,
  statOf,
  step,
  type Fight,
} from "../fight";
import { at, bow, skill, unit } from "./fighters";

/** The fight after `ticks` ticks. */
const after = (fight: Fight, ticks: number) => {
  let next = fight;
  for (let i = 0; i < ticks; i++) next = step(next);
  return next;
};

/** A player unit and an enemy face to face across the middle. */
const duel = (player = unit(), enemy = unit({ id: "e", name: "Foe" })) =>
  createFight(
    [
      at(player, "player", { col: 3, row: 4 }),
      at(enemy, "enemy", { col: 3, row: 3 }),
    ],
    1,
  );

const hpOf = (fight: Fight, side: "player" | "enemy") =>
  fight.fighters.find((f) => f.side === side)!.hp;

describe("attackTicks", () => {
  it.each([
    [10, 10],
    [20, 5],
    [100, 3],
  ])(
    "given speed %i, when its attack time is worked out, then it is %i ticks",
    (speed, ticks) => {
      const result = attackTicks(speed);

      expect(result).toBe(ticks);
    },
  );

  it("given no speed, when its attack time is worked out, then it never attacks", () => {
    const ticks = attackTicks(0);

    expect(ticks).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("rangeOf", () => {
  it("given a melee weapon, when its range is asked, then it is 1", () => {
    const range = rangeOf(unit());

    expect(range).toBe(1);
  });

  it("given a ranged weapon, when its range is asked, then it is RANGED_RANGE", () => {
    const range = rangeOf(unit({ weapon: bow }));

    expect(range).toBe(RANGED_RANGE);
  });
});

describe("castable and manaCost", () => {
  it("given skills of supported and unsupported effects, when the castable are listed, then only the supported remain", () => {
    const strike = skill({ type: "strike", power: 2 });
    const stealth = skill({
      type: "status",
      status: {
        id: "x",
        name: "Hide",
        effect: "stealth",
        harmful: false,
        stat: "magic",
        power: 0,
        interval: 100,
        ticks: 1,
      },
    });
    const regen = skill({
      type: "status",
      status: {
        id: "r",
        name: "Regen",
        effect: "heal",
        harmful: false,
        stat: "magic",
        power: 1,
        interval: 100,
        ticks: 3,
      },
    });

    const skills = castable(
      unit({ skills: [strike, stealth, skill({ type: "cleanse" }), regen] }),
    );

    expect(skills).toEqual([strike, regen]);
  });

  it("given a unit without skills, when the castable are listed, then there are none", () => {
    const skills = castable(unit());

    expect(skills).toEqual([]);
  });

  it("given a skill costing 6 MP, when its mana is worked out, then it is the base plus 6 shares", () => {
    const cost = manaCost(skill({ type: "strike", power: 1 }, { mpCost: 6 }));

    expect(cost).toBe(MANA_BASE + 6 * MANA_PER_MP);
  });
});

describe("createFight", () => {
  it("given two units, when the fight is made, then both stand at full HP with no mana and nobody has won", () => {
    const fight = duel();

    expect(fight.fighters.map((f) => [f.hp, f.mana])).toEqual([
      [100, 0],
      [100, 0],
    ]);
    expect(fight.winner).toBeNull();
    expect(fight.tick).toBe(0);
  });
});

describe("step", () => {
  it("given two units face to face, when their attack time passes, then each has hit the other and gained mana", () => {
    const fight = after(duel(), 10);

    const [player, enemy] = fight.fighters;
    expect(player!.hp).toBeLessThan(100);
    expect(enemy!.hp).toBeLessThan(100);
    expect(player!.mana).toBe(MANA_PER_ATTACK + MANA_PER_HIT);
  });

  it("given a hit, when it lands, then attack and damage events tell of it", () => {
    const fight = after(duel(), 10);

    const kinds = fight.events.map((e) => e.kind);
    expect(kinds).toContain("attack");
    expect(kinds).toContain("damage");
  });

  it("given a unit far from its enemy, when it is time to move, then it steps one hex closer", () => {
    const fight = createFight(
      [
        at(unit(), "player", { col: 3, row: 7 }),
        at(unit({ id: "e" }), "enemy", { col: 3, row: 0 }),
      ],
      1,
    );

    const moved = after(fight, 1);
    const later = after(moved, MOVE_TICKS);

    expect(moved.fighters[0]!.hex.row).toBe(6);
    expect(later.fighters[0]!.hex.row).toBe(5);
  });

  it("given a unit of speed 0, when time passes, then it neither moves nor attacks", () => {
    const fight = createFight(
      [
        at(unit({ stats: { ...unit().stats, speed: 0 } }), "player", {
          col: 3,
          row: 4,
        }),
        at(unit({ id: "e", stats: { ...unit().stats, speed: 0 } }), "enemy", {
          col: 3,
          row: 0,
        }),
      ],
      1,
    );

    const later = after(fight, 20);

    expect(later.fighters[0]!.hex).toEqual({ col: 3, row: 4 });
    expect(later.events).toEqual([]);
  });

  it("given a unit walled in by its allies, when it has no way to an enemy, then it stays put", () => {
    const wall = [
      { col: 0, row: 6 },
      { col: 1, row: 6 },
      { col: 1, row: 7 },
    ];
    const fight = createFight(
      [
        at(unit(), "player", { col: 0, row: 7 }),
        ...wall.map((hex, i) =>
          at(
            unit({ id: `w${i}`, stats: { ...unit().stats, speed: 0 } }),
            "player",
            hex,
          ),
        ),
        at(unit({ id: "e", stats: { ...unit().stats, speed: 0 } }), "enemy", {
          col: 6,
          row: 0,
        }),
      ],
      1,
    );

    const later = after(fight, 2);

    expect(later.fighters[0]!.hex).toEqual({ col: 0, row: 7 });
  });

  it("given a ranged unit, when an enemy is within its range, then it shoots without moving", () => {
    const fight = createFight(
      [
        at(unit({ weapon: bow }), "player", { col: 3, row: 7 }),
        at(unit({ id: "e" }), "enemy", { col: 3, row: 3 }),
      ],
      1,
    );

    const later = after(fight, 10);

    expect(later.fighters[0]!.hex).toEqual({ col: 3, row: 7 });
    expect(hpOf(later, "enemy")).toBeLessThan(100);
  });

  it("given a sturdier target, when it is hit, then it takes less", () => {
    const soft = after(duel(), 10);

    const hard = after(
      duel(unit(), unit({ id: "e", stats: { ...unit().stats, defense: 50 } })),
      10,
    );

    expect(100 - hpOf(hard, "enemy")).toBeLessThan(100 - hpOf(soft, "enemy"));
  });

  it("given an immune target, when it is hit, then it takes nothing", () => {
    const fight = after(
      duel(unit(), unit({ id: "e", resistances: { slash: 0 } })),
      10,
    );

    expect(hpOf(fight, "enemy")).toBe(100);
  });

  it("given one side falls, when the fight steps, then the other wins and a fall is told", () => {
    const strong = unit({ stats: { ...unit().stats, attack: 500 } });

    const fight = after(duel(strong), 10);

    expect(fight.winner).toBe("player");
    expect(fight.events.map((e) => e.kind)).toContain("fall");
  });

  it("given a finished fight, when it steps, then it stays as it is", () => {
    const done = runFight(
      duel(unit({ stats: { ...unit().stats, attack: 500 } })),
    );

    const again = step(done);

    expect(again).toBe(done);
  });

  it("given both sides fall to poison in the same tick, when the fight steps, then it is a draw", () => {
    const fight = duel();
    const dying = {
      ...fight,
      fighters: fight.fighters.map((f) => ({
        ...f,
        hp: 1,
        ticking: [
          {
            name: "Poison",
            amount: 50,
            every: 1,
            next: 1,
            left: 1,
            harm: true,
          },
        ],
      })),
    };

    const later = step(dying);

    expect(later.winner).toBe("draw");
  });

  it("given neither side can hurt the other, when time runs out, then it is a draw", () => {
    const harmless = (id: string) => unit({ id, resistances: { slash: 0 } });

    const fight = runFight(duel(harmless("p"), harmless("e")));

    expect(fight.winner).toBe("draw");
    expect(fight.tick).toBe(FIGHT_TICKS);
  });
});

describe("skills", () => {
  /** A duel in which the player casts `s` at its first attack. */
  const casting = (
    s: ReturnType<typeof skill>,
    extra: Partial<Parameters<typeof unit>[0]> = {},
  ) => duel(unit({ skills: [s], ...extra }));
  const withMana = (fight: Fight, mana: number) => ({
    ...fight,
    fighters: fight.fighters.map((f, i) => (i === 0 ? { ...f, mana } : f)),
  });

  it("given full mana, when the unit's attack is ready, then it casts instead of attacking and its mana empties", () => {
    const fight = withMana(
      casting(skill({ type: "strike", power: 3 }, { name: "Smash" })),
      MANA_BASE,
    );

    const later = after(fight, 10);

    expect(later.events).toContainEqual({
      kind: "cast",
      source: later.fighters[0]!.id,
      skill: "Smash",
    });
    expect(later.fighters[0]!.mana).toBeLessThan(MANA_BASE);
    expect(hpOf(later, "enemy")).toBeLessThan(80);
  });

  it("given too little mana, when the attack is ready, then it attacks", () => {
    const fight = withMana(
      casting(skill({ type: "strike", power: 3 })),
      MANA_BASE - 1,
    );

    const later = after(fight, 10);

    expect(later.events.map((e) => e.kind)).not.toContain("cast");
  });

  it("given a finisher, when the target is low, then it hits much harder", () => {
    const finisher = skill({ type: "strike", power: 1, finisher: 5 });
    const plain = withMana(casting(finisher), MANA_BASE);
    const low = {
      ...plain,
      fighters: plain.fighters.map((f) =>
        f.side === "enemy" ? { ...f, hp: 25 } : f,
      ),
    };

    const dealt = 100 - hpOf(after(plain, 10), "enemy");
    const finished = after(low, 10);

    expect(hpOf(finished, "enemy")).toBe(0);
    expect(dealt).toBeLessThan(25);
  });

  it("given a draining spell, when it hits, then the caster heals", () => {
    const drain = skill({
      type: "damage",
      kind: "magical",
      element: "shadow",
      power: 3,
      drain: 1,
    });
    const fight = withMana(casting(drain), MANA_BASE);
    const hurt = {
      ...fight,
      fighters: fight.fighters.map((f, i) => (i === 0 ? { ...f, hp: 50 } : f)),
    };

    const later = after(hurt, 10);

    expect(hpOf(later, "player")).toBeGreaterThan(50);
  });

  it("given a heal on allies, when it is cast, then the most hurt ally heals", () => {
    const mend = skill({ type: "heal", power: 2 }, { target: "ally" });
    const fight = createFight(
      [
        at(unit({ skills: [mend] }), "player", { col: 3, row: 4 }),
        at(unit({ id: "hurt" }), "player", { col: 0, row: 7 }),
        at(unit({ id: "e", resistances: { slash: 0 } }), "enemy", {
          col: 3,
          row: 3,
        }),
      ],
      1,
    );
    const ready = {
      ...fight,
      fighters: fight.fighters.map((f, i) =>
        i === 0 ? { ...f, mana: MANA_BASE } : i === 1 ? { ...f, hp: 40 } : f,
      ),
    };

    const later = after(ready, 10);

    expect(later.fighters[1]!.hp).toBe(60);
  });

  it("given a heal of max HP on oneself, when it is cast, then it heals a share of max HP", () => {
    const wind = skill(
      { type: "heal", power: 0.25, of: "maxHp" },
      { target: "self" },
    );
    const fight = withMana(casting(wind), MANA_BASE);
    const hurt = {
      ...fight,
      fighters: fight.fighters.map((f, i) => (i === 0 ? { ...f, hp: 50 } : f)),
    };

    const later = after(hurt, 10);

    expect(later.events).toContainEqual({
      kind: "heal",
      target: later.fighters[0]!.id,
      amount: 25,
    });
  });

  it("given a timed buff, when it is cast, then the stat rises until it runs out", () => {
    const rage = skill(
      {
        type: "modify",
        modifier: {
          name: "Rage",
          stat: "attack",
          op: "mul",
          value: 2,
          duration: 100,
          harmful: false,
        },
      },
      { target: "self" },
    );
    const fight = withMana(casting(rage), MANA_BASE);

    const buffed = after(fight, 10);
    const faded = after(buffed, 11);

    expect(statOf(buffed.fighters[0]!, "attack")).toBe(20);
    expect(statOf(faded.fighters[0]!, "attack")).toBe(10);
  });

  it("given an added modifier, when the stat is read, then it adds before multiplying and never goes below 0", () => {
    const fighter = duel().fighters[0]!;

    const stat = statOf(
      {
        ...fighter,
        modifiers: [
          { name: "a", stat: "attack", op: "add", value: -30, until: 99 },
          { name: "b", stat: "magic", op: "mul", value: 3, until: 99 },
        ],
      },
      "attack",
    );

    expect(stat).toBe(0);
  });

  it("given a poison, when its ticks come, then the target loses HP each time until it ends", () => {
    const poison = skill({
      type: "status",
      status: {
        id: "p",
        name: "Poison",
        effect: "damage",
        damageType: "poison",
        harmful: true,
        stat: "magic",
        power: 1,
        interval: 10,
        ticks: 2,
      },
    });
    const fight = withMana(
      duel(
        unit({ skills: [poison], resistances: {} }),
        unit({ id: "e", resistances: { slash: 0 } }),
      ),
      MANA_BASE,
    );

    const later = after(fight, 13);

    const enemy = later.fighters[1]!;
    expect(enemy.hp).toBeLessThan(100);
    expect(enemy.ticking).toEqual([]);
  });

  it("given a regeneration, when its ticks come, then the target heals", () => {
    const regen = skill(
      {
        type: "status",
        status: {
          id: "r",
          name: "Regen",
          effect: "heal",
          harmful: false,
          stat: "magic",
          power: 1,
          interval: 10,
          ticks: 3,
        },
      },
      { target: "self" },
    );
    const fight = withMana(casting(regen), MANA_BASE);
    const hurt = {
      ...fight,
      fighters: fight.fighters.map((f, i) => (i === 0 ? { ...f, hp: 50 } : f)),
    };

    const later = after(hurt, 12);

    expect(later.events).toContainEqual({
      kind: "heal",
      target: later.fighters[0]!.id,
      amount: 10,
    });
  });

  it("given a shield, when the unit is hit, then the shield takes the damage first", () => {
    const ward = skill(
      {
        type: "status",
        status: {
          id: "s",
          name: "Shield",
          effect: "shield",
          harmful: false,
          stat: "magic",
          power: 100,
          interval: 100,
          ticks: 1,
        },
      },
      { target: "self" },
    );
    const fight = createFight(
      [
        at(
          unit({ skills: [ward], stats: { ...unit().stats, speed: 20 } }),
          "player",
          { col: 3, row: 4 },
        ),
        at(unit({ id: "e" }), "enemy", { col: 3, row: 3 }),
      ],
      1,
    );
    const ready = withMana(fight, MANA_BASE);

    const later = after(ready, 10);

    expect(hpOf(later, "player")).toBe(100);
    expect(later.fighters[0]!.shield).toBeLessThan(1000);
  });

  it.each([
    ["plus", 2],
    ["square", 2],
    ["line", 2],
    ["row", 2],
    ["reach", 1],
    ["single", 1],
  ] as const)(
    "given a %s blast, when it is cast, then it hits %i of the enemies",
    (area, hit) => {
      const blast = skill(
        { type: "damage", kind: "magical", element: "fire", power: 1 },
        { area },
      );
      const enemy = (id: string) =>
        unit({ id, stats: { ...unit().stats, speed: 0 } });
      const fight = createFight(
        [
          at(unit({ skills: [blast] }), "player", { col: 3, row: 4 }),
          at(enemy("a"), "enemy", { col: 3, row: 3 }),
          at(enemy("b"), "enemy", { col: 3, row: 2 }),
          at(enemy("c"), "enemy", { col: 0, row: 3 }),
        ],
        1,
      );

      const later = after(withMana(fight, MANA_BASE), 10);

      const damaged = later.fighters.filter(
        (f) => f.side === "enemy" && f.hp < 100,
      );
      expect(damaged).toHaveLength(hit);
    },
  );

  it("given an enemy skill and no enemy in range, when mana is full, then it waits rather than casting", () => {
    const smash = skill({ type: "strike", power: 3 });
    const fight = createFight(
      [
        at(unit({ skills: [smash] }), "player", { col: 3, row: 7 }),
        at(unit({ id: "e" }), "enemy", { col: 3, row: 0 }),
      ],
      1,
    );

    const later = after(withMana(fight, MANA_BASE), 3);

    expect(later.fighters[0]!.mana).toBe(MANA_BASE);
  });

  it("given an ally skill that leaves out the caster and no other ally, when mana is full, then it attacks instead", () => {
    const mend = skill(
      { type: "heal", power: 2 },
      { target: "ally", notSelf: true },
    );

    const later = after(withMana(casting(mend), MANA_BASE), 10);

    expect(later.events.map((e) => e.kind)).not.toContain("cast");
  });

  it("given an 'any' skill that helps, when it is cast, then it goes to an ally", () => {
    const haste = skill(
      {
        type: "modify",
        modifier: {
          name: "Haste",
          stat: "speed",
          op: "mul",
          value: 2,
          duration: 300,
          harmful: false,
        },
      },
      { target: "any" },
    );

    const later = after(withMana(casting(haste), MANA_BASE), 10);

    expect(later.fighters[0]!.modifiers.map((m) => m.name)).toEqual(["Haste"]);
  });

  it("given a unit with two skills, when it casts twice, then it casts each in turn", () => {
    const one = skill({ type: "strike", power: 1 }, { name: "One" });
    const two = skill({ type: "strike", power: 1 }, { name: "Two" });
    const fight = withMana(casting(one, { skills: [one, two] }), MANA_BASE);

    const first = after(fight, 10);
    const second = after(withMana(first, MANA_BASE), 10);

    const casts = [...first.events, ...second.events].filter(
      (e) => e.kind === "cast",
    );
    expect(casts.map((e) => (e.kind === "cast" ? e.skill : ""))).toEqual([
      "One",
      "Two",
    ]);
  });
});
