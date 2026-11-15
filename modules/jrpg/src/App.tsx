import type { StrikeResult } from "@jforge/melee/shared";
import { meta } from "../meta";
import { openingBattle, playTurn } from "../shared";
import { useApiHealth } from "./useApiHealth";

interface Health {
  module: string;
  status: string;
  uses: string[];
  demo: StrikeResult[];
}

function describe(turn: StrikeResult[]): string {
  return turn
    .map((hit) => `${hit.attacker} hits ${hit.defender} for ${hit.damage}`)
    .join(", ");
}

export function App() {
  const health = useApiHealth<Health>("/api/jrpg/health");
  const localTurn = playTurn(openingBattle);
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
            Uses melee in the browser:{" "}
            <span className="good">{describe(localTurn)}</span>
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
                {describe(health.body.demo)}
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
