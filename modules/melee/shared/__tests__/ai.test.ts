import { describe, expect, it } from "vitest";
import { chooseCommand } from "../ai";
import { createBattle } from "../battle";
import { sword } from "../content";
import type { BattleState, Placement, TargetingProfile } from "../types";
import { def, place } from "./helpers";

const calm: TargetingProfile = { finish: 3, wounded: 2, soft: 1, noise: 0 };

/** The AI attacker sits at enemy 2,0; returns the ID it attacks. */
function pick(
  party: Placement[],
  options: {
    profile?: TargetingProfile;
    seed?: number;
    setup?: (s: BattleState) => void;
  } = {},
): string | undefined {
  const brute = {
    ...def("brute", { attack: 20 }, sword),
    targeting: options.profile ?? calm,
  };
  const state = createBattle(
    { placements: [place(brute, "enemy", 2), ...party] },
    options.seed ?? 1,
  );
  options.setup?.(state);
  const unit = state.units.find((u) => u.id === "enemy-2-0")!;
  const command = chooseCommand(state, unit);
  return command?.type === "attack" ? command.targetId : undefined;
}

const setHp = (id: string, hp: number) => (s: BattleState) => {
  s.units.find((u) => u.id === id)!.hp = hp;
};

describe("enemy targeting", () => {
  it("goes for a unit it can knock out, even a tough one", () => {
    // 20 attack vs 40 defense: about 11 damage, enough to finish 8 HP.
    const target = pick(
      [
        place(def("tough", { maxHp: 100, defense: 40 }), "player", 1),
        place(def("soft", { maxHp: 100, defense: 0 }), "player", 3),
      ],
      { setup: setHp("player-1-0", 8) },
    );
    expect(target).toBe("player-1-0");
  });

  it("prefers a wounded unit over a healthy one", () => {
    const target = pick(
      [
        place(def("healthy", { maxHp: 100 }), "player", 1),
        place(def("hurt", { maxHp: 100 }), "player", 3),
      ],
      { setup: setHp("player-3-0", 50) },
    );
    expect(target).toBe("player-3-0");
  });

  it("prefers a soft unit when both are equally healthy", () => {
    const target = pick([
      place(def("armored", { defense: 30 }), "player", 1),
      place(def("robed", { defense: 2 }), "player", 3),
    ]);
    expect(target).toBe("player-3-0");
  });

  it("never picks a target it cannot reach, however tempting", () => {
    // The nearly dead mage is covered by the guard in front of it.
    const target = pick(
      [
        place(def("guard", { maxHp: 100, defense: 30 }), "player", 2, 0),
        place(def("mage", { maxHp: 100 }), "player", 2, 1),
      ],
      { setup: setHp("player-2-1", 1) },
    );
    expect(target).toBe("player-2-0");
  });

  it("uses its seeded randomness to break ties, repeatably", () => {
    const twins = [
      place(def("left"), "player", 1),
      place(def("right"), "player", 3),
    ];
    const noisy = { ...calm, noise: 1 };
    const picks = new Set(
      Array.from({ length: 20 }, (_, seed) =>
        pick(twins, { profile: noisy, seed }),
      ),
    );
    expect(picks).toEqual(new Set(["player-1-0", "player-3-0"]));
    expect(pick(twins, { profile: noisy, seed: 7 })).toBe(
      pick(twins, { profile: noisy, seed: 7 }),
    );
  });
});
