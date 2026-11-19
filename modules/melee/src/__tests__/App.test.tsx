// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { writeRoster } from "../../shared";
import { def } from "../../shared/__tests__/helpers";
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
const party = () => screen.getByText("Your party:").parentElement!.textContent;

describe("melee App", () => {
  it("starts a battle and comes back with the same encounter", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("radio", { name: "Hard" }));
    const encounter = screen.getByText(/^Encounter #/).textContent;
    fireEvent.click(button("Start"));
    expect(screen.getByRole("grid", { name: "Enemies" })).toBeTruthy();
    fireEvent.click(button("← Melee"));
    expect(screen.getByText(/^Encounter #/).textContent).toBe(encounter);
    expect(
      screen.getByRole("radio", { name: "Hard" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("rerolls the encounter", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.1);
    render(<App />);
    expect(screen.getByText("Encounter #100000")).toBeTruthy();
    random.mockReturnValue(0.2);
    fireEvent.click(button("Reroll"));
    expect(screen.getByText("Encounter #200000")).toBeTruthy();
    random.mockRestore();
  });

  it("draws from the roster char published when asked to", () => {
    writeRoster(localStorage, {
      party: [{ ...def("custom-hero"), name: "Gwen" }],
      monsters: [{ ...def("custom-foe"), name: "Grub" }],
    });
    render(<App />);
    expect(party()).not.toContain("Gwen");
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    expect(party()).toContain("Gwen");
  });

  it("plays a fresh battle once one is over", () => {
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
