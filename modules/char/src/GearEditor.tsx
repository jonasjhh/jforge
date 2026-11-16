import { content } from "@jforge/melee/shared";
import {
  GEAR_SLOTS,
  type Gear,
  type GearSlot,
  type StatBonus,
} from "../shared";
import { NumberField, SelectField, TextField } from "./fields";
import { STAT_OPTIONS } from "./labels";
import { WeaponFields } from "./WeaponFields";

const SLOT_LABELS: Record<GearSlot, string> = {
  weapon: "Weapon",
  armor: "Armor",
  accessory: "Accessory",
};
const SLOT_OPTIONS = GEAR_SLOTS.map(
  (slot) => [slot, SLOT_LABELS[slot]] as const,
);
const OP_OPTIONS = [
  ["add", "Add"],
  ["mul", "Multiply by"],
] as const;

interface GearEditorProps {
  gear: Gear;
  onChange: (gear: Gear) => void;
}

export function GearEditor({ gear, onChange }: GearEditorProps) {
  const setBonus = (index: number, bonus: StatBonus) =>
    onChange({
      ...gear,
      bonuses: gear.bonuses.map((b, i) => (i === index ? bonus : b)),
    });
  const setSlot = (slot: GearSlot) => {
    const next: Gear = { ...gear, slot };
    // A weapon needs to say how it attacks; other gear must not.
    if (slot === "weapon") {
      next.weapon ??= { ...content.sword, id: gear.id, name: gear.name };
    } else delete next.weapon;
    onChange(next);
  };
  return (
    <>
      <TextField
        label="Name"
        value={gear.name}
        onChange={(name) => onChange({ ...gear, name })}
      />
      <SelectField
        label="Slot"
        value={gear.slot}
        options={SLOT_OPTIONS}
        onChange={setSlot}
      />
      <fieldset className="group">
        <legend>Stat bonuses</legend>
        {gear.bonuses.map((bonus, i) => (
          <div className="bonus-row" key={i}>
            <SelectField
              label="Stat"
              value={bonus.stat}
              options={STAT_OPTIONS}
              onChange={(stat) => setBonus(i, { ...bonus, stat })}
            />
            <SelectField
              label="Change"
              value={bonus.op}
              options={OP_OPTIONS}
              onChange={(op) =>
                setBonus(i, { ...bonus, op, value: op === "mul" ? 1.1 : 5 })
              }
            />
            <NumberField
              label="Value"
              value={bonus.value}
              step={bonus.op === "mul" ? 0.05 : 1}
              onChange={(value) => setBonus(i, { ...bonus, value })}
            />
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove bonus ${i + 1}`}
              onClick={() =>
                onChange({
                  ...gear,
                  bonuses: gear.bonuses.filter((_, j) => j !== i),
                })
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            onChange({
              ...gear,
              bonuses: [
                ...gear.bonuses,
                { stat: "attack", op: "add", value: 5 },
              ],
            })
          }
        >
          Add bonus
        </button>
      </fieldset>
      {gear.slot === "weapon" && gear.weapon && (
        <WeaponFields
          legend="How it attacks"
          weapon={gear.weapon}
          onChange={(weapon) => onChange({ ...gear, weapon })}
        />
      )}
    </>
  );
}
