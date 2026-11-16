import { describe, expect, it } from "vitest";
import {
  content,
  createBattle,
  type DamagePreview,
  type Placement,
  type Unit,
} from "../../../shared";
import {
  aimHint,
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
  victimSummary,
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

describe("aimHint", () => {
  it("says where to tap to aim each kind of area skill", () => {
    expect(aimHint(content.shatter)).toBe("tap one of your boulders to aim");
    expect(aimHint(content.cleave)).toBe("tap a highlighted enemy to aim");
    expect(aimHint(content.fireball)).toBe("tap any cell to aim");
  });
});

describe("victimSummary", () => {
  const foe = at(content.slime, 0);
  const enemy = { ...foe, side: "enemy" as const };
  const ally = { ...at(content.fighter, 0), name: "Ada" };
  const ally2 = { ...ally, name: "Bo" };

  it("says when nothing would be hit", () => {
    expect(victimSummary([], "player")).toEqual({
      hits: "would hit nothing.",
      friends: [],
    });
  });

  it("counts enemies from the caster's side", () => {
    expect(victimSummary([enemy], "player").hits).toBe("hits 1 enemy");
    expect(victimSummary([enemy, enemy], "player").hits).toBe("hits 2 enemies");
  });

  it("names the allies caught in the blast", () => {
    expect(victimSummary([enemy, ally, ally2], "player")).toEqual({
      hits: "hits 1 enemy",
      friends: ["Ada", "Bo"],
    });
    expect(victimSummary([ally], "player").hits).toBe("hits 0 enemies");
  });
});
