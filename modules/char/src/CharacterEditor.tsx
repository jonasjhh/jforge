import { STAT_NAMES, THREAT_BUDGET } from "@jforge/melee/shared";
import {
  GEAR_SLOTS,
  archetypeOf,
  characterStats,
  characterWeapon,
  canWear,
  equip,
  unequip,
  toCombatantDef,
  archetypeSkills,
  type Character,
  type GearSlot,
  type Library,
} from "../shared";
import { SelectField, TextField } from "./fields";
import { STAT_LABELS } from "./labels";

const SLOT_LABELS: Record<GearSlot, string> = {
  weapon: "Weapon",
  armor: "Armor",
  accessory: "Accessory",
};

interface CharacterEditorProps {
  library: Library;
  character: Character;
  onChange: (character: Character) => void;
}

/** One character: its type and gear, and the stats they add up to. */
export function CharacterEditor({
  library,
  character,
  onChange,
}: CharacterEditorProps) {
  const archetype = archetypeOf(library, character);
  const stats = characterStats(library, character);
  const threat = toCombatantDef(library, character)?.threat ?? 0;
  return (
    <>
      <TextField
        label="Name"
        value={character.name}
        onChange={(name) => onChange({ ...character, name })}
      />
      <div className="grid-fields wide">
        <SelectField
          label="Class or enemy type"
          value={character.archetypeId}
          options={library.archetypes.map(
            (a) => [a.id, `${a.name} (${a.kind})`] as const,
          )}
          onChange={(archetypeId) => onChange({ ...character, archetypeId })}
        />
      </div>

      <fieldset className="group">
        <legend>Gear</legend>
        <div className="grid-fields wide">
          {GEAR_SLOTS.map((slot) => (
            <SelectField
              key={slot}
              label={SLOT_LABELS[slot]}
              value={character.gear[slot] ?? ""}
              options={[
                ["", "None"] as const,
                ...library.gear
                  .filter(
                    (g) =>
                      g.slot === slot &&
                      (canWear(library, character, g) ||
                        g.id === character.gear[slot]),
                  )
                  .map(
                    (g) =>
                      [
                        g.id,
                        canWear(library, character, g)
                          ? g.name
                          : `${g.name} (can't use)`,
                      ] as const,
                  ),
              ]}
              onChange={(id) => {
                const gear = library.gear.find((g) => g.id === id);
                onChange(
                  gear ? equip(character, gear) : unequip(character, slot),
                );
              }}
            />
          ))}
        </div>
      </fieldset>

      {archetype && stats && (
        <>
          <table className="stats" aria-label="Stats">
            <thead>
              <tr>
                <th scope="col">Stat</th>
                <th scope="col">Base</th>
                <th scope="col">With gear</th>
              </tr>
            </thead>
            <tbody>
              {STAT_NAMES.map((stat) => {
                const diff = stats.total[stat] - stats.base[stat];
                return (
                  <tr key={stat}>
                    <th scope="row">{STAT_LABELS[stat]}</th>
                    <td>{stats.base[stat]}</td>
                    <td className={diff > 0 ? "good" : diff < 0 ? "bad" : ""}>
                      {stats.total[stat]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted">
            Attacks with{" "}
            <strong>
              {characterWeapon(library, archetype, character).name}
            </strong>
            . Skills:{" "}
            {archetypeSkills(library, archetype)
              .map((s) => s.name)
              .join(", ") || "none yet"}
            .
          </p>
          {archetype.kind === "enemy" && (
            <p className="muted">
              Threat <strong>{threat}</strong>: an encounter spends{" "}
              {THREAT_BUDGET.normal} on Normal, so about{" "}
              {Math.max(1, Math.floor(THREAT_BUDGET.normal / threat))} of these.
            </p>
          )}
        </>
      )}
    </>
  );
}
