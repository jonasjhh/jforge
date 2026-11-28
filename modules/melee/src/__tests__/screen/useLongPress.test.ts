// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "@jforge/battle/screen/useLongPress.ts";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setUp = () => {
  const onLongPress = vi.fn();
  const hook = renderHook(({ callback }) => useLongPress(callback), {
    initialProps: { callback: onLongPress },
  });
  return { onLongPress, hook, press: () => hook.result.current };
};

const menu = () => ({ preventDefault: vi.fn() }) as unknown as MouseEvent;
/** Presses and holds for `ms`. */
const hold = (press: () => ReturnType<typeof useLongPress>, ms: number) => {
  act(() => press().onPointerDown());
  act(() => vi.advanceTimersByTime(ms));
};

describe("useLongPress", () => {
  it("given a press, when it is held 449 ms, then it does not fire yet", () => {
    const { onLongPress, press } = setUp();

    hold(press, 449);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("given a press, when it is held 450 ms, then it fires once", () => {
    const { onLongPress, press } = setUp();

    hold(press, 450);

    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it.each(["onPointerUp", "onPointerLeave", "onPointerCancel"] as const)(
    "given a press ended early by %s, when time passes, then it doesn't fire",
    (end) => {
      const { onLongPress, press } = setUp();
      act(() => press().onPointerDown());
      act(() => press()[end]());

      act(() => vi.advanceTimersByTime(1000));

      expect(onLongPress).not.toHaveBeenCalled();
    },
  );

  it("given no press, when the context menu opens, then it fires instead of the browser's menu", () => {
    const { onLongPress, press } = setUp();
    const event = menu();

    act(() => press().onContextMenu(event));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it("given a long press that fired, when the context menu opens too, then it has fired only once", () => {
    const { onLongPress, press } = setUp();
    hold(press, 450);

    act(() => press().onContextMenu(menu()));

    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it("given no long press, when a click is consumed, then there is none to ignore", () => {
    const { press } = setUp();

    const consumed = press().consumeClick();

    expect(consumed).toBe(false);
  });

  it("given a long press, when the clicks after it are consumed, then only the first is ignored", () => {
    const { press } = setUp();
    hold(press, 450);

    const first = press().consumeClick();
    const second = press().consumeClick();

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("given a new callback, when a press is held, then the latest callback fires", () => {
    const { onLongPress, hook, press } = setUp();
    const later = vi.fn();
    hook.rerender({ callback: later });

    hold(press, 450);

    expect(later).toHaveBeenCalledOnce();
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("given a pending press, when the hook is gone and time passes, then it doesn't fire", () => {
    const { onLongPress, hook, press } = setUp();
    act(() => press().onPointerDown());

    hook.unmount();
    vi.advanceTimersByTime(1000);

    expect(onLongPress).not.toHaveBeenCalled();
  });
});
