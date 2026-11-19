import { useCallback, useEffect, useState } from "react";
import {
  canAfford,
  getUnit,
  skillVictims,
  type BattleSetup,
  type Cell,
  type Command,
  type Side,
  type Skill,
  type Unit,
} from "../../shared";
import {
  loadBattleSpeed,
  nextSpeed,
  saveBattleSpeed,
  type BattleSpeed,
} from "./battleSpeed";
import { Grid } from "./Grid";
import {
  aimHint,
  resultText,
  rowHint,
  skillCost,
  targetHint,
  victimSummary,
} from "./labels";
import { pauseKeyAction } from "./pauseKeys";
import {
  actionName,
  aimedArea,
  ATTACK,
  canTarget,
  emphasized,
  incomingCells,
  previewFor,
  tap,
  turnKey,
  type Menu,
} from "./turnMenu";
import { TurnOrder } from "./TurnOrder";
import { UnitDetails } from "./UnitDetails";
import { coveredAfterMove, coveredFrom } from "./cover";
import { useBattle } from "./useBattle";

interface BattleScreenProps {
  setup: BattleSetup;
  seed: number;
  /** After a battle: `won` starts a new encounter, otherwise a retry. */
  onRestart: (won: boolean) => void;
  onExit: () => void;
  /** Called once, when the player gives the battle's first command. */
  onCommit?: () => void;
  /** Starts the battle over; offered once the player has given a command. */
  onRetry?: () => void;
  /** Wording for a host other than melee's own start screen (jrpg). */
  labels?: Partial<BattleLabels>;
}

export interface BattleLabels {
  /** The way out, in the header. */
  exit: string;
  /** The way out once the player has given a command (default: `exit`). */
  exitCommitted?: string;
  /** The main button after a victory, and after a defeat or draw. */
  won: string;
  lost: string;
  /** The second button once the battle is over; null leaves it out. */
  back: string | null;
}

const MELEE_LABELS: BattleLabels = {
  exit: "← Melee",
  won: "Next battle",
  lost: "Try again",
  back: "Back",
};

