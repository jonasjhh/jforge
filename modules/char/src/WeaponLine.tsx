import type { Weapon } from "@jforge/melee/shared";

const reach = (n: number | "any") => (n === "any" ? "any" : String(n));

/** How a weapon attacks, in one line. */
export function WeaponLine({ weapon }: { weapon: Weapon }) {
  return (
    <p>
      Attacks with <strong>{weapon.name}</strong>: {weapon.kind},{" "}
      {weapon.damageType} damage, reach {reach(weapon.columns)} across and{" "}
      {reach(weapon.depth)} deep.
    </p>
  );
}
