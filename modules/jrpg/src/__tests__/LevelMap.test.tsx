// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { Run, Stop } from "../../shared";
import { LevelMap } from "../LevelMap";
import { renderControlled } from "./controlled";
import { at, battle, training } from "./runs";

afterEach(cleanup);

const stop = (encounter: Stop["encounter"], lane: number, next: number[]) => ({
  encounter,
  lane,
  next,
});
/** Two rows: a battle that leads to a training or a battle. */
const forked = (changes: Partial<Run> = {}) =>
  at([battle], {
    map: [
      [stop(battle, 1, [0, 1])],
      [stop(training, 0, []), stop(battle, 2, [])],
    ],
    position: 1,
    path: [0],
    ...changes,
  });
const show = (run: Run) =>
  renderControlled(run, (value, onChange) => (
    <LevelMap run={value} onChange={onChange} />
  ));
const stateOf = (label: string) =>
  screen.getByLabelText(label).getAttribute("class");

describe("LevelMap", () => {
  it("marks where the party has been and where it can go", () => {
    show(forked());
    expect(stateOf("Battle, stop 1")).toBe("stop stop-done");
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(stateOf("Go to Training, stop 2")).toBe("stop stop-open");
  });

  it("travels to the stop tapped, or chosen with the keyboard", () => {
    const run = show(forked());
    fireEvent.click(
      screen.getByRole("button", { name: "Go to Training, stop 2" }),
    );
    expect(run.current.path).toEqual([0, 0]);
    expect(stateOf("Training, stop 2")).toBe("stop stop-here");
    expect(
      screen.getByLabelText("Training, stop 2").getAttribute("aria-current"),
    ).toBe("true");
    expect(stateOf("Battle, stop 2")).toBe("stop stop-ahead");
    cleanup();
    const keyed = show(forked());
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Go to Battle, stop 2" }),
      {
        key: "Enter",
      },
    );
    expect(keyed.current.path).toEqual([0, 1]);
  });

  it("ignores other keys", () => {
    const run = show(forked());
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Go to Battle, stop 2" }),
      {
        key: "a",
      },
    );
    expect(run.current.path).toEqual([0]);
  });

  it("draws the road walked", () => {
    show(forked({ position: 2, path: [0, 1] }));
    const walked = document.querySelectorAll("line.road.walked");
    expect(walked).toHaveLength(1);
    expect(document.querySelectorAll("line.road")).toHaveLength(2);
    expect(stateOf("Training, stop 2")).toBe("stop stop-missed");
  });

  it("marks the stop the party fell at", () => {
    show(forked({ path: [0, 1], defeated: true }));
    expect(stateOf("Battle, stop 2")).toBe("stop stop-lost");
  });
});
