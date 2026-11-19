// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { EMPTY_ROSTER, encounterPools, randomEncounter } from "../../shared";
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
const pools = encounterPools(EMPTY_ROSTER, false);
const show = (changes: Partial<Props> = {}) => {
  const props: Props = {
    difficulty: "normal",
    encounterSeed: 42,
    pools,
    imported: 0,
    custom: false,
    onCustom: vi.fn(),
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
  for (const p of randomEncounter(42, "normal", pools).placements) {
    if (p.side === side)
      counts.set(p.def.name, (counts.get(p.def.name) ?? 0) + 1);
  }
  return [...counts].map(([n, k]) => (k > 1 ? `${n} ×${k}` : n)).join(", ");
};

describe("melee StartScreen", () => {
  it("shows the encounter the seed and difficulty draw", () => {
    show();
    expect(screen.getByText("Your party:").parentElement!.textContent).toBe(
      `Your party: ${names("player")}`,
    );
    expect(screen.getByText("Enemies:").parentElement!.textContent).toBe(
      `Enemies: ${names("enemy")}`,
    );
    expect(screen.getByText("Encounter #42")).toBeTruthy();
  });

  it("chooses the difficulty, rerolls and starts", () => {
    const props = show();
    expect(
      screen
        .getByRole("radio", { name: "Normal" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Hard" }));
    expect(props.onDifficulty).toHaveBeenCalledWith("hard");
    fireEvent.click(screen.getByRole("button", { name: "Reroll" }));
    expect(props.onReroll).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(props.onStart).toHaveBeenCalledWith(
      randomEncounter(42, "normal", pools),
    );
  });

  it("offers the custom roster only when char has published one", () => {
    show();
    expect(screen.queryByRole("radiogroup", { name: "Roster" })).toBeNull();
    cleanup();
    const props = show({ imported: 3 });
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    expect(props.onCustom).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("radio", { name: "Built-in" }));
    expect(props.onCustom).toHaveBeenCalledWith(false);
  });

  it("shows whether the API answers", async () => {
    show();
    expect(screen.getByText(/checking…/)).toBeTruthy();
    expect(await screen.findByText("ok")).toBeTruthy();
    expect(health).toHaveBeenCalledWith("/api/melee/health");
    cleanup();
    health.mockRejectedValue(new Error("offline"));
    show();
    expect(await screen.findByText("unreachable")).toBeTruthy();
  });
});
