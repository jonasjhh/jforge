// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RUN_STORAGE_KEY, parseRun, startRun, type Run } from "../../shared";
import { App } from "../App";
import { library } from "./runs";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const saved = () => parseRun(localStorage.getItem(RUN_STORAGE_KEY));
const save = (run: Run) =>
  localStorage.setItem(RUN_STORAGE_KEY, JSON.stringify(run));
const button = (name: string | RegExp) => screen.getByRole("button", { name });

describe("jrpg App", () => {
  it("starts a run from the start screen and saves it", () => {
    render(<App />);
    fireEvent.click(button("Set out"));
    expect(screen.getByRole("heading", { name: "Level 1" })).toBeTruthy();
    expect(saved()?.depth).toBe(1);
  });

  it("goes into the battle at hand and can retreat before acting", () => {
    save(startRun(library, 3));
    render(<App />);
    fireEvent.click(button("Fight"));
    fireEvent.click(button("← Retreat"));
    expect(screen.getByRole("heading", { name: "Level 1" })).toBeTruthy();
    expect(saved()?.defeated).toBe(false);
  });

  it("reopens a battle the party acted in, where giving up ends the run", () => {
    save({ ...startRun(library, 3), committed: true });
    // happy-dom has no dialogs.
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    render(<App />);
    fireEvent.click(button("Give up"));
    expect(confirm).toHaveBeenCalledOnce();
    expect(button("Give up")).toBeTruthy();
    confirm.mockReturnValue(true);
    fireEvent.click(button("Give up"));
    expect(screen.getByText("The party has fallen")).toBeTruthy();
    expect(saved()?.defeated).toBe(true);
  });

  it("abandons the run, back to the start screen", () => {
    save(startRun(library, 3));
    render(<App />);
    fireEvent.click(button("Abandon run"));
    expect(button("Set out")).toBeTruthy();
    expect(localStorage.getItem(RUN_STORAGE_KEY)).toBeNull();
  });
});
