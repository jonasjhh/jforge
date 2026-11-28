import { describe, expect, it } from "vitest";
import { autobLibrary } from "@jforge/content/autob";
import { botRound, botRun } from "../bot";
import { startRun } from "../run";

const library = autobLibrary();

describe("botRound", () => {
  it("given a new run, when the bot plays a round, then it has fielded a unit and moved on to round 2", () => {
    const run = startRun(library, 1);

    const next = botRound(run);

    expect(next.round).toBe(2);
    expect(next.board.length).toBeGreaterThan(0);
  });

  it("given a run with nothing to buy, when the bot plays a round, then it loses it", () => {
    const run = { ...startRun(library, 1), gold: 0 };

    const next = botRound(run);

    expect(next.last).toEqual({ round: 1, won: false });
  });
});

describe("botRun", () => {
  it("given a new run, when the bot plays it out, then it ends", () => {
    const run = startRun(library, 2);

    const done = botRun(run);

    expect(done.outcome).not.toBe("playing");
  });
});
