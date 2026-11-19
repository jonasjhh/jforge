import { describe, expect, it } from "vitest";
import { act, advance, createBattle, validateCommand } from "../battle";
import {
  arcaneWave,
  charge,
  expose,
  fireball,
  meteor,
  firebolt,
  guard,
  knight,
  rescue,
  playerTypes,
  manaBurn,
  rebuke,
  sage,
  silence,
  shieldBash,
  shieldWall,
} from "../content";
import { resistance } from "../damage";

const EXPOSE_FACTOR = 1.3;
import { skillValue } from "../aiSkills";
import { previewDamage } from "../preview";
import { skillArea } from "../skills";
import { effectiveStat } from "../stats";
import { cleanse, spellPower } from "../status";
import { offenseOf } from "../threat";
import type {
  BattleEvent,
  BattleState,
  Cell,
  CombatantDef,
  DamageType,
  Unit,
} from "../types";
import { def, place } from "./helpers";

const fast = (d: CombatantDef) => ({ ...d, stats: { ...d.stats, speed: 50 } });
const unit = (s: BattleState, id: string): Unit =>
  s.units.find((u) => u.id === id)!;

/** `hero` (fast) ready at player 2,0; allies beside it and behind it. */
function turnOf(hero: CombatantDef): BattleState {
  return advance(
    createBattle(
      {
        placements: [
          place(fast(hero), "player", 2, 0),
          place(def("beside", { speed: 1, defense: 10 }), "player", 0, 0),
          place(def("behind", { speed: 1, defense: 10 }), "player", 2, 1),
          place(
            {
              ...def("foe", { speed: 1 }),
              resistances: { fire: 0.5, holy: 0 },
            },
            "enemy",
            2,
            0,
          ),
        ],
      },
      1,
    ),
  ).state;
}

const skillOn = (skillId: string, cell: Cell) =>
  ({ type: "skill", skillId, cell }) as const;

describe("Knight and Sage", () => {
  it("given the player types, when they are listed, then the Knight and the Sage are among them", () => {
    const types = playerTypes;

    expect(types).toContain(knight);
    expect(types).toContain(sage);
  });

  it("given the Knight and the Sage, when their skills are listed, then each has its own five", () => {
    const skills = [knight.skills, sage.skills];

    expect(skills).toEqual([
      [shieldWall, guard, shieldBash, charge, rescue],
      [expose, silence, manaBurn, rebuke, arcaneWave],
    ]);
  });

  it("given the other player types, when their skills are collected, then none of the Knight's or Sage's are among them", () => {
    const others = playerTypes
      .filter((t) => t !== knight && t !== sage)
      .flatMap((t) => t.skills ?? []);

    const shared = [...knight.skills!, ...sage.skills!].filter((s) =>
      others.includes(s),
    );

    expect(shared).toEqual([]);
  });
});

describe("Shield Wall", () => {
  const self = { side: "player", col: 2, row: 0 } as const;
  const walled = act(turnOf(knight), skillOn(shieldWall.id, self)).state;
  const defense = (id: string) => effectiveStat(unit(walled, id), "defense");

  it("given the Knight, when its area is worked out, then it is the Knight's whole row, on its own side", () => {
    const state = turnOf(knight);

    const cells = skillArea(state, unit(state, "player-2-0"), shieldWall, self);

    expect(cells).toEqual(
      [0, 1, 2, 3, 4].map((col) => ({ side: "player", col, row: 0 })),
    );
  });

  it.each([
    ["the ally beside it", "player-0-0", 15],
    ["the Knight", "player-2-0", Math.round(knight.stats.defense * 1.5)],
    ["the ally behind it", "player-2-1", 10],
    ["the foe", "enemy-2-0", 0],
  ])(
    "given the wall is up, when the defense of %s is read, then it is %i",
    (_, id, expected) => {
      const value = defense(id);

      expect(value).toBe(expected);
    },
  );

  it("given the Knight, when it aims the wall at an ally, then it is refused, as it is aimed at the caster", () => {
    const state = turnOf(knight);
    const command = skillOn(shieldWall.id, { side: "player", col: 0, row: 0 });

    const problem = validateCommand(state, unit(state, "player-2-0"), command);

    expect(problem).toMatch(/caster/);
  });
});

