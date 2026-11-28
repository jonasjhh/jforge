import { useState } from "react";
import { Portrait } from "@jforge/look";
import {
  GRID_COLUMNS,
  GRID_ROWS,
  type BattleSetup,
  type Placement,
  type Position,
} from "@jforge/battle";
import { formationOf, moveMember, type Run } from "../shared";

const ROWS = Array.from({ length: GRID_ROWS }, (_, row) => row);
const COLUMNS = Array.from({ length: GRID_COLUMNS }, (_, col) => col);
const ROW_WORDS = ["front", "middle", "back"];

interface FormationProps {
  run: Run;
  /** The battle ahead: its enemies are shown where they will stand. */
  setup: BattleSetup;
  onChange: (run: Run) => void;
}

/**
 * The battlefield before the fight: the enemies as they will stand, and
 * the party, which can be rearranged (tap a member, then a cell).
 */
export function Formation({ run, setup, onChange }: FormationProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const cells = formationOf(run);
  const memberAt = ({ col, row }: Position) =>
    run.party.find((c) => cells[c.id]?.col === col && cells[c.id]?.row === row);
  const enemyAt = ({ col, row }: Position): Placement | undefined =>
    setup.placements.find(
      (p) =>
        p.side === "enemy" && p.position.col === col && p.position.row === row,
    );
  const portraitOf = (id: string) =>
    setup.placements.find((p) => p.def.id === `char-${id}`)?.def;

  const tap = (cell: Position) => {
    const member = memberAt(cell);
    if (picked === null) {
      if (member) setPicked(member.id);
      return;
    }
    onChange(moveMember(run, picked, cell));
    setPicked(null);
  };

  return (
    <div className="field">
      <div
        className="field-grid field-enemy"
        role="grid"
        aria-label="Enemies ahead"
      >
        {[...ROWS].reverse().map((row) => (
          <div key={row} role="row" className="field-row">
            {COLUMNS.map((col) => {
              const enemy = enemyAt({ col, row });
              return (
                <div
                  key={col}
                  role="gridcell"
                  className={`field-cell${enemy ? " held" : ""}`}
                  aria-label={
                    enemy
                      ? `${enemy.def.name}, ${ROW_WORDS[row]} row`
                      : undefined
                  }
                >
                  {enemy && (
                    <>
                      <Portrait defId={enemy.def.portrait ?? enemy.def.id} />
                      <span className="field-name">{enemy.def.name}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div
        className="field-grid field-party"
        role="grid"
        aria-label="Formation"
      >
        {ROWS.map((row) => (
          <div key={row} role="row" className="field-row">
            {COLUMNS.map((col) => {
              const member = memberAt({ col, row });
              const def = member && portraitOf(member.id);
              const where = `${ROW_WORDS[row]} row, column ${col + 1}`;
              return (
                <button
                  key={col}
                  type="button"
                  role="gridcell"
                  className={`field-cell${member ? " held" : ""}${
                    member && member.id === picked ? " picked" : ""
                  }`}
                  aria-label={member ? `${member.name}, ${where}` : where}
                  aria-pressed={member ? member.id === picked : undefined}
                  disabled={picked === null && !member}
                  onClick={() => tap({ col, row })}
                >
                  {member && (
                    <>
                      {def && <Portrait defId={def.portrait ?? def.id} />}
                      <span className="field-name">{member.name}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="muted small">
        {picked === null
          ? "Tap one of yours, then a cell, to move them. The top row of your side is the front."
          : "Now tap where they should stand."}
      </p>
    </div>
  );
}
