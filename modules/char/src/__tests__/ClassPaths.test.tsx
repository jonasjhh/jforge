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
import { renderControlled } from "./controlled";

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
  renderControlled(get(id), (value, onChange) => (
    <ClassPaths archetype={value} library={library()} onChange={onChange} />
  ));

describe("ClassPaths", () => {
  it("given battle mage from fighter, when it shows, then fighter is its source and mage can be added", () => {
    edit("battle-mage");

    const from = screen.getByRole("list", { name: "Comes from" });

    expect(from.textContent).toContain("Fighter");
    expect(
      Array.from(
        (
          screen.getByLabelText(
            "Add a class it comes from",
          ) as HTMLSelectElement
        ).options,
        (o) => o.textContent,
      ),
    ).toEqual(["Pick a class", "Mage"]);
  });

  it("given battle mage from fighter, when mage is added, then it comes from both", () => {
    const type = edit("battle-mage");

    fireEvent.change(screen.getByLabelText("Add a class it comes from"), {
      target: { value: "mage" },
    });

    expect(type.current.comesFrom).toEqual(["fighter", "mage"]);
  });

  it("given battle mage from fighter, when fighter is removed, then it is a base class", () => {
    const type = edit("battle-mage");

    fireEvent.click(
      screen.getByRole("button", { name: "No longer from Fighter" }),
    );

    expect("comesFrom" in type.current).toBe(false);
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
        onChange={vi.fn()}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Battle Mage" }));

    expect(onOpen).toHaveBeenCalledWith("battle-mage");
  });
});
