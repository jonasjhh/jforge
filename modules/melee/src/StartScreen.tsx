import type { BattleSetup } from "../shared";
import { meta } from "../meta";
import { useApiHealth } from "./useApiHealth";

interface StartScreenProps {
  setup: BattleSetup;
  onStart: () => void;
}

export function StartScreen({ setup, onStart }: StartScreenProps) {
  const health = useApiHealth<{ status: string }>("/api/melee/health");
  const names = (side: "player" | "enemy") =>
    setup.placements.filter((p) => p.side === side).map((p) => p.def.name);

  return (
    <main className="page">
      <a className="back" href="/">
        ← jforge
      </a>
      <h1>{meta.title}</h1>
      <p className="muted">{meta.description}</p>

      <section className="panel">
        <h2>Sample battle</h2>
        <p>
          <strong>Your party:</strong> {names("player").join(", ")}
        </p>
        <p>
          <strong>Enemies:</strong> {names("enemy").join(", ")}
        </p>
        <p className="muted">
          Gauges fill with speed. When one of your units is ready, time stops
          until you choose its action. The enemies act on their own.
        </p>
        <button type="button" className="primary" onClick={onStart}>
          Start battle
        </button>
      </section>

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
