// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RunOverScreen } from "../RunOverScreen";
import { runWith } from "./runs";

afterEach(cleanup);

describe("RunOverScreen", () => {
  it("given a run lost in round 8, when it shows, then it tells of 7 rounds lived through", () => {
    render(
      <RunOverScreen
        run={runWith([], { round: 8, outcome: "lost" })}
        onNew={() => {}}
      />,
    );

    const result = screen.getByRole("region", { name: "Result" });

    expect(screen.getByRole("heading", { name: "Run lost" })).toBeTruthy();
    expect(result.textContent).toContain("Rounds lived through: 7 of 30");
  });

  it("given a won run, when a new run is asked for, then it is", () => {
    const onNew = vi.fn();
    render(
      <RunOverScreen
        run={runWith([], { round: 30, outcome: "won" })}
        onNew={onNew}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New run" }));

    expect(screen.getByRole("heading", { name: "Run won" })).toBeTruthy();
    expect(onNew).toHaveBeenCalledOnce();
  });
});