describe("Expose", () => {
  const before = unit(turnOf(sage), "enemy-2-0");
  const cast = act(
    turnOf(sage),
    skillOn(expose.id, { side: "enemy", col: 2, row: 0 }),
  ).state;
  const foe = unit(cast, "enemy-2-0");

  it("given a foe, when it is exposed, then it carries the harmful Exposed status", () => {
    const status = foe.statuses[0];

    expect(status).toMatchObject({ id: "exposed", harmful: true });
  });

  it.each<[string, DamageType, number, number]>([
    ["slash", "slash", 1, EXPOSE_FACTOR],
    ["fire it half resists", "fire", 0.5, 0.5 * EXPOSE_FACTOR],
    ["holy it is immune to", "holy", 0, 0],
  ])(
    "given an exposed foe, when its resistance to %s is read, then it goes up by the factor",
    (_, type, plain, exposed) => {
      const value = resistance(foe, type);

      expect(resistance(before, type)).toBe(plain);
      expect(value).toBeCloseTo(exposed);
    },
  );

  it("given the Sage, when it exposes a foe, then it pays 8 MP", () => {
    const mp = unit(cast, "player-2-0").mp;

    expect(mp).toBe(sage.stats.maxMp - expose.mpCost);
  });
});

describe("Guard", () => {
  const KNIGHT = "player-2-0";
  const BESIDE = "player-0-0";
  const BEHIND = "player-2-1";
  const FOE = "enemy-2-0";
  const behind = { side: "player", col: 2, row: 1 } as const;
  const guardOn = (id: string, state = turnOf(knight)) =>
    skillOn(guard.id, { side: "player", ...unit(state, id).position });
  /** The Knight guards the ally behind it; then it is the foe's turn. */
  const foeTurn = () => {
    const state = turnOf(knight);
    const after = act(state, guardOn(BEHIND, state)).state;
    const foe = unit(after, FOE);
    // Past cover, so the guarded ally behind the Knight can be aimed at.
    foe.skills = [{ ...firebolt, ignoreCover: true }, fireball];
    foe.mp = 99;
    foe.base.magic = 10;
    after.phase = { kind: "awaitingCommand", unitId: FOE };
    return after;
  };
  const guardValue = (state: BattleState) =>
    skillValue(state, unit(state, KNIGHT), guard, behind);

  it.each([
    ["the ally behind it", BEHIND, null],
    ["an ally two away", BESIDE, /next to you/],
    ["itself", KNIGHT, /caster/],
  ])(
    "given the Knight, when it guards %s, then it is allowed only next to it",
    (_, id, problem) => {
      const state = turnOf(knight);

      const result = validateCommand(state, unit(state, KNIGHT), guardOn(id));

      if (problem === null) expect(result).toBeNull();
      else expect(result).toMatch(problem);
    },
  );

  it("given the Knight, when it guards an ally, then the ally carries the Knight's guard, for 5 MP", () => {
    const state = turnOf(knight);

    const after = act(state, guardOn(BEHIND, state)).state;

    expect(unit(after, BEHIND).statuses[0]).toMatchObject({
      effect: "guard",
      sourceId: KNIGHT,
    });
    expect(unit(after, KNIGHT).mp).toBe(knight.stats.maxMp - guard.mpCost);
  });

  it("given a guarded ally, when it is attacked, then the blow lands on the Knight", () => {
    const state = foeTurn();

    const { state: after, events } = act(state, {
      type: "attack",
      targetId: BEHIND,
    });

    expect(events).toContainEqual({
      type: "guarded",
      unitId: BEHIND,
      byId: KNIGHT,
    });
    expect(unit(after, BEHIND).hp).toBe(100);
    expect(unit(after, KNIGHT).hp).toBeLessThan(knight.stats.maxHp);
  });

  it("given a guarded ally, when a single-target spell hits it, then the Knight takes it", () => {
    const state = foeTurn();

    const after = act(state, skillOn(firebolt.id, behind)).state;

    expect(unit(after, BEHIND).hp).toBe(100);
    expect(unit(after, KNIGHT).hp).toBeLessThan(knight.stats.maxHp);
  });

  it("given a guarded ally, when an area spell hits it, then the ally takes it", () => {
    const state = foeTurn();

    const after = act(state, skillOn(fireball.id, behind)).state;

    expect(unit(after, BEHIND).hp).toBeLessThan(100);
  });

  it("given a guarded ally and a fallen Knight, when the ally is attacked, then it takes the blow", () => {
    const state = foeTurn();
    unit(state, KNIGHT).hp = 0;

    const after = act(state, { type: "attack", targetId: BEHIND }).state;

    expect(unit(after, BEHIND).hp).toBeLessThan(100);
  });

  it("given a frail ally, when the AI values guarding it, then it is worth casting", () => {
    const state = turnOf(knight);

    const value = guardValue(state);

    expect(value).toBeGreaterThan(0);
  });

  it("given a tough ally, when the AI values guarding it, then it is not worth casting", () => {
    const tough = turnOf(knight);
    const ally = unit(tough, BEHIND);
    ally.base.maxHp = 500;
    ally.base.defense = 50;

    const value = guardValue(tough);

    expect(value).toBeLessThanOrEqual(0);
  });
});

