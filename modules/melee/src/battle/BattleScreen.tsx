import { useCallback, useEffect, useState } from "react";
import {
  cellOf,
  getUnit,
  previewDamage,
  isAlive,
  ROW_DEALT,
  sameCell,
  skillArea,
  skillVictims,
  unitAt,
  validateCommand,
  type BattleSetup,
  type BattleState,
  type Cell,
  type Command,
  type DamagePreview,
  type Skill,
  type Unit,
} from "../../shared";
import {
  loadBattleSpeed,
  saveBattleSpeed,
  type BattleSpeed,
} from "./battleSpeed";
import { Grid } from "./Grid";
import { TurnOrder } from "./TurnOrder";
import { UnitDetails } from "./UnitDetails";
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

const ROW_LABELS = ["front", "middle", "back"];

/** "15 HP" for Blood Bolt, "24 MP · delayed" for Meteor. */
function skillCost(skill: Skill): string {
  return [
    skill.hpCost ? `${skill.hpCost} HP` : "",
    skill.mpCost || !skill.hpCost ? `${skill.mpCost} MP` : "",
    skill.castTime ? "delayed" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Enough MP, and more HP than an HP cost (it may never be fatal). */
function canAfford(unit: Unit, skill: Skill): boolean {
  return unit.mp >= skill.mpCost && unit.hp > (skill.hpCost ?? 0);
}

/** ", front row: full damage" for melee; ranged weapons ignore rows. */
function rowHint(unit: Unit): string {
  if (unit.weapon.kind !== "melee") return "";
  const row = unit.position.row;
  const dealt = ROW_DEALT[row] ?? 1;
  const effect = dealt === 1 ? "full damage" : `×${dealt} damage`;
  return `, ${ROW_LABELS[row]} row: ${effect}`;
}

export function BattleScreen({
  setup,
  seed,
  onRestart,
  onExit,
}: BattleScreenProps) {
  // The unit whose details are open; time stands still meanwhile.
  const [inspected, setInspected] = useState<string | null>(null);
  // Paused by the player, or because they left the app.
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<BattleSpeed>(loadBattleSpeed);
  const toggleSpeed = () => {
    const next: BattleSpeed = speed === 1 ? 2 : 1;
    setSpeed(next);
    saveBattleSpeed(next);
  };
  const { state, log, hits, actorId, lastAction, actionArea, command } =
    useBattle(setup, seed, paused || inspected !== null, speed);
  const over = state.phase.kind === "over";
  const showPaused = paused && !over;
  usePauseControls(setPaused, over);
  const inspectedUnit = inspected ? getUnit(state, inspected) : null;
  const closeDetails = useCallback(() => setInspected(null), []);
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
    menu.kind === "skill" && aim && active
      ? skillArea(state, active, menu.skill, aim)
      : actionArea;
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
    // While choosing a cleanse target, point at the allies who need it.
    emphasize: (unit: Unit) =>
      menu.kind === "skill" &&
      menu.skill.effect.type === "cleanse" &&
      isAlive(unit) &&
      unit.side === active?.side &&
      unit.statuses.some((s) => s.harmful),
    onInspect: (unit: Unit) => setInspected(unit.id),
    preview: (unit: Unit): DamagePreview | null => {
      if (!active || !isAlive(unit)) return null;
      if (menu.kind === "attack") {
        return canTarget(cellOf(unit)) ? previewDamage(active, unit) : null;
      }
      if (menu.kind !== "skill") return null;
      // An aimed area: everyone it would hit, allies included.
      if (menu.aim) {
        const victims = previewVictims(state, active, menu.skill, menu.aim);
        return victims.includes(unit)
          ? previewDamage(active, unit, menu.skill)
          : null;
      }
      return menu.skill.area === "single" && canTarget(cellOf(unit))
        ? previewDamage(active, unit, menu.skill)
        : null;
    },
  };

  return (
    <main className="battle">
      <header className="battle-header">
        <button type="button" className="link" onClick={onExit}>
          ← Melee
        </button>
        <span className="header-end">
          <span className="muted">Seed {seed}</span>
          {!over && (
            <button
              type="button"
              className="speed-button"
              aria-label={`Battle speed ${speed}×, tap for ${speed === 1 ? 2 : 1}×`}
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
      <Grid side="enemy" {...gridProps} />
      <div className="frontline" aria-hidden="true" />
      <Grid side="player" {...gridProps} />
      <p className="side-label">Party</p>

      <section className="commands">
        <p
          className={`last-action${actorId ? " fresh" : ""}`}
          aria-live="polite"
        >
          {lastAction ?? "Time is moving…"}
        </p>

        {active && menu.kind === "attack" && (
          <>
            <p>
              <strong>{active.name}</strong>'s turn ({active.weapon.name}
              {rowHint(active)}) — tap a highlighted enemy.
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
                menu.aim
                  ? previewVictims(state, active, menu.skill, menu.aim)
                  : []
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
  victims: ReturnType<typeof skillVictims>;
  casterSide: "player" | "enemy";
}

/**
 * Who an area skill would hit if cast now. Shatter destroys its boulder
 * before the blast, so the boulder itself isn't counted.
 */
function previewVictims(
  state: BattleState,
  caster: Unit,
  skill: Skill,
  aim: Cell,
): Unit[] {
  const victims = skillVictims(state, caster, skill, aim);
  if (skill.effect.type !== "shatter") return victims;
  const rock = unitAt(state, aim);
  return victims.filter((u) => u !== rock);
}

/** What to tap for a single-target skill. */
function targetHint(skill: Skill): string {
  if (skill.effect.type === "summon" && skill.effect.anySide) {
    return "tap a highlighted empty cell on either side";
  }
  if (skill.effect.type === "summon" || skill.effect.type === "teleport") {
    return "tap a highlighted empty cell on your side";
  }
  if (skill.effect.type === "heave") return "tap a highlighted unit";
  switch (skill.target) {
    case "self":
      return "tap yourself to use it";
    case "ally":
      return "tap a highlighted ally";
    case "enemy":
      return "tap a highlighted enemy";
    case "any":
      return "tap a highlighted cell";
  }
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
        <strong>{skill.name}</strong> —{" "}
        {skill.effect.type === "shatter"
          ? "tap one of your boulders to aim"
          : skill.area === "reach"
            ? "tap a highlighted enemy to aim"
            : "tap any cell to aim"}
        .
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
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      // Space on a focused button presses it; leave that alone.
      const target = e.target as HTMLElement | null;
      const onControl = target?.closest("button, input, select, textarea");
      if (e.key === "p" || e.key === "P" || (e.key === " " && !onControl)) {
        e.preventDefault();
        setPaused((paused) => !paused);
      } else if (e.key === "Escape") {
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
