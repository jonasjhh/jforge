import { describe, expect, it } from "vitest";
import { openingBattle, playTurn } from "../index";

describe("playTurn", () => {
  it("lets the hero strike and the enemy answer using melee's rules", () => {
    const [heroHit, enemyHit] = playTurn(openingBattle);
    expect(heroHit).toMatchObject({ attacker: "Hero", damage: 4 });
    expect(enemyHit).toMatchObject({ attacker: "Slime", damage: 1 });
  });

  it("skips the answer when the enemy is knocked out", () => {
    const party = {
      ...openingBattle,
      enemy: { ...openingBattle.enemy, hp: 1 },
    };
    expect(playTurn(party)).toHaveLength(1);
  });
});
