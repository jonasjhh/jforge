// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RUN_STORAGE_KEY, parseRun, type Run } from "../../shared";
import { App } from "../App";
import { runWith, unit } from "./runs";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const saved = () => parseRun(localStorage.getItem(RUN_STORAGE_KEY));
const save = (run: Run) =>
  localStorage.setItem(RUN_STORAGE_KEY, JSON.stringify(run));
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const fielded = () =>
  runWith([], {
    board: [{ unit: unit("a", 3), position: { col: 3, row: 0 } }],
  });

describe("autob App", () => {
  it("given the start screen, when a run is started, then round 1 shows and the run is saved", () => {
    render(<App />);

    fireEvent.click(button("Start a run"));

    expect(screen.getByRole("heading", { name: "Round 1 of 30" })).toBeTruthy();
    expect(saved()?.round).toBe(1);
  });

  it("given a fielded board, when the fight is won, then round 2 shows and is saved", () => {
    save(fielded());
    render(<App />);
    fireEvent.click(button("Fight"));
    fireEvent.click(button("Skip to the end"));

    fireEvent.click(button("Continue"));

    expect(screen.getByRole("heading", { name: "Round 2 of 30" })).toBeTruthy();
    expect(saved()?.last).toEqual({ round: 1, won: true });
  });

  it("given the last life, when the round is lost, then the run is over", () => {
    save(
      runWith([], {
        lives: 1,
        round: 30,
        board: [
          { unit: unit("a", 1, "melee-archer"), position: { col: 3, row: 3 } },
        ],
        seed: 2,
      }),
    );
    render(<App />);
    fireEvent.click(button("Fight"));
    fireEvent.click(button("Skip to the end"));

    fireEvent.click(button("Continue"));

    expect(screen.getByRole("heading", { name: "Run lost" })).toBeTruthy();
  });

  it("given a finished run, when a new run is asked for, then the start screen shows and the save is gone", () => {
    save(runWith([], { outcome: "won" }));
    render(<App />);

    fireEvent.click(button("New run"));

    expect(button("Start a run")).toBeTruthy();
    expect(localStorage.getItem(RUN_STORAGE_KEY)).toBeNull();
  });

  it("given a run, when abandoning is confirmed, then the start screen shows", () => {
    save(runWith());
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    render(<App />);

    fireEvent.click(button("Abandon"));

    expect(button("Start a run")).toBeTruthy();
  });

  it("given a run, when abandoning is not confirmed, then the run stays", () => {
    save(runWith());
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );
    render(<App />);

    fireEvent.click(button("Abandon"));

    expect(saved()).not.toBeNull();
  });
});
