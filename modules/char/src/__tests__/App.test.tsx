// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { ROSTER_STORAGE_KEY, readRoster } from "@jforge/melee/shared";
import { LIBRARY_STORAGE_KEY, parseLibrary } from "../../shared";
import { App } from "../App";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const saved = () => parseLibrary(localStorage.getItem(LIBRARY_STORAGE_KEY))!;
const tab = (name: string) =>
  fireEvent.click(screen.getByRole("tab", { name }));

describe("char App", () => {
  it("starts on the roster and publishes the starter library", () => {
    render(<App />);
    expect(
      screen.getByRole("tab", { name: "Roster" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: "New character" })).toBeTruthy();
    expect(saved()).not.toBeNull();
    expect(localStorage.getItem(ROSTER_STORAGE_KEY)).not.toBeNull();
    expect(screen.getByText(/Published:/)).toBeTruthy();
  });

  it("switches between the sections", () => {
    render(<App />);
    for (const [name, noun] of [
      ["Classes", "class"],
      ["Enemies", "enemy type"],
      ["Skills", "skill"],
      ["Gear", "gear"],
    ]) {
      tab(name!);
      expect(
        screen.getByRole("tab", { name }).getAttribute("aria-selected"),
      ).toBe("true");
      expect(screen.getByRole("button", { name: `New ${noun}` })).toBeTruthy();
    }
  });

  it("saves a new item and every edit to it", () => {
    render(<App />);
    tab("Gear");
    const before = saved().gear.length;
    fireEvent.click(screen.getByRole("button", { name: "New gear" }));
    expect(saved().gear).toHaveLength(before + 1);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Tin Helm" },
    });
    expect(saved().gear.at(-1)!.name).toBe("Tin Helm");
    expect(screen.getByText("armor · 1 bonus")).toBeTruthy();
  });

  it("publishes a new character of a class to the party", () => {
    render(<App />);
    const party = readRoster(localStorage).party.length;
    fireEvent.click(screen.getByRole("button", { name: "New character" }));
    const first = saved().archetypes[0]!;
    expect(saved().characters.at(-1)!.archetypeId).toBe(first.id);
    expect(readRoster(localStorage).party.length).toBe(
      first.kind === "class" ? party + 1 : party,
    );
  });

  it("deletes an item", () => {
    render(<App />);
    tab("Skills");
    const skills = saved().skills;
    const first = skills[0]!.name;
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`^${first} `) }),
    );
    fireEvent.click(screen.getByRole("button", { name: `Delete ${first}` }));
    expect(saved().skills.map((s) => s.id)).toEqual(
      skills.slice(1).map((s) => s.id),
    );
  });

  it("warns when the device refuses to save", () => {
    const refuse = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    render(<App />);
    expect(
      screen.getByText("Could not save on this device; changes will be lost."),
    ).toBeTruthy();
    refuse.mockRestore();
  });

  it("keeps the library saved on this device", () => {
    render(<App />);
    tab("Gear");
    fireEvent.click(screen.getByRole("button", { name: "New gear" }));
    cleanup();
    render(<App />);
    tab("Gear");
    const list = screen.getByRole("list", { name: "gear list" });
    expect(within(list).getByText("New gear")).toBeTruthy();
  });
});
