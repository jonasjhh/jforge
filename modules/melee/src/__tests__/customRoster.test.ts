// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_ROSTER, content, writeRoster } from "../../shared";
import { loadRoster } from "../customRoster";

const refusals: { mockRestore(): void }[] = [];
/** Makes the browser refuse this storage call until the test ends. */
const refuse = (method: "getItem" | "setItem" | "removeItem") => {
  refusals.push(
    vi.spyOn(localStorage, method).mockImplementation(() => {
      throw new Error("denied");
    }),
  );
};

afterEach(() => {
  localStorage.clear();
  refusals.splice(0).forEach((spy) => spy.mockRestore());
});

describe("loadRoster", () => {
  it("is empty when char published nothing", () => {
    expect(loadRoster()).toEqual(EMPTY_ROSTER);
  });

  it("is the roster char published", () => {
    const roster = { party: [content.fighter], monsters: [content.slime] };
    writeRoster(localStorage, roster);
    expect(loadRoster()).toEqual(roster);
  });

  it("is empty when the browser refuses to read", () => {
    writeRoster(localStorage, { party: [content.fighter], monsters: [] });
    refuse("getItem");
    expect(loadRoster()).toEqual(EMPTY_ROSTER);
  });

  it("is empty when the browser blocks storage altogether", () => {
    const spy = vi
      .spyOn(window, "localStorage", "get")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(loadRoster()).toEqual(EMPTY_ROSTER);
    spy.mockRestore();
  });
});
