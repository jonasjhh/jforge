import { useState } from "react";
import { BattleScreen } from "@jforge/melee/battle";
import {
  battleFor,
  battleSeed,
  commitBattle,
  leaveBattle,
  loseBattle,
  startRun,
  winBattle,
  type Reward,
  type Run,
} from "../shared";
import { RunScreen } from "./RunScreen";
import { StartScreen } from "./StartScreen";
import { loadLibrary, loadRun, saveRun } from "./storage";

const BATTLE_LABELS = {
  exit: "← Retreat",
  exitCommitted: "Give up",
  won: "Collect rewards",
  lost: "End of the run",
  back: null,
};

export function App() {
  const [run, setRun] = useState<Run | null>(loadRun);
  // On the battle screen. A fight the party has acted in is never left
  // standing, so a run saved in one opens in it (from its start).
  const [fighting, setFighting] = useState(() => run?.committed === true);
  // What the last battle paid, shown until the party moves on.
  const [reward, setReward] = useState<Reward | null>(null);

  const update = (next: Run | null) => {
    saveRun(next);
    setRun(next);
  };

  if (run === null) {
    const library = loadLibrary();
    return (
      <StartScreen
        library={library}
        onStart={(seed) => update(startRun(library, seed))}
      />
    );
  }

  const setup = fighting ? battleFor(run) : null;
  if (setup) {
    return (
      <BattleScreen
        key={`${run.depth}-${run.position}`}
        setup={setup}
        seed={battleSeed(run)}
        labels={{
          ...BATTLE_LABELS,
          // A battle reopened after a reload is already committed.
          ...(run.committed ? { exit: BATTLE_LABELS.exitCommitted } : {}),
        }}
        onCommit={() => update(commitBattle(run))}
        onRestart={(won) => {
          const result = won ? winBattle(run) : null;
          setReward(result?.reward ?? null);
          update(result ? result.run : loseBattle(run));
          setFighting(false);
        }}
        onExit={() => {
          if (run.committed && !window.confirm("Give up? The run ends here.")) {
            return;
          }
          update(leaveBattle(run));
          setFighting(false);
        }}
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
        setFighting(true);
      }}
      onAbandon={() => {
        setReward(null);
        setFighting(false);
        update(null);
      }}
    />
  );
}
