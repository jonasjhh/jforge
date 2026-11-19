// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StartScreen } from "../StartScreen";

afterEach(cleanup);

describe("StartScreen", () => {
  it("given no library of one's own, when the screen shows, then the starter classes are on sale", () => {
    render(<StartScreen library={null} onStart={() => {}} />);

    const sells = screen.getByRole("region", { name: "The shop sells" });

    expect(sells.textContent).toContain("Knight");
  });

  it("given the start screen, when a run is started, then it starts with a seed", () => {
    const onStart = vi.fn();
    render(<StartScreen library={null} onStart={onStart} />);

    fireEvent.click(screen.getByRole("button", { name: "Start a run" }));

    expect(onStart).toHaveBeenCalledWith(expect.any(Number));
  });
});
