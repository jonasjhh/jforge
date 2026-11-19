// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  TICKS_PER_SECOND,
  createFight,
  roundFight,
  unitDef,
  type Fight,
} from "../../shared";
import { FightView } from "../FightView";
import { library, runWith, unit } from "./runs";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const fightOf = (classId = "melee-knight") =>
  roundFight(
    runWith([], {
      board: [{ unit: unit("a", 3, classId), position: { col: 3, row: 0 } }],
    }),
  )!;

const button = (name: string) => screen.getByRole("button", { name });

describe("FightView", () => {
  it("given a fight, when it shows, then both sides stand in the arena", () => {
    render(<FightView round={1} fight={fightOf()} onDone={() => {}} />);

    const units = screen
      .getByRole("grid", { name: "Fight" })
      .querySelectorAll(".held");

    expect(units.length).toBe(fightOf().fighters.length);
    expect(screen.getByLabelText(/^Knight ★★★, \d+ of \d+ HP/)).toBeTruthy();
  });

  it("given a fight, when a second passes, then the clock has moved on", () => {
    render(<FightView round={1} fight={fightOf()} onDone={() => {}} />);

    for (let i = 0; i < TICKS_PER_SECOND; i++) {
      act(() => vi.advanceTimersByTime(1000 / TICKS_PER_SECOND));
    }

    expect(screen.getByText("1.0 s")).toBeTruthy();
  });

  it("given a fight, when it is skipped, then its end shows and continuing tells whether it was won", () => {
    const onDone = vi.fn();
    render(<FightView round={1} fight={fightOf()} onDone={onDone} />);

    fireEvent.click(button("Skip to the end"));
    fireEvent.click(button("Continue"));

    expect(screen.getByText("Victory")).toBeTruthy();
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it("given a fight lost, when it ends, then defeat shows and continuing tells of the loss", () => {
    const onDone = vi.fn();
    const knight = unitDef(library, unit("a"))!;
    const fight: Fight = createFight(
      [
        { def: knight, side: "player", hex: { col: 3, row: 4 } },
        {
          def: { ...knight, id: "e", stats: { ...knight.stats, attack: 999 } },
          side: "enemy",
          hex: { col: 3, row: 3 },
        },
      ],
      1,
    );
    render(<FightView round={1} fight={fight} onDone={onDone} />);

    fireEvent.click(button("Skip to the end"));
    fireEvent.click(button("Continue"));

    expect(screen.getByText("Defeat")).toBeTruthy();
    expect(onDone).toHaveBeenCalledWith(false);
  });

  it("given a unit with skills, when it shows, then it has a mana bar", () => {
    render(
      <FightView round={1} fight={fightOf("melee-mage")} onDone={() => {}} />,
    );

    const bars = document.querySelectorAll(".bar.mana");

    expect(bars.length).toBeGreaterThan(0);
  });
});
