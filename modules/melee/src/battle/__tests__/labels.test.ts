import { describe, expect, it } from "vitest";
import {
  content,
  createBattle,
  type DamagePreview,
  type Placement,
  type Unit,
} from "../../../shared";
import {
  previewClasses,
  previewLabel,
  previewText,
  resistanceKind,
  resistanceNote,
  resultText,
  rowHint,
  skillCost,
  targetHint,
  unitName,
} from "../labels";

const at = (def: Placement["def"], row: number): Unit =>
  createBattle(
    {
      placements: [
        { def, side: "player", position: { col: 0, row } },
        { def: content.slime, side: "enemy", position: { col: 0, row: 0 } },
      ],
    },
    1,
  ).units[0]!;

const preview = (multiplier: number, knocksOut = false): DamagePreview => ({
  amount: 24,
  multiplier,
  knocksOut,
});

describe("resistanceKind", () => {
  it("names what a damage multiplier means", () => {
    expect([0, 0.5, 1, 1.5].map(resistanceKind)).toEqual([
      "immune",
      "resist",
      undefined,
      "weak",
    ]);
  });

  it("gives the log's note for each", () => {
    expect([0, 0.5, 1, 1.5].map(resistanceNote)).toEqual([
      " (immune)",
      " (resisted)",
      "",
      " (weak)",
    ]);
  });
});

describe("resultText", () => {
  it("is from the player's point of view", () => {
    expect(resultText("player")).toBe("Victory!");
    expect(resultText("enemy")).toBe("Defeat…");
    expect(resultText(null)).toBe("Draw");
  });
});

describe("unitName", () => {
  it("is the unit's name, or the id for an unknown unit", () => {
    const state = createBattle(
      {
        placements: [
          { def: content.mage, side: "player", position: { col: 0, row: 0 } },
          { def: content.slime, side: "enemy", position: { col: 0, row: 0 } },
        ],
      },
      1,
    );
    expect(unitName(state, "enemy-0-0")).toBe("Slime");
    expect(unitName(state, "ghost")).toBe("ghost");
  });
});

describe("skillCost", () => {
  it("shows MP, HP and whether the skill is delayed", () => {
    expect(skillCost({ ...content.fireball, mpCost: 12 })).toBe("12 MP");
    expect(
      skillCost({ ...content.meteor, mpCost: 24, castTime: 100, hpCost: 0 }),
    ).toBe("24 MP · delayed");
    expect(skillCost({ ...content.bloodBolt, mpCost: 0, hpCost: 15 })).toBe(
      "15 HP",
    );
    expect(skillCost({ ...content.summonImp, mpCost: 6, hpCost: 10 })).toBe(
      "10 HP · 6 MP",
    );
  });

  it("shows 0 MP for a free skill", () => {
    expect(skillCost({ ...content.fireball, mpCost: 0 })).toBe("0 MP");
  });
});

describe("rowHint", () => {
  it("gives a melee unit's damage for its row", () => {
    expect(rowHint(at(content.fighter, 0))).toBe(", front row: full damage");
    expect(rowHint(at(content.fighter, 1))).toBe(", middle row: ×0.75 damage");
    expect(rowHint(at(content.fighter, 2))).toBe(", back row: ×0.5 damage");
  });

  it("is empty for ranged weapons, which ignore rows", () => {
    expect(rowHint(at(content.archer, 2))).toBe("");
  });
});

describe("targetHint", () => {
  it("says what to tap for each kind of skill", () => {
    expect(targetHint(content.raiseBoulder)).toBe(
      "tap a highlighted empty cell on either side",
    );
    expect(targetHint(content.summonImp)).toBe(
      "tap a highlighted empty cell on your side",
    );
    expect(targetHint(content.shadowstep)).toBe(
      "tap a highlighted empty cell on your side",
    );
    expect(targetHint(content.upheaval)).toBe("tap a highlighted unit");
    expect(targetHint(content.vanish)).toBe("tap yourself to use it");
    expect(targetHint(content.heal)).toBe("tap a highlighted ally");
    expect(targetHint(content.cleave)).toBe("tap a highlighted enemy");
    expect(targetHint(content.fireball)).toBe("tap a highlighted cell");
  });
});

describe("damage preview badge", () => {
  it("shows the expected damage, or Immune", () => {
    expect(previewLabel(preview(1))).toBe("~24");
    expect(previewLabel(preview(0))).toBe("Immune");
    expect(previewLabel(preview(1, true))).toBe("~24 KO");
  });

  it("is gold if weak, grey if resisted or immune, red if it knocks out", () => {
    expect(previewClasses(preview(1))).toBe("preview");
    expect(previewClasses(preview(2))).toBe("preview weak");
    expect(previewClasses(preview(0.5))).toBe("preview resist");
    expect(previewClasses(preview(0))).toBe("preview resist");
    expect(previewClasses(preview(1.5, true))).toBe("preview weak ko");
  });

  it("reads out the damage, resistance and knock-out", () => {
    expect(previewText(preview(1))).toBe("about 24 damage");
    expect(previewText(preview(2, true))).toBe(
      "about 24 damage, weak, knocks out",
    );
    expect(previewText(preview(0.5))).toBe("about 24 damage, resists");
    expect(previewText(preview(0))).toBe("about 24 damage, immune");
  });
});
