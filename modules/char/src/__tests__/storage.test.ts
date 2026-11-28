// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadTab, loadView, saveTab, saveView } from "../storage";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("tab and view", () => {
  it("given nothing saved, when they are loaded, then it is Classes of everything", () => {
    const loaded = [loadTab(), loadView()];

    expect(loaded).toEqual(["Classes", "all"]);
  });

  it("given Gear and autob saved, when they are loaded, then they come back", () => {
    saveTab("Gear");
    saveView("autob");

    const loaded = [loadTab(), loadView()];

    expect(loaded).toEqual(["Gear", "autob"]);
  });

  it("given an unknown tab and view saved, when they are loaded, then the defaults are used", () => {
    localStorage.setItem("jforge.char.tab", "Roster");
    localStorage.setItem("jforge.char.view", "chess");

    const loaded = [loadTab(), loadView()];

    expect(loaded).toEqual(["Classes", "all"]);
  });

  it("given a browser that refuses storage, when they are saved and loaded, then nothing throws", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });

    saveTab("Gear");
    const loaded = loadTab();

    expect(loaded).toBe("Classes");
  });
});
