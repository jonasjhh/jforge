import { useState } from "react";
import { archetypeOf, canWear } from "@jforge/rules/core";
import {
  battleFor,
  canRecruit,
  choices,
  currentEncounter,
  encounterLabel,
  enemySummary,
  gearOf,
  gearKind,
  gearSummary,
  levelCleared,
  nextLevel,
  recruitOf,
  resolveAlly,
  resolveGear,
  resolveTraining,
  travel,
  type Encounter,
  type Reward,
  type Run,
} from "../shared";
import { Formation } from "./Formation";
import { iconOf } from "./icons";
import { LevelMap } from "./LevelMap";
import { PartyPanel } from "./PartyPanel";

const DIFFICULTY_WORDS = { easy: "Easy", normal: "Normal", hard: "Hard" };
/** What the signpost says about each road. */
const WAY_WORDS: Record<Encounter["kind"], string> = {
  battle: "Tracks in the mud: a fight",
  ally: "Smoke from a campfire: someone to meet",
  gear: "An overgrown ruin: gear to find",
  training: "A quiet clearing: a place to train",
};
const wayWords = (encounter: Encounter) =>
  encounter.kind === "battle" && encounter.rank === "elite"
    ? "A dangerous road: a hard fight, sure to drop gear"
    : WAY_WORDS[encounter.kind];

interface RunScreenProps {
  run: Run;
  /** What the battle just won paid, if the party has not moved on yet. */
  reward: Reward | null;
  onChange: (run: Run) => void;
  onFight: () => void;
  onAbandon: () => void;
}

/** The map: the level's encounters, the one at hand, and the party. */
export function RunScreen({
  run,
  reward,
  onChange,
  onFight,
  onAbandon,
}: RunScreenProps) {
  return (
    <main className="page">
      <header className="run-header">
        <a className="back" href="/">
          ← jforge
        </a>
        <button type="button" className="link" onClick={onAbandon}>
          {run.defeated ? "New run" : "Abandon run"}
        </button>
      </header>
      <h1>Level {run.depth}</h1>

      <LevelMap run={run} onChange={onChange} />

      {reward && <RewardPanel reward={reward} />}
      <EncounterPanel
        run={run}
        onChange={onChange}
        onFight={onFight}
        onAbandon={onAbandon}
      />
      <PartyPanel run={run} onChange={onChange} />
    </main>
  );
}

function RewardPanel({ reward }: { reward: Reward }) {
  return (
    <section className="panel reward" aria-label="Rewards">
      <h2>Victory</h2>
      <ul>
        <li>Everyone gains {reward.xp} XP</li>
        {reward.levelUps.map((up) => (
          <li key={up.name} className="good">
            {up.name} reaches level {up.level}
          </li>
        ))}
        {reward.loot && (
          <li>
            Found <strong>{reward.loot.name}</strong> (
            {gearSummary(reward.loot)}), now in the bag
          </li>
        )}
      </ul>
    </section>
  );
}

