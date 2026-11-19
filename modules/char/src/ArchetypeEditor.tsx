import { TRAITS, type Skill } from "@jforge/melee/shared";
import {
  ALL_GEAR_CATEGORIES,
  GEAR_CATEGORY_NAMES,
  type Archetype,
} from "../shared";
import { SelectField, TextField } from "./fields";
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
      </div>
      <StatsFields
        legend="Stats at level 1"
        stats={archetype.baseStats}
        onChange={(baseStats) => set({ baseStats })}
      />
      <WeaponFields
        legend="Unarmed attack"
        weapon={archetype.weapon}
        onChange={(weapon) => set({ weapon })}
      />
      <fieldset className="group">
        <legend>Skills</legend>
        {skills.length === 0 && (
          <p className="muted">No skills designed yet.</p>
        )}
        {skills.map((skill) => (
          <div className="check-row" key={skill.id}>
            <label>
              <input
                type="checkbox"
                checked={archetype.skills.includes(skill.id)}
                onChange={(e) =>
                  set({
                    skills: e.target.checked
                      ? [...archetype.skills, skill.id]
                      : archetype.skills.filter((id) => id !== skill.id),
                  })
                }
              />
              {skill.name}
            </label>
          </div>
        ))}
      </fieldset>
      <fieldset className="group">
        <legend>Gear it can use</legend>
        <label className="chip">
          <input
            type="checkbox"
            checked={archetype.proficiencies === undefined}
            onChange={(e) => {
              const next = { ...archetype };
              if (e.target.checked) delete next.proficiencies;
              else next.proficiencies = [...ALL_GEAR_CATEGORIES];
              onChange(next);
            }}
          />
          Any gear
        </label>
        {archetype.proficiencies && (
          <div className="chips">
            {ALL_GEAR_CATEGORIES.map((category) => (
              <label key={category} className="chip">
                <input
                  type="checkbox"
                  checked={archetype.proficiencies!.includes(category)}
                  onChange={(e) =>
                    set({
                      proficiencies: e.target.checked
                        ? [...archetype.proficiencies!, category]
                        : archetype.proficiencies!.filter(
                            (c) => c !== category,
                          ),
                    })
                  }
                />
                {GEAR_CATEGORY_NAMES[category]}
              </label>
            ))}
          </div>
        )}
        <p className="muted small">
          Gear without a category, and every accessory, fits anyone.
        </p>
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
