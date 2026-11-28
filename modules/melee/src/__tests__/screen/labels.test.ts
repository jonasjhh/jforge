import { describe, expect, it } from "vitest";
import {
  createBattle,
  type DamagePreview,
  type Placement,
  type Unit,
} from "@jforge/battle";
import { content } from "../../../shared";
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
} from "@jforge/battle/screen/labels.ts";

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
  it.each([
    [0, "immune", " (immune)"],
    [0.5, "resist", " (resisted)"],
    [1, undefined, ""],
    [1.5, "weak", " (weak)"],
  ])(
    "given a multiplier of %s, when it is named, then it is %s with the log's note",
    (multiplier, kind, note) => {
      const named = [resistanceKind(multiplier), resistanceNote(multiplier)];

      expect(named).toEqual([kind, note]);
    },
  );
});

describe("resultText", () => {
  it.each<[Parameters<typeof resultText>[0], string]>([
    ["player", "Victory!"],
    ["enemy", "Defeat…"],
    [null, "Draw"],
  ])("given %s won, when the result is read, then it is %s", (winner, text) => {
    const result = resultText(winner);

    expect(result).toBe(text);
  });
});

describe("unitName", () => {
  const state = createBattle(
    {
      placements: [
        { def: content.mage, side: "player", position: { col: 0, row: 0 } },
        { def: content.slime, side: "enemy", position: { col: 0, row: 0 } },
      ],
    },
    1,
  );

  it.each([
    ["a known unit", "enemy-0-0", "Slime"],
    ["an unknown unit", "ghost", "ghost"],
  ])("given %s, when it is named, then it is %s", (_, id, name) => {
    const result = unitName(state, id);

    expect(result).toBe(name);
  });
});

describe("skillCost", () => {
  it.each([
    ["a 12 MP skill", { ...content.fireball, mpCost: 12 }, "12 MP"],
    [
      "a delayed 24 MP skill",
      { ...content.meteor, mpCost: 24, castTime: 100, hpCost: 0 },
      "24 MP · delayed",
    ],
    ["a 15 HP skill", { ...content.bloodBolt, mpCost: 0, hpCost: 15 }, "15 HP"],
    [
      "a 10 HP, 6 MP skill",
      { ...content.summonImp, mpCost: 6, hpCost: 10 },
      "10 HP · 6 MP",
    ],
    ["a free skill", { ...content.fireball, mpCost: 0 }, "0 MP"],
  ])("given %s, when its cost is shown, then it reads %s", (_, skill, text) => {
    const cost = skillCost(skill);

    expect(cost).toBe(text);
  });
});

describe("rowHint", () => {
  it.each([
    [0, ", front row: full damage"],
    [1, ", middle row: ×0.75 damage"],
    [2, ", back row: ×0.5 damage"],
  ])(
    "given a fighter in row %i, when the row hint is read, then it gives its damage",
    (row, hint) => {
      const fighter = at(content.fighter, row);

      const result = rowHint(fighter);

      expect(result).toBe(hint);
    },
  );

  it("given an archer, when the row hint is read, then it is empty, as ranged weapons ignore rows", () => {
    const archer = at(content.archer, 2);

    const result = rowHint(archer);

    expect(result).toBe("");
  });
});

describe("targetHint", () => {
  it.each([
    [
      "Raise Boulder",
      content.raiseBoulder,
      "tap a highlighted empty cell on either side",
    ],
    [
      "Summon Imp",
      content.summonImp,
      "tap a highlighted empty cell on your side",
    ],
    [
      "Shadowstep",
      content.shadowstep,
      "tap a highlighted empty cell on your side",
    ],
    ["Upheaval", content.upheaval, "tap a highlighted unit"],
    ["Vanish", content.vanish, "tap yourself to use it"],
    ["Heal", content.heal, "tap a highlighted ally"],
    ["Cleave", content.cleave, "tap a highlighted enemy"],
    ["Fireball", content.fireball, "tap a highlighted cell"],
  ])(
    "given %s, when its target hint is read, then it says what to tap",
    (_, skill, hint) => {
      const result = targetHint(skill);

      expect(result).toBe(hint);
    },
  );
});

describe("damage preview badge", () => {
  it.each([
    ["plain", preview(1), "~24", "preview", "about 24 damage"],
    [
      "immune",
      preview(0),
      "Immune",
      "preview resist",
      "about 24 damage, immune",
    ],
    [
      "knocking out",
      preview(1, true),
      "~24 KO",
      "preview ko",
      "about 24 damage, knocks out",
    ],
    ["weak", preview(2), "~24", "preview weak", "about 24 damage, weak"],
    [
      "resisted",
      preview(0.5),
      "~24",
      "preview resist",
      "about 24 damage, resists",
    ],
    [
      "weak and knocking out",
      preview(1.5, true),
      "~24 KO",
      "preview weak ko",
      "about 24 damage, weak, knocks out",
    ],
  ])(
    "given a %s preview, when the badge is drawn, then its label, colour and read-out match",
    (_, p, label, classes, text) => {
      const badge = [previewLabel(p), previewClasses(p), previewText(p)];

      expect(badge).toEqual([label, classes, text]);
    },
  );
});

describe("aimHint", () => {
  it.each([
    ["Shatter", content.shatter, "tap one of your boulders to aim"],
    ["Cleave", content.cleave, "tap a highlighted enemy to aim"],
    ["Fireball", content.fireball, "tap any cell to aim"],
  ])(
    "given %s, when its aim hint is read, then it says where to tap",
    (_, skill, hint) => {
      const result = aimHint(skill);

      expect(result).toBe(hint);
    },
  );
});

describe("victimSummary", () => {
  const foe = at(content.slime, 0);
  const enemy = { ...foe, side: "enemy" as const };
  const ally = { ...at(content.fighter, 0), name: "Ada" };
  const ally2 = { ...ally, name: "Bo" };

  it.each<[string, Unit[], string, string[]]>([
    ["nothing", [], "would hit nothing.", []],
    ["one enemy", [enemy], "hits 1 enemy", []],
    ["two enemies", [enemy, enemy], "hits 2 enemies", []],
    [
      "an enemy and two allies",
      [enemy, ally, ally2],
      "hits 1 enemy",
      ["Ada", "Bo"],
    ],
    ["only an ally", [ally], "hits 0 enemies", ["Ada"]],
  ])(
    "given a blast on %s, when it is summed up for the party, then it counts enemies and names allies",
    (_, victims, hits, friends) => {
      const summary = victimSummary(victims, "player");

      expect(summary).toEqual({ hits, friends });
    },
  );
});
