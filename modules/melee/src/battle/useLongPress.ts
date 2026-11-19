import { useEffect, useRef, type MouseEvent } from "react";

/** How long a press must last to count as a long press. */
const LONG_PRESS_MS = 450;

interface LongPress {
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onContextMenu: (event: MouseEvent) => void;
  /** True once for the click that ends a long press, so it can be ignored. */
  consumeClick: () => boolean;
}

/**
 * Calls `onLongPress` when a pointer is held down, and on right-click or the
 * platform's own long-press menu (Android fires a context menu).
 */
export function useLongPress(onLongPress: () => void): LongPress {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);
  const callback = useRef(onLongPress);
  callback.current = onLongPress;

  const clear = () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  const fire = () => {
    clear();
    if (fired.current) return;
    fired.current = true;
    callback.current();
  };
  useEffect(() => clear, []);

  return {
    onPointerDown: () => {
      fired.current = false;
      clear();
      timer.current = window.setTimeout(fire, LONG_PRESS_MS);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (event) => {
      event.preventDefault();
      fire();
    },
    consumeClick: () => {
      const was = fired.current;
      fired.current = false;
      return was;
    },
  };
}
