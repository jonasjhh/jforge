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
  it("given char published nothing, when the roster is loaded, then it is empty", () => {
    localStorage.clear();

    const roster = loadRoster();

    expect(roster).toEqual(EMPTY_ROSTER);
  });

  it("given char published a roster, when it is loaded, then it is that roster", () => {
    const published = { party: [content.fighter], monsters: [content.slime] };
    writeRoster(localStorage, published);

    const roster = loadRoster();

    expect(roster).toEqual(published);
  });

  it("given the browser refuses to read, when the roster is loaded, then it is empty", () => {
    writeRoster(localStorage, { party: [content.fighter], monsters: [] });
    refuse("getItem");

    const roster = loadRoster();

    expect(roster).toEqual(EMPTY_ROSTER);
  });

  it("given the browser blocks storage altogether, when the roster is loaded, then it is empty", () => {
    const spy = vi
      .spyOn(window, "localStorage", "get")
      .mockImplementation(() => {
        throw new Error("blocked");
      });

    const roster = loadRoster();

    expect(roster).toEqual(EMPTY_ROSTER);
    spy.mockRestore();
  });
});
