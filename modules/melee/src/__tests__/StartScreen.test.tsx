// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { meleeEncounter } from "../../shared/arena";
import { StartScreen } from "../StartScreen";

const health = vi.fn<() => Promise<Response>>();
beforeEach(() => {
  health.mockResolvedValue(Response.json({ status: "ok" }));
  vi.stubGlobal("fetch", health);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Props = ComponentProps<typeof StartScreen>;
const show = (changes: Partial<Props> = {}) => {
  const props: Props = {
    difficulty: "normal",
    encounterSeed: 42,
    onDifficulty: vi.fn(),
    onReroll: vi.fn(),
    onStart: vi.fn(),
    ...changes,
  };
  render(<StartScreen {...props} />);
  return props;
};
const names = (side: "player" | "enemy") => {
  const counts = new Map<string, number>();
  for (const p of meleeEncounter(42, "normal").placements) {
    if (p.side === side)
      counts.set(p.def.name, (counts.get(p.def.name) ?? 0) + 1);
  }
  return [...counts].map(([n, k]) => (k > 1 ? `${n} ×${k}` : n)).join(", ");
};

const radio = (name: string) => screen.getByRole("radio", { name });
const click = (role: "radio" | "button", name: string) =>
  fireEvent.click(screen.getByRole(role, { name }));

describe("melee StartScreen", () => {
  it("given seed 42 on normal, when it shows, then it lists the party, the enemies and the encounter number", () => {
    const seed = 42;

    show({ encounterSeed: seed });

    expect(screen.getByText("Your party:").parentElement!.textContent).toBe(
      `Your party: ${names("player")}`,
    );
    expect(screen.getByText("Enemies:").parentElement!.textContent).toBe(
      `Enemies: ${names("enemy")}`,
    );
    expect(screen.getByText("Encounter #42")).toBeTruthy();
  });

  it("given normal difficulty, when it shows, then Normal is checked", () => {
    const difficulty = "normal";

    show({ difficulty });

    expect(radio("Normal").getAttribute("aria-checked")).toBe("true");
  });

  it.each<[string, "radio" | "button", string, keyof Props, unknown[]]>([
    ["Hard", "radio", "Hard", "onDifficulty", ["hard"]],
    ["Start", "button", "Start", "onStart", [meleeEncounter(42, "normal")]],
  ])(
    "given the start screen, when %s is pressed, then it is reported",
    (_, role, name, handler, args) => {
      const props = show();

      click(role, name);

      expect(props[handler]).toHaveBeenCalledWith(...args);
    },
  );

  it("given the start screen, when Reroll is pressed, then it is reported once", () => {
    const props = show();

    click("button", "Reroll");

    expect(props.onReroll).toHaveBeenCalledOnce();
  });

  it("given the API has not answered yet, when it shows, then it says it is checking", () => {
    health.mockReturnValue(new Promise(() => {}));

    show();

    expect(screen.getByText(/checking…/)).toBeTruthy();
  });

  it("given the API answers, when it shows, then it reports ok from the melee health endpoint", async () => {
    const ok = health;

    show();

    expect(await screen.findByText("ok")).toBeTruthy();
    expect(ok).toHaveBeenCalledWith("/api/melee/health");
  });

  it("given the API is offline, when it shows, then it reports unreachable", async () => {
    health.mockRejectedValue(new Error("offline"));

    show();

    expect(await screen.findByText("unreachable")).toBeTruthy();
  });
});
