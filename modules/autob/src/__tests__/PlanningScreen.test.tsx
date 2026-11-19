// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  REROLL_COST,
  XP_COST,
  MAX_LEVEL,
  ownedUnits,
  type Run,
} from "../../shared";
import { PlanningScreen } from "../PlanningScreen";
import { renderControlled } from "./controlled";
import { runWith, unit } from "./runs";

afterEach(cleanup);

const plan = (
  run: Run,
  handlers: Partial<{ onFight: () => void; onAbandon: () => void }> = {},
) =>
  renderControlled(run, (value, onChange) => (
    <PlanningScreen
      run={value}
      onChange={onChange}
      onFight={handlers.onFight ?? (() => {})}
      onAbandon={handlers.onAbandon ?? (() => {})}
    />
  ));

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const board = () => screen.getByRole("grid", { name: "Board" });
const hex = (name: string) =>
  within(board()).getByLabelText(name, { exact: false });
const empty = (name: string) =>
  within(board()).getByLabelText(name, { exact: true });

describe("PlanningScreen", () => {
  it("given a new run, when it shows, then the round, lives, gold and level are told", () => {
    plan(runWith());

    const status = screen.getByLabelText("Status");

    expect(screen.getByRole("heading", { name: "Round 1 of 30" })).toBeTruthy();
    expect(status.textContent).toContain("Lives 3");
    expect(status.textContent).toContain("Gold 30 (+3 interest)");
    expect(status.textContent).toContain("Level 1 · XP 0/2");
  });

  it("given the round's pack, when the board shows, then its monsters stand on the enemy side", () => {
    plan(runWith());

    const foes = board().querySelectorAll(".foe");

    expect(foes.length).toBeGreaterThan(0);
  });

  it("given a shop offer, when it is bought, then the unit sits on the bench", () => {
    const latest = plan(runWith());

    fireEvent.click(screen.getAllByRole("button", { name: /Knight/ })[0]!);

    expect(ownedUnits(latest.current)).toHaveLength(1);
    expect(button("Knight, bench 1")).toBeTruthy();
  });

  it("given a bench unit, when it is tapped and then a hex, then it stands there", () => {
    const latest = plan(runWith([unit("a")]));

    fireEvent.click(button("Knight, bench 1"));
    fireEvent.click(empty("front row, column 4"));

    expect(latest.current.board).toEqual([
      { unit: unit("a"), position: { col: 3, row: 0 } },
    ]);
  });

  it("given a unit on the board, when it is tapped and then a bench slot, then it goes back to the bench", () => {
    const latest = plan(
      runWith([], {
        board: [{ unit: unit("a"), position: { col: 0, row: 0 } }],
      }),
    );

    fireEvent.click(hex("Knight, front row, column 1"));
    fireEvent.click(button("Bench 5"));

    expect(latest.current.bench[4]).toEqual(unit("a"));
  });

  it("given two units on the board, when one is tapped and then the other, then they swap", () => {
    const latest = plan(
      runWith([], {
        level: 2,
        board: [
          { unit: unit("a"), position: { col: 0, row: 0 } },
          { unit: unit("b", 1, "melee-archer"), position: { col: 1, row: 0 } },
        ],
      }),
    );

    fireEvent.click(hex("Knight, front row, column 1"));
    fireEvent.click(hex("Archer, front row, column 2"));

    expect(
      latest.current.board.find((b) => b.unit.uid === "a")?.position,
    ).toEqual({ col: 1, row: 0 });
  });

  it("given a held unit, when it is tapped again, then it is let go", () => {
    plan(runWith([unit("a")]));

    fireEvent.click(button("Knight, bench 1"));
    fireEvent.click(button("Knight, bench 1"));

    expect(button("Knight, bench 1").getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("given a held unit, when it is sold, then the gold comes back and the unit is gone", () => {
    const latest = plan(runWith([unit("a", 2)]));

    fireEvent.click(button("Knight ★★, bench 1"));
    fireEvent.click(button(/Sell for/));

    expect(ownedUnits(latest.current)).toEqual([]);
    expect(latest.current.gold).toBeGreaterThan(30);
  });

  it("given gold, when the shop is rerolled, then it costs REROLL_COST", () => {
    const latest = plan(runWith());

    fireEvent.click(button(`Reroll (${REROLL_COST})`));

    expect(latest.current.gold).toBe(30 - REROLL_COST);
  });

  it("given gold, when experience is bought, then it costs XP_COST", () => {
    const latest = plan(runWith());

    fireEvent.click(button(`Buy XP (${XP_COST})`));

    expect(latest.current.gold).toBe(30 - XP_COST);
  });

  it("given the top level, when the screen shows, then experience can't be bought and none is shown", () => {
    plan(runWith([], { level: MAX_LEVEL }));

    expect(button(`Buy XP (${XP_COST})`).hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Status").textContent).not.toContain("XP");
  });

  it("given a sold-out slot, when the shop shows, then it says so", () => {
    plan(runWith([], { shop: [null] }));

    expect(screen.getByText("Sold")).toBeTruthy();
  });

  it("given an empty board, when the screen shows, then Fight is off", () => {
    plan(runWith());

    expect(button("Fight").hasAttribute("disabled")).toBe(true);
  });

  it("given a unit on the board, when Fight is pressed, then the fight is asked for", () => {
    const onFight = vi.fn();
    plan(
      runWith([], {
        board: [{ unit: unit("a"), position: { col: 0, row: 0 } }],
      }),
      { onFight },
    );

    fireEvent.click(button("Fight"));

    expect(onFight).toHaveBeenCalledOnce();
  });

  it("given a lost round before, when the screen shows, then it tells of it", () => {
    plan(runWith([], { round: 2, last: { round: 1, won: false } }));

    expect(screen.getByRole("status").textContent).toBe("Round 1 lost.");
  });

  it("given a stage's last round, when the screen shows, then it warns of a stronger pack", () => {
    plan(runWith([], { round: 5, last: { round: 4, won: true } }));

    expect(screen.getByLabelText("Status").textContent).toContain(
      "a stronger pack",
    );
    expect(screen.getByRole("status").textContent).toBe("Round 4 won.");
  });

  it("given the screen, when Abandon is pressed, then abandoning is asked for", () => {
    const onAbandon = vi.fn();
    plan(runWith(), { onAbandon });

    fireEvent.click(button("Abandon"));

    expect(onAbandon).toHaveBeenCalledOnce();
  });

  it("given a refused move, when a bench unit is placed on a full board, then nothing changes and it is let go", () => {
    const run = runWith([unit("b")], {
      board: [{ unit: unit("a"), position: { col: 0, row: 0 } }],
    });
    const latest = plan(run);

    fireEvent.click(button("Knight, bench 1"));
    fireEvent.click(empty("front row, column 3"));

    expect(latest.current).toBe(run);
    expect(button("Knight, bench 1").getAttribute("aria-pressed")).toBe(
      "false",
    );
  });
});

describe("PlanningScreen without a held unit", () => {
  it("given nothing held, when the screen shows, then empty hexes and slots can't be tapped", () => {
    render(
      <PlanningScreen
        run={runWith()}
        onChange={() => {}}
        onFight={() => {}}
        onAbandon={() => {}}
      />,
    );

    expect(
      within(board())
        .queryAllByRole("gridcell")
        .every((c) => c.tagName !== "BUTTON"),
    ).toBe(true);
    expect(button("Bench 1").hasAttribute("disabled")).toBe(true);
  });
});
