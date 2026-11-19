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
  // Throws if the party was never asked.
  screen.getByRole("group", { name: "Action" });
};
const untilOver = () => {
  for (let i = 0; i < 300 && !document.querySelector(".result"); i++) {
    play(100);
  }
};
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const tab = (name: string) =>
  screen.getByRole("button", { name, pressed: undefined });

const labels = { exit: "← Out", exitCommitted: "Give up" };
const attackFoe = () =>
  fireEvent.click(screen.getByRole("gridcell", { name: /^Attack foe/ }));
/** The duel shown and won with one attack. */
const won = (changes: Partial<Props> = {}) => {
  const props = show(changes);
  untilAsked();
  attackFoe();
  untilOver();
  return props;
};
/** The casting battle shown, the mage asked and defending. */
const committed = () => {
  const props = show({ setup: casting, labels });
  untilAsked();
  fireEvent.click(button("Defend"));
  return props;
};
/** The casting battle at the mage's turn, its Skill tab open. */
const skills = () => {
  show({ setup: casting });
  untilAsked();
  fireEvent.click(tab("Skill"));
};
const skill = content.mage.skills![0]!;
const paused = () => screen.queryByText("Paused");

describe("BattleScreen", () => {
  it("given a battle, when it shows, then time is moving", () => {
    const setup = duel;

    show({ setup });

    expect(screen.getByText("Time is moving…")).toBeTruthy();
  });

  it("given a battle, when the party is asked, then an attack is offered and skills are not", () => {
    show();

    untilAsked();

    expect(screen.getByText(/'s turn \(Anywhere/)).toBeTruthy();
    expect(tab("Attack").getAttribute("aria-pressed")).toBe("true");
    expect((tab("Skill") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("list", { name: "Turn order" })).toBeTruthy();
  });

  it("given the host's labels, when the battle shows, then the way out uses them", () => {
    const named = labels;

    show({ labels: named });

    expect(button("← Out")).toBeTruthy();
  });

  it("given the party asked, when the first command is given, then the battle is committed", () => {
    const props = show();
    untilAsked();

    attackFoe();

    expect(props.onCommit).toHaveBeenCalledOnce();
  });

  it("given a winning blow, when the battle runs out, then it is a victory with no restart", () => {
    show();
    untilAsked();
    attackFoe();

    untilOver();

    expect(document.querySelector(".result")!.textContent).toBe("Victory!");
    expect(screen.queryByRole("button", { name: "Restart battle" })).toBeNull();
  });

  it("given a victory, when Next battle is pressed, then a restart is asked for as won", () => {
    const props = won();

    fireEvent.click(button("Next battle"));

    expect(props.onRestart).toHaveBeenCalledWith(true);
  });

  it("given a victory, when Back is pressed, then the host is left", () => {
    const props = won();

    fireEvent.click(button("Back"));

    expect(props.onExit).toHaveBeenCalledOnce();
  });

  it("given a host without a second button, when the battle is won, then only its won button shows", () => {
    const hostLabels = { exit: "x", won: "Collect", lost: "End", back: null };

    won({ labels: hostLabels });

    expect(button("Collect")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("given no command given yet, when the party is asked, then the battle can't be restarted", () => {
    show({ setup: casting, labels });

    untilAsked();

    expect(screen.queryByRole("button", { name: "Restart battle" })).toBeNull();
  });

  it("given the party asked, when it defends, then the way out is renamed", () => {
    show({ setup: casting, labels });
    untilAsked();

    fireEvent.click(button("Defend"));

    expect(button("Give up")).toBeTruthy();
  });

  it("given a committed battle, when it is restarted, then a retry is asked for", () => {
    const props = committed();

    fireEvent.click(button("Restart battle"));

    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  it("given a committed battle, when the player gives up, then the host is left", () => {
    const props = committed();

    fireEvent.click(button("Give up"));

    expect(props.onExit).toHaveBeenCalledOnce();
  });

  it("given the mage asked, when the Skill tab opens, then it asks for a skill", () => {
    show({ setup: casting });
    untilAsked();

    fireEvent.click(tab("Skill"));

    expect(screen.getByText(/choose a skill\./)).toBeTruthy();
  });

  it("given the skill list, when a skill is picked, then its target is asked for", () => {
    skills();

    fireEvent.click(button(new RegExp(`^${skill.name}`)));

    expect(screen.getByText(skill.name, { selector: "p strong" })).toBeTruthy();
  });

  it("given a skill picked, when the player goes back, then the list shows again", () => {
    skills();
    fireEvent.click(button(new RegExp(`^${skill.name}`)));

    fireEvent.click(button("← Skills"));

    expect(screen.getByText(/choose a skill\./)).toBeTruthy();
  });

  it("given the mage asked, when the Move tab opens, then steps to other cells are offered", () => {
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

  it("given the battle paused by the button, when long enough for a turn passes, then time holds", () => {
    show({ setup: casting });
    fireEvent.click(button("Pause"));

    // Long enough for the mage's turn, were time running.
    play(10_000);

    expect(paused()).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Action" })).toBeNull();
    expect(screen.getByText("Time is moving…")).toBeTruthy();
  });

  it("given a paused battle, when the pause button is pressed again, then it resumes", () => {
    show({ setup: casting });
    fireEvent.click(button("Pause"));

    fireEvent.click(button(/Paused/));

    expect(paused()).toBeNull();
  });

  it("given the party asked, when P is pressed, then it pauses", () => {
    show({ setup: casting });
    untilAsked();

    fireEvent.keyDown(window, { key: "p" });

    expect(paused()).toBeTruthy();
  });

  it("given a battle paused by P, when Escape is pressed, then it resumes", () => {
    show({ setup: casting });
    untilAsked();
    fireEvent.keyDown(window, { key: "p" });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(paused()).toBeNull();
  });

  it("given 1×, when the speed button is pressed, then it is 2×", () => {
    show();

    fireEvent.click(screen.getByRole("button", { name: /^Battle speed 1×/ }));

    expect(
      screen.getByRole("button", { name: /^Battle speed 2×/ }),
    ).toBeTruthy();
  });

  it("given 2× chosen before, when the battle shows again, then it is still 2×", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /^Battle speed 1×/ }));
    cleanup();

    show();

    expect(
      screen.getByRole("button", { name: /^Battle speed 2×/ }),
    ).toBeTruthy();
  });

  it("given a unit, when it is right-clicked, then its details open", () => {
    show();

    fireEvent.contextMenu(screen.getByText("foe", { selector: ".unit-name" }));

    expect(screen.getByRole("dialog", { name: "foe details" })).toBeTruthy();
  });

  it("given a unit's details open, when Close is pressed, then they close", () => {
    show();
    fireEvent.contextMenu(screen.getByText("foe", { selector: ".unit-name" }));

    fireEvent.click(button("Close"));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