export function BattleScreen({
  setup,
  seed,
  onRestart,
  onExit,
  onCommit,
  onRetry,
  labels,
}: BattleScreenProps) {
  const text = { ...MELEE_LABELS, ...labels };
  // Whether the player has given a command in this battle yet.
  const [committed, setCommitted] = useState(false);
  // The unit whose details are open; time stands still meanwhile.
  const [inspected, setInspected] = useState<string | null>(null);
  // Paused by the player, or because they left the app.
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<BattleSpeed>(loadBattleSpeed);
  const toggleSpeed = () => {
    const next = nextSpeed(speed);
    setSpeed(next);
    saveBattleSpeed(next);
  };
  const {
    state,
    log,
    hits,
    actorId,
    lastAction,
    actionArea,
    coveredIds,
    command: send,
  } = useBattle(setup, seed, paused || inspected !== null, speed);
  const command = (given: Command) => {
    if (!committed) {
      setCommitted(true);
      onCommit?.();
    }
    send(given);
  };
  const over = state.phase.kind === "over";
  const showPaused = paused && !over;
  usePauseControls(setPaused, over);
  const inspectedUnit = inspected ? getUnit(state, inspected) : null;
  const closeDetails = useCallback(() => setInspected(null), []);
  const { phase } = state;
  const active =
    phase.kind === "awaitingCommand" ? getUnit(state, phase.unitId) : null;

  // The menu belongs to one turn; every turn starts on Attack.
  const turn = turnKey(state, active);
  const [chosen, setChosen] = useState<{ turn: string; menu: Menu } | null>(
    null,
  );
  const menu = turn && chosen?.turn === turn ? chosen.menu : ATTACK;
  const choose = (next: Menu) => turn && setChosen({ turn, menu: next });

  const onTarget = (cell: Cell) => {
    if (!active) return;
    const result = tap(state, active, menu, cell);
    if (result?.type === "aim") choose(result.menu);
    else if (result) command(result.command);
  };

  const aim = menu.kind === "skill" ? menu.aim : null;
  const gridProps = {
    state,
    hits,
    activeId: active?.id ?? null,
    actorId,
    canTarget: (cell: Cell) => canTarget(state, active, menu, cell),
    onTarget,
    actionName: actionName(menu),
    area: aimedArea(state, active, menu) ?? actionArea,
    aim,
    incoming: incomingCells(state),
    emphasize: (unit: Unit) => emphasized(active, menu, unit),
    onInspect: (unit: Unit) => setInspected(unit.id),
    preview: (unit: Unit) => previewFor(state, active, menu, unit),
    covered: (unit: Unit) =>
      coveredIds.includes(unit.id) || coveredFrom(state, active, menu, unit),
    coveredCell: (cell: Cell) => coveredAfterMove(state, active, menu, cell),
  };

  return (
    <main className="battle">
      <header className="battle-header">
        <button type="button" className="link" onClick={onExit}>
          {committed ? (text.exitCommitted ?? text.exit) : text.exit}
        </button>
        <span className="header-end">
          <span className="muted">Seed {seed}</span>
          {!over && committed && onRetry && (
            <button
              type="button"
              className="speed-button"
              aria-label="Restart battle"
              title="Restart battle"
              onClick={onRetry}
            >
              ↺
            </button>
          )}
          {!over && (
            <button
              type="button"
              className="speed-button"
              aria-label={`Battle speed ${speed}×, tap for ${nextSpeed(speed)}×`}
              onClick={toggleSpeed}
            >
              {speed}×
            </button>
          )}
          {!over && (
            <button
              type="button"
              className="pause-button"
              aria-label="Pause"
              onClick={() => setPaused(true)}
            >
              <span className="pause-icon" aria-hidden="true" />
            </button>
          )}
        </span>
      </header>

      <TurnOrder state={state} />
      <p className="side-label">Enemies</p>
      <div className="board">
        <Grid side="enemy" {...gridProps} />
        <div className="frontline" aria-hidden="true" />
        <Grid side="player" {...gridProps} />
      </div>
      <p className="side-label">Party</p>

      <section className="commands">
        <p
          className={`last-action${actorId ? " fresh" : ""}`}
          aria-live="polite"
        >
          {lastAction ?? "Time is moving…"}
        </p>

        {active && (
          <ModeTabs
            mode={menu.kind === "skill" ? "skills" : menu.kind}
            hasSkills={active.skills.length > 0}
            onChoose={(kind) => choose({ kind })}
          />
        )}

        {active && menu.kind === "attack" && (
          <p>
            <strong>{active.name}</strong>'s turn ({active.weapon.name}
            {rowHint(active)}) — tap a highlighted enemy.
          </p>
        )}

        {active && menu.kind === "move" && (
          <p>
            <strong>{active.name}</strong> — tap a highlighted cell to step
            there. <span className="muted">Moving costs half a turn.</span>
          </p>
        )}

        {active && (menu.kind === "attack" || menu.kind === "move") && (
          <div className="command-list">
            <button
              type="button"
              className="command"
              title="Halve the hits you take until your next turn"
              onClick={() => command({ type: "defend" })}
            >
              Defend
            </button>
            <button
              type="button"
              className="command"
              title="Do nothing now and act again sooner"
              onClick={() => command({ type: "wait" })}
            >
              Wait
            </button>
          </div>
        )}

        {active && menu.kind === "skills" && (
          <>
            <p>
              <strong>{active.name}</strong> — choose a skill.{" "}
              <span className="muted">
                MP {active.mp}/{active.base.maxMp}
              </span>
            </p>
            <div className="skill-list">
              {active.skills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  className="skill-option"
                  disabled={!canAfford(active, skill)}
                  onClick={() => choose({ kind: "skill", skill, aim: null })}
                >
                  <span className="skill-head">
                    <span className="skill-name">{skill.name}</span>
                    <span className="skill-cost">{skillCost(skill)}</span>
                  </span>
                  <span className="skill-description">{skill.description}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {active && menu.kind === "skill" && (
          <>
            <SkillPrompt
              skill={menu.skill}
              aim={menu.aim}
              victims={
                menu.aim
                  ? skillVictims(state, active, menu.skill, menu.aim)
                  : []
              }
              casterSide={active.side}
            />
            <div className="command-list">
              <button
                type="button"
                className="command"
                onClick={() => choose({ kind: "skills" })}
              >
                ← Skills
              </button>
              {menu.aim && (
                <button
                  type="button"
                  className="command action"
                  onClick={() =>
                    menu.aim &&
                    command({
                      type: "skill",
                      skillId: menu.skill.id,
                      cell: menu.aim,
                    })
                  }
                >
                  Cast
                </button>
              )}
            </div>
          </>
        )}

        {phase.kind === "over" && (
          <>
            <p className={`result result-${phase.winner ?? "draw"}`}>
              {resultText(phase.winner)}
            </p>
            <div className="command-list">
              <button
                type="button"
                className="command action"
                onClick={() => onRestart(phase.winner === "player")}
              >
                {phase.winner === "player" ? text.won : text.lost}
              </button>
              {text.back !== null && (
                <button type="button" className="command" onClick={onExit}>
                  {text.back}
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <ol className="log" aria-label="Battle log">
        {log.slice(0, 6).map((line, i) => (
          <li key={log.length - i}>{line}</li>
        ))}
      </ol>
      {showPaused && (
        <button
          type="button"
          className="pause-overlay"
          onClick={() => setPaused(false)}
          autoFocus
        >
          <span className="pause-title">Paused</span>
          <span className="pause-hint">Tap to resume</span>
        </button>
      )}
      {inspectedUnit && (
        <UnitDetails
          unit={inspectedUnit}
          time={state.time}
          speed={speed}
          onClose={closeDetails}
        />
      )}
    </main>
  );
}

interface SkillPromptProps {
  skill: Skill;
  aim: Cell | null;
  victims: Unit[];
  casterSide: Side;
}

function SkillPrompt({ skill, aim, victims, casterSide }: SkillPromptProps) {
  if (skill.area === "single") {
    return (
      <p>
        <strong>{skill.name}</strong> — {targetHint(skill)}.
      </p>
    );
  }
  if (!aim) {
    return (
      <p>
        <strong>{skill.name}</strong> — {aimHint(skill)}.
        {skill.castTime && (
          <span className="muted">
            {" "}
            It lands after a delay: whoever stands in the zone then is hit.
          </span>
        )}
      </p>
    );
  }
  const { hits, friends } = victimSummary(victims, casterSide);
  return (
    <p>
      <strong>{skill.name}</strong> {hits}
      {friends.length > 0 && (
        <span className="warn"> and {friends.join(", ")}!</span>
      )}
      {victims.length > 0 && friends.length === 0 && "."}{" "}
      <span className="muted">Tap again to cast.</span>
    </p>
  );
}

/**
 * Pausing from outside the screen's buttons: P or Space toggles it (Escape
 * resumes) on a keyboard, and leaving the app pauses so the battle doesn't
 * carry on the moment the player comes back.
 */
function usePauseControls(
  setPaused: (update: (paused: boolean) => boolean) => void,
  over: boolean,
) {
  useEffect(() => {
    if (over) return;
    const onVisibility = () => {
      if (document.hidden) setPaused(() => true);
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const action = pauseKeyAction({
        key: e.key,
        repeat: e.repeat,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        onControl: !!target?.closest?.("button, input, select, textarea"),
      });
      if (action === "toggle") {
        e.preventDefault();
        setPaused((paused) => !paused);
      } else if (action === "resume") {
        setPaused(() => false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
    };
  }, [setPaused, over]);
}

type Mode = "attack" | "skills" | "move";

const MODES: [Mode, string][] = [
  ["attack", "Attack"],
  ["skills", "Skill"],
  ["move", "Move"],
];

interface ModeTabsProps {
  mode: Mode;
  hasSkills: boolean;
  onChoose: (mode: Mode) => void;
}

/**
 * What a tap on the board will do: attack, pick a skill or move. A mode,
 * not an action, so it is a segmented control rather than buttons.
 */
function ModeTabs({ mode, hasSkills, onChoose }: ModeTabsProps) {
  return (
    <div className="segmented mode-tabs" role="group" aria-label="Action">
      {MODES.map(([kind, label]) => (
        <button
          key={kind}
          type="button"
          className={kind === mode ? "selected" : ""}
          aria-pressed={kind === mode}
          disabled={kind === "skills" && !hasSkills}
          onClick={() => onChoose(kind)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
