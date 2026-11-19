// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { START_PARTY_SIZE, drawParty, heroes } from "../../shared";
import { StartScreen } from "../StartScreen";
import { library } from "./runs";

beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SEED = 500_000;
const heroButtons = () =>
  within(screen.getByRole("group", { name: "Heroes" })).getAllByRole("button");
const pressed = () =>
  heroButtons()
    .filter((b) => b.getAttribute("aria-pressed") === "true")
    .map((b) => b.querySelector("strong")!.textContent);
const names = (ids: string[]) =>
  ids.map((id) => heroes(library).find((h) => h.id === id)!.name);

const heroButton = (name: string) =>
  heroButtons().find((b) => b.querySelector("strong")!.textContent === name)!;
const setOut = () =>
  screen.getByRole("button", { name: "Set out" }) as HTMLButtonElement;

describe("StartScreen", () => {
  it("given the start screen, when it shows, then every hero is offered with a party drawn by lot", () => {
    render(<StartScreen library={library} onStart={() => {}} />);

    expect(heroButtons()).toHaveLength(heroes(library).length);
    expect(pressed()).toEqual(names(drawParty(library, SEED).map((c) => c.id)));
  });

  it("given the party drawn, when Set out is pressed, then the run starts with them", () => {
    const onStart = vi.fn();
    render(<StartScreen library={library} onStart={onStart} />);

    fireEvent.click(setOut());

    expect(onStart).toHaveBeenCalledWith(
      SEED,
      drawParty(library, SEED).map((c) => c.id),
    );
  });

  it("given a full party, when one more hero is picked, then the first chosen is let go", () => {
    render(<StartScreen library={library} onStart={() => {}} />);
    const drawn = drawParty(library, SEED).map((c) => c.id);
    const other = heroes(library).find((h) => !drawn.includes(h.id))!;

    fireEvent.click(heroButton(other.name));

    expect(pressed().sort()).toEqual(
      names([...drawn.slice(1), other.id]).sort(),
    );
  });

  it("given a hero picked over a full party, when Set out is pressed, then the run starts with the new party", () => {
    const onStart = vi.fn();
    render(<StartScreen library={library} onStart={onStart} />);
    const drawn = drawParty(library, SEED).map((c) => c.id);
    const other = heroes(library).find((h) => !drawn.includes(h.id))!;
    fireEvent.click(heroButton(other.name));

    fireEvent.click(setOut());

    expect(onStart).toHaveBeenCalledWith(SEED, [...drawn.slice(1), other.id]);
  });

  it("given a full party, when a chosen hero is let go, then the party can't set out", () => {
    render(<StartScreen library={library} onStart={() => {}} />);
    const first = heroButtons().find(
      (b) => b.getAttribute("aria-pressed") === "true",
    )!;

    fireEvent.click(first);

    expect(pressed()).toHaveLength(START_PARTY_SIZE - 1);
    expect(setOut().disabled).toBe(true);
  });

  it("given a new lot, when Draw again is pressed, then the party drawn for its seed is chosen", () => {
    render(<StartScreen library={library} onStart={() => {}} />);
    vi.spyOn(Math, "random").mockReturnValue(0.25);

    fireEvent.click(screen.getByRole("button", { name: "Draw again" }));

    expect(pressed()).toEqual(
      names(drawParty(library, 250_000).map((c) => c.id)),
    );
  });

  it("given a party drawn again, when Set out is pressed, then the run starts on the new seed", () => {
    const onStart = vi.fn();
    render(<StartScreen library={library} onStart={onStart} />);
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    fireEvent.click(screen.getByRole("button", { name: "Draw again" }));

    fireEvent.click(setOut());

    expect(onStart.mock.calls[0]![0]).toBe(250_000);
  });
});
