// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "../useLongPress";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setUp = () => {
  const onLongPress = vi.fn();
  const hook = renderHook(({ callback }) => useLongPress(callback), {
    initialProps: { callback: onLongPress },
  });
  return { onLongPress, hook, press: () => hook.result.current };
};

describe("useLongPress", () => {
  it("fires once a press has been held long enough", () => {
    const { onLongPress, press } = setUp();
    act(() => press().onPointerDown());
    act(() => vi.advanceTimersByTime(449));
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it.each(["onPointerUp", "onPointerLeave", "onPointerCancel"] as const)(
    "doesn't fire when %s ends the press early",
    (end) => {
      const { onLongPress, press } = setUp();
      act(() => press().onPointerDown());
      act(() => press()[end]());
      act(() => vi.advanceTimersByTime(1000));
      expect(onLongPress).not.toHaveBeenCalled();
    },
  );

  it("fires on the context menu, instead of the browser's menu", () => {
    const { onLongPress, press } = setUp();
    const event = { preventDefault: vi.fn() } as unknown as MouseEvent;
    act(() => press().onContextMenu(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it("fires once when the timer and the context menu both come", () => {
    const { onLongPress, press } = setUp();
    const event = { preventDefault: vi.fn() } as unknown as MouseEvent;
    act(() => press().onPointerDown());
    act(() => vi.advanceTimersByTime(450));
    act(() => press().onContextMenu(event));
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it("lets the click that ends a long press be ignored, once", () => {
    const { press } = setUp();
    expect(press().consumeClick()).toBe(false);
    act(() => press().onPointerDown());
    act(() => vi.advanceTimersByTime(450));
    expect(press().consumeClick()).toBe(true);
    expect(press().consumeClick()).toBe(false);
  });

  it("calls the latest callback it was given", () => {
    const { onLongPress, hook, press } = setUp();
    const later = vi.fn();
    hook.rerender({ callback: later });
    act(() => press().onPointerDown());
    act(() => vi.advanceTimersByTime(450));
    expect(later).toHaveBeenCalledOnce();
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("stops a pending press when it is gone", () => {
    const { onLongPress, hook, press } = setUp();
    act(() => press().onPointerDown());
    hook.unmount();
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
