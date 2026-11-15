import { useState } from "react";
import {
  getUnit,
  validateCommand,
  type BattleSetup,
  type Command,
  type Skill,
  type Unit,
} from "../../shared";
import { Grid } from "./Grid";
import { useBattle } from "./useBattle";

interface BattleScreenProps {
  setup: BattleSetup;
  seed: number;
  onRestart: () => void;
  onExit: () => void;
}

/** What the active party member is choosing. */
type Menu =
  { kind: "attack" } | { kind: "skills" } | { kind: "skill"; skill: Skill };

const ATTACK: Menu = { kind: "attack" };

export function BattleScreen({
  setup,
  seed,
  onRestart,
  onExit,
}: BattleScreenProps) {
  const { state, log, hits, actorId, actionText, command } = useBattle(
    setup,
    seed,
  );
  const { phase } = state;
  const active =
    phase.kind === "awaitingCommand" ? getUnit(state, phase.unitId) : null;

  // The menu belongs to one turn; every turn starts on Attack. Game time
  // stands still during a turn and always differs between two turns of the
  // same unit, so unit + time identifies the turn.
  const turn = active ? `${active.id}@${state.time}` : null;
  const [chosen, setChosen] = useState<{ turn: string; menu: Menu } | null>(
    null,
  );
  const menu = turn && chosen?.turn === turn ? chosen.menu : ATTACK;
  const choose = (next: Menu) => turn && setChosen({ turn, menu: next });

  const commandFor = (target: Unit): Command | null => {
    if (menu.kind === "attack") return { type: "attack", targetId: target.id };
    if (menu.kind === "skill") {
      return { type: "skill", skillId: menu.skill.id, targetId: target.id };
    }
    return null;
  };
  const canTarget = (target: Unit) => {
    const c = commandFor(target);
    return (
      active !== null &&
      c !== null &&
      validateCommand(state, active, c) === null
    );
  };
  const onTarget = (target: Unit) => {
    const c = commandFor(target);
    if (c) command(c);
  };
  const gridProps = {
    units: state.units,
    hits,
    activeId: active?.id ?? null,
    actorId,
    canTarget,
    onTarget,
    actionName: menu.kind === "skill" ? menu.skill.name : "Attack",
  };

  return (
    <main className="battle">
      <header className="battle-header">
        <button type="button" className="link" onClick={onExit}>
          ← Melee
        </button>
        <span className="muted">Seed {seed}</span>
      </header>

      <p className="side-label">Enemies</p>
      <Grid side="enemy" {...gridProps} />
      <div className="frontline" aria-hidden="true" />
      <Grid side="player" {...gridProps} />
      <p className="side-label">Party</p>

      <section className="commands" aria-live="polite">
        {phase.kind === "running" && (
          <p className={actionText ? "" : "muted"}>
            {actionText ?? "Time is moving…"}
          </p>
        )}

        {active && menu.kind === "attack" && (
          <>
            <p>
              <strong>{active.name}</strong>'s turn ({active.weapon.name}) — tap
              a highlighted enemy.
            </p>
            <div className="command-list">
              <button
                type="button"
                className="command selected"
                aria-pressed="true"
              >
                Attack
              </button>
              <button
                type="button"
                className="command"
                disabled={active.skills.length === 0}
                onClick={() => choose({ kind: "skills" })}
              >
                Skill
              </button>
            </div>
          </>
        )}

        {active && menu.kind === "skills" && (
          <>
            <p>
              <strong>{active.name}</strong> — choose a skill.{" "}
              <span className="muted">
                MP {active.mp}/{active.base.maxMp}
              </span>
            </p>
            <div className="command-list">
              {active.skills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  className="command"
                  title={skill.description}
                  disabled={active.mp < skill.mpCost}
                  onClick={() => choose({ kind: "skill", skill })}
                >
                  {skill.name} · {skill.mpCost} MP
                </button>
              ))}
              <button
                type="button"
                className="command"
                onClick={() => choose(ATTACK)}
              >
                Back
              </button>
            </div>
          </>
        )}

        {active && menu.kind === "skill" && (
          <>
            <p>
              <strong>{menu.skill.name}</strong> — tap a highlighted{" "}
              {menu.skill.target === "ally" ? "ally" : "enemy"}.
            </p>
            <div className="command-list">
              <button
                type="button"
                className="command"
                onClick={() => choose({ kind: "skills" })}
              >
                Back
              </button>
            </div>
          </>
        )}

        {phase.kind === "over" && (
          <>
            <p className={`result result-${phase.winner ?? "draw"}`}>
              {phase.winner === "player"
                ? "Victory!"
                : phase.winner === "enemy"
                  ? "Defeat…"
                  : "Draw"}
            </p>
            <div className="command-list">
              <button
                type="button"
                className="command selected"
                onClick={onRestart}
              >
                Play again
              </button>
              <button type="button" className="command" onClick={onExit}>
                Back
              </button>
            </div>
          </>
        )}
      </section>

      <ol className="log" aria-label="Battle log">
        {log.slice(0, 6).map((line, i) => (
          <li key={log.length - i}>{line}</li>
        ))}
      </ol>
    </main>
  );
}
