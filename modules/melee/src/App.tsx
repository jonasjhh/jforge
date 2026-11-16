import { useState } from "react";
import { randomEncounter, type BattleSetup, type Difficulty } from "../shared";
import { BattleScreen } from "./battle/BattleScreen";
import { StartScreen } from "./StartScreen";

const newSeed = () => Math.floor(Math.random() * 1_000_000);

export function App() {
  // Kept here so the chosen encounter survives a battle and coming back.
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [encounterSeed, setEncounterSeed] = useState(newSeed);
  const [battle, setBattle] = useState<{
    setup: BattleSetup;
    seed: number;
  } | null>(null);

  if (battle === null) {
    return (
      <StartScreen
        difficulty={difficulty}
        encounterSeed={encounterSeed}
        onDifficulty={setDifficulty}
        onReroll={() => setEncounterSeed(newSeed())}
        onStart={(setup) => setBattle({ setup, seed: newSeed() })}
      />
    );
  }
  return (
    <BattleScreen
      key={battle.seed}
      setup={battle.setup}
      seed={battle.seed}
      onRestart={(won) => {
        if (!won) {
          // Retry: the same encounter, a fresh battle seed.
          setBattle({ ...battle, seed: newSeed() });
          return;
        }
        // Next battle: a new random encounter at the chosen difficulty.
        const next = newSeed();
        setEncounterSeed(next);
        setBattle({
          setup: randomEncounter(next, difficulty),
          seed: newSeed(),
        });
      }}
      onExit={() => setBattle(null)}
    />
  );
}
