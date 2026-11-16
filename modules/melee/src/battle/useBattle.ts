import { useCallback, useEffect, useRef, useState } from "react";
import {
  act,
  advance,
  createBattle,
  type BattleEvent,
  type BattleSetup,
  type Cell,
  type BattleState,
  type Command,
  type StepResult,
} from "../../shared";
import { findAction, summarizeAction } from "./actionSummary";
import { describeEvent } from "./describeEvent";
import { resistanceKind } from "./labels";

/** Game time per real second at 1×. Speed 10 fills a gauge in about 1.7 s. */
export const TIME_SCALE = 60;
/** How long time stays frozen to show an action, at 1×. */
export const ACTION_MS = 700;
/** Longest frame step, so a background tab doesn't jump time ahead. */
const MAX_FRAME_MS = 100;
const LOG_LINES = 40;

export interface Hit {
  key: number;
  unitId: string;
  amount: number;
  kind: "damage" | "heal";
  /** How the target's resistance changed a damage hit, or a shield took it. */
  tag?: "weak" | "resist" | "immune" | "shield";
  /** Damage from an effect over time, e.g. poison. */
  overTime?: boolean;
}

export interface BattleView {
  state: BattleState;
  log: string[];
  /** Damage and heal numbers from the latest action, keyed to replay. */
  hits: Hit[];
  /** The unit that acted last, while its action is being shown. */
  actorId: string | null;
  /** The latest action and its result, kept until the next action. */
  lastAction: string | null;
  /** Cells covered by the area skill being shown, for the blast effect. */
  actionArea: Cell[];
  command: (command: Command) => void;
}

/**
 * Plays a battle in real time: gauges fill frame by frame, AI units act
 * when ready, and time freezes while a player unit waits for a command and
 * while each action is shown. `paused` stops time too (e.g. while the
 * player reads a unit's details). `speed` multiplies how fast time runs
 * and shortens the action pauses to match.
 */
export function useBattle(
  setup: BattleSetup,
  seed: number,
  paused = false,
  speed = 1,
): BattleView {
  const [state, setState] = useState(() => createBattle(setup, seed));
  const [log, setLog] = useState<string[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [actorId, setActorId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [actionArea, setActionArea] = useState<Cell[]>([]);
  const stateRef = useRef(state);
  const frozenUntil = useRef(0);
  const hitKey = useRef(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const apply = useCallback((step: StepResult) => {
    stateRef.current = step.state;
    setState(step.state);
    if (step.events.length === 0) return;

    const lines = step.events
      .map((e) => describeEvent(step.state, e))
      .filter((line): line is string => line !== null);
    if (lines.length)
      setLog((old) => [...lines.reverse(), ...old].slice(0, LOG_LINES));

    const action = findAction(step.events);
    if (action) {
      setActorId(action.unitId);
      setLastAction(summarizeAction(step.state, step.events));
      setActionArea(
        (action.type === "skill" || action.type === "castStarted") &&
          action.area.length > 1
          ? action.area
          : [],
      );
      frozenUntil.current = performance.now() + ACTION_MS / speedRef.current;
    }
    // Numbers to float up: from the action, or from effects over time,
    // which tick without pausing the battle.
    const hits = hitsFrom(step.events, () => ++hitKey.current);
    if (action || hits.length > 0) setHits(hits);
  }, []);

  const running = state.phase.kind === "running";
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, MAX_FRAME_MS);
      last = now;
      if (pausedRef.current) {
        // Hold any action being shown until time runs again.
        frozenUntil.current = Math.max(frozenUntil.current, now);
      } else if (now >= frozenUntil.current) {
        setActorId(null);
        setActionArea([]);
        const current = stateRef.current;
        apply(
          advance(current, {
            until: current.time + (dt / 1000) * TIME_SCALE * speedRef.current,
            stopAfterAction: true,
          }),
        );
      }
      if (stateRef.current.phase.kind === "running") {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, apply]);

  const command = useCallback(
    (c: Command) => {
      if (stateRef.current.phase.kind !== "awaitingCommand") return;
      apply(act(stateRef.current, c));
    },
    [apply],
  );

  return { state, log, hits, actorId, lastAction, actionArea, command };
}

/** Damage and heal numbers to float up for a step's events. */
export function hitsFrom(events: BattleEvent[], nextKey: () => number): Hit[] {
  return events.flatMap((e): Hit[] => {
    if (e.type === "heal" || (e.type === "statusTick" && e.effect === "heal")) {
      if (e.amount <= 0) return [];
      return [
        { key: nextKey(), unitId: e.unitId, amount: e.amount, kind: "heal" },
      ];
    }
    if (e.type === "statusTick") {
      if (e.amount <= 0) return [];
      return [
        {
          key: nextKey(),
          unitId: e.unitId,
          amount: e.amount,
          kind: "damage",
          overTime: true,
        },
      ];
    }
    if (e.type !== "damage") return [];
    return [
      {
        key: nextKey(),
        unitId: e.unitId,
        amount: e.amount,
        kind: "damage",
        // A hit fully soaked by a shield shows as SHIELD.
        tag:
          e.amount === 0 && e.absorbed
            ? "shield"
            : resistanceKind(e.multiplier),
      },
    ];
  });
}
