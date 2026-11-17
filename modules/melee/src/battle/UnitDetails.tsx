import { useEffect } from "react";
import {
  AMBUSH_POWER,
  BLESS_DEALT,
  BLESS_TAKEN,
  PETRIFY_TAKEN,
  STONE_SKIN_DEFENSE,
  EXPOSE_FACTOR,
  WEAKEN_FACTOR,
  effectiveStat,
  isAlive,
  type Modifier,
  type StatName,
  type Status,
  type Unit,
} from "../../shared";
import { Portrait } from "./Portrait";
import { TIME_SCALE } from "./useBattle";

interface UnitDetailsProps {
  unit: Unit;
  /** Game time now, for how long effects have left. */
  time: number;
  /** Battle speed, to give times left in real seconds. */
  speed: number;
  onClose: () => void;
}

const STATS: [StatName, string][] = [
  ["attack", "Attack"],
  ["defense", "Defense"],
  ["magic", "Magic"],
  ["spirit", "Spirit"],
  ["speed", "Speed"],
];

/** Game time as real seconds at the battle's speed: "4s". */
function seconds(gameTime: number, speed: number): string {
  return `${Math.max(1, Math.ceil(gameTime / (TIME_SCALE * speed)))}s`;
}

function statusText(status: Status, speed: number): string {
  const every = seconds(status.interval, speed);
  switch (status.effect) {
    case "heal":
      return `Regains ${status.amount} HP every ${every}.`;
    case "damage":
      return `Takes ${status.amount} ${status.damageType ?? ""} damage every ${every}.`;
    case "stealth":
      return `Hidden: single-target attacks and skills can't pick it. Its next attack deals ×${AMBUSH_POWER}.`;
    case "shield":
      return `Absorbs the next ${status.amount} damage.`;
    case "ward":
      return "Can't be knocked out: a fatal hit leaves 1 HP.";
    case "taunt":
      return "Provoking: enemies that single out a target must pick it.";
    case "expose":
      return `Exposed: takes ×${EXPOSE_FACTOR} damage of every type.`;
    case "silence":
      return "Silenced: can't use skills.";
    case "guard":
      return "Guarded: enemies' single-target hits on it land on its guardian.";
    case "weaken":
      return `Weakened: deals ×${WEAKEN_FACTOR} damage.`;
    case "coat":
      return "Coated blade: every weapon hit poisons its target.";
    case "smoke":
      return "In smoke: enemies can't single it out (areas still hit it).";
    case "stoneSkin":
      return `Stone Skin: defense ×${STONE_SKIN_DEFENSE}, can't be pushed or pulled.`;
    case "petrify":
      return `Petrified: can't act, takes ×${PETRIFY_TAKEN} damage.`;
    case "bless":
      return `Blessed: deals ×${BLESS_DEALT} damage and takes ×${BLESS_TAKEN}.`;
    case "bomb":
      return `Explodes when time runs out or it falls: ${status.amount} ${status.damageType ?? ""} damage to it and its neighbours.`;
  }
}

/** When a status's last tick lands. */
function statusEnds(status: Status): number {
  return status.nextTickAt + (status.ticksLeft - 1) * status.interval;
}

function modifierText(mod: Modifier): string {
  const amount = mod.op === "mul" ? `×${mod.value}` : `+${mod.value}`;
  return `${mod.stat[0]!.toUpperCase()}${mod.stat.slice(1)} ${amount}.`;
}

/** "fire ×2, cold ×1.5" for the resistances matching `keep`. */
function resistanceList(unit: Unit, keep: (m: number) => boolean): string {
  return Object.entries(unit.resistances)
    .filter(([, m]) => m !== undefined && keep(m))
    .map(([type, m]) => (m === 0 ? type : `${type} ×${m}`))
    .join(", ");
}

/** A unit's stats, weapon, resistances and running effects. */
export function UnitDetails({ unit, time, speed, onClose }: UnitDetailsProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const weak = resistanceList(unit, (m) => m > 1);
  const resists = resistanceList(unit, (m) => m > 0 && m < 1);
  const immune = resistanceList(unit, (m) => m === 0);
  const timed = unit.modifiers.filter((m) => m.expiresAt !== undefined);
  const kind = unit.obstacle ? "Obstacle" : unit.summonedBy ? "Summon" : null;

  return (
    <div className="details-backdrop" onClick={onClose}>
      <section
        className="details"
        role="dialog"
        aria-label={`${unit.name} details`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="details-header">
          <h2>
            <Portrait
              defId={unit.portrait ?? unit.defId}
              className={`portrait-large ${unit.side === "enemy" ? "foe" : ""}`}
            />
            {unit.name}
            {kind && <span className="muted"> · {kind}</span>}
          </h2>
          <button type="button" className="link" onClick={onClose}>
            Close
          </button>
        </header>
        <p>
          {isAlive(unit) ? `HP ${unit.hp}/${unit.base.maxHp}` : "Knocked out"}
          {unit.base.maxMp > 0 && ` · MP ${unit.mp}/${unit.base.maxMp}`}
        </p>
        {!unit.obstacle && (
          <>
            <dl className="details-stats">
              {STATS.map(([stat, label]) => {
                const now = Math.round(effectiveStat(unit, stat));
                const base = unit.base[stat];
                return (
                  <div key={stat}>
                    <dt>{label}</dt>
                    <dd
                      className={now > base ? "good" : now < base ? "bad" : ""}
                    >
                      {now}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p>
              <strong>{unit.weapon.name}</strong>{" "}
              <span className="muted">
                {unit.weapon.damageType}, {unit.weapon.kind}
              </span>
            </p>
          </>
        )}
        {weak || resists || immune ? (
          <ul className="details-list">
            {weak && <li>Weak: {weak}</li>}
            {resists && <li>Resists: {resists}</li>}
            {immune && <li>Immune: {immune}</li>}
          </ul>
        ) : (
          <p className="muted">No weaknesses or resistances.</p>
        )}
        {(unit.statuses.length > 0 ||
          timed.length > 0 ||
          unit.casting ||
          unit.defending) && (
          <ul className="details-list">
            {unit.defending && (
              <li>
                <strong>Defending</strong> — hits are halved{" "}
                <span className="muted">until its next action.</span>
              </li>
            )}
            {unit.casting && (
              <li>
                <strong>Casting {unit.casting.skillName}</strong> — lands in{" "}
                {seconds(unit.casting.readyAt - time, speed)}.
              </li>
            )}
            {unit.statuses.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong> {statusText(s, speed)}{" "}
                <span className="muted">
                  {seconds(statusEnds(s) - time, speed)} left.
                </span>
              </li>
            ))}
            {timed.map((m) => (
              <li key={m.source}>
                <strong>{m.source}</strong> {modifierText(m)}{" "}
                <span className="muted">
                  {seconds((m.expiresAt ?? time) - time, speed)} left.
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
