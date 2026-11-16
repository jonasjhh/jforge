import { archetypeOf } from "@jforge/char/shared";
import {
  battleFor,
  canRecruit,
  currentEncounter,
  encounterLabel,
  enemySummary,
  gearOf,
  gearSummary,
  levelCleared,
  nextLevel,
  resolveAlly,
  resolveGear,
  type Encounter,
  type Reward,
  type Run,
} from "../shared";
import { PartyPanel } from "./PartyPanel";

const DIFFICULTY_WORDS = { easy: "Easy", normal: "Normal", hard: "Hard" };
const ICONS: Record<Encounter["kind"], string> = {
  battle: "⚔",
  ally: "☺",
  gear: "◆",
};

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

      <ol className="path" aria-label="Encounters">
        {run.encounters.map((encounter, index) => {
          const state =
            index < run.position
              ? "done"
              : index === run.position
                ? run.defeated
                  ? "lost"
                  : "here"
                : "ahead";
          return (
            <li
              key={index}
              className={`stop stop-${state}`}
              aria-current={index === run.position ? "step" : undefined}
              aria-label={`${index + 1}: ${encounterLabel(encounter)}`}
              title={encounterLabel(encounter)}
            >
              {ICONS[encounter.kind]}
            </li>
          );
        })}
      </ol>

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
  const step = `${run.position + 1} of ${run.encounters.length}`;

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
        <button type="button" className="primary" onClick={onFight}>
          Fight
        </button>
      </section>
    );
  }

  if (encounter.kind === "ally") {
    const { character } = encounter;
    const type = archetypeOf(run.library, character);
    const room = canRecruit(run);
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
        {!room && <p className="muted small">Your party is full.</p>}
        <div className="button-row">
          <button
            type="button"
            className="primary"
            disabled={!room}
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
      </section>
    );
  }

  const found = gearOf(run, encounter.gearId);
  return (
    <section className="panel" aria-label="Encounter">
      <h2>
        Something in the grass <span className="muted small">{step}</span>
      </h2>
      {found ? (
        <p>
          <strong>{found.name}</strong> ({found.slot}): {gearSummary(found)}
        </p>
      ) : (
        <p>Nothing of use.</p>
      )}
      <div className="choices">
        {found &&
          run.party.map((member) => (
            <button
              key={member.id}
              type="button"
              className="secondary"
              onClick={() => onChange(resolveGear(run, member.id))}
            >
              Give to {member.name}
            </button>
          ))}
        <button
          type="button"
          className="secondary"
          onClick={() => onChange(resolveGear(run, null))}
        >
          {found ? "Keep in the bag" : "Move on"}
        </button>
      </div>
    </section>
  );
}
