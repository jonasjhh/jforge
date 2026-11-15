import { useState } from "react";
import {
  areaCells,
  getUnit,
  isAlive,
  sameCell,
  skillVictims,
  unitAt,
  validateCommand,
  type BattleSetup,
  type Cell,
  type Command,
  type Skill,
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
  | { kind: "attack" }
  | { kind: "move" }
  | { kind: "skills" }
  /** `aim` is the previewed cell of an area skill, before it is cast. */
  | { kind: "skill"; skill: Skill; aim: Cell | null };

const ATTACK: Menu = { kind: "attack" };

export function BattleScreen({
  setup,
  seed,
  onRestart,
  onExit,
}: BattleScreenProps) {
  const { state, log, hits, actorId, actionText, actionArea, command } =
    useBattle(setup, seed);
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

  const commandFor = (cell: Cell): Command | null => {
    if (menu.kind === "attack") {
      const target = unitAt(state, cell);
      return target ? { type: "attack", targetId: target.id } : null;
    }
    if (menu.kind === "skill") {
      return { type: "skill", skillId: menu.skill.id, cell };
    }
    if (menu.kind === "move" && active && cell.side === active.side) {
      return { type: "move", to: { col: cell.col, row: cell.row } };
    }
    return null;
  };
  const canTarget = (cell: Cell) => {
    const c = commandFor(cell);
    return (
      active !== null &&
      c !== null &&
      validateCommand(state, active, c) === null
    );
  };
  const onTarget = (cell: Cell) => {
    const c = commandFor(cell);
    if (!c) return;
    // Area skills take two taps: the first aims and previews, a second tap
    // on the same cell casts.
    if (menu.kind === "skill" && menu.skill.area !== "single") {
      if (menu.aim && sameCell(menu.aim, cell)) command(c);
      else choose({ ...menu, aim: cell });
      return;
    }
    command(c);
  };

  const aim = menu.kind === "skill" ? menu.aim : null;
  const area =
    menu.kind === "skill" && aim ? areaCells(aim, menu.skill.area) : actionArea;
  const gridProps = {
    state,
    hits,
    activeId: active?.id ?? null,
    actorId,
    canTarget,
    onTarget,
    actionName:
      menu.kind === "skill"
        ? menu.skill.area === "single"
          ? menu.skill.name
          : `Aim ${menu.skill.name} at`
        : menu.kind === "move"
          ? "Move to"
          : "Attack",
    area,
    aim,
    incoming: state.units.flatMap((u) =>
      u.casting && isAlive(u) ? u.casting.area : [],
    ),
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
              <button
                type="button"
                className="command"
                onClick={() => choose({ kind: "move" })}
              >
                Move
              </button>
            </div>
          </>
        )}

        {active && menu.kind === "move" && (
          <>
            <p>
              <strong>{active.name}</strong> — tap a highlighted cell to step
              there. <span className="muted">Moving costs half a turn.</span>
            </p>
            <div className="command-list">
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
                  onClick={() => choose({ kind: "skill", skill, aim: null })}
                >
                  {skill.name} · {skill.mpCost} MP
                  {skill.castTime ? " · delayed" : ""}
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
            <SkillPrompt
              skill={menu.skill}
              aim={menu.aim}
              victims={
                menu.aim ? skillVictims(state, menu.skill, menu.aim) : []
              }
              casterSide={active.side}
            />
            <div className="command-list">
              {menu.aim && (
                <button
                  type="button"
                  className="command selected"
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

interface SkillPromptProps {
  skill: Skill;
  aim: Cell | null;
  victims: ReturnType<typeof skillVictims>;
  casterSide: "player" | "enemy";
}

function SkillPrompt({ skill, aim, victims, casterSide }: SkillPromptProps) {
  if (skill.area === "single") {
    return (
      <p>
        <strong>{skill.name}</strong> — tap a highlighted{" "}
        {skill.target === "ally" ? "ally" : "enemy"}.
      </p>
    );
  }
  if (!aim) {
    return (
      <p>
        <strong>{skill.name}</strong> — tap any cell to aim.
        {skill.castTime && (
          <span className="muted">
            {" "}
            It lands after a delay: whoever stands in the zone then is hit.
          </span>
        )}
      </p>
    );
  }
  const foes = victims.filter((u) => u.side !== casterSide);
  const friends = victims.filter((u) => u.side === casterSide);
  return (
    <p>
      <strong>{skill.name}</strong>{" "}
      {victims.length === 0
        ? "would hit nothing."
        : `hits ${foes.length} ${foes.length === 1 ? "enemy" : "enemies"}`}
      {friends.length > 0 && (
        <span className="warn">
          {" "}
          and {friends.map((u) => u.name).join(", ")}!
        </span>
      )}
      {victims.length > 0 && friends.length === 0 && "."}{" "}
      <span className="muted">Tap again to cast.</span>
    </p>
  );
}
