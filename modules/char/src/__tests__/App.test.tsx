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
  it("given a fresh device, when the app opens, then it shows the roster and publishes the starter library", () => {
    render(<App />);

    const roster = screen.getByRole("tab", { name: "Roster" });

    expect(roster.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: "New character" })).toBeTruthy();
    expect(saved()).not.toBeNull();
    expect(localStorage.getItem(ROSTER_STORAGE_KEY)).not.toBeNull();
    expect(screen.getByText(/Published:/)).toBeTruthy();
  });

  it.each([
    ["Classes", "class"],
    ["Enemies", "enemy type"],
    ["Skills", "skill"],
    ["Gear", "gear"],
  ])(
    "given the app open, when the %s tab is picked, then that section shows",
    (name, noun) => {
      render(<App />);

      tab(name);

      expect(
        screen.getByRole("tab", { name }).getAttribute("aria-selected"),
      ).toBe("true");
      expect(screen.getByRole("button", { name: `New ${noun}` })).toBeTruthy();
    },
  );

  it("given the gear section, when new gear is made, then it is saved", () => {
    render(<App />);
    tab("Gear");
    const before = saved().gear.length;

    fireEvent.click(screen.getByRole("button", { name: "New gear" }));

    expect(saved().gear).toHaveLength(before + 1);
  });

  it("given new gear, when it is renamed, then the edit is saved and the list notes it", () => {
    render(<App />);
    tab("Gear");
    fireEvent.click(screen.getByRole("button", { name: "New gear" }));

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Tin Helm" },
    });

    expect(saved().gear.at(-1)!.name).toBe("Tin Helm");
    expect(screen.getByText("armor · 1 bonus")).toBeTruthy();
  });

  it("given the roster, when a new character is made, then it is of the first type and joins the party if a class", () => {
    render(<App />);
    const party = readRoster(localStorage).party.length;

    fireEvent.click(screen.getByRole("button", { name: "New character" }));

    const first = saved().archetypes[0]!;
    expect(saved().characters.at(-1)!.archetypeId).toBe(first.id);
    expect(readRoster(localStorage).party.length).toBe(
      first.kind === "class" ? party + 1 : party,
    );
  });

  it("given an open skill, when it is deleted, then the saved library drops it", () => {
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

  it("given a device that refuses to save, when the app opens, then it warns that changes will be lost", () => {
    const refuse = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("full");
    });

    render(<App />);

    expect(
      screen.getByText("Could not save on this device; changes will be lost."),
    ).toBeTruthy();
    refuse.mockRestore();
  });

  it("given new gear made earlier, when the app opens again, then the gear is still there", () => {
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
