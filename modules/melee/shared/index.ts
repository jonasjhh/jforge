// Melee's public rules, importable by other modules as "@jforge/melee/shared".
// Placeholder: a single strike between two fighters.

export interface Fighter {
  name: string;
  attack: number;
  defense: number;
  hp: number;
}

export interface StrikeResult {
  attacker: string;
  defender: string;
  damage: number;
  defenderHp: number;
  knockedOut: boolean;
}

/** Every hit lands for at least 1 damage; hp never drops below 0. */
export function strike(attacker: Fighter, defender: Fighter): StrikeResult {
  const damage = Math.max(1, attacker.attack - defender.defense);
  const defenderHp = Math.max(0, defender.hp - damage);
  return {
    attacker: attacker.name,
    defender: defender.name,
    damage,
    defenderHp,
    knockedOut: defenderHp === 0,
  };
}
