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
  it.each<[string, PauseKey, "toggle" | "resume" | null]>([
    ["p", press("p"), "toggle"],
    ["P", press("P"), "toggle"],
    ["Space", press(" "), "toggle"],
    ["Space on a focused control", press(" ", { onControl: true }), null],
    ["P on a focused control", press("p", { onControl: true }), "toggle"],
    ["Escape", press("Escape"), "resume"],
    ["a", press("a"), null],
    ["Enter", press("Enter"), null],
  ])(
    "given %s is pressed, when the action is read, then it is %s",
    (_, key, action) => {
      const result = pauseKeyAction(key);

      expect(result).toBe(action);
    },
  );

  it.each(
    ["p", "Escape"].flatMap((key) =>
      [
        { repeat: true },
        { ctrlKey: true },
        { metaKey: true },
        { altKey: true },
      ].map(
        (extra) =>
          [`${key} ${JSON.stringify(extra)}`, press(key, extra)] as const,
      ),
    ),
  )(
    "given %s, when the action is read, then the held key or shortcut is ignored",
    (_, key) => {
      const result = pauseKeyAction(key);

      expect(result).toBeNull();
    },
  );
});
