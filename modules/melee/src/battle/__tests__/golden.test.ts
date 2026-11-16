import { describe, expect, it } from "vitest";
import {
  canAfford,
  content,
  createBattle,
  type DamagePreview,
} from "../../../shared";
import { botBattles, digest } from "../../../shared/__tests__/bot";
import { summarizeAction } from "../actionSummary";
import { describeEvent } from "../describeEvent";
import {
  previewClasses,
  previewLabel,
  previewText,
  rowHint,
  skillCost,
  targetHint,
} from "../labels";
import { hitsFrom } from "../useBattle";

// Pins the battle screen's text for whole battles and for every class and
// skill, so refactors that should change nothing can prove it.
describe("golden battle text", () => {
  it("logs, captions and floating numbers stay the same", () => {
    const battles = botBattles(12);
    const text = Object.fromEntries(
      battles.map(({ name, steps }) => {
        let key = 0;
        const lines = steps.map((s) => ({
          log: s.events.map((e) => describeEvent(s.state, e)),
          caption: summarizeAction(s.state, s.events),
          hits: hitsFrom(s.events, () => ++key),
        }));
        return [name, digest(lines)];
      }),
    );
    expect(text).toMatchSnapshot();
  });

  it("skill costs, hints and affordability stay the same", () => {
    const skills = content.playerTypes.flatMap((t) => t.skills ?? []);
    expect(
      skills.map((s) => `${s.name}: ${skillCost(s)} | ${targetHint(s)}`),
    ).toMatchSnapshot();

    const state = createBattle(
      {
        placements: [
          ...content.playerTypes.slice(0, 5).map((def, i) => ({
            def,
            side: "player" as const,
            position: { col: i, row: i % 3 },
          })),
          { def: content.slime, side: "enemy", position: { col: 0, row: 0 } },
        ],
      },
      1,
    );
    const rows = state.units.map((u) => `${u.name}${rowHint(u)}`);
    const afford = state.units.flatMap((u) =>
      skills.flatMap((s) =>
        [0, 5, 15, 16, 100].map((n) => {
          const unit = { ...u, mp: n, hp: n };
          return canAfford(unit, s) ? 1 : 0;
        }),
      ),
    );
    expect({ rows, afford: afford.join("") }).toMatchSnapshot();
  });

  it("damage preview badges stay the same", () => {
    const previews: DamagePreview[] = [0, 0.5, 1, 1.5, 2].flatMap(
      (multiplier) =>
        [false, true].map((knocksOut) => ({
          amount: 24,
          multiplier,
          knocksOut,
        })),
    );
    expect(
      previews.map(
        (p) => `${previewClasses(p)} | ${previewLabel(p)} | ${previewText(p)}`,
      ),
    ).toMatchSnapshot();
  });
});
