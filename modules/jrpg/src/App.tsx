import type { BattleSummary } from "@jforge/melee/shared";
import { meta } from "../meta";
import { previewOpeningBattle } from "../shared";
import { useApiHealth } from "./useApiHealth";

interface Health {
  module: string;
  status: string;
  uses: string[];
  demo: BattleSummary;
}

function describeBattle(summary: BattleSummary): string {
  const result =
    summary.winner === null
      ? "Draw"
      : summary.winner === "player"
        ? "Party wins"
        : "Enemies win";
  return `${result} after ${summary.actions} actions`;
}

export function App() {
  const health = useApiHealth<Health>("/api/jrpg/health");
  const local = previewOpeningBattle();
  return (
    <main className="page">
      <a className="back" href="/">
        ← jforge
      </a>
      <h1>{meta.title}</h1>
      <p className="muted">{meta.description}</p>

      <section className="panel">
        <h2>Setup check</h2>
        <ul>
          <li>
            Module: <code>modules/{meta.name}</code>, served at{" "}
            <code>/{meta.name}/</code>
          </li>
          <li>
            Opening battle with melee in the browser:{" "}
            <span className="good">{describeBattle(local)}</span>
          </li>
          <li>
            API <code>/api/{meta.name}/health</code>:{" "}
            {health.state === "loading" && "checking…"}
            {health.state === "error" && (
              <span className="bad">unreachable ({health.message})</span>
            )}
            {health.state === "ok" && (
              <span className="good">
                {health.body.status}, uses {health.body.uses.join(", ")} —{" "}
                {describeBattle(health.body.demo)}
              </span>
            )}
          </li>
        </ul>
      </section>

      <p className="muted">
        <a className="back" href="/melee/">
          Open melee →
        </a>
      </p>
    </main>
  );
}
