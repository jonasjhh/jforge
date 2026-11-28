// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RUN_STORAGE_KEY, startRun } from "../../shared";
import { loadRun, saveRun } from "../storage";
import { library } from "./runs";

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

describe("loadRun and saveRun", () => {
  it("given a saved run, when it is loaded, then it is that run", () => {
    const run = startRun(library, 4);
    saveRun(run);

    const loaded = loadRun();

    expect(loaded).toEqual(run);
  });

  it("given a saved run, when null is saved, then the save is gone", () => {
    saveRun(startRun(library, 4));

    saveRun(null);

    expect(localStorage.getItem(RUN_STORAGE_KEY)).toBeNull();
  });

  it("given a browser that refuses storage, when a run is loaded, then there is none", () => {
    refuse("getItem");

    const loaded = loadRun();

    expect(loaded).toBeNull();
  });

  it("given a browser that refuses storage, when a run is saved, then nothing breaks", () => {
    refuse("setItem");

    const save = () => saveRun(startRun(library, 4));

    expect(save).not.toThrow();
  });
});