describe("Shield Bash", () => {
  it("given a foe in front, when the Knight bashes it, then it is hurt and knocked a row back, for the MP cost", () => {
    const state = turnOf(knight);

    const { state: after, events } = act(
      state,
      skillOn(shieldBash.id, { side: "enemy", col: 2, row: 0 }),
    );

    const foe = unit(after, "enemy-2-0");
    expect(foe.position).toEqual({ col: 2, row: 1 });
    expect(foe.hp).toBeLessThan(100);
    expect(events.some((e) => e.type === "pushed")).toBe(true);
    expect(unit(after, "player-2-0").mp).toBe(
      knight.stats.maxMp - shieldBash.mpCost,
    );
  });
});

describe("Charge", () => {
  /** The Knight (fast) at player 2,`row`, `blocker` ahead of it if given. */
  const knightAt = (row: number, blocker?: number) =>
    advance(
      createBattle(
        {
          placements: [
            place(fast(knight), "player", 2, row),
            ...(blocker === undefined
              ? []
              : [place(def("ally", { speed: 1 }), "player", 2, blocker)]),
            place(def("foe", { speed: 1 }), "enemy", 2, 0),
          ],
        },
        1,
      ),
    ).state;
  const command = skillOn(charge.id, { side: "enemy", col: 2, row: 0 });
  const knightIn = (s: BattleState) =>
    s.units.find((u) => u.defId === "knight")!;

  it("given the Knight in the back row, when it charges, then it runs to the front of its column and strikes, for the MP cost", () => {
    const state = knightAt(2);

    const { state: after, events } = act(state, command);

    const self = knightIn(after);
    expect(self.position).toEqual({ col: 2, row: 0 });
    expect(events).toContainEqual({
      type: "moved",
      unitId: "player-2-2",
      from: { col: 2, row: 2 },
      to: { col: 2, row: 0 },
    });
    expect(unit(after, "enemy-2-0").hp).toBeLessThan(100);
    expect(self.mp).toBe(knight.stats.maxMp - charge.mpCost);
  });

  it("given the Knight in the back row, when its charge is previewed, then it hits as hard as a weapon attack from the front, harder than one from the back", () => {
    const back = knightAt(2);
    const front = knightAt(0);
    const foe = unit(back, "enemy-2-0");
    const fromFront = previewDamage(knightIn(front), foe)!.amount;

    const charged = previewDamage(knightIn(back), foe, charge)!.amount;

    expect(charged).toBe(fromFront);
    expect(previewDamage(knightIn(back), foe)!.amount).toBeLessThan(fromFront);
  });

  it.each([
    ["an ally ahead of it", () => knightAt(2, 1), /blocked/],
    ["the Knight already at the front", () => knightAt(0), /front row/],
  ])(
    "given %s, when the Knight charges, then it is refused",
    (_, make, problem) => {
      const state = make();

      const result = validateCommand(state, knightIn(state), command);

      expect(result).toMatch(problem);
    },
  );
});

