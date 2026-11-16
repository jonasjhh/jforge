import type { Skill, SkillEffect } from "@jforge/melee/shared";
import {
  EDITABLE_EFFECTS,
  EFFECT_LABELS,
  defaultEffect,
  defaultTarget,
  isEditable,
  skillProblems,
  type EditableEffect,
} from "../shared";
import { NumberField, SelectField, TextField } from "./fields";
import { DAMAGE_OPTIONS, STAT_OPTIONS } from "./labels";

const TARGET_OPTIONS = [
  ["enemy", "An enemy"],
  ["ally", "An ally"],
  ["self", "Itself"],
  ["any", "Any cell"],
] as const;
const AREA_OPTIONS = [
  ["single", "One unit"],
  ["plus", "Plus (5 cells)"],
  ["square", "Square (3×3)"],
  ["line", "Line of two"],
  ["reach", "Everyone in weapon reach"],
] as const;
const EFFECT_OPTIONS = EDITABLE_EFFECTS.map(
  (type) => [type, EFFECT_LABELS[type]] as const,
);
const OP_OPTIONS = [
  ["mul", "Multiply by"],
  ["add", "Add"],
] as const;
const HARM_OPTIONS = [
  ["no", "Helps (buff)"],
  ["yes", "Harms (debuff)"],
] as const;

interface SkillEditorProps {
  skill: Skill;
  onChange: (skill: Skill) => void;
}

export function SkillEditor({ skill, onChange }: SkillEditorProps) {
  const set = (change: Partial<Skill>) => onChange({ ...skill, ...change });
  const setEffect = (effect: SkillEffect) => set({ effect });
  const { effect } = skill;
  const problems = skillProblems(skill);
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
      <div className="grid-fields wide">
        <NumberField
          label="MP cost"
          value={skill.mpCost}
          min={0}
          onChange={(mpCost) => set({ mpCost })}
        />
        <NumberField
          label="Cast time (0 = instant)"
          value={skill.castTime ?? 0}
          min={0}
          step={10}
          onChange={(castTime) => {
            const next = { ...skill };
            if (castTime > 0) next.castTime = castTime;
            else delete next.castTime;
            onChange(next);
          }}
        />
        <SelectField
          label="Target"
          value={skill.target}
          options={TARGET_OPTIONS}
          onChange={(target) => set({ target })}
        />
        <SelectField
          label="Area"
          value={skill.area}
          options={AREA_OPTIONS}
          onChange={(area) => set({ area })}
        />
      </div>

      {isEditable(effect) ? (
        <fieldset className="group">
          <legend>Effect</legend>
          <SelectField
            label="Kind"
            value={effect.type as EditableEffect}
            options={EFFECT_OPTIONS}
            onChange={(type) => {
              const next = defaultEffect(type);
              set({ effect: next, target: defaultTarget(next) });
            }}
          />
          <div className="grid-fields wide">
            {(effect.type === "damage" ||
              effect.type === "strike" ||
              effect.type === "heal") && (
              <NumberField
                label={
                  effect.type === "strike"
                    ? "Power (× attack)"
                    : "Power (× magic)"
                }
                value={effect.power}
                step={0.1}
                min={0}
                onChange={(power) => setEffect({ ...effect, power })}
              />
            )}
            {effect.type === "damage" && (
              <>
                <SelectField
                  label="Damage type"
                  value={effect.element}
                  options={DAMAGE_OPTIONS}
                  onChange={(element) => setEffect({ ...effect, element })}
                />
                <NumberField
                  label="Drain (share healed)"
                  value={effect.drain ?? 0}
                  step={0.1}
                  min={0}
                  max={1}
                  onChange={(drain) => {
                    const next = { ...effect };
                    if (drain > 0) next.drain = drain;
                    else delete next.drain;
                    setEffect(next);
                  }}
                />
              </>
            )}
            {effect.type === "strike" && (
              <NumberField
                label="Push rows (− pulls)"
                value={effect.push ?? 0}
                min={-2}
                max={2}
                onChange={(push) => {
                  const next = { ...effect };
                  if (push !== 0) next.push = push;
                  else delete next.push;
                  setEffect(next);
                }}
              />
            )}
            {effect.type === "modify" && (
              <>
                <TextField
                  label="Shown as"
                  value={effect.modifier.name}
                  onChange={(name) =>
                    setEffect({
                      ...effect,
                      modifier: { ...effect.modifier, name },
                    })
                  }
                />
                <SelectField
                  label="Stat"
                  value={effect.modifier.stat}
                  options={STAT_OPTIONS}
                  onChange={(stat) =>
                    setEffect({
                      ...effect,
                      modifier: { ...effect.modifier, stat },
                    })
                  }
                />
                <SelectField
                  label="Change"
                  value={effect.modifier.op}
                  options={OP_OPTIONS}
                  onChange={(op) =>
                    setEffect({
                      ...effect,
                      modifier: { ...effect.modifier, op },
                    })
                  }
                />
                <NumberField
                  label="Value"
                  value={effect.modifier.value}
                  step={0.1}
                  onChange={(value) =>
                    setEffect({
                      ...effect,
                      modifier: { ...effect.modifier, value },
                    })
                  }
                />
                <NumberField
                  label="Duration (game time)"
                  value={effect.modifier.duration}
                  step={10}
                  min={0}
                  onChange={(duration) =>
                    setEffect({
                      ...effect,
                      modifier: { ...effect.modifier, duration },
                    })
                  }
                />
                <SelectField
                  label="Nature"
                  value={effect.modifier.harmful ? "yes" : "no"}
                  options={HARM_OPTIONS}
                  onChange={(harm) =>
                    setEffect({
                      ...effect,
                      modifier: { ...effect.modifier, harmful: harm === "yes" },
                    })
                  }
                />
              </>
            )}
          </div>
        </fieldset>
      ) : (
        <p className="muted">
          This skill's effect ({effect.type}) can't be edited here yet; the rest
          can.
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
