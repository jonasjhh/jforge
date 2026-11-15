import { useCallback, useEffect, useRef, useState } from "react";
import {
  act,
  advance,
  createBattle,
  type BattleSetup,
  type Cell,
  type BattleState,
  type Command,
  type StepResult,
} from "../../shared";
import { describeEvent } from "./describeEvent";

/** Game time per real second. Speed 10 fills a gauge in about 1.7 s. */
const TIME_SCALE = 60;
/** How long time stays frozen to show an action. */
export const ACTION_MS = 700;
/** Longest frame step, so a background tab doesn't jump time ahead. */
const MAX_FRAME_MS = 100;
const LOG_LINES = 40;

export interface Hit {
  key: number;
  unitId: string;
  amount: number;
  kind: "damage" | "heal";
  /** How the target's resistance changed a damage hit. */
  tag?: "weak" | "resist" | "immune";
}

export interface BattleView {
  state: BattleState;
  log: string[];
  /** Damage and heal numbers from the latest action, keyed to replay. */
  hits: Hit[];
  /** The unit that acted last, while its action is being shown. */
  actorId: string | null;
  /** Log line for the action being shown. */
  actionText: string | null;
  /** Cells covered by the area skill being shown, for the blast effect. */
  actionArea: Cell[];
  command: (command: Command) => void;
}

/**
 * Plays a battle in real time: gauges fill frame by frame, AI units act
 * when ready, and time freezes while a player unit waits for a command and
 * while each action is shown.
 */
export function useBattle(setup: BattleSetup, seed: number): BattleView {
  const [state, setState] = useState(() => createBattle(setup, seed));
  const [log, setLog] = useState<string[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [actorId, setActorId] = useState<string | null>(null);
  const [actionText, setActionText] = useState<string | null>(null);
  const [actionArea, setActionArea] = useState<Cell[]>([]);
  const stateRef = useRef(state);
  const frozenUntil = useRef(0);
  const hitKey = useRef(0);

  const apply = useCallback((step: StepResult) => {
    stateRef.current = step.state;
    setState(step.state);
    if (step.events.length === 0) return;

    const lines = step.events
      .map((e) => describeEvent(step.state, e))
      .filter((line): line is string => line !== null);
    if (lines.length)
      setLog((old) => [...lines.reverse(), ...old].slice(0, LOG_LINES));

    const action = step.events.find(
      (e) =>
        e.type === "attack" ||
        e.type === "skill" ||
        e.type === "moved" ||
        e.type === "castStarted",
    );
    if (
      action &&
      (action.type === "attack" ||
        action.type === "skill" ||
        action.type === "moved" ||
        action.type === "castStarted")
    ) {
      setActorId(action.unitId);
      setActionText(describeEvent(step.state, action));
      setActionArea(
        (action.type === "skill" || action.type === "castStarted") &&
          action.area.length > 1
          ? action.area
          : [],
      );
      frozenUntil.current = performance.now() + ACTION_MS;
      setHits(
        step.events.flatMap((e): Hit[] => {
          if (e.type === "heal") {
            return [
              {
                key: ++hitKey.current,
                unitId: e.unitId,
                amount: e.amount,
                kind: "heal",
              },
            ];
          }
          if (e.type !== "damage") return [];
          return [
            {
              key: ++hitKey.current,
              unitId: e.unitId,
              amount: e.amount,
              kind: "damage",
              tag: resistanceTag(e.multiplier),
            },
          ];
        }),
      );
    }
  }, []);

  const running = state.phase.kind === "running";
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, MAX_FRAME_MS);
      last = now;
      if (now >= frozenUntil.current) {
        setActorId(null);
        setActionText(null);
        setActionArea([]);
        const current = stateRef.current;
        apply(
          advance(current, {
            until: current.time + (dt / 1000) * TIME_SCALE,
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

  return { state, log, hits, actorId, actionText, actionArea, command };
}

function resistanceTag(multiplier: number): Hit["tag"] {
  if (multiplier === 0) return "immune";
  if (multiplier > 1) return "weak";
  if (multiplier < 1) return "resist";
  return undefined;
}
