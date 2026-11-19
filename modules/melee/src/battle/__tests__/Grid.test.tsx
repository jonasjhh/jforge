// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { createBattle, type Cell, type Unit } from "../../../shared";
import { def, place } from "../../../shared/__tests__/helpers";
import { Grid } from "../Grid";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const state = createBattle(
  {
    placements: [
      place(def("hero", { maxMp: 10 }), "player", 0),
      { ...place(def("mage", { maxMp: 10 }), "player", 1, 2) },
      place(def("slime"), "enemy", 2),
      place(def("wolf"), "enemy", 4, 1),
    ],
  },
  1,
);
const isUnit = (name: string) => (u: Unit) => u.name === name;
type Props = ComponentProps<typeof Grid>;
const props = (changes: Partial<Props> = {}): Props => ({
  side: "enemy",
  state,
  hits: [],
  activeId: null,
  actorId: null,
  canTarget: () => false,
  onTarget: () => {},
  actionName: "Attack",
  area: [],
  aim: null,
  incoming: [],
  emphasize: () => false,
  onInspect: () => {},
  preview: () => null,
  covered: () => false,
  coveredCell: () => false,
  ...changes,
});
const cellOf = (name: string) =>
  screen.getByText(name, { selector: ".unit-name" }).closest(".cell")!;

describe("Grid", () => {
  it("lays out a side's rows, back row first for enemies", () => {
    render(<Grid {...props()} />);
    const rows = within(
      screen.getByRole("grid", { name: "Enemies" }),
    ).getAllByRole("row");
    expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual([
      "Back row",
      "Middle row",
      "Front row",
    ]);
    cleanup();
    render(<Grid {...props({ side: "player" })} />);
    const party = within(
      screen.getByRole("grid", { name: "Party" }),
    ).getAllByRole("row");
    expect(party[0]!.getAttribute("aria-label")).toBe("Front row");
  });

  it("makes targets buttons that report their cell", () => {
    const onTarget = vi.fn();
    render(
      <Grid
        {...props({
          canTarget: (c: Cell) => c.col === 2 && c.row === 0,
          onTarget,
          activeId: "player-0-0",
        })}
      />,
    );
    fireEvent.click(screen.getByRole("gridcell", { name: "Attack slime" }));
    expect(onTarget).toHaveBeenCalledWith({ side: "enemy", col: 2, row: 0 });
    // The wolf can't be reached by the active unit.
    expect(cellOf("wolf").tagName).toBe("DIV");
    expect(cellOf("wolf").className).toContain("unreachable");
  });

  it("names empty cells that can be stepped to, and those in cover", () => {
    const onTarget = vi.fn();
    render(
      <Grid
        {...props({
          side: "player",
          canTarget: (c: Cell) => c.row === 1,
          coveredCell: (c: Cell) => c.col === 3,
          actionName: "Move",
          onTarget,
        })}
      />,
    );
    fireEvent.click(
      screen.getByRole("gridcell", { name: "Move Party column 1, middle row" }),
    );
    expect(onTarget).toHaveBeenCalledWith({ side: "player", col: 0, row: 1 });
    expect(
      screen.getByRole("gridcell", {
        name: "Move Party column 4, middle row, covered",
      }),
    ).toBeTruthy();
  });

  it("shows expected damage in a target's name", () => {
    const slime = state.units.find(isUnit("slime"))!;
    render(
      <Grid
        {...props({
          canTarget: () => true,
          preview: (u: Unit) =>
            u.id === slime.id
              ? { amount: 18, multiplier: 2, knocksOut: true }
              : null,
        })}
      />,
    );
    expect(
      screen.getByRole("gridcell", {
        name: "Attack slime, about 18 damage, weak, knocks out",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("gridcell", { name: "Attack wolf" })).toBeTruthy();
  });

  it("marks the area, the aim, incoming hits and friendly fire", () => {
    const hero: Cell = { side: "player", col: 0, row: 0 };
    render(
      <Grid
        {...props({
          side: "player",
          area: [hero, { side: "player", col: 1, row: 0 }],
          aim: hero,
          incoming: [{ side: "player", col: 1, row: 2 }],
          emphasize: isUnit("mage"),
        })}
      />,
    );
    const heroCell = cellOf("hero").className;
    expect(heroCell).toContain("in-area");
    expect(heroCell).toContain("aimed");
    expect(heroCell).toContain("danger");
    expect(cellOf("mage").className).toContain("incoming");
    expect(cellOf("mage").className).toContain("emphasized");
  });

  it("shows bars, badges, cover and floating numbers", () => {
    const wolf = state.units.find(isUnit("wolf"))!;
    const hurt: Unit = {
      ...wolf,
      hp: 20,
      summonedBy: "enemy-2-0",
      statuses: [
        {
          id: "s",
          name: "Barrier",
          effect: "shield",
          harmful: false,
          amount: 7,
          interval: 60,
          nextTickAt: 60,
          ticksLeft: 1,
          sourceId: wolf.id,
        },
      ],
      modifiers: [
        {
          stat: "speed",
          op: "mul",
          value: 0.5,
          source: "Slow",
          expiresAt: 99,
          harmful: true,
        },
      ],
    };
    render(
      <Grid
        {...props({
          state: {
            ...state,
            units: state.units.map((u) => (u.id === wolf.id ? hurt : u)),
          },
          covered: isUnit("wolf"),
          hits: [{ key: 1, unitId: wolf.id, kind: "damage", amount: 12 }],
        })}
      />,
    );
    const cell = cellOf("wolf");
    expect(
      within(cell as HTMLElement).getByLabelText("HP 20 of 100"),
    ).toBeTruthy();
    expect(cell.querySelector(".hp .low")).toBeTruthy();
    expect(
      [...cell.querySelectorAll(".status")].map((s) => s.textContent),
    ).toEqual(["Summon", "Barrier 7", "Slow"]);
    expect(cell.querySelector(".status-debuff")).toBeTruthy();
    expect(screen.getByRole("img", { name: "wolf is covered" })).toBeTruthy();
    expect(cell.className).toContain("hit");
    expect(cell.querySelector(".damage")!.textContent).toBe("12");
  });

  it("opens a unit's details on a long press, without also targeting it", () => {
    vi.useFakeTimers();
    const onInspect = vi.fn();
    const onTarget = vi.fn();
    render(<Grid {...props({ canTarget: () => true, onInspect, onTarget })} />);
    const slime = screen.getByRole("gridcell", { name: "Attack slime" });
    fireEvent.pointerDown(slime);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(slime);
    fireEvent.click(slime);
    expect(onInspect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "slime" }),
    );
    expect(onTarget).not.toHaveBeenCalled();
    fireEvent.click(slime);
    expect(onTarget).toHaveBeenCalledOnce();
  });

  it("opens details on right-click", () => {
    const onInspect = vi.fn();
    render(<Grid {...props({ onInspect })} />);
    fireEvent.contextMenu(cellOf("wolf"));
    expect(onInspect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "wolf" }),
    );
  });
});
