import { describe, expect, it } from "vitest";
import { act, advance, createBattle } from "../battle";
import { cure, regen, venomFangs } from "../content";
import { applyStatus } from "../status";
import type { BattleEvent, BattleState, StatusDef } from "../types";
import { def, place } from "./helpers";

const poison = venomFangs.onHit!;
const regenStatus = (regen.effect as { type: "status"; status: StatusDef })
  .status;

/** The healer is waiting for a command; the patient carries `statuses`. */
function waiting(statuses: StatusDef[]): BattleState {
  const healer = {
    ...def("healer", { magic: 10, attack: 10, maxMp: 20, speed: 50 }),
    skills: [cure],
  };
  const state = createBattle(
    {
      placements: [
        place(healer, "player", 0),
        place(def("patient", { maxHp: 200, speed: 1 }), "player", 1),
        place(def("dummy", { maxHp: 1000, attack: 0, speed: 0 }), "enemy", 0),
      ],
    },
    1,
  );
  const [healerUnit, patient] = state.units;
  for (const s of statuses) applyStatus(state, healerUnit!, patient!, s, []);
  return advance(state).state;
}

const cureOn = (state: BattleState, col: number) =>
  act(state, {
    type: "skill",
    skillId: "cure",
    cell: { side: "player", col, row: 0 },
  });
const patient = (s: BattleState) => s.units.find((u) => u.id === "player-1-0")!;

describe("Cure", () => {
  it("given a patient poisoned and regenerating, when cured, then the poison goes, Regen stays and MP is spent", () => {
    const state = waiting([poison, regenStatus]);

    const { state: after, events } = cureOn(state, 1);

    expect(patient(after).statuses.map((s) => s.id)).toEqual(["regen"]);
    expect(events).toContainEqual({
      type: "statusRemoved",
      unitId: "player-1-0",
      statusId: "poison",
      name: "Poison",
    });
    expect(after.units[0]!.mp).toBe(20 - cure.mpCost);
  });

  it("given a patient with nothing harmful, when cured, then nothing is removed", () => {
    const state = waiting([regenStatus]);

    const { state: after, events } = cureOn(state, 1);

    expect(patient(after).statuses.map((s) => s.id)).toEqual(["regen"]);
    expect(events.some((e) => e.type === "statusRemoved")).toBe(false);
  });

  it("given a cured patient, when time runs on, then poison doesn't tick again", () => {
    const { state } = cureOn(waiting([poison]), 1);
    const hpAfterCure = patient(state).hp;
    const events: BattleEvent[] = [];
    let current = state;

    for (let i = 0; i < 20 && current.time < 300; i++) {
      if (current.phase.kind === "awaitingCommand") {
        current = act(current, { type: "attack", targetId: "enemy-0-0" }).state;
        continue;
      }
      const step = advance(current, { until: 300 });
      events.push(...step.events);
      current = step.state;
    }

    expect(events.some((e) => e.type === "statusTick")).toBe(false);
    expect(patient(current).hp).toBe(hpAfterCure);
  });
});
