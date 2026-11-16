import { useState } from "react";
import { BattleScreen } from "@jforge/melee/battle";
import {
  battleFor,
  loseBattle,
  startRun,
  winBattle,
  type Reward,
  type Run,
} from "../shared";
import { RunScreen } from "./RunScreen";
import { StartScreen } from "./StartScreen";
import { loadLibrary, loadRun, saveRun } from "./storage";

const newSeed = () => Math.floor(Math.random() * 1_000_000);

const BATTLE_LABELS = {
  exit: "← Retreat",
  won: "Collect rewards",
  lost: "End of the run",
  back: null,
};

export function App() {
  const [run, setRun] = useState<Run | null>(loadRun);
  // The battle being fought, by its battle seed; null on the map.
  const [fighting, setFighting] = useState<number | null>(null);
  // What the last battle paid, shown until the party moves on.
  const [reward, setReward] = useState<Reward | null>(null);

  const update = (next: Run | null) => {
    saveRun(next);
    setRun(next);
  };

  if (run === null) {
    return (
      <StartScreen
        library={loadLibrary()}
        onStart={(library) => update(startRun(library, newSeed()))}
      />
    );
  }

  const setup = fighting === null ? null : battleFor(run);
  if (fighting !== null && setup) {
    return (
      <BattleScreen
        key={fighting}
        setup={setup}
        seed={fighting}
        labels={BATTLE_LABELS}
        onRestart={(won) => {
          const result = won ? winBattle(run) : null;
          setReward(result?.reward ?? null);
          update(result ? result.run : loseBattle(run));
          setFighting(null);
        }}
        onExit={() => setFighting(null)}
      />
    );
  }

  return (
    <RunScreen
      run={run}
      reward={reward}
      onChange={(next) => {
        setReward(null);
        update(next);
      }}
      onFight={() => {
        setReward(null);
        setFighting(newSeed());
      }}
      onAbandon={() => {
        setReward(null);
        update(null);
      }}
    />
  );
}