function EncounterPanel({
  run,
  onChange,
  onFight,
  onAbandon,
}: Omit<RunScreenProps, "reward">) {
  const encounter = currentEncounter(run);
  if (run.defeated) {
    return (
      <section className="panel" aria-label="Encounter">
        <h2>The party has fallen</h2>
        <p className="muted">
          The run ends on level {run.depth}, at encounter {run.position + 1}.
        </p>
        <button type="button" className="primary" onClick={onAbandon}>
          New run
        </button>
      </section>
    );
  }
  const ways = choices(run);
  if (ways.length > 0) {
    const row = run.map[run.position]!;
    return (
      <section className="panel" aria-label="Encounter">
        <h2>
          The road splits{" "}
          <span className="muted small">
            {run.position + 1} of {run.map.length}
          </span>
        </h2>
        <div className="ways">
          {ways.map((index) => (
            <button
              key={index}
              type="button"
              className="secondary"
              onClick={() => onChange(travel(run, index))}
            >
              {iconOf(row[index]!.encounter)} {wayWords(row[index]!.encounter)}
            </button>
          ))}
        </div>
      </section>
    );
  }
  if (levelCleared(run) || !encounter) {
    return (
      <section className="panel" aria-label="Encounter">
        <h2>Level {run.depth} cleared</h2>
        <p className="muted">The next level's enemies are stronger.</p>
        <button
          type="button"
          className="primary"
          onClick={() => onChange(nextLevel(run))}
        >
          On to level {run.depth + 1}
        </button>
      </section>
    );
  }
  const step = `${run.position + 1} of ${run.map.length}`;

  if (encounter.kind === "battle") {
    const setup = battleFor(run);
    return (
      <section className="panel" aria-label="Encounter">
        <h2>
          {encounterLabel(encounter)}{" "}
          <span className="muted small">
            {DIFFICULTY_WORDS[encounter.difficulty]} · {step}
          </span>
        </h2>
        <p>{setup ? enemySummary(setup) : "Nobody is here."}</p>
        {setup && <Formation run={run} setup={setup} onChange={onChange} />}
        <p className="muted small">
          You can retreat until you give your first command. After that the
          fight is won or the run is over.
        </p>
        <button type="button" className="primary" onClick={onFight}>
          Fight
        </button>
      </section>
    );
  }

  if (encounter.kind === "ally") {
    const character = recruitOf(run) ?? encounter.character;
    const type = archetypeOf(run.library, character);
    const room = canRecruit(run);
    const kit = Object.values(character.gear).flatMap(
      (id) => gearOf(run, id)?.name ?? [],
    );
    return (
      <section className="panel" aria-label="Encounter">
        <h2>
          A traveller <span className="muted small">{step}</span>
        </h2>
        <p>
          {type?.name === character.name ? "A " : ""}
          <strong>{character.name}</strong>
          {type && type.name !== character.name ? `, a ${type.name},` : ""}{" "}
          offers to join you.
        </p>
        {kit.length > 0 && (
          <p className="muted small">Brings along: {kit.join(", ")}.</p>
        )}
        {room ? (
          <div className="button-row">
            <button
              type="button"
              className="primary"
              onClick={() => onChange(resolveAlly(run, true))}
            >
              Welcome {character.name}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => onChange(resolveAlly(run, false))}
            >
              Move on
            </button>
          </div>
        ) : (
          <>
            <p className="muted small">
              Your party is full. {character.name} can take someone's place:
              they leave, and their gear goes in the bag.
            </p>
            <div className="choices">
              {run.party.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className="secondary"
                  onClick={() => onChange(resolveAlly(run, true, member.id))}
                >
                  Replace {member.name}
                </button>
              ))}
              <button
                type="button"
                className="secondary"
                onClick={() => onChange(resolveAlly(run, false))}
              >
                Move on
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  if (encounter.kind === "training") {
    return (
      <section className="panel" aria-label="Encounter">
        <h2>
          A quiet clearing <span className="muted small">{step}</span>
        </h2>
        <p>Time to train: one of you gains a level.</p>
        <div className="choices">
          {run.party.map((member) => (
            <button
              key={member.id}
              type="button"
              className="secondary"
              onClick={() => onChange(resolveTraining(run, member.id))}
            >
              Train {member.name}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <GearFind
      key={run.position}
      run={run}
      gearIds={encounter.gearIds}
      step={step}
      onChange={onChange}
    />
  );
}

/** Gear lying about: pick one piece, then who gets it. */
function GearFind({
  run,
  gearIds,
  step,
  onChange,
}: {
  run: Run;
  gearIds: string[];
  step: string;
  onChange: (run: Run) => void;
}) {
  const pieces = gearIds.flatMap((id) => gearOf(run, id) ?? []);
  const [chosen, setChosen] = useState(pieces[0]?.id ?? null);
  const chosenPiece = pieces.find((piece) => piece.id === chosen);
  // Only those whose class can use it are offered it.
  const users = chosenPiece
    ? run.party.filter((member) => canWear(run.library, member, chosenPiece))
    : [];
  return (
    <section className="panel" aria-label="Encounter">
      <h2>
        Something in the grass <span className="muted small">{step}</span>
      </h2>
      {pieces.length > 0 ? (
        <>
          <p className="muted small">Take one.</p>
          <div className="pieces" role="radiogroup" aria-label="Gear">
            {pieces.map((piece) => (
              <button
                key={piece.id}
                type="button"
                role="radio"
                aria-checked={piece.id === chosen}
                className="piece"
                onClick={() => setChosen(piece.id)}
              >
                <strong>{piece.name}</strong>{" "}
                <span className="muted small">
                  {gearKind(piece)} · {gearSummary(piece)}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <p>Nothing of use.</p>
      )}
      {chosenPiece && users.length === 0 && (
        <p className="muted small">
          Nobody in the party can use it; it can go in the bag.
        </p>
      )}
      <div className="choices">
        {chosenPiece &&
          users.map((member) => (
            <button
              key={member.id}
              type="button"
              className="secondary"
              onClick={() => onChange(resolveGear(run, chosen, member.id))}
            >
              Give to {member.name}
            </button>
          ))}
        <button
          type="button"
          className="secondary"
          onClick={() => onChange(resolveGear(run, chosen, null))}
        >
          {chosen !== null ? "Keep in the bag" : "Move on"}
        </button>
      </div>
    </section>
  );
}
