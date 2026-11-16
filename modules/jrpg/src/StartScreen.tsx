import type { Library } from "@jforge/char/shared";
import { LEVEL_LENGTH, runLibrary, startRun } from "../shared";
import { meta } from "../meta";

interface StartScreenProps {
  /** The library designed in char, if any. */
  library: Library | null;
  onStart: (library: Library | null) => void;
}

/** Before a run: who sets out, and where they come from. */
export function StartScreen({ library, onStart }: StartScreenProps) {
  const own = library !== null && runLibrary(library) === library;
  const party = startRun(library, 0).party;
  return (
    <main className="page">
      <a className="back" href="/">
        ← jforge
      </a>
      <h1>{meta.title}</h1>
      <p className="muted">
        Travel a level of {LEVEL_LENGTH} encounters: battles, allies to find and
        gear lying about. Battles pay experience and sometimes gear. Lose one
        and the run is over.
      </p>

      <section className="panel">
        <h2>Setting out</h2>
        <p>
          <strong>{party.map((c) => c.name).join(" and ")}</strong>
        </p>
        <p className="muted small">
          {own ? (
            <>
              From your library in <a href="/char/">Char</a>: its first class
              characters set out, its other classes can be found as allies, its
              enemies and gear fill the level.
            </>
          ) : (
            <>
              The starter heroes. Design your own classes, enemies and gear in{" "}
              <a href="/char/">Char</a>.
            </>
          )}
        </p>
        <div className="button-row">
          <button
            type="button"
            className="primary"
            onClick={() => onStart(library)}
          >
            Set out
          </button>
        </div>
      </section>
    </main>
  );
}