describe("Rescue", () => {
  const KNIGHT = "player-1-0";
  const ALLY = "player-2-0";
  /** The Knight (fast) at player 1,0, a hurt ally beside it at 2,0. */
  const rescueTurn = (...others: [number, number][]) => {
    const state = advance(
      createBattle(
        {
          placements: [
            place(fast(knight), "player", 1, 0),
            place(def("ally", { speed: 1 }), "player", 2, 0),
            ...others.map(([col, row]) =>
              place(def("other", { speed: 1 }), "player", col, row),
            ),
            place(def("foe", { speed: 1 }), "enemy", 2, 0),
          ],
        },
        1,
      ),
    ).state;
    const ally = unit(state, ALLY);
    ally.hp = 30;
    ally.gauge = 600;
    return state;
  };
  const command = skillOn(rescue.id, { side: "player", col: 2, row: 0 });
  const knightIn = (s: BattleState) =>
    s.units.find((u) => u.defId === "knight")!;
  const rescueValue = (state: BattleState) =>
    skillValue(state, unit(state, KNIGHT), rescue, command.cell);

  it("given a hurt ally beside the Knight, when it is rescued, then the Knight stands in its middle row and the ally behind it, for the MP cost", () => {
    const state = rescueTurn();

    const { state: after, events } = act(state, command);

    const self = knightIn(after);
    expect(self.position).toEqual({ col: 2, row: 1 });
    expect(unit(after, ALLY).position).toEqual({ col: 2, row: 2 });
    expect(events).toContainEqual({
      type: "rescued",
      unitId: ALLY,
      byId: KNIGHT,
    });
    expect(self.mp).toBe(knight.stats.maxMp - rescue.mpCost);
  });

  it("given an ally at gauge 600, when it is rescued, then its gauge halves and the Knight is braced x1.3 defense", () => {
    const before = rescueTurn();
    const defense = effectiveStat(unit(before, KNIGHT), "defense");

    const { state } = act(before, command);

    const self = knightIn(state);
    expect(unit(state, ALLY).gauge).toBe(300);
    expect(self.modifiers).toContainEqual(
      expect.objectContaining({ source: "Braced", stat: "defense" }),
    );
    expect(effectiveStat(self, "defense")).toBeCloseTo(defense * 1.3, 0);
  });

  it("given an ally with a gauge below 0 (a bow's late start), when it is rescued, then its gauge is not raised", () => {
    const before = rescueTurn();
    unit(before, ALLY).gauge = -400;

    const { state } = act(before, command);

    expect(unit(state, ALLY).gauge).toBe(-400);
  });

  it.each<[string, () => BattleState]>([
    ["someone in the ally's middle row", () => rescueTurn([2, 1])],
    [
      "a knocked-out body in the ally's back row",
      () => {
        const body = rescueTurn([2, 2]);
        unit(body, "player-2-2").hp = 0;
        return body;
      },
    ],
  ])("given %s, when the Knight rescues, then there is no room", (_, make) => {
    const state = make();

    const problem = validateCommand(state, unit(state, KNIGHT), command);

    expect(problem).toMatch(/No room/);
  });

  it("given an ally two away, when the Knight rescues it, then it is refused as not next to it", () => {
    const far = rescueTurn();
    unit(far, ALLY).position = { col: 3, row: 0 };

    const problem = validateCommand(far, unit(far, KNIGHT), {
      ...command,
      cell: { side: "player", col: 3, row: 0 },
    });

    expect(problem).toMatch(/next to you/);
  });

  it("given an ally already behind the Knight, when the Knight rescues it, then it is refused", () => {
    const placed = rescueTurn();
    unit(placed, KNIGHT).position = { col: 2, row: 1 };
    unit(placed, ALLY).position = { col: 2, row: 2 };

    const problem = validateCommand(placed, unit(placed, KNIGHT), {
      ...command,
      cell: { side: "player", col: 2, row: 2 },
    });

    expect(problem).toMatch(/already behind/);
  });

  it("given a hurt front-row ally, when the AI values rescuing it, then it is worth casting", () => {
    const state = rescueTurn();

    const value = rescueValue(state);

    expect(value).toBeGreaterThan(0);
  });

  it("given a healthy front-row ally, when the AI values rescuing it, then it is not worth casting", () => {
    const healthy = rescueTurn();
    unit(healthy, ALLY).hp = 100;

    const value = rescueValue(healthy);

    expect(value).toBeLessThanOrEqual(0);
  });
});

