// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIBRARY_STORAGE_KEY,
  starterLibrary,
  type Library,
} from "../../shared";
import { useLibrary } from "../useLibrary";

const rename =
  (name: string) =>
  (library: Library): Library => ({
    ...library,
    characters: library.characters.map((c, i) =>
      i === 0 ? { ...c, name: `${c.name}${name}` } : c,
    ),
  });
const saved = () =>
  JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY)!) as Library;

beforeEach(() => localStorage.clear());

describe("useLibrary", () => {
  it("given the library on this device, when the hook starts, then it holds and saves that library", () => {
    const { result } = renderHook(() => useLibrary());

    expect(result.current.library).toEqual(starterLibrary());
    expect(result.current.saved).toBe(true);
    expect(saved()).toEqual(starterLibrary());
  });

  it("given a library, when it is changed, then the change is held and saved at once", () => {
    const { result } = renderHook(() => useLibrary());
    const first = result.current.library.characters[0]!.name;

    act(() => result.current.update(rename("!")));

    expect(result.current.library.characters[0]!.name).toBe(`${first}!`);
    expect(saved().characters[0]!.name).toBe(`${first}!`);
  });

  it("given a library, when two changes are made together, then they apply one after another", () => {
    const { result } = renderHook(() => useLibrary());
    const first = result.current.library.characters[0]!.name;

    act(() => {
      result.current.update(rename("a"));
      result.current.update(rename("b"));
    });

    expect(result.current.library.characters[0]!.name).toBe(`${first}ab`);
  });

  it("given a browser that refuses to save, when the library is changed, then it says it isn't saved", () => {
    const { result } = renderHook(() => useLibrary());
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("full");
    });

    act(() => result.current.update(rename("!")));

    expect(result.current.saved).toBe(false);
    spy.mockRestore();
  });
});
