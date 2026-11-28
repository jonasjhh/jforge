// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBattle, type BattleSetup } from "@jforge/battle";
import { content } from "../../../shared";
import { useBattle } from "@jforge/battle/screen/useBattle.ts";

// A fighter against a slime: the fighter waits for commands, the slime
// acts on its own.
const setup: BattleSetup = {
  placements: [
    { def: content.fighter, side: "player", position: { col: 2, row: 0 } },
    { def: content.slime, side: "enemy", position: { col: 2, row: 0 } },
  ],
};

beforeEach(() =>
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
  }),
);
afterEach(() => vi.useRealTimers());

/** Lets this much real time pass, a frame at a time. */
const play = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

/** Plays until the fighter waits for a command. */
function untilAsked(result: { current: ReturnType<typeof useBattle> }) {
  for (let i = 0; i < 200; i++) {
    if (result.current.state.phase.kind !== "running") return;
    play(100);
  }
}

/** Plays until the fighter is asked, then has it defend. */
function defended(result: { current: ReturnType<typeof useBattle> }) {
  untilAsked(result);
  act(() => result.current.command({ type: "defend" }));
}

describe("useBattle", () => {
  it("given a setup and seed, when the hook first renders, then it holds the battle they make and an empty log", () => {
    const seed = 3;

    const { result } = renderHook(() => useBattle(setup, seed));

    expect(result.current.state).toEqual(createBattle(setup, seed));
    expect(result.current.log).toEqual([]);
  });

  it("given a battle, when time runs, then it runs until a player unit waits for a command", () => {
    const { result } = renderHook(() => useBattle(setup, 3));

    untilAsked(result);

    expect(result.current.state.phase).toEqual({
      kind: "awaitingCommand",
      unitId: expect.any(String),
    });
    expect(result.current.state.time).toBeGreaterThan(0);
  });

  it("given a paused battle, when 3 s pass, then time holds", () => {
    const { result } = renderHook(() => useBattle(setup, 3, true));

    play(3000);

    expect(result.current.state.time).toBe(0);
  });

  it("given a paused battle, when it is unpaused and 0.5 s pass, then time runs", () => {
    const { result, rerender } = renderHook(
      ({ paused }) => useBattle(setup, 3, paused),
      { initialProps: { paused: true } },
    );
    play(3000);

    rerender({ paused: false });
    play(500);

    expect(result.current.state.time).toBeGreaterThan(0);
  });

  it("given battles at 1× and 2×, when 0.3 s pass, then time runs faster at 2×", () => {
    const slow = renderHook(() => useBattle(setup, 3, false, 1));
    const fast = renderHook(() => useBattle(setup, 3, false, 2));

    play(300);

    expect(fast.result.current.state.time).toBeGreaterThan(
      slow.result.current.state.time,
    );
  });

  it("given a unit waiting, when it is commanded, then the command is carried out, shown and logged", () => {
    const { result } = renderHook(() => useBattle(setup, 3));
    untilAsked(result);
    const asked = result.current.state.phase;

    act(() => result.current.command({ type: "defend" }));

    expect(result.current.state.phase).not.toEqual(asked);
    expect(result.current.actorId).toBe(
      asked.kind === "awaitingCommand" ? asked.unitId : null,
    );
    expect(result.current.lastAction).not.toBeNull();
    expect(result.current.log.length).toBeGreaterThan(0);
  });

  it("given no one waits for a command, when a command comes, then it is ignored", () => {
    const { result } = renderHook(() => useBattle(setup, 3));
    const before = result.current.state;

    act(() => result.current.command({ type: "defend" }));

    expect(result.current.state).toBe(before);
  });

  it("given an action being shown, when 0.3 s pass, then time stays frozen on it", () => {
    const { result } = renderHook(() => useBattle(setup, 3));
    defended(result);
    const shown = result.current.state.time;
    const actor = result.current.actorId;

    play(300);

    expect(result.current.state.time).toBe(shown);
    expect(result.current.actorId).toBe(actor);
  });

  it("given an action being shown, when 1.3 s pass, then time runs on and the area clears", () => {
    const { result } = renderHook(() => useBattle(setup, 3));
    defended(result);
    const shown = result.current.state.time;

    play(1300);

    expect(result.current.state.time).toBeGreaterThan(shown);
    expect(result.current.actionArea).toEqual([]);
  });
});
