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
  it("is nothing when char saved nothing, or something broken", () => {
    expect(loadLibrary()).toBeNull();
    localStorage.setItem(LIBRARY_STORAGE_KEY, "nope");
    expect(loadLibrary()).toBeNull();
  });

  it("is the library char saved", () => {
    const library = starterLibrary();
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));
    expect(loadLibrary()).toEqual(library);
  });

  it("is nothing when the browser refuses to read", () => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(starterLibrary()));
    refuse("getItem");
    expect(loadLibrary()).toBeNull();
  });
});

describe("loadRun and saveRun", () => {
  const run = startRun(starterLibrary(), 3);

  it("is no run when none was saved", () => {
    expect(loadRun()).toBeNull();
  });

  it("reads back the run that was saved", () => {
    saveRun(run);
    expect(loadRun()).toEqual(run);
  });

  it("forgets the run when saving none", () => {
    saveRun(run);
    saveRun(null);
    expect(localStorage.getItem(RUN_STORAGE_KEY)).toBeNull();
  });

  it("plays on without a save when the browser refuses", () => {
    saveRun(run);
    refuse("setItem");
    refuse("removeItem");
    expect(() => saveRun(run)).not.toThrow();
    expect(() => saveRun(null)).not.toThrow();
    refuse("getItem");
    expect(loadRun()).toBeNull();
  });
});
