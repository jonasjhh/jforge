import { useState } from "react";
import {
  BENCH_SIZE,
  BOARD_ROWS,
  REROLL_COST,
  ROUNDS,
  XP_COST,
  boardLimit,
  buy,
  buyXp,
  costOf,
  interest,
  isStageEnd,
  ownedUnits,
  packOf,
  place,
  reroll,
  sell,
  sellValue,
  stageOf,
  toBench,
  unitDef,
  xpToNext,
  type Hex,
  type Run,
} from "../shared";
import { Arena, type HexView } from "./Arena";
import { UnitBadge } from "./UnitBadge";

interface PlanningScreenProps {
  run: Run;
  onChange: (run: Run) => void;
  onFight: () => void;
  onAbandon: () => void;
}

/**
 * Between fights: the shop, the bench and the board, with the round's
 * pack shown where it will stand. Tap a unit, then a hex or a bench
 * slot, to move it.
 */
export function PlanningScreen({
  run,
  onChange,
  onFight,
  onAbandon,
}: PlanningScreenProps) {
  const [held, setHeld] = useState<string | null>(null);
  const pack = packOf(run);
  const heldUnit = ownedUnits(run).find((u) => u.uid === held);
  const need = xpToNext(run.level);

  const change = (next: Run | null) => {
    setHeld(null);
    if (next) onChange(next);
  };
  const pick = (uid: string) => setHeld(held === uid ? null : uid);

  const view = ({ col, row }: Hex): HexView => {
    if (row < BOARD_ROWS) {
      const monster = pack.find(
        (m) =>
          m.position.col === col && BOARD_ROWS - 1 - m.position.row === row,
      );
      return monster
        ? {
            content: <UnitBadge def={monster.def} />,
            label: monster.def.name,
            className: "held foe",
          }
        : {};
    }
    const position = { col, row: row - BOARD_ROWS };
    const there = run.board.find(
      (b) => b.position.col === position.col && b.position.row === position.row,
    );
    const def = there && unitDef(run.library, there.unit);
    if (there && def) {
      return {
        content: <UnitBadge def={def} />,
        label: def.name,
        className: `held${there.unit.uid === held ? " picked" : ""}`,
        pressed: there.unit.uid === held,
        onTap: () =>
          held && held !== there.unit.uid
            ? change(place(run, held, position))
            : pick(there.unit.uid),
      };
    }
    return held ? { onTap: () => change(place(run, held, position)) } : {};
  };

  return (
    <main className="page">
      <div className="run-header">
        <h1>
          Round {run.round} of {ROUNDS}
        </h1>
        <button type="button" className="secondary" onClick={onAbandon}>
          Abandon
        </button>
      </div>
      <p className="muted small" aria-label="Status">
        Stage {stageOf(run.round)}
        {isStageEnd(run.round) ? " · a stronger pack" : ""} · Lives {run.lives}{" "}
        · Gold {run.gold} (+{interest(run.gold)} interest) · Level {run.level}
        {need === null ? "" : ` · XP ${run.xp}/${need}`} · Board{" "}
        {run.board.length}/{boardLimit(run)}
      </p>
      {run.last && (
        <p className="small" role="status">
          Round {run.last.round} {run.last.won ? "won" : "lost"}.
        </p>
      )}

      <Arena label="Board" view={view} />

      <section className="panel" aria-label="Bench">
        <h2>Bench</h2>
        <div className="bench">
          {Array.from({ length: BENCH_SIZE }, (_, slot) => {
            const unit = run.bench[slot] ?? null;
            const def = unit && unitDef(run.library, unit);
            return (
              <button
                key={slot}
                type="button"
                className={`slot${def ? " held" : ""}${
                  unit && unit.uid === held ? " picked" : ""
                }`}
                aria-label={
                  def ? `${def.name}, bench ${slot + 1}` : `Bench ${slot + 1}`
                }
                aria-pressed={unit ? unit.uid === held : undefined}
                disabled={!unit && !held}
                onClick={() =>
                  held && held !== unit?.uid
                    ? change(toBench(run, held, slot))
                    : unit && pick(unit.uid)
                }
              >
                {def && <UnitBadge def={def} />}
              </button>
            );
          })}
        </div>
        {heldUnit ? (
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              onClick={() => change(sell(run, heldUnit.uid))}
            >
              Sell for{" "}
              {sellValue(costOf(run, heldUnit.classId), heldUnit.stars)} gold
            </button>
          </div>
        ) : (
          <p className="muted small">
            Tap a unit, then a hex of your side or a bench slot, to move it.
          </p>
        )}
      </section>

      <section className="panel" aria-label="Shop">
        <h2>Shop</h2>
        <div className="shop">
          {run.shop.map((classId, slot) => {
            const archetype = run.library.archetypes.find(
              (a) => a.id === classId,
            );
            const cost = classId ? costOf(run, classId) : 0;
            return (
              <button
                key={slot}
                type="button"
                className={`offer tier-${cost}`}
                disabled={!archetype || run.gold < cost}
                onClick={() => change(buy(run, slot))}
              >
                {archetype ? (
                  <>
                    <strong>{archetype.name}</strong>
                    <span className="small">{cost} gold</span>
                  </>
                ) : (
                  <span className="muted small">Sold</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="button-row">
          <button
            type="button"
            className="secondary"
            disabled={run.gold < REROLL_COST}
            onClick={() => change(reroll(run))}
          >
            Reroll ({REROLL_COST})
          </button>
          <button
            type="button"
            className="secondary"
            disabled={run.gold < XP_COST || need === null}
            onClick={() => change(buyXp(run))}
          >
            Buy XP ({XP_COST})
          </button>
          <button
            type="button"
            className="primary"
            disabled={run.board.length === 0}
            onClick={onFight}
          >
            Fight
          </button>
        </div>
      </section>
    </main>
  );
}
