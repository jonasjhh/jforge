// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { advance, createBattle, turnOrder } from "../../../shared";
import { sampleBattle } from "../../../shared/__tests__/helpers";
import { TurnOrder } from "../TurnOrder";

afterEach(cleanup);

const names = () =>
  screen.getAllByRole("listitem").map((li) => [li.textContent, li.className]);

describe("TurnOrder", () => {
  it("shows the next five turns in each side's colour", () => {
    const state = createBattle(sampleBattle, 1);
    render(<TurnOrder state={state} />);
    const expected = turnOrder(state, 5).map((id) => {
      const unit = state.units.find((u) => u.id === id)!;
      return [unit.name, `turn turn-${unit.side}`];
    });
    expect(names()).toEqual(expected);
  });

  it("marks the unit whose turn it is now", () => {
    const { state } = advance(createBattle(sampleBattle, 1));
    expect(state.phase.kind).toBe("awaitingCommand");
    render(<TurnOrder state={state} />);
    expect(screen.getAllByRole("listitem")[0]!.className).toContain("turn-now");
  });

  it("shows nothing once the battle is over", () => {
    const state = createBattle(sampleBattle, 1);
    const { container } = render(
      <TurnOrder
        state={{ ...state, phase: { kind: "over", winner: "player" } }}
      />,
    );
    expect(container.innerHTML).toBe("");
  });
});
