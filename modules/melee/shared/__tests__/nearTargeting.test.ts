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
  const { state, brute } = battle([
    place(def("ahead"), "player", 2, 0),
    place(def("far"), "player", 0, 2),
    place(def("aside"), "player", 3, 0),
    place(def("behind"), "player", 2, 1),
  ]);

  it.each([
    ["straight ahead", "player-2-0", 0],
    ["two columns off in the back row", "player-0-2", 4 / 6],
  ])(
    "given a target %s, when its farness is taken, then it is %d",
    (_, id, far) => {
      const result = farness(brute, unit(state, id));

      expect(result).toBe(far);
    },
  );

  it("given one target a column aside and one a row behind, when their farness is taken, then it is the same", () => {
    const aside = farness(brute, unit(state, "player-3-0"));

    const behind = farness(brute, unit(state, "player-2-1"));

    expect(behind).toBe(aside);
  });
});

describe("near in targetScore", () => {
  it("given a target straight ahead, when it is scored with and without near, then the scores match", () => {
    const { state, brute } = battle([place(def("ahead"), "player", 2, 0)]);
    const ahead = unit(state, "player-2-0");
    const without = targetScore(
      state,
      { ...brute, targeting: { ...calm, near: 0 } },
      ahead,
    );

    const score = targetScore(state, brute, ahead);

    expect(score).toBeCloseTo(without);
  });

  it("given two equal targets, near and far, when the AI attacks, then it picks the nearer", () => {
    const { state, brute } = battle([
      place(def("aside"), "player", 3, 0),
      place(def("far"), "player", 0, 2),
    ]);

    const target = attacked(state, brute);

    expect(target).toBe("player-3-0");
  });

  it("given a badly wounded target a little farther off, when the AI attacks, then it picks the wounded one", () => {
    const { state, brute } = battle([
      place(def("aside"), "player", 3, 0),
      place(def("hurt"), "player", 0, 1),
    ]);
    unit(state, "player-0-1").hp = 30;

    const target = attacked(state, brute);

    expect(target).toBe("player-0-1");
  });

  it("given a target it can finish at the far corner, when the AI attacks, then it goes for it", () => {
    const { state, brute } = battle([
      place(def("ahead"), "player", 2, 0),
      place(def("dying"), "player", 0, 2),
    ]);
    unit(state, "player-0-2").hp = 5;

    const target = attacked(state, brute);

    expect(target).toBe("player-0-2");
  });

  it("given a near of 0, when a near and a far target are scored, then the scores match", () => {
    const { state, brute } = battle(
      [place(def("aside"), "player", 3, 0), place(def("far"), "player", 0, 2)],
      { ...calm, near: 0, soft: 0 },
    );

    const aside = targetScore(state, brute, unit(state, "player-3-0"));
    const far = targetScore(state, brute, unit(state, "player-0-2"));

    expect(aside).toBeCloseTo(far);
  });
});