describe("Silence", () => {
  const SAGE = "player-2-0";
  const FOE = "enemy-2-0";
  const playerCell = { side: "player", col: 2, row: 0 } as const;
  /** The Sage's turn, its foe a caster with MP to spare. */
  const sageTurn = () => {
    const state = turnOf(sage);
    const foe = unit(state, FOE);
    foe.skills = [firebolt, meteor];
    foe.mp = 99;
    return state;
  };
  const command = skillOn(silence.id, { side: "enemy", col: 2, row: 0 });
  /** The foe silenced; then it is the foe's turn. */
  const foeTurn = () => {
    const after = act(sageTurn(), command).state;
    after.phase = { kind: "awaitingCommand", unitId: FOE };
    return after;
  };
  /** `state` with the foe casting a Meteor at the Sage. */
  const casting = (state: BattleState) => {
    unit(state, FOE).casting = {
      skillId: meteor.id,
      skillName: meteor.name,
      cell: playerCell,
      area: [playerCell],
      startedAt: state.time,
      readyAt: state.time + 60,
    };
    return state;
  };
  const silenceValue = (state: BattleState) =>
    skillValue(state, unit(state, SAGE), silence, command.cell);

  it("given a foe caster, when it is silenced, then it carries the harmful Silenced status, for 9 MP", () => {
    const state = sageTurn();

    const after = act(state, command).state;

    expect(unit(after, FOE).statuses[0]).toMatchObject({
      id: "silenced",
      harmful: true,
    });
    expect(unit(after, SAGE).mp).toBe(sage.stats.maxMp - silence.mpCost);
  });

  it("given a silenced foe, when it casts, then it is refused", () => {
    const state = foeTurn();

    const problem = validateCommand(
      state,
      unit(state, FOE),
      skillOn(firebolt.id, playerCell),
    );

    expect(problem).toMatch(/silenced/);
  });

  it("given a silenced foe, when it attacks, then it may", () => {
    const state = foeTurn();

    const problem = validateCommand(state, unit(state, FOE), {
      type: "attack",
      targetId: SAGE,
    });

    expect(problem).toBeNull();
  });

  it("given a silenced foe, when 150 time passes, then it wears off", () => {
    let state = act(sageTurn(), command).state;
    const until = state.time + 150;

    while (state.time <= until && state.phase.kind !== "over") {
      state = advance(state).state;
      if (state.phase.kind === "awaitingCommand") {
        state = act(state, { type: "defend" }).state;
      }
    }

    expect(unit(state, FOE).statuses).toEqual([]);
  });

  it("given a silenced foe, when it is cleansed, then the silence goes", () => {
    const state = foeTurn();

    cleanse(unit(state, FOE), []);

    expect(unit(state, FOE).statuses).toEqual([]);
  });

  it("given a foe casting, when it is silenced, then the cast fizzles", () => {
    const state = casting(sageTurn());

    const { state: after, events } = act(state, command);

    expect(unit(after, FOE).casting).toBeUndefined();
    expect(events).toContainEqual({
      type: "castFizzled",
      unitId: FOE,
      skillName: meteor.name,
    });
  });

  it("given a foe with skills, when the AI values silencing it, then it is worth casting", () => {
    const idle = sageTurn();

    const value = silenceValue(idle);

    expect(value).toBeGreaterThan(0);
  });

  it("given a foe casting, when the AI values silencing it, then it is worth more than an idle one", () => {
    const idle = silenceValue(sageTurn());

    const value = silenceValue(casting(sageTurn()));

    expect(value).toBeGreaterThan(idle);
  });

  it("given a foe without skills, when the AI values silencing it, then it is not worth casting", () => {
    const plain = turnOf(sage);

    const value = silenceValue(plain);

    expect(value).toBeLessThanOrEqual(0);
  });
});

