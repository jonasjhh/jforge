import {
  getUnit,
  validateCommand,
  type BattleSetup,
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

  const canTarget = (target: Unit) =>
    active !== null &&
    validateCommand(state, active, { type: "attack", targetId: target.id }) ===
      null;
  const onTarget = (target: Unit) =>
    command({ type: "attack", targetId: target.id });
  const gridProps = {
    units: state.units,
    hits,
    activeId: active?.id ?? null,
    actorId,
    canTarget,
    onTarget,
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
        {active && (
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
                disabled
                title="Skills arrive in phase 2"
              >
                Skill
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
