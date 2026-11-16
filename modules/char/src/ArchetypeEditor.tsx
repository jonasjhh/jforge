import { TRAITS, type Skill } from "@jforge/melee/shared";
import { MAX_LEVEL, clampLevel, type Archetype } from "../shared";
import { NumberField, SelectField, TextField } from "./fields";
import { PORTRAIT_OPTIONS, ROW_OPTIONS } from "./labels";
import { StatsFields } from "./StatsFields";
import { WeaponFields } from "./WeaponFields";

interface ArchetypeEditorProps {
  archetype: Archetype;
  /** Every skill in the library, to choose what it learns. */
  skills: Skill[];
  onChange: (archetype: Archetype) => void;
}

/** A class or enemy type: its stats, growth, weapon, traits and skills. */
export function ArchetypeEditor({
  archetype,
  skills,
  onChange,
}: ArchetypeEditorProps) {
  const set = (change: Partial<Archetype>) =>
    onChange({ ...archetype, ...change });
  const unlockOf = (skillId: string) =>
    archetype.skills.find((u) => u.skillId === skillId);
  return (
    <>
      <TextField
        label="Name"
        value={archetype.name}
        onChange={(name) => set({ name })}
      />
      <div className="grid-fields wide">
        <SelectField
          label="Icon"
          value={archetype.portrait}
          options={PORTRAIT_OPTIONS}
          onChange={(portrait) => set({ portrait })}
        />
        <SelectField
          label="Preferred row"
          value={String(archetype.preferredRow) as "0" | "1" | "2"}
          options={ROW_OPTIONS}
          onChange={(row) => set({ preferredRow: Number(row) })}
        />
        {archetype.kind === "enemy" && (
          <NumberField
            label="Threat"
            value={archetype.threat}
            min={1}
            onChange={(threat) => set({ threat: Math.max(1, threat) })}
          />
        )}
      </div>
      <StatsFields
        legend="Stats at level 1"
        stats={archetype.baseStats}
        onChange={(baseStats) => set({ baseStats })}
      />
      <StatsFields
        legend="Growth per level"
        stats={archetype.growth}
        step={0.1}
        onChange={(growth) => set({ growth })}
      />
      <WeaponFields
        legend="Unarmed attack"
        weapon={archetype.weapon}
        onChange={(weapon) => set({ weapon })}
      />
      <fieldset className="group">
        <legend>Skills and the level they are learned at</legend>
        {skills.length === 0 && (
          <p className="muted">No skills designed yet.</p>
        )}
        {skills.map((skill) => {
          const unlock = unlockOf(skill.id);
          return (
            <div className="check-row" key={skill.id}>
              <label>
                <input
                  type="checkbox"
                  checked={unlock !== undefined}
                  onChange={(e) =>
                    set({
                      skills: e.target.checked
                        ? [...archetype.skills, { skillId: skill.id, level: 1 }]
                        : archetype.skills.filter(
                            (u) => u.skillId !== skill.id,
                          ),
                    })
                  }
                />
                {skill.name}
              </label>
              {unlock && (
                <NumberField
                  label={`${skill.name} level`}
                  value={unlock.level}
                  min={1}
                  max={MAX_LEVEL}
                  onChange={(level) =>
                    set({
                      skills: archetype.skills.map((u) =>
                        u.skillId === skill.id
                          ? { ...u, level: clampLevel(level) }
                          : u,
                      ),
                    })
                  }
                />
              )}
            </div>
          );
        })}
      </fieldset>
      <fieldset className="group">
        <legend>Traits (default resistances)</legend>
        <div className="chips">
          {TRAITS.map((trait) => (
            <label key={trait} className="chip">
              <input
                type="checkbox"
                checked={archetype.traits.includes(trait)}
                onChange={(e) =>
                  set({
                    traits: e.target.checked
                      ? [...archetype.traits, trait]
                      : archetype.traits.filter((t) => t !== trait),
                  })
                }
              />
              {trait}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
