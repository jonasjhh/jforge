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

const renamed = () => {
  const start = starterLibrary();
  return upsert(start, "characters", {
    ...start.characters[0]!,
    name: "Renamed",
  });
};

describe("loadLibrary", () => {
  it("given nothing saved, when the library is loaded, then it is the starter library", () => {
    const library = loadLibrary();

    expect(library).toEqual(starterLibrary());
  });

  it("given a save that is not a library, when the library is loaded, then it is the starter library", () => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, "{broken");

    const library = loadLibrary();

    expect(library).toEqual(starterLibrary());
  });

  it("given a saved library with an edited character, when it is loaded, then the edit is kept", () => {
    saveLibrary(renamed());

    const library = loadLibrary();

    expect(library.characters[0]!.name).toBe("Renamed");
  });

  it("given a save that lacks a melee hero, when it is loaded, then the hero is brought back", () => {
    const start = starterLibrary();
    const id = meleeHeroId("knight");
    saveLibrary({
      ...start,
      characters: start.characters.filter((c) => c.id !== id),
    });

    const library = loadLibrary();

    expect(library.characters.some((c) => c.id === id)).toBe(true);
  });

  it("given a saved library and a browser that refuses to read, when it is loaded, then it is the starter library", () => {
    saveLibrary(renamed());
    refuse("getItem");

    const library = loadLibrary();

    expect(library).toEqual(starterLibrary());
  });
});

describe("saveLibrary", () => {
  it("given the starter library, when it is saved, then the library and its roster are stored", () => {
    const library = starterLibrary();

    const ok = saveLibrary(library);

    expect(ok).toBe(true);
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(ROSTER_STORAGE_KEY)).not.toBeNull();
    expect(readRoster(localStorage).party.length).toBeGreaterThan(0);
  });

  it("given a browser that refuses to write, when the library is saved, then saving fails", () => {
    refuse("setItem");

    const ok = saveLibrary(starterLibrary());

    expect(ok).toBe(false);
  });
});
