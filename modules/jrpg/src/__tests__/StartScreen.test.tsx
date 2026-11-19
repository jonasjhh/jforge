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

describe("StartScreen", () => {
  it("offers every hero, with a party drawn by lot", () => {
    render(<StartScreen library={library} onStart={() => {}} />);
    expect(heroButtons()).toHaveLength(heroes(library).length);
    expect(pressed()).toEqual(names(drawParty(library, SEED).map((c) => c.id)));
  });

  it("sets out with the heroes chosen", () => {
    const onStart = vi.fn();
    render(<StartScreen library={library} onStart={onStart} />);
    const drawn = drawParty(library, SEED).map((c) => c.id);
    fireEvent.click(screen.getByRole("button", { name: "Set out" }));
    expect(onStart).toHaveBeenCalledWith(SEED, drawn);
  });

  it("lets go of the first chosen when one more is picked", () => {
    const onStart = vi.fn();
    render(<StartScreen library={library} onStart={onStart} />);
    const drawn = drawParty(library, SEED).map((c) => c.id);
    const other = heroes(library).find((h) => !drawn.includes(h.id))!;
    fireEvent.click(
      heroButtons().find(
        (b) => b.querySelector("strong")!.textContent === other.name,
      )!,
    );
    expect(pressed()).toHaveLength(START_PARTY_SIZE);
    fireEvent.click(screen.getByRole("button", { name: "Set out" }));
    expect(onStart).toHaveBeenCalledWith(SEED, [...drawn.slice(1), other.id]);
  });

  it("can't set out short of a full party", () => {
    render(<StartScreen library={library} onStart={() => {}} />);
    const first = heroButtons().find(
      (b) => b.getAttribute("aria-pressed") === "true",
    )!;
    fireEvent.click(first);
    const setOut = screen.getByRole("button", {
      name: "Set out",
    }) as HTMLButtonElement;
    expect(setOut.disabled).toBe(true);
  });

  it("draws again with a new seed", () => {
    const onStart = vi.fn();
    render(<StartScreen library={library} onStart={onStart} />);
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    fireEvent.click(screen.getByRole("button", { name: "Draw again" }));
    expect(pressed()).toEqual(
      names(drawParty(library, 250_000).map((c) => c.id)),
    );
    fireEvent.click(screen.getByRole("button", { name: "Set out" }));
    expect(onStart.mock.calls[0]![0]).toBe(250_000);
  });
});
