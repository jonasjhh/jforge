// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createBattle, type Status, type Unit } from "../../../shared";
import { def, place } from "../../../shared/__tests__/helpers";
import { UnitDetails } from "../UnitDetails";
import { TIME_SCALE } from "../useBattle";

afterEach(cleanup);

const base = (): Unit =>
  createBattle(
    {
      placements: [
        place(def("hero", { maxMp: 30, attack: 20, speed: 10 }), "player", 0),
        place(def("foe"), "enemy", 0),
      ],
    },
    1,
  ).units[0]!;
const status = (changes: Partial<Status>): Status => ({
  id: "s1",
  name: "Poison",
  effect: "damage",
  damageType: "poison",
  harmful: true,
  amount: 4,
  interval: TIME_SCALE * 2,
  nextTickAt: TIME_SCALE * 2,
  ticksLeft: 3,
  sourceId: "enemy-0-0",
  ...changes,
});
const show = (unit: Unit, onClose = () => {}, time = 0, speed = 1) =>
  render(
    <UnitDetails unit={unit} time={time} speed={speed} onClose={onClose} />,
  );
const dialog = () => screen.getByRole("dialog", { name: "hero details" });

describe("UnitDetails", () => {
  it("shows HP, MP, stats and weapon", () => {
    show(base());
    const text = dialog().textContent!;
    expect(text).toContain("HP 100/100 · MP 30/30");
    expect(text).toContain("Attack20");
    expect(text).toContain("Anywhere slash, ranged");
    expect(text).toContain("No weaknesses or resistances.");
  });

  it("says a fallen unit is knocked out", () => {
    show({ ...base(), hp: 0 });
    expect(dialog().textContent).toContain("Knocked out");
  });

  it("marks stats raised or lowered by modifiers", () => {
    show({
      ...base(),
      modifiers: [
        {
          stat: "attack",
          op: "mul",
          value: 1.5,
          source: "Rage",
          expiresAt: 600,
        },
        { stat: "speed", op: "add", value: -4, source: "Slow", harmful: true },
      ],
    });
    expect(screen.getByText("30").className).toBe("good");
    expect(screen.getByText("6").className).toBe("bad");
    // Only the timed modifier is listed, with the time it has left.
    expect(dialog().textContent).toContain("Rage Attack ×1.5. 10s left.");
    expect(dialog().textContent).not.toContain("Slow Speed");
  });

  it("lists weaknesses, resistances and immunities", () => {
    show({ ...base(), resistances: { fire: 2, cold: 0.5, poison: 0 } });
    const text = dialog().textContent!;
    expect(text).toContain("Weak: fire ×2");
    expect(text).toContain("Resists: cold ×0.5");
    expect(text).toContain("Immune: poison");
  });

  it("explains its running effects and how long they last", () => {
    show(
      {
        ...base(),
        defending: true,
        statuses: [
          status({}),
          status({ id: "s2", name: "Barrier", effect: "shield", amount: 12 }),
        ],
        casting: {
          skillId: "fireball",
          skillName: "Fireball",
          cell: { side: "enemy", col: 0, row: 0 },
          area: [],
          startedAt: 0,
          readyAt: TIME_SCALE * 3,
        },
      },
      () => {},
      0,
      2,
    );
    const text = dialog().textContent!;
    expect(text).toContain("Defending — hits are halved");
    expect(text).toContain("Casting Fireball — lands in 2s.");
    expect(text).toContain("Poison Takes 4 poison damage every 1s. 3s left.");
    expect(text).toContain("Barrier Absorbs the next 12 damage.");
  });

  it.each([
    ["heal", "Regains 4 HP every 2s."],
    [
      "stealth",
      "Hidden: single-target attacks and skills can't pick it. Its next attack deals ×1.",
    ],
    ["ward", "Can't be knocked out"],
    ["taunt", "Provoking:"],
    ["expose", "Exposed: takes ×1 damage"],
    ["silence", "Silenced: can't use skills."],
    ["guard", "Guarded:"],
    ["weaken", "Weakened: deals ×1 damage."],
    ["coat", "Coated blade:"],
    ["smoke", "In smoke:"],
    ["stoneSkin", "Stone Skin: defense ×1"],
    ["petrify", "Petrified: can't act, takes ×1 damage."],
    ["bless", "Blessed: deals ×1 damage and takes ×1."],
    ["bomb", "Explodes when time runs out or it falls: 4 poison damage"],
  ] as const)("explains a %s status", (effect, text) => {
    show({ ...base(), statuses: [status({ effect })] });
    expect(dialog().textContent).toContain(text);
  });

  it("names summons and obstacles, and shows no stats for an obstacle", () => {
    show({ ...base(), summonedBy: "player-1-0" });
    expect(dialog().textContent).toContain("· Summon");
    cleanup();
    show({ ...base(), obstacle: true });
    expect(dialog().textContent).toContain("· Obstacle");
    expect(dialog().querySelector("dl")).toBeNull();
  });

  it("closes on Escape, Close or a tap outside, not a tap inside", () => {
    const onClose = vi.fn();
    const { container } = show(base(), onClose);
    fireEvent.click(dialog());
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(container.querySelector(".details-backdrop")!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
