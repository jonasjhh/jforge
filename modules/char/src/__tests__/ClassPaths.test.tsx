// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  blankArchetype,
  emptyLibrary,
  type Archetype,
  type Library,
} from "../../shared";
import { ClassPaths } from "../ClassPaths";

afterEach(cleanup);

const named = (id: string, name: string, comesFrom?: string[]): Archetype => ({
  ...blankArchetype(id, "class"),
  name,
  ...(comesFrom ? { comesFrom } : {}),
});
const library = (): Library => ({
  ...emptyLibrary(),
  archetypes: [
    named("fighter", "Fighter"),
    named("mage", "Mage"),
    named("battle-mage", "Battle Mage", ["fighter"]),
  ],
});
const get = (id: string) => library().archetypes.find((a) => a.id === id)!;
const edit = (id: string) =>
  render(<ClassPaths archetype={get(id)} library={library()} />);

describe("ClassPaths", () => {
  it("given battle mage from fighter, when it shows, then fighter is its source and nothing can be edited", () => {
    edit("battle-mage");

    const from = screen.getByRole("list", { name: "Comes from" });

    expect(from.textContent).toBe("Fighter");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: /No longer from/ })).toBeNull();
  });

  it("given fighter, when it shows, then it is a base class that becomes battle mage", () => {
    edit("fighter");

    const becomes = screen.getByRole("list", { name: "Becomes" });

    expect(screen.getByText("Nothing: it is a base class.")).toBeTruthy();
    expect(becomes.textContent).toBe("Battle Mage");
  });

  it("given mage, when it shows, then it becomes nothing yet", () => {
    edit("mage");

    const note = screen.getByText("Nothing yet.");

    expect(note).toBeTruthy();
  });

  it("given a way to open classes, when a class it becomes is pressed, then that class is opened", () => {
    const onOpen = vi.fn();
    render(
      <ClassPaths
        archetype={get("fighter")}
        library={library()}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Battle Mage" }));

    expect(onOpen).toHaveBeenCalledWith("battle-mage");
  });
});
