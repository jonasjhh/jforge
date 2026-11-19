// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { battleFor } from "../../shared";
import { Formation } from "../Formation";
import { renderControlled } from "./controlled";
import { at, battle } from "./runs";

afterEach(cleanup);

const arrange = () => {
  const run = at([battle]);
  const setup = battleFor(run)!;
  return {
    setup,
    run: renderControlled(run, (value, onChange) => (
      <Formation run={value} setup={setup} onChange={onChange} />
    )),
  };
};
const cell = (name: string | RegExp) => screen.getByRole("gridcell", { name });

describe("Formation", () => {
  it("shows the enemies where they will stand", () => {
    const { setup } = arrange();
    const enemies = setup.placements.filter((p) => p.side === "enemy");
    const shown = screen
      .getByRole("grid", { name: "Enemies ahead" })
      .querySelectorAll(".field-cell.held");
    expect(shown).toHaveLength(enemies.length);
    expect(
      screen.getAllByRole("gridcell", { name: /, (front|middle|back) row$/ }),
    ).toHaveLength(enemies.length);
  });

  it("places each member in their class's row", () => {
    arrange();
    expect(cell(/^Aldric, front row/)).toBeTruthy();
    expect(cell(/^Mira, back row/)).toBeTruthy();
  });

  it("moves a member: tap them, then a cell", () => {
    const { run } = arrange();
    const empty = cell("middle row, column 1") as HTMLButtonElement;
    expect(empty.disabled).toBe(true);
    fireEvent.click(cell(/^Aldric/));
    expect(cell(/^Aldric/).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Now tap where they should stand.")).toBeTruthy();
    expect(empty.disabled).toBe(false);
    fireEvent.click(empty);
    expect(run.current.formation?.[run.current.party[0]!.id]).toEqual({
      col: 0,
      row: 1,
    });
    expect(cell("Aldric, middle row, column 1")).toBeTruthy();
    expect(screen.getByText(/^Tap one of yours/)).toBeTruthy();
  });

  it("swaps two members when one is moved onto the other", () => {
    const { run } = arrange();
    const [aldric, mira] = run.current.party;
    fireEvent.click(cell(/^Aldric/));
    fireEvent.click(cell(/^Mira/));
    expect(run.current.formation?.[aldric!.id]?.row).toBe(2);
    expect(run.current.formation?.[mira!.id]?.row).toBe(0);
  });
});
