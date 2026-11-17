import type { CSSProperties } from "react";
import {
  GAUGE_FULL,
  GRID_COLUMNS,
  isAlive,
  sameCell,
  unitAt,
  type BattleState,
  type Casting,
  type Cell,
  type DamagePreview,
  type Side,
  type Unit,
} from "../../shared";
import { previewClasses, previewLabel, previewText } from "./labels";
import { Portrait } from "./Portrait";
import type { Hit } from "./hits";
import { useLongPress } from "./useLongPress";

function castProgress(casting: Casting, time: number): number {
  const total = casting.readyAt - casting.startedAt;
  return total > 0 ? Math.min(1, (time - casting.startedAt) / total) : 1;
}

interface GridProps {
  side: Side;
  state: BattleState;
  hits: Hit[];
  activeId: string | null;
  actorId: string | null;
  canTarget: (cell: Cell) => boolean;
  onTarget: (cell: Cell) => void;
  /** What tapping a target does, for screen readers: "Attack", "Heal". */
  actionName: string;
  /** Cells an area skill covers: the aimed preview, or the blast being shown. */
  area: Cell[];
  /** The aimed cell while previewing an area skill. */
  aim: Cell | null;
  /** Cells a delayed skill will hit when it lands. */
  incoming: Cell[];
  /** Units the chosen skill is most useful on, e.g. poisoned allies for Cure. */
  emphasize: (unit: Unit) => boolean;
  /** Long press (or right-click) on a unit: show its details. */
  onInspect: (unit: Unit) => void;
  /** Expected damage on a unit the current action would hit, if any. */
  preview: (unit: Unit) => DamagePreview | null;
}

// Enemies show their back row at the top; the party shows its front row at
// the top, so the two front rows face each other in the middle.
const ROW_ORDER: Record<Side, number[]> = {
  enemy: [2, 1, 0],
  player: [0, 1, 2],
};
const ROW_NAMES = ["Front", "Middle", "Back"];
const SIDE_NAMES: Record<Side, string> = { player: "Party", enemy: "Enemies" };

