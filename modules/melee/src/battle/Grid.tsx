import {
  GAUGE_FULL,
  GRID_COLUMNS,
  isAlive,
  type Side,
  type Unit,
} from "../../shared";
import type { Hit } from "./useBattle";

interface GridProps {
  side: Side;
  units: Unit[];
  hits: Hit[];
  activeId: string | null;
  actorId: string | null;
  canTarget: (unit: Unit) => boolean;
  onTarget: (unit: Unit) => void;
  /** What tapping a target does, for screen readers: "Attack", "Heal". */
  actionName: string;
}

// Enemies show their back row at the top; the party shows its front row at
// the top, so the two front rows face each other in the middle.
const ROW_ORDER: Record<Side, number[]> = {
  enemy: [2, 1, 0],
  player: [0, 1, 2],
};
const ROW_NAMES = ["Front", "Middle", "Back"];

export function Grid({
  side,
  units,
  hits,
  activeId,
  actorId,
  canTarget,
  onTarget,
  actionName,
}: GridProps) {
  const at = (col: number, row: number) =>
    units.find(
      (u) =>
        u.side === side && u.position.col === col && u.position.row === row,
    );

  return (
    <div
      className={`grid grid-${side}`}
      role="grid"
      aria-label={side === "player" ? "Party" : "Enemies"}
    >
      {ROW_ORDER[side].map((row) => (
        <div
          className="grid-row"
          role="row"
          key={row}
          aria-label={`${ROW_NAMES[row]} row`}
        >
          {Array.from({ length: GRID_COLUMNS }, (_, col) => {
            const unit = at(col, row);
            if (!unit)
              return <div className="cell empty" role="gridcell" key={col} />;
            return (
              <UnitCell
                key={col}
                unit={unit}
                hits={hits.filter((h) => h.unitId === unit.id)}
                active={unit.id === activeId}
                acting={unit.id === actorId}
                targetable={canTarget(unit)}
                unreachable={
                  activeId !== null &&
                  side === "enemy" &&
                  isAlive(unit) &&
                  !canTarget(unit)
                }
                onTarget={() => onTarget(unit)}
                actionName={actionName}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface UnitCellProps {
  unit: Unit;
  hits: Hit[];
  active: boolean;
  acting: boolean;
  targetable: boolean;
  /** An enemy the active party member's weapon cannot reach. */
  unreachable: boolean;
  onTarget: () => void;
  actionName: string;
}

function UnitCell({
  unit,
  hits,
  active,
  acting,
  targetable,
  unreachable,
  onTarget,
  actionName,
}: UnitCellProps) {
  const alive = isAlive(unit);
  const hp = unit.hp / unit.base.maxHp;
  const classes = [
    "cell",
    "unit",
    alive ? "" : "down",
    active ? "active" : "",
    acting ? "acting" : "",
    targetable ? "targetable" : "",
    unreachable ? "unreachable" : "",
    hits.some((h) => h.kind === "damage") ? "hit" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className="unit-top">
        <span className="unit-name">{unit.name}</span>
        <span className="unit-hp">{alive ? unit.hp : "KO"}</span>
      </span>
      <span
        className="bar hp"
        aria-label={`HP ${unit.hp} of ${unit.base.maxHp}`}
      >
        <span
          style={{ width: `${hp * 100}%` }}
          className={hp < 0.3 ? "low" : ""}
        />
      </span>
      {unit.skills.length > 0 && unit.base.maxMp > 0 && (
        <span
          className="bar mp"
          aria-label={`MP ${unit.mp} of ${unit.base.maxMp}`}
        >
          <span style={{ width: `${(unit.mp / unit.base.maxMp) * 100}%` }} />
        </span>
      )}
      <span className="bar gauge" aria-hidden="true">
        <span
          style={{ width: `${(unit.gauge / GAUGE_FULL) * 100}%` }}
          className={unit.gauge >= GAUGE_FULL ? "full" : ""}
        />
      </span>
      {hits.map((h) => (
        <span className={`damage ${h.kind}`} key={h.key}>
          {h.kind === "heal" ? `+${h.amount}` : h.amount}
        </span>
      ))}
    </>
  );

  return targetable ? (
    <button
      type="button"
      className={classes}
      role="gridcell"
      onClick={onTarget}
      aria-label={`${actionName} ${unit.name}`}
    >
      {content}
    </button>
  ) : (
    <div className={classes} role="gridcell">
      {content}
    </div>
  );
}
