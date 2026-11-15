import { useState } from "react";
import { content } from "../shared";
import { BattleScreen } from "./battle/BattleScreen";
import { StartScreen } from "./StartScreen";

const newSeed = () => Math.floor(Math.random() * 1_000_000);

export function App() {
  const [seed, setSeed] = useState<number | null>(null);
  const setup = content.sampleBattle;

  if (seed === null) {
    return <StartScreen setup={setup} onStart={() => setSeed(newSeed())} />;
  }
  return (
    <BattleScreen
      key={seed}
      setup={setup}
      seed={seed}
      onRestart={() => setSeed(newSeed())}
      onExit={() => setSeed(null)}
    />
  );
}
