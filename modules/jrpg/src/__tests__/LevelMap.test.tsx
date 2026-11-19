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
  it("given the party at a fork, when the map shows, then the stop passed is done and the two ahead are open", () => {
    show(forked());

    expect(stateOf("Battle, stop 1")).toBe("stop stop-done");
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(stateOf("Go to Training, stop 2")).toBe("stop stop-open");
  });

  it("given the party at a fork, when a stop is tapped, then the party is there and the other is ahead", () => {
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
  });

  it.each([
    ["Enter", [0, 1]],
    ["a", [0]],
  ])(
    "given the party at a fork, when %s is pressed on a stop, then the path is %j",
    (key, path) => {
      const run = show(forked());

      fireEvent.keyDown(
        screen.getByRole("button", { name: "Go to Battle, stop 2" }),
        { key },
      );

      expect(run.current.path).toEqual(path);
    },
  );

  it("given the party past a fork, when the map shows, then the road walked is drawn and the stop not taken is missed", () => {
    show(forked({ position: 2, path: [0, 1] }));

    expect(document.querySelectorAll("line.road.walked")).toHaveLength(1);
    expect(document.querySelectorAll("line.road")).toHaveLength(2);
    expect(stateOf("Training, stop 2")).toBe("stop stop-missed");
  });

  it("given a party that fell at a stop, when the map shows, then that stop is marked lost", () => {
    show(forked({ path: [0, 1], defeated: true }));

    expect(stateOf("Battle, stop 2")).toBe("stop stop-lost");
  });
});
