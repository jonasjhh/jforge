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
  it("given a battle ahead, when the formation shows, then each enemy is in the cell where it will stand", () => {
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

  it("given a knight and a sage, when the formation shows, then each stands in their class's row", () => {
    arrange();

    expect(cell(/^Aldric, front row/)).toBeTruthy();
    expect(cell(/^Mira, back row/)).toBeTruthy();
  });

  it("given no member picked, when the formation shows, then empty cells can't be tapped", () => {
    arrange();

    const empty = cell("middle row, column 1") as HTMLButtonElement;

    expect(empty.disabled).toBe(true);
  });

  it("given the formation, when a member is tapped, then they are picked and empty cells open", () => {
    arrange();

    fireEvent.click(cell(/^Aldric/));

    expect(cell(/^Aldric/).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Now tap where they should stand.")).toBeTruthy();
    expect((cell("middle row, column 1") as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("given a member picked, when an empty cell is tapped, then they move there", () => {
    const { run } = arrange();
    fireEvent.click(cell(/^Aldric/));

    fireEvent.click(cell("middle row, column 1"));

    expect(run.current.formation?.[run.current.party[0]!.id]).toEqual({
      col: 0,
      row: 1,
    });
    expect(cell("Aldric, middle row, column 1")).toBeTruthy();
    expect(screen.getByText(/^Tap one of yours/)).toBeTruthy();
  });

  it("given a member picked, when another member is tapped, then the two swap", () => {
    const { run } = arrange();
    const [aldric, mira] = run.current.party;
    fireEvent.click(cell(/^Aldric/));

    fireEvent.click(cell(/^Mira/));

    expect(run.current.formation?.[aldric!.id]?.row).toBe(2);
    expect(run.current.formation?.[mira!.id]?.row).toBe(0);
  });
});
