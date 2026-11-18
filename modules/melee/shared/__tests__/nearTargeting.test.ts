import { describe, expect, it } from "vitest";
import { chooseCommand, targetScore } from "../ai";
import { createBattle } from "../battle";
import { farness } from "../grid";
import type { BattleState, Placement, TargetingProfile, Unit } from "../types";
import { def, place } from "./helpers";

const calm: TargetingProfile = {
  near: 1,
  finish: 3,
  wounded: 1,
  soft: 1,
  noise: 0,
};

/** The AI attacker (reaching anywhere) sits at enemy 2,0. */
function battle(
  party: Placement[],
  profile = calm,
): { state: BattleState; brute: Unit } {
  const brute = { ...def("brute"), targeting: profile };
  const state = createBattle(
    { placements: [place(brute, "enemy", 2), ...party] },
    1,
  );
  return { state, brute: state.units.find((u) => u.id === "enemy-2-0")! };
}

const unit = (state: BattleState, id: string) =>
  state.units.find((u) => u.id === id)!;
const attacked = (state: BattleState, brute: Unit) => {
  const command = chooseCommand(state, brute);
  return command?.type === "attack" ? command.targetId : undefined;
};

describe("farness", () => {
  it("is 0 straight ahead and 1 across every column in the back row", () => {
    const { state, brute } = battle([
      place(def("ahead"), "player", 2, 0),
      place(def("far"), "player", 0, 2),
    ]);
    expect(farness(brute, unit(state, "player-2-0"))).toBe(0);
    expect(farness(brute, unit(state, "player-0-2"))).toBe(4 / 6);
  });

  it("counts columns away and depth alike", () => {
    const { state, brute } = battle([
      place(def("aside"), "player", 3, 0),
      place(def("behind"), "player", 2, 1),
    ]);
    expect(farness(brute, unit(state, "player-3-0"))).toBe(
      farness(brute, unit(state, "player-2-1")),
    );
  });
});

describe("near in targetScore", () => {
  it("costs nothing for the target straight ahead", () => {
    const { state, brute } = battle([place(def("ahead"), "player", 2, 0)]);
    const ahead = unit(state, "player-2-0");
    const without = targetScore(
      state,
      { ...brute, targeting: { ...calm, near: 0 } },
      ahead,
    );
    expect(targetScore(state, brute, ahead)).toBeCloseTo(without);
  });

  it("prefers the closer of two equal targets", () => {
    const { state, brute } = battle([
      place(def("aside"), "player", 3, 0),
      place(def("far"), "player", 0, 2),
    ]);
    expect(attacked(state, brute)).toBe("player-3-0");
  });

  it("still goes for a badly wounded target a little farther off", () => {
    const { state, brute } = battle([
      place(def("aside"), "player", 3, 0),
      place(def("hurt"), "player", 0, 1),
    ]);
    unit(state, "player-0-1").hp = 30;
    expect(attacked(state, brute)).toBe("player-0-1");
  });

  it("goes anywhere for a target it can finish", () => {
    const { state, brute } = battle([
      place(def("ahead"), "player", 2, 0),
      place(def("dying"), "player", 0, 2),
    ]);
    unit(state, "player-0-2").hp = 5;
    expect(attacked(state, brute)).toBe("player-0-2");
  });

  it("is ignored with a near of 0", () => {
    const { state, brute } = battle(
      [place(def("aside"), "player", 3, 0), place(def("far"), "player", 0, 2)],
      { ...calm, near: 0, soft: 0 },
    );
    const aside = targetScore(state, brute, unit(state, "player-3-0"));
    const far = targetScore(state, brute, unit(state, "player-0-2"));
    expect(aside).toBeCloseTo(far);
  });
});
