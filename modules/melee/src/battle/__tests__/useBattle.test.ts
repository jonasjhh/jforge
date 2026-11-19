// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { content, createBattle, type BattleSetup } from "../../../shared";
import { useBattle } from "../useBattle";

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

describe("useBattle", () => {
  it("starts the battle the setup and seed make", () => {
    const { result } = renderHook(() => useBattle(setup, 3));
    expect(result.current.state).toEqual(createBattle(setup, 3));
    expect(result.current.log).toEqual([]);
  });

  it("runs time until a player unit waits for a command", () => {
    const { result } = renderHook(() => useBattle(setup, 3));
    untilAsked(result);
    expect(result.current.state.phase).toEqual({
      kind: "awaitingCommand",
      unitId: expect.any(String),
    });
    expect(result.current.state.time).toBeGreaterThan(0);
  });

  it("holds time while paused", () => {
    const { result, rerender } = renderHook(
      ({ paused }) => useBattle(setup, 3, paused),
      { initialProps: { paused: true } },
    );
    play(3000);
    expect(result.current.state.time).toBe(0);
    rerender({ paused: false });
    play(500);
    expect(result.current.state.time).toBeGreaterThan(0);
  });

  it("runs time faster at a higher speed", () => {
    const slow = renderHook(() => useBattle(setup, 3, false, 1));
    const fast = renderHook(() => useBattle(setup, 3, false, 2));
    play(300);
    expect(fast.result.current.state.time).toBeGreaterThan(
      slow.result.current.state.time,
    );
  });

  it("carries out a command, shows the action and logs it", () => {
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

  it("ignores a command while no one waits for one", () => {
    const { result } = renderHook(() => useBattle(setup, 3));
    const before = result.current.state;
    act(() => result.current.command({ type: "defend" }));
    expect(result.current.state).toBe(before);
  });

  it("freezes time while an action is shown, then runs on", () => {
    const { result } = renderHook(() => useBattle(setup, 3));
    untilAsked(result);
    act(() => result.current.command({ type: "defend" }));
    const shown = result.current.state.time;
    const actor = result.current.actorId;
    play(300);
    expect(result.current.state.time).toBe(shown);
    expect(result.current.actorId).toBe(actor);
    play(1000);
    expect(result.current.state.time).toBeGreaterThan(shown);
    expect(result.current.actionArea).toEqual([]);
  });
});
