// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createBattle, type Status, type Unit } from "@jforge/battle";
import { def, place } from "../../../shared/__tests__/helpers";
import { UnitDetails } from "@jforge/battle/screen/UnitDetails.tsx";
import { TIME_SCALE } from "@jforge/battle/screen/useBattle.ts";

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

const text = () => dialog().textContent!;
const backdrop = (container: HTMLElement) =>
  container.querySelector(".details-backdrop")!;

describe("UnitDetails", () => {
  it("given a hero, when its details show, then they list HP, MP, stats and weapon", () => {
    const hero = base();

    show(hero);

    expect(text()).toContain("HP 100/100 · MP 30/30");
    expect(text()).toContain("Attack20");
    expect(text()).toContain("Anywhere slash, ranged");
    expect(text()).toContain("No weaknesses or resistances.");
  });

  it("given a fallen unit, when its details show, then they say it is knocked out", () => {
    const fallen = { ...base(), hp: 0 };

    show(fallen);

    expect(text()).toContain("Knocked out");
  });

  it("given a timed rage and an untimed slow, when the details show, then stats are marked and only the timed one is listed with its time left", () => {
    const unit: Unit = {
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
    };

    show(unit);

    expect(screen.getByText("30").className).toBe("good");
    expect(screen.getByText("6").className).toBe("bad");
    expect(text()).toContain("Rage Attack ×1.5. 10s left.");
    expect(text()).not.toContain("Slow Speed");
  });

  it("given weaknesses, resistances and an immunity, when the details show, then each is listed", () => {
    const unit = {
      ...base(),
      resistances: { fire: 2, cold: 0.5, poison: 0 },
    };

    show(unit);

    expect(text()).toContain("Weak: fire ×2");
    expect(text()).toContain("Resists: cold ×0.5");
    expect(text()).toContain("Immune: poison");
  });

  it("given a defending unit casting, poisoned and shielded at 2×, when the details show, then each effect is explained with how long it lasts", () => {
    const unit: Unit = {
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
    };

    show(unit, () => {}, 0, 2);

    expect(text()).toContain("Defending — hits are halved");
    expect(text()).toContain("Casting Fireball — lands in 2s.");
    expect(text()).toContain("Poison Takes 4 poison damage every 1s. 3s left.");
    expect(text()).toContain("Barrier Absorbs the next 12 damage.");
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
    ["stoneSkin", "Stone Skin: defence ×1"],
    ["petrify", "Petrified: can't act, takes ×1 damage."],
    ["bless", "Blessed: deals ×1 damage and takes ×1."],
    ["bomb", "Explodes when time runs out or it falls: 4 poison damage"],
  ] as const)(
    "given a %s status, when the details show, then it is explained",
    (effect, explained) => {
      const unit = { ...base(), statuses: [status({ effect })] };

      show(unit);

      expect(text()).toContain(explained);
    },
  );

  it("given a summon, when its details show, then it is named a summon", () => {
    const summon = { ...base(), summonedBy: "player-1-0" };

    show(summon);

    expect(text()).toContain("· Summon");
  });

  it("given an obstacle, when its details show, then it is named an obstacle, with no stats", () => {
    const obstacle = { ...base(), obstacle: true };

    show(obstacle);

    expect(text()).toContain("· Obstacle");
    expect(dialog().querySelector("dl")).toBeNull();
  });

  it.each<[string, (container: HTMLElement) => void]>([
    ["a tap inside", () => fireEvent.click(dialog())],
    ["Enter", () => fireEvent.keyDown(window, { key: "Enter" })],
  ])("given the details open, when %s comes, then they stay open", (_, act) => {
    const onClose = vi.fn();
    const { container } = show(base(), onClose);

    act(container);

    expect(onClose).not.toHaveBeenCalled();
  });

  it.each<[string, (container: HTMLElement) => void]>([
    ["Escape", () => fireEvent.keyDown(window, { key: "Escape" })],
    [
      "Close",
      () => fireEvent.click(screen.getByRole("button", { name: "Close" })),
    ],
    ["a tap outside", (container) => fireEvent.click(backdrop(container))],
  ])("given the details open, when %s comes, then they close", (_, act) => {
    const onClose = vi.fn();
    const { container } = show(base(), onClose);

    act(container);

    expect(onClose).toHaveBeenCalledOnce();
  });
});
