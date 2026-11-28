import { describe, expect, it } from "vitest";
import { chooseCommand } from "@jforge/battle/engine/ai.ts";
import { createBattle } from "@jforge/battle/engine/battle.ts";
import { sword } from "../content";
import type {
  BattleState,
  Placement,
  TargetingProfile,
} from "@jforge/battle/engine/types.ts";
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
  it("given a tough unit it can finish and a soft one, when the AI picks, then it finishes the tough one", () => {
    // 20 attack vs 40 defence: about 11 damage, enough to finish 8 HP.
    const party = [
      place(def("tough", { maxHp: 100, defence: 40 }), "player", 1),
      place(def("soft", { maxHp: 100, defence: 0 }), "player", 3),
    ];

    const target = pick(party, { setup: setHp("player-1-0", 8) });

    expect(target).toBe("player-1-0");
  });

  it("given a wounded and a healthy unit, when the AI picks, then it picks the wounded one", () => {
    const party = [
      place(def("healthy", { maxHp: 100 }), "player", 1),
      place(def("hurt", { maxHp: 100 }), "player", 3),
    ];

    const target = pick(party, { setup: setHp("player-3-0", 50) });

    expect(target).toBe("player-3-0");
  });

  it("given an armoured and a robed unit, equally healthy, when the AI picks, then it picks the robed one", () => {
    const party = [
      place(def("armoured", { defence: 30 }), "player", 1),
      place(def("robed", { defence: 2 }), "player", 3),
    ];

    const target = pick(party);

    expect(target).toBe("player-3-0");
  });

  it("given a nearly dead mage behind a guard, when the AI picks, then it picks the guard it can reach", () => {
    const party = [
      place(def("guard", { maxHp: 100, defence: 30 }), "player", 2, 0),
      place(def("mage", { maxHp: 100 }), "player", 2, 1),
    ];

    const target = pick(party, { setup: setHp("player-2-1", 1) });

    expect(target).toBe("player-2-0");
  });

  const twins = [
    place(def("left"), "player", 1),
    place(def("right"), "player", 3),
  ];
  const noisy = { ...calm, noise: 1 };

  it("given twins and a noisy AI, when it picks over twenty seeds, then both are picked", () => {
    const seeds = Array.from({ length: 20 }, (_, seed) => seed);

    const picks = new Set(
      seeds.map((seed) => pick(twins, { profile: noisy, seed })),
    );

    expect(picks).toEqual(new Set(["player-1-0", "player-3-0"]));
  });

  it("given twins and a noisy AI, when it picks twice on one seed, then it picks the same", () => {
    const first = pick(twins, { profile: noisy, seed: 7 });

    const second = pick(twins, { profile: noisy, seed: 7 });

    expect(second).toBe(first);
  });
});
