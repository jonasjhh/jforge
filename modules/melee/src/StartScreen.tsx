import {
  DIFFICULTIES,
  type BattleSetup,
  type Difficulty,
} from "@jforge/battle";
import { meleeEncounter } from "../shared/arena";
import { meta } from "../meta";
import { PORTRAIT_AUTHORS } from "@jforge/look";
import { useApiHealth } from "./useApiHealth";

interface StartScreenProps {
  difficulty: Difficulty;
  encounterSeed: number;
  onDifficulty: (difficulty: Difficulty) => void;
  onReroll: () => void;
  onStart: (setup: BattleSetup) => void;
}

const LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
};

/** "Slime ×2, Wolf" for one side of a setup. */
function roster(setup: BattleSetup, side: "player" | "enemy"): string {
  const counts = new Map<string, number>();
  for (const p of setup.placements) {
    if (p.side === side)
      counts.set(p.def.name, (counts.get(p.def.name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
    .join(", ");
}

export function StartScreen({
  difficulty,
  encounterSeed,
  onDifficulty,
  onReroll,
  onStart,
}: StartScreenProps) {
  const health = useApiHealth<{ status: string }>("/api/melee/health");
  const encounter = meleeEncounter(encounterSeed, difficulty);

  return (
    <main className="page">
      <a className="back" href="/">
        ← jforge
      </a>
      <h1>{meta.title}</h1>
      <p className="muted">{meta.description}</p>

      <section className="panel">
        <h2>Random encounter</h2>
        <div className="segmented" role="radiogroup" aria-label="Difficulty">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={d === difficulty}
              className={d === difficulty ? "selected" : ""}
              onClick={() => onDifficulty(d)}
            >
              {LABELS[d]}
            </button>
          ))}
        </div>
        <p>
          <strong>Your party:</strong> {roster(encounter, "player")}
        </p>
        <p>
          <strong>Enemies:</strong> {roster(encounter, "enemy")}
        </p>
        <div className="button-row">
          <button type="button" className="secondary" onClick={onReroll}>
            Reroll
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => onStart(encounter)}
          >
            Start
          </button>
        </div>
        <p className="muted small">Encounter #{encounterSeed}</p>
      </section>

      <p className="muted small">
        Gauges fill with speed. When one of your units is ready, time stops
        until you choose its action. The enemies act on their own. Defend halves
        the hits a unit takes until it acts again; Wait skips the turn but lets
        it act again sooner. Hold a unit (or right-click it) to see its details.
      </p>
      <p className="muted small">
        Design your own classes, enemies, skills and gear in{" "}
        <a className="link" href="/char/">
          Char
        </a>
        ; they appear here as the Custom roster.
      </p>
      <p className="muted small">
        Unit icons by {PORTRAIT_AUTHORS.join(" and ")} from{" "}
        <a className="link" href="https://game-icons.net">
          game-icons.net
        </a>
        ,{" "}
        <a className="link" href="https://creativecommons.org/licenses/by/3.0/">
          CC BY 3.0
        </a>
        .
      </p>
      <p className="muted small">
        API:{" "}
        {health.state === "ok" ? (
          <span className="good">{health.body.status}</span>
        ) : health.state === "error" ? (
          <span className="bad">unreachable</span>
        ) : (
          "checking…"
        )}
      </p>
    </main>
  );
}
