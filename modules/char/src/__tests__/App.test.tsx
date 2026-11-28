// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { catalogue } from "@jforge/content/catalogue";
import { jrpgLibrary } from "@jforge/content/jrpg";
import { App } from "../App";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const tab = (name: string) =>
  fireEvent.click(screen.getByRole("tab", { name }));
const game = (name: string) =>
  fireEvent.click(screen.getByRole("radio", { name }));
const listed = (noun: string) =>
  screen.getByRole("list", { name: `${noun} list` }).children.length;
const openItem = (name: string) =>
  fireEvent.click(
    screen.getAllByRole("button", { name: new RegExp(`^${name} `) })[0]!,
  );
const isOpen = (name: string) =>
  screen.getByRole("tab", { name }).getAttribute("aria-selected") === "true";

describe("char App", () => {
  it("given a fresh device, when the codex opens, then it shows every class", () => {
    const classes = catalogue().archetypes.filter((a) => a.kind === "class");

    render(<App />);

    expect(isOpen("Classes")).toBe(true);
    expect(listed("class")).toBe(classes.length);
  });

  it("given the codex open, when JRPG is picked, then only jrpg's classes are listed", () => {
    const classes = jrpgLibrary().archetypes.filter((a) => a.kind === "class");
    render(<App />);

    game("JRPG");

    expect(listed("class")).toBe(classes.length);
  });

  it.each([
    ["Enemies", "enemy type"],
    ["Summons", "summon"],
    ["Characters", "character"],
    ["Skills", "skill"],
    ["Gear", "gear"],
  ])(
    "given the codex open, when the %s tab is picked, then its list shows",
    (name, noun) => {
      render(<App />);

      tab(name);

      expect(isOpen(name)).toBe(true);
      expect(listed(noun)).toBeGreaterThan(0);
    },
  );

  it("given the codex open, when the Paths tab is picked, then the base classes show", () => {
    render(<App />);

    tab("Paths");

    expect(screen.getByRole("region", { name: "Base classes" })).toBeTruthy();
  });

  it("given anything in the codex, when it is looked at, then nothing offers to change it", () => {
    const first = catalogue().archetypes.find((a) => a.kind === "class")!;
    render(<App />);

    openItem(first.name);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /^(New|Delete) / })).toBeNull();
  });

  it("given an open class, when one of its skills is pressed, then the Skills tab opens on it", () => {
    const library = catalogue();
    const named = (name: string) =>
      library.archetypes.filter((a) => a.name === name).length;
    const archetype = library.archetypes.find(
      (a) => a.kind === "class" && a.skills.length > 0 && named(a.name) === 1,
    )!;
    const skill = library.skills.find((s) => s.id === archetype.skills[0])!;
    render(<App />);
    openItem(archetype.name);

    fireEvent.click(screen.getByRole("button", { name: `Open ${skill.name}` }));

    expect(isOpen("Skills")).toBe(true);
    expect(
      screen.getByRole("heading", { level: 2, name: skill.name }),
    ).toBeTruthy();
  });

  it("given JRPG and Skills picked earlier, when the codex opens again, then both are kept", () => {
    render(<App />);
    game("JRPG");
    tab("Skills");
    cleanup();

    render(<App />);

    expect(isOpen("Skills")).toBe(true);
    expect(
      screen.getByRole("radio", { name: "JRPG" }).getAttribute("aria-checked"),
    ).toBe("true");
  });
});