describe("Mana Burn", () => {
  const FOE = "enemy-2-0";
  const cell = { side: "enemy", col: 2, row: 0 } as const;
  const burnWith = (mp: number) => {
    const state = turnOf(sage);
    const foe = unit(state, FOE);
    foe.skills = [firebolt];
    foe.base.maxMp = 30;
    foe.mp = mp;
    return state;
  };
  const burn = (state: BattleState) => act(state, skillOn(manaBurn.id, cell));
  const burnValue = (state: BattleState) =>
    skillValue(state, unit(state, "player-2-0"), manaBurn, cell);

  it("given a foe with 25 MP, when it is burned, then it takes arcane damage and loses 10 MP, for the MP cost", () => {
    const state = burnWith(25);

    const { state: after, events } = burn(state);

    expect(unit(after, FOE).hp).toBeLessThan(100);
    expect(unit(after, FOE).mp).toBe(15);
    expect(events).toContainEqual({
      type: "mpBurned",
      unitId: FOE,
      amount: 10,
      mp: 15,
    });
    expect(unit(after, "player-2-0").mp).toBe(
      sage.stats.maxMp - manaBurn.mpCost,
    );
  });

  it("given a foe with 4 MP, when it is burned, then it loses what is left", () => {
    const state = burnWith(4);

    const { state: after } = burn(state);

    expect(unit(after, FOE).mp).toBe(0);
  });

  it("given a foe without MP, when it is burned, then no MP burns", () => {
    const state = burnWith(0);

    const { events } = burn(state);

    expect(events.some((e) => e.type === "mpBurned")).toBe(false);
  });

  it("given a foe with MP and one without, when the AI values burning them, then the one with MP is worth more", () => {
    const empty = burnValue(burnWith(0));

    const full = burnValue(burnWith(25));

    expect(full).toBeGreaterThan(empty);
  });
});

