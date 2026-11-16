import { describe, expect, it } from "vitest";
import { ALDRIC, MIRA, pair } from "./pair";
import { starterLibrary } from "@jforge/char/shared";
import { createBattle } from "@jforge/melee/shared";
import { formationOf, moveMember } from "../formation";
import {
  battleFor,
  commitBattle,
  parseRun,
  resolveAlly,
  roadOf,
  startRun,
  type Encounter,
  type Run,
} from "../run";

const library = starterLibrary();
const battle: Encounter = {
  kind: "battle",
  difficulty: "easy",
  seed: 5,
  rank: "normal",
};
/** Aldric (a Knight, front row) and Mira (a Sage, back row) at a battle. */
const run: Run = {
  ...startRun(library, 1),
  party: pair(library),
  map: roadOf([battle]),
  position: 0,
  path: [0],
};

describe("formationOf", () => {
  it("stands members in their class's row, from the middle out", () => {
    expect(formationOf(run)).toEqual({
      [ALDRIC]: { col: 2, row: 0 },
      [MIRA]: { col: 2, row: 2 },
    });
    const twins = {
      ...run,
      party: [run.party[0]!, { ...run.party[0]!, id: "b" }],
    };
    expect(formationOf(twins).b).toEqual({ col: 1, row: 0 });
  });

  it("gives everyone a cell of their own, however big the party", () => {
    const crowd = {
      ...run,
      party: Array.from({ length: 5 }, (_, i) => ({
        ...run.party[0]!,
        id: `m${i}`,
      })),
    };
    const cells = Object.values(
      formationOf({
        ...crowd,
        party: [
          ...crowd.party,
          ...crowd.party.map((c) => ({ ...c, id: `x${c.id}` })),
        ],
      }),
    );
    expect(new Set(cells.map((c) => `${c.col},${c.row}`)).size).toBe(10);
  });

  it("keeps where the player put someone, unless it can't be", () => {
    const placed = { ...run, formation: { [MIRA]: { col: 0, row: 1 } } };
    expect(formationOf(placed)[MIRA]).toEqual({ col: 0, row: 1 });
    const off = { ...run, formation: { [MIRA]: { col: 9, row: 1 } } };
    expect(formationOf(off)[MIRA]).toEqual({ col: 2, row: 2 });
    const clash = {
      ...run,
      formation: { [ALDRIC]: { col: 4, row: 1 }, [MIRA]: { col: 4, row: 1 } },
    };
    const cells = formationOf(clash);
    expect(cells[ALDRIC]).toEqual({ col: 4, row: 1 });
    expect(cells[MIRA]).toEqual({ col: 2, row: 2 });
  });

  it("finds a place for a recruit without moving the others", () => {
    const meeting: Run = {
      ...run,
      formation: { [ALDRIC]: { col: 2, row: 2 } },
      map: roadOf([
        {
          kind: "ally",
          character: { ...run.party[1]!, id: "new", name: "Nell" },
        },
      ]),
    };
    const cells = formationOf(resolveAlly(meeting, true));
    expect(cells[ALDRIC]).toEqual({ col: 2, row: 2 });
    expect(cells.new).toEqual({ col: 3, row: 2 });
  });
});

describe("moveMember", () => {
  it("moves a member to an empty cell", () => {
    const moved = moveMember(run, ALDRIC, { col: 4, row: 1 });
    expect(formationOf(moved)).toEqual({
      [ALDRIC]: { col: 4, row: 1 },
      [MIRA]: { col: 2, row: 2 },
    });
  });

  it("swaps places with whoever stands there", () => {
    const moved = moveMember(run, ALDRIC, { col: 2, row: 2 });
    expect(formationOf(moved)).toEqual({
      [ALDRIC]: { col: 2, row: 2 },
      [MIRA]: { col: 2, row: 0 },
    });
  });

  it("refuses cells off the grid, strangers, and standing still", () => {
    expect(moveMember(run, ALDRIC, { col: 5, row: 0 })).toBe(run);
    expect(moveMember(run, ALDRIC, { col: 0, row: 3 })).toBe(run);
    expect(moveMember(run, "nobody", { col: 0, row: 0 })).toBe(run);
    expect(moveMember(run, ALDRIC, { col: 2, row: 0 })).toBe(run);
  });

  it("is locked once the party has acted in the battle", () => {
    const committed = commitBattle(run);
    expect(moveMember(committed, ALDRIC, { col: 0, row: 0 })).toBe(committed);
  });

  it("is saved with the run", () => {
    const moved = moveMember(run, ALDRIC, { col: 4, row: 1 });
    expect(formationOf(parseRun(JSON.stringify(moved))!)).toEqual(
      formationOf(moved),
    );
  });
});

describe("battleFor", () => {
  it("stands the party in formation and leaves the enemies where they were", () => {
    const moved = moveMember(run, MIRA, { col: 0, row: 1 });
    const side = (r: Run, s: string) =>
      battleFor(r)!.placements.filter((p) => p.side === s);
    expect(side(moved, "enemy")).toEqual(side(run, "enemy"));
    expect(side(moved, "player").map((p) => [p.def.name, p.position])).toEqual([
      ["Aldric", { col: 2, row: 0 }],
      ["Mira", { col: 0, row: 1 }],
    ]);
    expect(() => createBattle(battleFor(moved)!, 1)).not.toThrow();
  });
});
