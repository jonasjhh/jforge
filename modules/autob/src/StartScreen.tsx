import type { Library } from "@jforge/rules/core";
import { ROUNDS, START_LIVES, shopClasses, runLibrary } from "../shared";
import { meta } from "../meta";

interface StartScreenProps {
  /** The content to start from; null for the game's own. */
  library: Library | null;
  onStart: (seed: number) => void;
}

const newSeed = () => Math.floor(Math.random() * 1_000_000);

/** Before a run: what it is, and the classes the shop will sell. */
export function StartScreen({ library, onStart }: StartScreenProps) {
  const classes = shopClasses(runLibrary(library));
  return (
    <main className="page">
      <a className="back" href="/">
        ← jforge
      </a>
      <h1>{meta.title}</h1>
      <p className="muted">
        Buy units in the shop, place them on your board and watch them fight
        {` ${ROUNDS}`} rounds of monsters. Three copies of a class merge into
        one a star higher. Each lost round costs a life; you have
        {` ${START_LIVES}`}.
      </p>
      <section className="panel" aria-label="The shop sells">
        <h2>The shop sells</h2>
        <p className="muted small">
          Every class autob uses. <a href="/char/">Char</a> shows them all.
        </p>
        <p>{classes.map((c) => c.name).join(", ")}</p>
        <div className="button-row">
          <button
            type="button"
            className="primary"
            onClick={() => onStart(newSeed())}
          >
            Start a run
          </button>
        </div>
      </section>
    </main>
  );
}
