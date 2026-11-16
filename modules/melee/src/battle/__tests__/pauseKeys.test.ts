import { describe, expect, it } from "vitest";
import { pauseKeyAction, type PauseKey } from "../pauseKeys";

const press = (key: string, extra: Partial<PauseKey> = {}): PauseKey => ({
  key,
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  onControl: false,
  ...extra,
});

describe("pauseKeyAction", () => {
  it("toggles on P, either case, and on Space", () => {
    expect(pauseKeyAction(press("p"))).toBe("toggle");
    expect(pauseKeyAction(press("P"))).toBe("toggle");
    expect(pauseKeyAction(press(" "))).toBe("toggle");
  });

  it("leaves Space alone on a focused control, but not P", () => {
    expect(pauseKeyAction(press(" ", { onControl: true }))).toBeNull();
    expect(pauseKeyAction(press("p", { onControl: true }))).toBe("toggle");
  });

  it("resumes on Escape", () => {
    expect(pauseKeyAction(press("Escape"))).toBe("resume");
  });

  it("ignores other keys", () => {
    expect(pauseKeyAction(press("a"))).toBeNull();
    expect(pauseKeyAction(press("Enter"))).toBeNull();
  });

  it("ignores held keys and shortcuts with modifiers", () => {
    for (const extra of [
      { repeat: true },
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
    ]) {
      expect(pauseKeyAction(press("p", extra))).toBeNull();
      expect(pauseKeyAction(press("Escape", extra))).toBeNull();
    }
  });
});
