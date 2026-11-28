import { useState } from "react";
import { finishRound, roundFight, startRun, type Run } from "../shared";
import { FightView } from "./FightView";
import { PlanningScreen } from "./PlanningScreen";
import { RunOverScreen } from "./RunOverScreen";
import { StartScreen } from "./StartScreen";
import { loadRun, saveRun } from "./storage";

export function App() {
  const [run, setRun] = useState<Run | null>(loadRun);
  // Watching the round's fight. It follows from the run alone, so a
  // reload during one goes back to planning and the same fight.
  const [fighting, setFighting] = useState(false);

  const update = (next: Run | null) => {
    saveRun(next);
    setRun(next);
  };

  if (run === null) {
    // A run draws from its game's content (@jforge/content).
    const library = null;
    return (
      <StartScreen
        library={library}
        onStart={(seed) => update(startRun(library, seed))}
      />
    );
  }
  if (run.outcome !== "playing") {
    return <RunOverScreen run={run} onNew={() => update(null)} />;
  }
  const fight = fighting ? roundFight(run) : null;
  if (fight) {
    return (
      <FightView
        key={run.round}
        round={run.round}
        fight={fight}
        onDone={(won) => {
          setFighting(false);
          update(finishRound(run, won));
        }}
      />
    );
  }
  return (
    <PlanningScreen
      run={run}
      onChange={update}
      onFight={() => setFighting(true)}
      onAbandon={() => {
        if (window.confirm("Abandon this run?")) update(null);
      }}
    />
  );
}
