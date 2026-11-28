import { describe, expect, it } from "vitest";
import { ALDRIC, MIRA, pair } from "./pair";
import { jrpgLibrary } from "@jforge/content/jrpg";
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

const library = jrpgLibrary();
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
  it("given a knight and a sage nobody has placed, when the formation is worked out, then each stands mid-row in their class's row", () => {
    const cells = formationOf(run);

    expect(cells).toEqual({
      [ALDRIC]: { col: 2, row: 0 },
      [MIRA]: { col: 2, row: 2 },
    });
  });

  it("given two front-row members, when the formation is worked out, then the second stands next to the middle", () => {
    const twins = {
      ...run,
      party: [run.party[0]!, { ...run.party[0]!, id: "b" }],
    };

    const cells = formationOf(twins);

    expect(cells.b).toEqual({ col: 1, row: 0 });
  });

  it("given ten front-row members, when the formation is worked out, then each has a cell of their own", () => {
    const crowd = {
      ...run,
      party: Array.from({ length: 10 }, (_, i) => ({
        ...run.party[0]!,
        id: `m${i}`,
      })),
    };

    const cells = Object.values(formationOf(crowd));

    expect(new Set(cells.map((c) => `${c.col},${c.row}`)).size).toBe(10);
  });

  it("given a member the player placed, when the formation is worked out, then they stay there", () => {
    const placed = { ...run, formation: { [MIRA]: { col: 0, row: 1 } } };

    const cells = formationOf(placed);

    expect(cells[MIRA]).toEqual({ col: 0, row: 1 });
  });

  it("given a member placed off the grid, when the formation is worked out, then they stand in their usual cell", () => {
    const off = { ...run, formation: { [MIRA]: { col: 9, row: 1 } } };

    const cells = formationOf(off);

    expect(cells[MIRA]).toEqual({ col: 2, row: 2 });
  });

  it("given two members placed in one cell, when the formation is worked out, then the first keeps it and the second stands in their usual cell", () => {
    const clash = {
      ...run,
      formation: { [ALDRIC]: { col: 4, row: 1 }, [MIRA]: { col: 4, row: 1 } },
    };

    const cells = formationOf(clash);

    expect(cells[ALDRIC]).toEqual({ col: 4, row: 1 });
    expect(cells[MIRA]).toEqual({ col: 2, row: 2 });
  });

  it("given a placed party, when a recruit joins, then the recruit finds a cell without moving the others", () => {
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
  it("given an empty cell, when a member is moved there, then they stand in it", () => {
    const moved = moveMember(run, ALDRIC, { col: 4, row: 1 });

    expect(formationOf(moved)).toEqual({
      [ALDRIC]: { col: 4, row: 1 },
      [MIRA]: { col: 2, row: 2 },
    });
  });

  it("given a cell someone stands in, when a member is moved there, then the two swap places", () => {
    const moved = moveMember(run, ALDRIC, { col: 2, row: 2 });

    expect(formationOf(moved)).toEqual({
      [ALDRIC]: { col: 2, row: 2 },
      [MIRA]: { col: 2, row: 0 },
    });
  });

  it.each([
    ["a column off the grid", ALDRIC, { col: 5, row: 0 }],
    ["a row off the grid", ALDRIC, { col: 0, row: 3 }],
    ["someone not in the party", "nobody", { col: 0, row: 0 }],
    ["the cell they stand in", ALDRIC, { col: 2, row: 0 }],
  ])(
    "given %s, when the move is made, then the run is unchanged",
    (_, id, cell) => {
      const moved = moveMember(run, id, cell);

      expect(moved).toBe(run);
    },
  );

  it("given the party has acted in the battle, when a member is moved, then the formation is locked", () => {
    const committed = commitBattle(run);

    const moved = moveMember(committed, ALDRIC, { col: 0, row: 0 });

    expect(moved).toBe(committed);
  });

  it("given a moved member, when the run is saved and parsed, then the formation is kept", () => {
    const moved = moveMember(run, ALDRIC, { col: 4, row: 1 });

    const back = parseRun(JSON.stringify(moved))!;

    expect(formationOf(back)).toEqual(formationOf(moved));
  });
});

describe("battleFor", () => {
  const side = (r: Run, s: string) =>
    battleFor(r)!.placements.filter((p) => p.side === s);

  it("given a moved member, when the battle is set up, then the party stands in formation and the enemies where they were", () => {
    const moved = moveMember(run, MIRA, { col: 0, row: 1 });

    const players = side(moved, "player");

    expect(side(moved, "enemy")).toEqual(side(run, "enemy"));
    expect(players.map((p) => [p.def.name, p.position])).toEqual([
      ["Aldric", { col: 2, row: 0 }],
      ["Mira", { col: 0, row: 1 }],
    ]);
  });

  it("given a moved member, when the battle starts, then melee accepts it", () => {
    const moved = moveMember(run, MIRA, { col: 0, row: 1 });

    const start = () => createBattle(battleFor(moved)!, 1);

    expect(start).not.toThrow();
  });
});
