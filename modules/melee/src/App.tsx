import type { StrikeResult } from "../shared";
import { meta } from "../meta";
import { useApiHealth } from "./useApiHealth";

interface Health {
  module: string;
  status: string;
  demo: StrikeResult;
}

export function App() {
  const health = useApiHealth<Health>("/api/melee/health");
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
            API <code>/api/{meta.name}/health</code>:{" "}
            {health.state === "loading" && "checking…"}
            {health.state === "error" && (
              <span className="bad">unreachable ({health.message})</span>
            )}
            {health.state === "ok" && (
              <span className="good">
                {health.body.status} — {health.body.demo.attacker} hits{" "}
                {health.body.demo.defender} for {health.body.demo.damage}
              </span>
            )}
          </li>
        </ul>
      </section>
    </main>
  );
}
