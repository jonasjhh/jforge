import { useState } from "react";
import { archetypeOf, type Library } from "@jforge/char/shared";
import { MIN_LEVEL_LENGTH, heroes, startRun } from "../shared";
import { meta } from "../meta";

const newSeed = () => Math.floor(Math.random() * 1_000_000);

interface StartScreenProps {
  /** The library designed in char, if any. */
  library: Library | null;
  onStart: (seed: number) => void;
}

/** Before a run: who was drawn to set out, and who else is out there. */
export function StartScreen({ library, onStart }: StartScreenProps) {
  const [seed, setSeed] = useState(newSeed);
  const run = startRun(library, seed);
  const others = heroes(library).filter(
    (hero) => !run.party.some((member) => member.id === hero.id),
  );
  return (
    <main className="page">
      <a className="back" href="/">
        ← jforge
      </a>
      <h1>{meta.title}</h1>
      <p className="muted">
        Travel levels of {MIN_LEVEL_LENGTH} or more encounters: battles, allies
        to meet, gear to find, places to train and forks in the road. Battles
        pay experience and sometimes gear. Lose one and the run is over.
      </p>

      <section className="panel" aria-label="Setting out">
        <h2>Setting out</h2>
        <ul>
          {run.party.map((member) => (
            <li key={member.id}>
              <strong>{member.name}</strong>{" "}
              <span className="muted small">
                {archetypeOf(run.library, member)?.name} · Level {member.level}
              </span>
            </li>
          ))}
        </ul>
        <p className="muted small">
          Drawn by lot. Out there to meet:{" "}
          {others.map((hero) => hero.name).join(", ")}. Class characters you
          design in <a href="/char/">Char</a> join the draw; your enemies and
          gear join the world's own.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="primary"
            onClick={() => onStart(seed)}
          >
            Set out
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setSeed(newSeed())}
          >
            Draw again
          </button>
        </div>
      </section>
    </main>
  );
}
