import { STAT_NAMES, THREAT_BUDGET } from "@jforge/melee/shared";
import {
  GEAR_SLOTS,
  MAX_LEVEL,
  archetypeOf,
  characterStats,
  characterWeapon,
  clampLevel,
  canWear,
  equip,
  gainXp,
  unequip,
  toCombatantDef,
  unlockedSkills,
  xpToNext,
  type Character,
  type GearSlot,
  type Library,
} from "../shared";
import { NumberField, SelectField, TextField } from "./fields";
import { STAT_LABELS } from "./labels";

const SLOT_LABELS: Record<GearSlot, string> = {
  weapon: "Weapon",
  armor: "Armor",
  accessory: "Accessory",
};
const XP_STEP = 100;

interface CharacterEditorProps {
  library: Library;
  character: Character;
  onChange: (character: Character) => void;
}

/** One character: its type, level and gear, and the stats they add up to. */
export function CharacterEditor({
  library,
  character,
  onChange,
}: CharacterEditorProps) {
  const archetype = archetypeOf(library, character);
  const stats = characterStats(library, character);
  const needed = xpToNext(character.level);
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
        <NumberField
          label={`Level (1–${MAX_LEVEL})`}
          value={character.level}
          min={1}
          max={MAX_LEVEL}
          onChange={(level) =>
            onChange({ ...character, level: clampLevel(level), xp: 0 })
          }
        />
      </div>
      <p className="xp">
        <span>
          {needed > 0
            ? `XP ${character.xp} / ${needed} to level ${character.level + 1}`
            : "Top level"}
        </span>
        <button
          type="button"
          className="secondary"
          disabled={needed === 0}
          onClick={() =>
            onChange({ ...character, ...gainXp(character, XP_STEP) })
          }
        >
          +{XP_STEP} XP
        </button>
      </p>

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
                <th scope="col">Level {character.level}</th>
                <th scope="col">With gear</th>
              </tr>
            </thead>
            <tbody>
              {STAT_NAMES.map((stat) => {
                const diff = stats.total[stat] - stats.leveled[stat];
                return (
                  <tr key={stat}>
                    <th scope="row">{STAT_LABELS[stat]}</th>
                    <td>{stats.leveled[stat]}</td>
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
            {unlockedSkills(library, archetype, character.level)
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
