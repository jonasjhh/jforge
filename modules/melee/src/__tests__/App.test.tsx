// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { App } from "../App";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const button = (name: string) => screen.getByRole("button", { name });

const encounterText = () => screen.getByText(/^Encounter #/).textContent;

describe("melee App", () => {
  it("given a hard encounter, when Start is pressed, then the battle shows", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("radio", { name: "Hard" }));

    fireEvent.click(button("Start"));

    expect(screen.getByRole("grid", { name: "Enemies" })).toBeTruthy();
  });

  it("given a hard battle started, when the player goes back, then the same encounter and difficulty are chosen", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("radio", { name: "Hard" }));
    const encounter = encounterText();
    fireEvent.click(button("Start"));

    fireEvent.click(button("← Melee"));

    expect(encounterText()).toBe(encounter);
    expect(
      screen.getByRole("radio", { name: "Hard" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("given encounter #100000, when Reroll is pressed, then a new one is drawn", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.1);
    render(<App />);
    random.mockReturnValue(0.2);

    fireEvent.click(button("Reroll"));

    expect(screen.getByText("Encounter #200000")).toBeTruthy();
    random.mockRestore();
  });

  it("given a battle that is over, when the next one is asked for, then a fresh battle starts", () => {
    // Seeds that differ from draw to draw, but the same on every run.
    let draw = 0;
    vi.spyOn(Math, "random").mockImplementation(
      () => (draw = (draw + 0.37) % 1),
    );
    // At 2× the battle takes half the frames.
    localStorage.setItem("melee.battleSpeed", "2");
    render(<App />);
    fireEvent.click(button("Start"));
    // Let the battle run until it's over, the party only defending. Checks
    // for the action tabs by class, which is cheaper than a role query.
    for (let i = 0; i < 2000 && !document.querySelector(".result"); i++) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
      if (document.querySelector(".mode-tabs"))
        fireEvent.click(button("Defend"));
    }
    const again = screen.getByRole("button", { name: /Next battle|Try again/ });

    fireEvent.click(again);

    expect(screen.getByRole("grid", { name: "Enemies" })).toBeTruthy();
    expect(document.querySelector(".result")).toBeNull();
    vi.restoreAllMocks();
  });
});