describe("Rebuke", () => {
  const FOE = "enemy-2-0";
  const cell = { side: "enemy", col: 2, row: 0 } as const;
  const preview = (state: BattleState) =>
    previewDamage(unit(state, "player-2-0"), unit(state, FOE), rebuke)!.amount;
  const hastedTurn = () => {
    const state = turnOf(sage);
    unit(state, FOE).modifiers.push({
      stat: "speed",
      op: "mul",
      value: 1.5,
      source: "Haste",
    });
    return state;
  };
  const plain = preview(turnOf(sage));

  it("given a hasted foe, when Rebuke is previewed, then it hits x1.6", () => {
    const state = hastedTurn();

    const amount = preview(state);

    // Both are rounded, so allow one point either way.
    expect(Math.abs(amount - 1.6 * plain)).toBeLessThan(1.5);
  });

  it("given a foe casting, when Rebuke is previewed, then it hits as hard as on a hasted one", () => {
    const state = turnOf(sage);
    unit(state, FOE).casting = {
      skillId: "x",
      skillName: "X",
      cell,
      area: [cell],
      startedAt: 0,
      readyAt: 60,
    };

    const amount = preview(state);

    expect(amount).toBe(preview(hastedTurn()));
  });

  it("given a slowed foe, when Rebuke is previewed, then it gets no bonus", () => {
    const state = turnOf(sage);
    unit(state, FOE).modifiers.push({
      stat: "speed",
      op: "mul",
      value: 0.5,
      source: "Slow",
      harmful: true,
    });

    const amount = preview(state);

    expect(amount).toBe(plain);
  });

  it("given a hasted foe, when Rebuke lands, then it deals the bonus", () => {
    const state = hastedTurn();
    const expected = preview(state);

    const { events } = act(state, skillOn(rebuke.id, cell));

    const hit = events.find((e) => e.type === "damage");
    expect(hit && hit.type === "damage" && hit.amount).toBeGreaterThanOrEqual(
      Math.floor(expected * 0.85),
    );
  });
});

describe("Arcane Wave", () => {
  const cell = { side: "enemy", col: 2, row: 0 } as const;
  const effect = arcaneWave.effect as Extract<
    typeof arcaneWave.effect,
    { type: "damage" }
  >;
  /** The Sage's turn with foes in the enemy front row at `cols`. */
  const waveAt = (cols: number[]) => {
    const state = turnOf(sage);
    const foe = unit(state, "enemy-2-0");
    for (const col of cols.filter((c) => c !== 2)) {
      state.units.push({
        ...structuredClone(foe),
        id: `enemy-${col}-0`,
        position: { col, row: 0 },
      });
    }
    return state;
  };

  it.each([
    [1, 1.5],
    [2, 1],
    [4, 0.5],
    [5, 0.4],
  ])(
    "given %i foes hit, when the spell power is worked out, then each gets x%s of the shared x2, at most x1.5",
    (count, power) => {
      const foe = unit(turnOf(sage), "enemy-2-0");

      const share = spellPower(effect, foe, count);

      expect(share).toBe(power);
    },
  );

  it("given four foes in the enemy front row, when the wave hits, then each takes its quarter share", () => {
    const state = waveAt([0, 1, 2, 4]);
    const expected = previewDamage(
      unit(state, "player-2-0"),
      unit(state, "enemy-2-0"),
      arcaneWave,
      4,
    )!.amount;

    const { events } = act(state, skillOn(arcaneWave.id, cell));

    const hits = events.filter(
      (e): e is Extract<BattleEvent, { type: "damage" }> => e.type === "damage",
    );
    const outside = hits.filter(
      (hit) =>
        hit.amount < Math.floor(expected * 0.85) ||
        hit.amount > Math.ceil(expected * 1.15),
    );
    expect(hits.map((e) => e.unitId).sort()).toEqual([
      "enemy-0-0",
      "enemy-1-0",
      "enemy-2-0",
      "enemy-4-0",
    ]);
    expect(outside).toEqual([]);
  });

  it("given a lone foe, when the wave is previewed for one and for four, then four each take a third of one", () => {
    const state = waveAt([2]);
    const sageUnit = unit(state, "player-2-0");
    const foe = unit(state, "enemy-2-0");
    const one = previewDamage(sageUnit, foe, arcaneWave, 1)!.amount;

    const four = previewDamage(sageUnit, foe, arcaneWave, 4)!.amount;

    expect(Math.abs(four - one / 3)).toBeLessThan(1.5);
  });

  it("given the wave and a single-target x2 strike, when their offense is worked out, then they count the same for threat", () => {
    const single = {
      ...sage,
      skills: [
        {
          ...arcaneWave,
          area: "single" as const,
          effect: { ...effect, power: 2, split: undefined },
        },
      ],
    };

    const wave = offenseOf({ ...sage, skills: [arcaneWave] });

    expect(wave).toBeCloseTo(offenseOf(single));
  });
});
