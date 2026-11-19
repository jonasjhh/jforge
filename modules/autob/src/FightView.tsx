import { useEffect, useState } from "react";
import {
  TICKS_PER_SECOND,
  castable,
  manaCost,
  maxHpOf,
  runFight,
  sameHex,
  step,
  type Fight,
  type Fighter,
  type Hex,
} from "../shared";
import { Arena, type HexView } from "./Arena";
import { UnitBadge } from "./UnitBadge";

interface FightViewProps {
  round: number;
  fight: Fight;
  onDone: (won: boolean) => void;
}

const RESULT = {
  player: "Victory",
  enemy: "Defeat",
  draw: "Time is up: a draw counts as a loss",
};

const share = (part: number, whole: number) =>
  `${Math.round(Math.min(1, whole > 0 ? part / whole : 0) * 100)}%`;

function FighterHex({ f }: { f: Fighter }) {
  const skills = castable(f.def);
  const cost =
    skills.length > 0 ? manaCost(skills[f.skillIndex % skills.length]!) : 0;
  return (
    <>
      <UnitBadge def={f.def} />
      <span className="bar hp">
        <span style={{ width: share(f.hp, maxHpOf(f)) }} />
      </span>
      {cost > 0 && (
        <span className="bar mana">
          <span style={{ width: share(f.mana, cost) }} />
        </span>
      )}
    </>
  );
}

/** A round's fight, played out in real time; it can be skipped. */
export function FightView({ round, fight: start, onDone }: FightViewProps) {
  const [fight, setFight] = useState(start);

  useEffect(() => {
    if (fight.winner) return;
    const timer = setTimeout(
      () => setFight(step(fight)),
      1000 / TICKS_PER_SECOND,
    );
    return () => clearTimeout(timer);
  }, [fight]);

  const view = (hex: Hex): HexView => {
    const f = fight.fighters.find((o) => o.hp > 0 && sameHex(o.hex, hex));
    return f
      ? {
          content: <FighterHex f={f} />,
          label: `${f.name}, ${f.hp} of ${maxHpOf(f)} HP`,
          className: `held${f.side === "enemy" ? " foe" : ""}`,
        }
      : {};
  };

  return (
    <main className="page">
      <h1>Round {round}</h1>
      <p className="muted small">
        {(fight.tick / TICKS_PER_SECOND).toFixed(1)} s
      </p>
      <Arena label="Fight" view={view} />
      <div className="button-row">
        {fight.winner ? (
          <>
            <p role="status">
              <strong>{RESULT[fight.winner]}</strong>
            </p>
            <button
              type="button"
              className="primary"
              onClick={() => onDone(fight.winner === "player")}
            >
              Continue
            </button>
          </>
        ) : (
          <button
            type="button"
            className="secondary"
            onClick={() => setFight(runFight(fight))}
          >
            Skip to the end
          </button>
        )}
      </div>
    </main>
  );
}
