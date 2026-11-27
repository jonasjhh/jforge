import { TRAITS } from "@jforge/melee/shared";
import {
  ALL_GEAR_CATEGORIES,
  GEAR_CATEGORY_NAMES,
  type Archetype,
  type Library,
} from "../shared";
import { ClassPaths } from "./ClassPaths";
import { SelectField, TextField } from "./fields";
import { PORTRAIT_OPTIONS, ROW_OPTIONS } from "./labels";
import { SkillPicker } from "./SkillPicker";
import { StatsFields } from "./StatsFields";
import { WeaponFields } from "./WeaponFields";

interface ArchetypeEditorProps {
  archetype: Archetype;
  /** The library, for its skills and other classes. */
  library: Library;
  onChange: (archetype: Archetype) => void;
  /** Opens a skill it knows in the skill editor. */
  onOpenSkill?: (id: string) => void;
  /** Opens another class in its editor. */
  onOpenClass?: (id: string) => void;
}

/** A class or enemy type: its stats, growth, weapon, traits and skills. */
export function ArchetypeEditor({
  archetype,
  library,
  onChange,
  onOpenSkill,
  onOpenClass,
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
      <SkillPicker
        known={archetype.skills}
        skills={library.skills}
        onChange={(known) => set({ skills: known })}
        onOpen={onOpenSkill}
      />
      {archetype.kind === "class" && (
        <ClassPaths
          archetype={archetype}
          library={library}
          onOpen={onOpenClass}
        />
      )}
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
