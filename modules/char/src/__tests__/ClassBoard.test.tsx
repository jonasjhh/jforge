// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import {
  blankArchetype,
  emptyLibrary,
  type Archetype,
  type Library,
} from "../../shared";
import { ClassBoard } from "../ClassBoard";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const named = (id: string, name: string, comesFrom?: string[]): Archetype => ({
  ...blankArchetype(id, "class"),
  name,
  ...(comesFrom ? { comesFrom } : {}),
});

/** Fighter leads to Paladin; Mage is in the tray. */
function show(onOpenClass = vi.fn()) {
  const current: { library: Library } = {
    library: {
      ...emptyLibrary(),
      archetypes: [
        named("fighter", "Fighter"),
        named("paladin", "Paladin", ["fighter"]),
        named("mage", "Mage"),
      ],
    },
  };
  function Harness() {
    const [library, setLibrary] = useState(current.library);
    return (
      <ClassBoard
        library={library}
        onUpdate={(change) =>
          setLibrary((old) => (current.library = change(old)))
        }
        onOpenClass={onOpenClass}
      />
    );
  }
  render(<Harness />);
  return { current, onOpenClass };
}

const tray = () =>
  screen.queryByRole("list", { name: "Classes not on the board" });
const card = (name: string) =>
  screen.getByText(name, { selector: ".class-card-name" });

describe("ClassBoard", () => {
  it("given linked fighter and paladin and a lone mage, when the board shows, then the mage waits in the tray", () => {
    show();

    const waiting = tray();

    expect(waiting?.textContent).toBe("Mage");
    expect(card("Fighter")).toBeTruthy();
    expect(card("Paladin")).toBeTruthy();
  });

  it("given the mage in the tray, when it is tapped, then it is on the board and kept on this device", () => {
    show();

    fireEvent.click(screen.getByRole("button", { name: "Place Mage" }));

    expect(tray()).toBeNull();
    expect(card("Mage")).toBeTruthy();
    expect(
      Object.keys(JSON.parse(localStorage.getItem("jforge.char.board")!)),
    ).toEqual(["mage"]);
  });

  it("given paladin picked on the board, when it is taken off, then it is back in the tray with no links", () => {
    const { current } = show();
    fireEvent.click(card("Paladin"));

    fireEvent.click(screen.getByRole("button", { name: "Take off the board" }));

    expect(tray()?.textContent).toContain("Paladin");
    expect(current.library.archetypes[1].comesFrom).toBeUndefined();
  });

  it("given paladin picked on the board, when Edit is pressed, then paladin is opened", () => {
    const { onOpenClass } = show();
    fireEvent.click(card("Paladin"));

    fireEvent.click(screen.getByRole("button", { name: "Edit Paladin" }));

    expect(onOpenClass).toHaveBeenCalledWith("paladin");
  });
});
