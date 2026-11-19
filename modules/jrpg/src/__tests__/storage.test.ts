// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIBRARY_STORAGE_KEY, starterLibrary } from "@jforge/char/shared";
import { RUN_STORAGE_KEY, startRun } from "../../shared";
import { loadLibrary, loadRun, saveRun } from "../storage";

const refusals: { mockRestore(): void }[] = [];
/** Makes the browser refuse this storage call until the test ends. */
const refuse = (method: "getItem" | "setItem" | "removeItem") => {
  refusals.push(
    vi.spyOn(localStorage, method).mockImplementation(() => {
      throw new Error("denied");
    }),
  );
};

beforeEach(() => localStorage.clear());
afterEach(() => refusals.splice(0).forEach((spy) => spy.mockRestore()));

describe("loadLibrary", () => {
  it("given nothing saved by char, when the library is loaded, then there is none", () => {
    const loaded = loadLibrary();

    expect(loaded).toBeNull();
  });

  it("given a broken save, when the library is loaded, then there is none", () => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, "nope");

    const loaded = loadLibrary();

    expect(loaded).toBeNull();
  });

  it("given a library saved by char, when it is loaded, then it is that library", () => {
    const library = starterLibrary();
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));

    const loaded = loadLibrary();

    expect(loaded).toEqual(library);
  });

  it("given a saved library and a browser that refuses to read, when it is loaded, then there is none", () => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(starterLibrary()));
    refuse("getItem");

    const loaded = loadLibrary();

    expect(loaded).toBeNull();
  });
});

describe("loadRun and saveRun", () => {
  const run = startRun(starterLibrary(), 3);

  it("given no run saved, when the run is loaded, then there is none", () => {
    const loaded = loadRun();

    expect(loaded).toBeNull();
  });

  it("given a run saved, when it is loaded, then it reads back unchanged", () => {
    saveRun(run);

    const loaded = loadRun();

    expect(loaded).toEqual(run);
  });

  it("given a run saved, when no run is saved, then the run is forgotten", () => {
    saveRun(run);

    saveRun(null);

    expect(localStorage.getItem(RUN_STORAGE_KEY)).toBeNull();
  });

  it.each([
    ["a run", run],
    ["no run", null],
  ])(
    "given a browser that refuses to write, when %s is saved, then nothing throws",
    (_, value) => {
      refuse("setItem");
      refuse("removeItem");

      const save = () => saveRun(value);

      expect(save).not.toThrow();
    },
  );

  it("given a saved run and a browser that refuses to read, when the run is loaded, then there is none", () => {
    saveRun(run);
    refuse("getItem");

    const loaded = loadRun();

    expect(loaded).toBeNull();
  });
});
