import type { Skill, SkillEffect } from "@jforge/melee/shared";
import {
  EDITABLE_EFFECTS,
  EFFECT_LABELS,
  SKILL_FIELDS,
  STATUS_OPTIONS,
  defaultEffect,
  defaultTarget,
  effectFields,
  isEditable,
  readField,
  skillProblems,
  withSummonSource,
  writeField,
  type EditableEffect,
  type FieldSpec,
  type Library,
} from "../shared";
import { NumberField, SelectField, TextField } from "./fields";

const EFFECT_OPTIONS = EDITABLE_EFFECTS.map(
  (type) => [type, EFFECT_LABELS[type]] as const,
);

interface SkillEditorProps {
  skill: Skill;
  library: Library;
  onChange: (skill: Skill) => void;
}

export function SkillEditor({ skill, library, onChange }: SkillEditorProps) {
  const set = (change: Partial<Skill>) => onChange({ ...skill, ...change });
  const { effect } = skill;
  const problems = skillProblems(skill, library);
  return (
    <>
      <TextField
        label="Name"
        value={skill.name}
        onChange={(name) => set({ name })}
      />
      <TextField
        label="Description"
        value={skill.description}
        multiline
        onChange={(description) => set({ description })}
      />
      <Fields
        of={skill}
        specs={SKILL_FIELDS}
        library={library}
        onChange={onChange}
      />

      {isEditable(effect) ? (
        <fieldset className="group">
          <legend>Effect</legend>
          <SelectField
            label="Kind"
            value={effect.type as EditableEffect}
            options={EFFECT_OPTIONS}
            onChange={(type) => {
              const next = defaultEffect(type, library);
              if (next.type === "status") next.status.id = skill.id;
              set({ effect: next, target: defaultTarget(next) });
            }}
          />
          <Fields
            of={effect}
            specs={effectFields(effect)}
            library={library}
            onChange={(next: SkillEffect) => {
              const kindChanged =
                next.type === "status" &&
                effect.type === "status" &&
                next.status.effect !== effect.status.effect;
              set(
                kindChanged
                  ? { effect: next, target: defaultTarget(next) }
                  : { effect: next },
              );
            }}
          />
        </fieldset>
      ) : (
        <p className="muted">
          This skill's effect ({effect.type}) is unknown here; the rest can be
          edited.
        </p>
      )}
      {problems.map((problem) => (
        <p key={problem} className="bad" role="alert">
          {problem}
        </p>
      ))}
    </>
  );
}

interface FieldsProps<T extends object> {
  of: T;
  specs: FieldSpec[];
  library: Library;
  onChange: (next: T) => void;
}

/** A form drawn from field specs: inputs in a grid, flags as chips below. */
function Fields<T extends object>({
  of,
  specs,
  library,
  onChange,
}: FieldsProps<T>) {
  const write = (spec: FieldSpec, value: unknown) =>
    onChange(writeField(of, spec, value));
  const inputs = specs.filter((s) => s.kind !== "flag");
  const flags = specs.filter((s) => s.kind === "flag");
  return (
    <>
      {inputs.length > 0 && (
        <div className="grid-fields wide">
          {inputs.map((spec) => (
            <Control
              key={spec.path.join(".")}
              spec={spec}
              of={of}
              library={library}
              write={write}
              onChange={onChange}
            />
          ))}
        </div>
      )}
      {flags.length > 0 && (
        <div className="chips">
          {flags.map((spec) => (
            <label key={spec.path.join(".")} className="chip">
              <input
                type="checkbox"
                checked={readField(of, spec) === true}
                onChange={(e) => write(spec, e.target.checked)}
              />
              {spec.label}
            </label>
          ))}
        </div>
      )}
    </>
  );
}

interface ControlProps<T extends object> {
  spec: FieldSpec;
  of: T;
  library: Library;
  write: (spec: FieldSpec, value: unknown) => void;
  onChange: (next: T) => void;
}

function Control<T extends object>({
  spec,
  of,
  library,
  write,
  onChange,
}: ControlProps<T>) {
  const value = readField(of, spec);
  switch (spec.kind) {
    case "number":
      return (
        <NumberField
          label={spec.label}
          value={value as number}
          step={spec.step}
          min={spec.min}
          max={spec.max}
          onChange={(v) => write(spec, v)}
        />
      );
    case "text":
      return (
        <TextField
          label={spec.label}
          value={(value as string) ?? ""}
          onChange={(v) => write(spec, v)}
        />
      );
    case "select":
      return (
        <SelectField
          label={spec.label}
          value={value as string}
          options={spec.options}
          onChange={(v) => write(spec, v)}
        />
      );
    case "statusKind":
      return (
        <SelectField
          label={spec.label}
          value={value as string}
          options={STATUS_OPTIONS}
          onChange={(v) => write(spec, v)}
        />
      );
    case "creature":
      return (
        <CreatureFields
          effect={of as unknown as SkillEffect}
          library={library}
          onChange={(next) => onChange(next as unknown as T)}
        />
      );
    case "flag":
      return null;
  }
}

interface CreatureFieldsProps {
  effect: SkillEffect;
  library: Library;
  onChange: (effect: SkillEffect) => void;
}

/** A summon's enemy type; the creature is compiled from it. */
function CreatureFields({ effect, library, onChange }: CreatureFieldsProps) {
  if (effect.type !== "summon") return null;
  const enemies = library.archetypes.filter((a) => a.kind === "enemy");
  const options = [
    ["", "Pick an enemy type"] as const,
    ...enemies.map((a) => [a.id, a.name] as const),
  ];
  const source = effect.source;
  return (
    <>
      <SelectField
        label="Creature (enemy type)"
        value={source?.archetypeId ?? ""}
        options={options}
        onChange={(id) => {
          if (id) onChange(withSummonSource(library, effect, id));
        }}
      />
    </>
  );
}
