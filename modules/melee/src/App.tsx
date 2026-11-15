import { useState } from "react";
import type { BattleSetup, Difficulty } from "../shared";
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
      // Play again: the same encounter, a fresh battle seed.
      onRestart={() => setBattle({ ...battle, seed: newSeed() })}
      onExit={() => setBattle(null)}
    />
  );
}
