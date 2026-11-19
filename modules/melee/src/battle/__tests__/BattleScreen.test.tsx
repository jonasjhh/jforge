// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { content, type BattleSetup } from "../../../shared";
import { def, place } from "../../../shared/__tests__/helpers";
import { BattleScreen } from "../BattleScreen";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// A fast hero who fells the foe in one hit; the foe barely acts.
const duel: BattleSetup = {
  placements: [
    place(def("hero", { attack: 999, speed: 50 }), "player", 2),
    place(def("foe", { maxHp: 1, speed: 1 }), "enemy", 2),
  ],
};
// A mage with skills, against a foe that takes a while to fall.
const casting: BattleSetup = {
  placements: [
    place(content.mage, "player", 2, 2),
    place(def("foe", { maxHp: 999, speed: 1 }), "enemy", 2),
  ],
};
type Props = ComponentProps<typeof BattleScreen>;
const show = (changes: Partial<Props> = {}) => {
  const props: Props = {
    setup: duel,
    seed: 7,
    onRestart: vi.fn(),
    onExit: vi.fn(),
    onCommit: vi.fn(),
    onRetry: vi.fn(),
    ...changes,
  };
  render(<BattleScreen {...props} />);
  return props;
};
const play = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
/** Plays until one of the party is asked for a command. */
const untilAsked = () => {
  for (
    let i = 0;
    i < 300 && !screen.queryByRole("group", { name: "Action" });
    i++
  ) {
    play(100);
  }
  expect(screen.getByRole("group", { name: "Action" })).toBeTruthy();
};
const untilOver = () => {
  for (let i = 0; i < 300 && !document.querySelector(".result"); i++) {
    play(100);
  }
};
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const tab = (name: string) =>
  screen.getByRole("button", { name, pressed: undefined });

describe("BattleScreen", () => {
  it("runs time until the party is asked, then offers an attack", () => {
    show();
    expect(screen.getByText("Time is moving…")).toBeTruthy();
    untilAsked();
    expect(screen.getByText(/'s turn \(Anywhere/)).toBeTruthy();
    expect(tab("Attack").getAttribute("aria-pressed")).toBe("true");
    expect((tab("Skill") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("list", { name: "Turn order" })).toBeTruthy();
  });

  it("commits on the first command and wins the battle", () => {
    const props = show({ labels: { exit: "← Out", exitCommitted: "Give up" } });
    expect(button("← Out")).toBeTruthy();
    untilAsked();
    fireEvent.click(screen.getByRole("gridcell", { name: /^Attack foe/ }));
    expect(props.onCommit).toHaveBeenCalledOnce();
    untilOver();
    expect(document.querySelector(".result")!.textContent).toBe("Victory!");
    expect(screen.queryByRole("button", { name: "Restart battle" })).toBeNull();
    fireEvent.click(button("Next battle"));
    expect(props.onRestart).toHaveBeenCalledWith(true);
    fireEvent.click(button("Back"));
    expect(props.onExit).toHaveBeenCalledOnce();
  });

  it("can be restarted once a command is given, and renames the way out", () => {
    const props = show({
      setup: casting,
      labels: { exit: "← Out", exitCommitted: "Give up" },
    });
    untilAsked();
    expect(screen.queryByRole("button", { name: "Restart battle" })).toBeNull();
    fireEvent.click(button("Defend"));
    expect(button("Give up")).toBeTruthy();
    fireEvent.click(button("Restart battle"));
    expect(props.onRetry).toHaveBeenCalledOnce();
    fireEvent.click(button("Give up"));
    expect(props.onExit).toHaveBeenCalledOnce();
  });

  it("leaves out the second button when the host has none", () => {
    show({ labels: { exit: "x", won: "Collect", lost: "End", back: null } });
    untilAsked();
    fireEvent.click(screen.getByRole("gridcell", { name: /^Attack foe/ }));
    untilOver();
    expect(button("Collect")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("picks a skill, then its target, or goes back to the list", () => {
    show({ setup: casting });
    untilAsked();
    fireEvent.click(tab("Skill"));
    expect(screen.getByText(/choose a skill\./)).toBeTruthy();
    const skill = content.mage.skills![0]!;
    fireEvent.click(button(new RegExp(`^${skill.name}`)));
    expect(screen.getByText(skill.name, { selector: "p strong" })).toBeTruthy();
    fireEvent.click(button("← Skills"));
    expect(screen.getByText(/choose a skill\./)).toBeTruthy();
  });

  it("offers steps to other cells in Move", () => {
    show({ setup: casting });
    untilAsked();
    fireEvent.click(tab("Move"));
    expect(
      screen.getByText(/tap a highlighted cell to step there/),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("gridcell", { name: /^Move to Party column/ }).length,
    ).toBeGreaterThan(0);
  });

  it("pauses from the button or the keyboard, holding time", () => {
    show({ setup: casting });
    fireEvent.click(button("Pause"));
    expect(screen.getByText("Paused")).toBeTruthy();
    // Long enough for the mage's turn, were time running.
    play(10_000);
    expect(screen.queryByRole("group", { name: "Action" })).toBeNull();
    expect(screen.getByText("Time is moving…")).toBeTruthy();
    fireEvent.click(button(/Paused/));
    expect(screen.queryByText("Paused")).toBeNull();
    untilAsked();
    fireEvent.keyDown(window, { key: "p" });
    expect(screen.getByText("Paused")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Paused")).toBeNull();
  });

  it("switches the battle speed and remembers it", () => {
    show();
    const speed = screen.getByRole("button", { name: /^Battle speed 1×/ });
    fireEvent.click(speed);
    expect(
      screen.getByRole("button", { name: /^Battle speed 2×/ }),
    ).toBeTruthy();
    cleanup();
    show();
    expect(
      screen.getByRole("button", { name: /^Battle speed 2×/ }),
    ).toBeTruthy();
  });

  it("opens a unit's details on right-click, and closes them", () => {
    show();
    fireEvent.contextMenu(screen.getByText("foe", { selector: ".unit-name" }));
    expect(screen.getByRole("dialog", { name: "foe details" })).toBeTruthy();
    fireEvent.click(button("Close"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
