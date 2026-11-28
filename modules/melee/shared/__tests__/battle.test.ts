import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "@jforge/battle/engine/battle.ts";
import { DEFENCE_K } from "@jforge/battle/engine/damage.ts";
import { simulate } from "@jforge/battle/engine/simulate.ts";
import type { BattleSetup } from "@jforge/battle/engine/types.ts";
import { def, place, sampleBattle } from "./helpers";

describe("createBattle", () => {
  const enemy = place(def("e"), "enemy", 0);
  const party = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      place(def(`p${i}`), "player", i % 5, Math.floor(i / 5)),
    );

  it.each([
    [
      "a unit off the grid",
      [place(def("a"), "player", 5), enemy],
      /off the grid/,
    ],
    [
      "two units in one cell",
      [place(def("a"), "player", 0), place(def("b"), "player", 0), enemy],
      /share cell/,
    ],
    ["6 player units", [...party(6), enemy], /At most 5/],
    ["no player unit", [enemy], /player side/],
    ["no enemy unit", [place(def("a"), "player", 0)], /enemy side/],
  ])(
    "given %s, when the battle is created, then it is refused",
    (_, placements, error) => {
      const create = () => createBattle({ placements }, 1);

      expect(create).toThrow(error);
    },
  );

  it("given 5 player units, when the battle is created, then it is allowed", () => {
    const placements = [...party(5), enemy];

    const create = () => createBattle({ placements }, 1);

    expect(create).not.toThrow();
  });
});

describe("player commands", () => {
  const setup: BattleSetup = {
    placements: [
      place(def("hero", { attack: 50, speed: 20 }), "player", 0),
      place(def("ally"), "player", 1),
      place(def("rat", { maxHp: 10, speed: 1 }), "enemy", 2),
    ],
  };
  const waiting = advance(createBattle(setup, 1)).state;

  it("given a fresh battle, when it advances, then it waits for the fastest player unit", () => {
    const start = createBattle(setup, 1);

    const { state } = advance(start);

    expect(state.phase).toEqual({
      kind: "awaitingCommand",
      unitId: "player-0-0",
    });
  });

  it("given the hero waiting, when it attacks the last foe, then the hit knocks it out and ends the battle", () => {
    const { state, events } = act(waiting, {
      type: "attack",
      targetId: "enemy-2-0",
    });

    expect(events.map((e) => e.type)).toEqual([
      "attack",
      "damage",
      "knockedOut",
      "battleOver",
    ]);
    expect(state.phase).toEqual({ kind: "over", winner: "player" });
  });

  it.each([
    ["an ally", "player-1-0", /ally/],
    ["an unknown unit", "nope", /Unknown/],
  ])(
    "given the hero waiting, when it attacks %s, then it is refused",
    (_, targetId, error) => {
      const attack = () => act(waiting, { type: "attack", targetId });

      expect(attack).toThrow(error);
    },
  );

  it("given no unit waiting, when a command is given, then it is refused", () => {
    const start = createBattle(setup, 1);

    const attack = () => act(start, { type: "attack", targetId: "enemy-0-0" });

    expect(attack).toThrow(/No unit is waiting/);
  });

  it("given a battle, when it advances, then the state it was given is unchanged", () => {
    const start = createBattle(setup, 1);
    const copy = structuredClone(start);

    advance(start);

    expect(start).toEqual(copy);
  });
});

describe("damage", () => {
  it("given an attack of 100 against defence K, when it hits, then it deals 50 within the 10% spread", () => {
    const setup: BattleSetup = {
      placements: [
        place(def("hero", { attack: 100, speed: 20 }), "player", 0),
        place(
          def("wall", { maxHp: 10_000, defence: DEFENCE_K, speed: 1 }),
          "enemy",
          0,
        ),
      ],
    };
    const waiting = advance(createBattle(setup, 7)).state;

    const { events } = act(waiting, { type: "attack", targetId: "enemy-0-0" });

    const hit = events.find((e) => e.type === "damage");
    const amount = hit && hit.type === "damage" && hit.amount;
    expect(amount).toBeGreaterThanOrEqual(45);
    expect(amount).toBeLessThanOrEqual(55);
  });
});

describe("simulate", () => {
  it("given the sample battle, when it is simulated, then it is played to an end", () => {
    const summary = simulate(sampleBattle, 42);

    expect(summary.winner).not.toBeUndefined();
    expect(summary.actions).toBeGreaterThan(0);
  });

  it("given the same seed, when the battle is simulated twice, then the results are the same", () => {
    const first = simulate(sampleBattle, 42);

    const second = simulate(sampleBattle, 42);

    expect(second).toEqual(first);
  });

  it("given nobody can ever act, when the battle is simulated, then it is a draw", () => {
    const frozen = { speed: 0 };
    const setup = {
      placements: [
        place(def("a", frozen), "player", 0),
        place(def("b", frozen), "enemy", 0),
      ],
    };

    const summary = simulate(setup, 1);

    expect(summary.winner).toBeNull();
  });
});

describe("advance options", () => {
  const setup: BattleSetup = {
    placements: [
      place(def("hero", { speed: 10 }), "player", 0),
      place(def("wolf", { speed: 20, attack: 1 }), "enemy", 0),
    ],
  };

  it("given a time to stop at, when the battle advances, then it stops there with gauges partly filled", () => {
    const start = createBattle(setup, 1);

    const { state, events } = advance(start, { until: 25 });

    expect(state.time).toBe(25);
    expect(state.phase.kind).toBe("running");
    expect(state.units.map((u) => u.gauge)).toEqual([250, 500]);
    expect(events).toEqual([{ type: "timeAdvanced", time: 25 }]);
  });

  it("given stopAfterAction, when the battle advances, then it stops right after an AI unit acts", () => {
    const start = createBattle(setup, 1);

    const { state, events } = advance(start, { stopAfterAction: true });

    expect(state.time).toBe(50);
    expect(events.filter((e) => e.type === "attack")).toHaveLength(1);
    expect(state.phase.kind).toBe("running");
  });
});

describe("unit names", () => {
  it("given two enemies with the same name, when the battle is created, then letters tell them apart", () => {
    const slime = def("Slime");
    const placements = [
      place(def("Slime"), "player", 0),
      place(slime, "enemy", 0),
      place(slime, "enemy", 1),
    ];

    const state = createBattle({ placements }, 1);

    expect(state.units.map((u) => u.name)).toEqual([
      "Slime",
      "Slime A",
      "Slime B",
    ]);
  });
});
