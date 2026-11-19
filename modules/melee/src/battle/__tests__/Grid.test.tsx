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

const rowLabels = (name: string) =>
  within(screen.getByRole("grid", { name }))
    .getAllByRole("row")
    .map((r) => r.getAttribute("aria-label"));
/** Holds a press on the slime long enough to open its details. */
const longPress = (slime: HTMLElement) => {
  fireEvent.pointerDown(slime);
  act(() => {
    vi.advanceTimersByTime(500);
  });
  fireEvent.pointerUp(slime);
};
const pressable = () => {
  vi.useFakeTimers();
  const onInspect = vi.fn();
  const onTarget = vi.fn();
  render(<Grid {...props({ canTarget: () => true, onInspect, onTarget })} />);
  const slime = screen.getByRole("gridcell", { name: "Attack slime" });
  return { onInspect, onTarget, slime };
};

describe("Grid", () => {
  it("given the enemy side, when it is laid out, then the back row comes first", () => {
    const side = "enemy";

    render(<Grid {...props({ side })} />);

    expect(rowLabels("Enemies")).toEqual([
      "Back row",
      "Middle row",
      "Front row",
    ]);
  });

  it("given the party side, when it is laid out, then the front row comes first", () => {
    const side = "player";

    render(<Grid {...props({ side })} />);

    expect(rowLabels("Party")[0]).toBe("Front row");
  });

  it("given the slime is a target, when it is clicked, then its cell is reported", () => {
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
  });

  it("given the wolf is out of reach, when the grid shows, then it is no button and marked unreachable", () => {
    const canTarget = (c: Cell) => c.col === 2 && c.row === 0;

    render(<Grid {...props({ canTarget, activeId: "player-0-0" })} />);

    expect(cellOf("wolf").tagName).toBe("DIV");
    expect(cellOf("wolf").className).toContain("unreachable");
  });

  describe("moving", () => {
    const onTarget = vi.fn();
    const moving = () =>
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

    it("given an empty cell to step to, when it is clicked, then its cell is reported", () => {
      moving();

      fireEvent.click(
        screen.getByRole("gridcell", {
          name: "Move Party column 1, middle row",
        }),
      );

      expect(onTarget).toHaveBeenCalledWith({ side: "player", col: 0, row: 1 });
    });

    it("given a cell in cover, when the grid shows, then its name says so", () => {
      moving();

      const cell = screen.getByRole("gridcell", {
        name: "Move Party column 4, middle row, covered",
      });

      expect(cell).toBeTruthy();
    });
  });

  it("given a preview for the slime only, when the grid shows, then its name has the expected damage and the wolf's doesn't", () => {
    const slime = state.units.find(isUnit("slime"))!;
    const preview = (u: Unit) =>
      u.id === slime.id ? { amount: 18, multiplier: 2, knocksOut: true } : null;

    render(<Grid {...props({ canTarget: () => true, preview })} />);

    expect(
      screen.getByRole("gridcell", {
        name: "Attack slime, about 18 damage, weak, knocks out",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("gridcell", { name: "Attack wolf" })).toBeTruthy();
  });

  it("given an area, an aim, incoming hits and friendly fire, when the grid shows, then their cells are marked", () => {
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

  it("given a hurt, summoned, shielded, slowed, covered wolf just hit, when the grid shows, then its cell shows all of it", () => {
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

  it("given a target, when it is long-pressed and the press ends in a click, then its details open and it is not targeted", () => {
    const { onInspect, onTarget, slime } = pressable();
    longPress(slime);

    fireEvent.click(slime);

    expect(onInspect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "slime" }),
    );
    expect(onTarget).not.toHaveBeenCalled();
  });

  it("given a long press ended, when the target is clicked again, then it is targeted", () => {
    const { onTarget, slime } = pressable();
    longPress(slime);
    fireEvent.click(slime);

    fireEvent.click(slime);

    expect(onTarget).toHaveBeenCalledOnce();
  });

  it("given a unit, when it is right-clicked, then its details open", () => {
    const onInspect = vi.fn();
    render(<Grid {...props({ onInspect })} />);

    fireEvent.contextMenu(cellOf("wolf"));

    expect(onInspect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "wolf" }),
    );
  });
});
