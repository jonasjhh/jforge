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
  it("given the start screen, when Set out is pressed, then the first level shows and the run is saved", () => {
    render(<App />);

    fireEvent.click(button("Set out"));

    expect(screen.getByRole("heading", { name: "Level 1" })).toBeTruthy();
    expect(saved()?.depth).toBe(1);
  });

  it("given a battle entered before acting, when the party retreats, then the level shows and the run goes on", () => {
    save(startRun(library, 3));
    render(<App />);
    fireEvent.click(button("Fight"));

    fireEvent.click(button("← Retreat"));

    expect(screen.getByRole("heading", { name: "Level 1" })).toBeTruthy();
    expect(saved()?.defeated).toBe(false);
  });

  it("given a battle the party acted in, when giving up is not confirmed, then the battle stays", () => {
    save({ ...startRun(library, 3), committed: true });
    // happy-dom has no dialogs.
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    render(<App />);

    fireEvent.click(button("Give up"));

    expect(confirm).toHaveBeenCalledOnce();
    expect(button("Give up")).toBeTruthy();
  });

  it("given a battle the party acted in, when giving up is confirmed, then the run ends", () => {
    save({ ...startRun(library, 3), committed: true });
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    render(<App />);

    fireEvent.click(button("Give up"));

    expect(screen.getByText("The party has fallen")).toBeTruthy();
    expect(saved()?.defeated).toBe(true);
  });

  it("given a run, when it is abandoned, then the start screen shows and the save is gone", () => {
    save(startRun(library, 3));
    render(<App />);

    fireEvent.click(button("Abandon run"));

    expect(button("Set out")).toBeTruthy();
    expect(localStorage.getItem(RUN_STORAGE_KEY)).toBeNull();
  });
});
