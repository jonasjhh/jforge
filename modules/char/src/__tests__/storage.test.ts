// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROSTER_STORAGE_KEY, readRoster } from "@jforge/melee/shared";
import {
  LIBRARY_STORAGE_KEY,
  meleeHeroId,
  starterLibrary,
  upsert,
} from "../../shared";
import { loadLibrary, saveLibrary } from "../storage";

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
  it("is the starter library when nothing is saved", () => {
    expect(loadLibrary()).toEqual(starterLibrary());
  });

  it("is the starter library when the save is not a library", () => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, "{broken");
    expect(loadLibrary()).toEqual(starterLibrary());
  });

  it("reads back what was saved, keeping an edited character", () => {
    const start = starterLibrary();
    const edited = upsert(start, "characters", {
      ...start.characters[0]!,
      name: "Renamed",
    });
    saveLibrary(edited);
    expect(loadLibrary().characters[0]!.name).toBe("Renamed");
  });

  it("brings back a melee hero the save lacks", () => {
    const start = starterLibrary();
    const id = meleeHeroId("knight");
    saveLibrary({
      ...start,
      characters: start.characters.filter((c) => c.id !== id),
    });
    expect(loadLibrary().characters.some((c) => c.id === id)).toBe(true);
  });

  it("is the starter library when the browser refuses to read", () => {
    saveLibrary(
      upsert(starterLibrary(), "characters", {
        ...starterLibrary().characters[0]!,
        name: "Renamed",
      }),
    );
    refuse("getItem");
    expect(loadLibrary()).toEqual(starterLibrary());
  });
});

describe("saveLibrary", () => {
  it("saves the library and publishes its roster", () => {
    expect(saveLibrary(starterLibrary())).toBe(true);
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(ROSTER_STORAGE_KEY)).not.toBeNull();
    expect(readRoster(localStorage).party.length).toBeGreaterThan(0);
  });

  it("is false when the browser refuses to write", () => {
    refuse("setItem");
    expect(saveLibrary(starterLibrary())).toBe(false);
  });
});
