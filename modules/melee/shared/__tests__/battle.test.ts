import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { DEFENSE_K } from "../damage";
import { simulate } from "../simulate";
import type { BattleSetup } from "../types";
import { def, place, sampleBattle } from "./helpers";

describe("createBattle", () => {
  const enemy = place(def("e"), "enemy", 0);

  it("rejects units off the grid", () => {
    expect(() =>
      createBattle({ placements: [place(def("a"), "player", 5), enemy] }, 1),
    ).toThrow(/off the grid/);
  });

  it("rejects two units in one cell", () => {
    const placements = [
      place(def("a"), "player", 0),
      place(def("b"), "player", 0),
      enemy,
    ];
    expect(() => createBattle({ placements }, 1)).toThrow(/share cell/);
  });

  it("allows at most 5 player units", () => {
    const party = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        place(def(`p${i}`), "player", i % 5, Math.floor(i / 5)),
      );
    expect(() =>
      createBattle({ placements: [...party(5), enemy] }, 1),
    ).not.toThrow();
    expect(() => createBattle({ placements: [...party(6), enemy] }, 1)).toThrow(
      /At most 5/,
    );
  });

  it("needs a unit on each side", () => {
    expect(() => createBattle({ placements: [enemy] }, 1)).toThrow(
      /player side/,
    );
    expect(() =>
      createBattle({ placements: [place(def("a"), "player", 0)] }, 1),
    ).toThrow(/enemy side/);
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

  it("waits for the player, then resolves the attack", () => {
    const waiting = advance(createBattle(setup, 1)).state;
    expect(waiting.phase).toEqual({
      kind: "awaitingCommand",
      unitId: "player-0-0",
    });

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

  it("rejects attacking an ally or an unknown unit", () => {
    const waiting = advance(createBattle(setup, 1)).state;
    expect(() =>
      act(waiting, { type: "attack", targetId: "player-1-0" }),
    ).toThrow(/ally/);
    expect(() => act(waiting, { type: "attack", targetId: "nope" })).toThrow(
      /Unknown/,
    );
  });

  it("rejects a command when no unit is waiting for one", () => {
    expect(() =>
      act(createBattle(setup, 1), { type: "attack", targetId: "enemy-0-0" }),
    ).toThrow(/No unit is waiting/);
  });

  it("does not change the state it was given", () => {
    const start = createBattle(setup, 1);
    const copy = structuredClone(start);
    advance(start);
    expect(start).toEqual(copy);
  });
});

describe("damage", () => {
  it("scales attack by K / (K + defense), within the random spread", () => {
    const setup: BattleSetup = {
      placements: [
        place(def("hero", { attack: 100, speed: 20 }), "player", 0),
        place(
          def("wall", { maxHp: 10_000, defense: DEFENSE_K, speed: 1 }),
          "enemy",
          0,
        ),
      ],
    };
    const waiting = advance(createBattle(setup, 7)).state;
    const { events } = act(waiting, { type: "attack", targetId: "enemy-0-0" });
    const hit = events.find((e) => e.type === "damage");
    // 100 x 50/100 = 50, +-10%.
    expect(hit && hit.type === "damage" && hit.amount).toBeGreaterThanOrEqual(
      45,
    );
    expect(hit && hit.type === "damage" && hit.amount).toBeLessThanOrEqual(55);
  });
});

describe("simulate", () => {
  it("plays a whole battle to the end", () => {
    const summary = simulate(sampleBattle, 42);
    expect(summary.winner).not.toBeUndefined();
    expect(summary.actions).toBeGreaterThan(0);
  });

  it("gives the same result for the same seed", () => {
    expect(simulate(sampleBattle, 42)).toEqual(simulate(sampleBattle, 42));
  });

  it("ends in a draw when nobody can ever act", () => {
    const frozen = { speed: 0 };
    const summary = simulate(
      {
        placements: [
          place(def("a", frozen), "player", 0),
          place(def("b", frozen), "enemy", 0),
        ],
      },
      1,
    );
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

  it("stops at the requested game time with gauges partly filled", () => {
    const { state, events } = advance(createBattle(setup, 1), { until: 25 });
    expect(state.time).toBe(25);
    expect(state.phase.kind).toBe("running");
    expect(state.units.map((u) => u.gauge)).toEqual([250, 500]);
    expect(events).toEqual([{ type: "timeAdvanced", time: 25 }]);
  });

  it("stops right after an AI unit acts", () => {
    const { state, events } = advance(createBattle(setup, 1), {
      stopAfterAction: true,
    });
    expect(state.time).toBe(50);
    expect(events.filter((e) => e.type === "attack")).toHaveLength(1);
    expect(state.phase.kind).toBe("running");
  });
});

describe("unit names", () => {
  it("adds letters to duplicate names on the same side", () => {
    const slime = def("Slime");
    const state = createBattle(
      {
        placements: [
          place(def("Slime"), "player", 0),
          place(slime, "enemy", 0),
          place(slime, "enemy", 1),
        ],
      },
      1,
    );
    expect(state.units.map((u) => u.name)).toEqual([
      "Slime",
      "Slime A",
      "Slime B",
    ]);
  });
});
