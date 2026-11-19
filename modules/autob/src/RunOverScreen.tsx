import { ROUNDS, roundsCleared, type Run } from "../shared";

/** The end of a run: how far it got, and a way to start another. */
export function RunOverScreen({ run, onNew }: { run: Run; onNew: () => void }) {
  return (
    <main className="page">
      <h1>{run.outcome === "won" ? "Run won" : "Run lost"}</h1>
      <section className="panel" aria-label="Result">
        <p>
          Rounds lived through: {roundsCleared(run)} of {ROUNDS}.
        </p>
        <div className="button-row">
          <button type="button" className="primary" onClick={onNew}>
            New run
          </button>
        </div>
      </section>
    </main>
  );
}
