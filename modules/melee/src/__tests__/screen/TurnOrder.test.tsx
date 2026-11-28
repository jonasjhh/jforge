// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { advance, createBattle, turnOrder } from "@jforge/battle";
import { sampleBattle } from "../../../shared/__tests__/helpers";
import { TurnOrder } from "@jforge/battle/screen/TurnOrder.tsx";

afterEach(cleanup);

const names = () =>
  screen.getAllByRole("listitem").map((li) => [li.textContent, li.className]);

describe("TurnOrder", () => {
  it("given a fresh battle, when the turn order shows, then it lists the next five turns in each side's colour", () => {
    const state = createBattle(sampleBattle, 1);
    const expected = turnOrder(state, 5).map((id) => {
      const unit = state.units.find((u) => u.id === id)!;
      return [unit.name, `turn turn-${unit.side}`];
    });

    render(<TurnOrder state={state} />);

    expect(names()).toEqual(expected);
  });

  it("given a unit waiting for a command, when the turn order shows, then it marks that unit's turn as now", () => {
    const { state } = advance(createBattle(sampleBattle, 1));

    render(<TurnOrder state={state} />);

    expect(state.phase.kind).toBe("awaitingCommand");
    expect(screen.getAllByRole("listitem")[0]!.className).toContain("turn-now");
  });

  it("given the battle is over, when the turn order shows, then it is empty", () => {
    const state = createBattle(sampleBattle, 1);
    const over = {
      ...state,
      phase: { kind: "over", winner: "player" } as const,
    };

    const { container } = render(<TurnOrder state={over} />);

    expect(container.innerHTML).toBe("");
  });
});