export function Grid({
  side,
  state,
  hits,
  activeId,
  actorId,
  canTarget,
  onTarget,
  actionName,
  area,
  aim,
  incoming,
  emphasize,
  onInspect,
  preview,
}: GridProps) {
  return (
    <div
      className={`grid grid-${side}`}
      role="grid"
      aria-label={SIDE_NAMES[side]}
    >
      {ROW_ORDER[side].map((row) => (
        <div
          className="grid-row"
          role="row"
          key={row}
          aria-label={`${ROW_NAMES[row]} row`}
        >
          {Array.from({ length: GRID_COLUMNS }, (_, col) => {
            const cell: Cell = { side, col, row };
            const unit = unitAt(state, cell);
            const targetable = canTarget(cell);
            const inArea = area.some((c) => sameCell(c, cell));
            const aimed = aim !== null && sameCell(aim, cell);
            const threatened = incoming.some((c) => sameCell(c, cell));
            const onClick = () => onTarget(cell);
            if (!unit) {
              return (
                <EmptyCell
                  key={col}
                  label={`${actionName} ${SIDE_NAMES[side]} column ${col + 1}, ${ROW_NAMES[row]?.toLowerCase()} row`}
                  targetable={targetable}
                  inArea={inArea}
                  aimed={aimed}
                  incoming={threatened}
                  onClick={onClick}
                />
              );
            }
            return (
              <UnitCell
                key={col}
                unit={unit}
                hits={hits.filter((h) => h.unitId === unit.id)}
                active={unit.id === activeId}
                acting={unit.id === actorId}
                targetable={targetable}
                unreachable={
                  activeId !== null &&
                  side === "enemy" &&
                  isAlive(unit) &&
                  !targetable
                }
                inArea={inArea}
                // An ally caught in an aimed area: friendly fire warning.
                danger={
                  aim !== null &&
                  inArea &&
                  unit.side === "player" &&
                  isAlive(unit)
                }
                aimed={aimed}
                incoming={threatened}
                emphasized={emphasize(unit)}
                time={state.time}
                onClick={onClick}
                onInspect={() => onInspect(unit)}
                preview={preview(unit)}
                actionName={actionName}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface EmptyCellProps {
  label: string;
  targetable: boolean;
  inArea: boolean;
  aimed: boolean;
  incoming: boolean;
  onClick: () => void;
}

function EmptyCell({
  label,
  targetable,
  inArea,
  aimed,
  incoming,
  onClick,
}: EmptyCellProps) {
  const classes = [
    "cell",
    "empty",
    targetable ? "targetable" : "",
    inArea ? "in-area" : "",
    aimed ? "aimed" : "",
    incoming ? "incoming" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return targetable ? (
    <button
      type="button"
      className={classes}
      role="gridcell"
      aria-label={label}
      onClick={onClick}
    />
  ) : (
    <div className={classes} role="gridcell" />
  );
}

interface UnitCellProps {
  unit: Unit;
  hits: Hit[];
  active: boolean;
  acting: boolean;
  targetable: boolean;
  /** An enemy the active party member cannot target right now. */
  unreachable: boolean;
  inArea: boolean;
  danger: boolean;
  aimed: boolean;
  incoming: boolean;
  emphasized: boolean;
  /** Game time now, for the cast bar of a casting unit. */
  time: number;
  onClick: () => void;
  onInspect: () => void;
  preview: DamagePreview | null;
  actionName: string;
}

function UnitCell({
  unit,
  hits,
  active,
  acting,
  targetable,
  unreachable,
  inArea,
  danger,
  aimed,
  incoming,
  emphasized,
  time,
  onClick,
  onInspect,
  preview,
  actionName,
}: UnitCellProps) {
  const { consumeClick, ...press } = useLongPress(onInspect);
  const alive = isAlive(unit);
  const hp = unit.hp / unit.base.maxHp;
  // Effects over time and timed modifiers (Haste, Slow) as small badges.
  const badges = [
    ...(unit.summonedBy && !unit.obstacle
      ? [{ name: "Summon", kind: "summon" }]
      : []),
    ...unit.statuses.map((st) => ({
      name: st.effect === "shield" ? `${st.name} ${st.amount}` : st.name,
      kind: st.effect,
    })),
    ...unit.modifiers
      .filter((mod) => mod.expiresAt !== undefined)
      .map((mod) => ({
        name: mod.source,
        kind: mod.harmful ? "debuff" : "buff",
      })),
  ];
  const classes = [
    "cell",
    "unit",
    alive ? "" : "down",
    active ? "active" : "",
    acting ? "acting" : "",
    targetable ? "targetable" : "",
    unreachable ? "unreachable" : "",
    inArea ? "in-area" : "",
    danger ? "danger" : "",
    aimed ? "aimed" : "",
    incoming ? "incoming" : "",
    unit.casting ? "casting" : "",
    unit.defending ? "defending" : "",
    emphasized ? "emphasized" : "",
    unit.obstacle ? "boulder" : "",
    unit.statuses.some((st) => st.effect === "stealth" || st.effect === "smoke")
      ? "stealthed"
      : "",
    unit.statuses.some((st) => st.effect === "taunt") ? "taunting" : "",
    unit.statuses.some((st) => st.effect === "petrify") ? "petrified" : "",
    hits.some((h) => h.kind === "damage") ? "hit" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span
        className="unit-name"
        style={{ "--chars": unit.name.length } as CSSProperties}
      >
        {unit.name}
      </span>
      {badges.length > 0 && (
        <span className="statuses">
          {badges.map((b) => (
            <span
              key={b.name}
              className={`status status-${b.kind}`}
              title={b.name}
            >
              {b.name}
            </span>
          ))}
        </span>
      )}
      <span
        className="bar hp"
        aria-label={`HP ${unit.hp} of ${unit.base.maxHp}`}
      >
        <span
          style={{ width: `${hp * 100}%` }}
          className={hp < 0.3 ? "low" : ""}
        />
        <span className="unit-hp" aria-hidden="true">
          {alive ? unit.hp : "KO"}
        </span>
      </span>
      <span className="unit-foot">
        <Portrait defId={unit.portrait ?? unit.defId} />
        <span className="unit-foot-bars">
          {unit.skills.length > 0 && unit.base.maxMp > 0 && (
            <span
              className="bar mp"
              aria-label={`MP ${unit.mp} of ${unit.base.maxMp}`}
            >
              <span
                style={{ width: `${(unit.mp / unit.base.maxMp) * 100}%` }}
              />
            </span>
          )}
          {unit.obstacle ? null : unit.casting ? (
            <span
              className="bar cast"
              aria-label={`Casting ${unit.casting.skillName}`}
            >
              <span
                style={{ width: `${castProgress(unit.casting, time) * 100}%` }}
              />
            </span>
          ) : (
            <span className="bar gauge" aria-hidden="true">
              <span
                style={{
                  width: `${(Math.max(0, unit.gauge) / GAUGE_FULL) * 100}%`,
                }}
                className={unit.gauge >= GAUGE_FULL ? "full" : ""}
              />
            </span>
          )}
        </span>
      </span>
      {preview && <PreviewBadge preview={preview} />}
      {hits.map((h) => (
        <span
          className={`damage ${h.kind} ${h.tag ?? ""} ${h.overTime ? "over-time" : ""}`}
          key={h.key}
        >
          {h.tag && <span className="damage-tag">{h.tag}</span>}
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
      onClick={() => {
        // The click that ends a long press only opened the details.
        if (!consumeClick()) onClick();
      }}
      aria-label={`${actionName} ${unit.name}${preview ? `, ${previewText(preview)}` : ""}`}
      {...press}
    >
      {content}
    </button>
  ) : (
    <div className={classes} role="gridcell" {...press}>
      {content}
    </div>
  );
}

/** Expected damage on a target: gold if weak, grey if resisted, red if KO. */
function PreviewBadge({ preview: p }: { preview: DamagePreview }) {
  return (
    <span className={previewClasses(p)} aria-hidden="true">
      {previewLabel(p)}
    </span>
  );
}
