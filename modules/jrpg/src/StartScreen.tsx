import { useState } from "react";
import { archetypeOf, type Library } from "@jforge/rules/core";
import {
  MIN_LEVEL_LENGTH,
  START_LEVEL,
  START_PARTY_SIZE,
  drawParty,
  heroes,
  startRun,
} from "../shared";
import { meta } from "../meta";

const newSeed = () => Math.floor(Math.random() * 1_000_000);

interface StartScreenProps {
  /** The content to start from; null for the game's own. */
  library: Library | null;
  onStart: (seed: number, chosen: string[]) => void;
}

/** Before a run: choosing who sets out, from a party drawn by lot. */
export function StartScreen({ library, onStart }: StartScreenProps) {
  const [seed, setSeed] = useState(newSeed);
  const [chosen, setChosen] = useState(() =>
    drawParty(library, seed).map((c) => c.id),
  );
  const all = heroes(library);
  const run = startRun(library, seed, chosen);
  const full = chosen.length >= Math.min(START_PARTY_SIZE, all.length);

  // Choosing one more than fits lets go of the first chosen.
  const toggle = (id: string) =>
    setChosen((was) =>
      was.includes(id)
        ? was.filter((other) => other !== id)
        : [...was, id].slice(-START_PARTY_SIZE),
    );
  const drawAgain = () => {
    const next = newSeed();
    setSeed(next);
    setChosen(drawParty(library, next).map((c) => c.id));
  };

  return (
    <main className="page">
      <a className="back" href="/">
        ← jforge
      </a>
      <h1>{meta.title}</h1>
      <p className="muted">
        Travel levels {MIN_LEVEL_LENGTH} or more stops long, choosing your road
        where it splits: battles, allies to meet, gear to find and places to
        train. Battles pay experience and sometimes gear. Lose one and the run
        is over.
      </p>

      <section className="panel" aria-label="Setting out">
        <h2>Setting out</h2>
        <p className="muted small">
          Choose {START_PARTY_SIZE} to set out, at Level {START_LEVEL}. The
          others may be met on the road. <a href="/char/">Char</a> shows every
          class and what each can do.
        </p>
        <div className="pieces" role="group" aria-label="Heroes">
          {all.map((hero) => (
            <button
              key={hero.id}
              type="button"
              aria-pressed={chosen.includes(hero.id)}
              className="piece"
              onClick={() => toggle(hero.id)}
            >
              <strong>{hero.name}</strong>{" "}
              <span className="muted small">
                {archetypeOf(run.library, hero)?.name}
              </span>
            </button>
          ))}
        </div>
        <div className="button-row">
          <button
            type="button"
            className="primary"
            disabled={!full}
            onClick={() => onStart(seed, chosen)}
          >
            Set out
          </button>
          <button type="button" className="secondary" onClick={drawAgain}>
            Draw again
          </button>
        </div>
      </section>
    </main>
  );
}
