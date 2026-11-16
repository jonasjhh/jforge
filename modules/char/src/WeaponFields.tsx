import type { Weapon } from "@jforge/melee/shared";
import { SelectField, TextField } from "./fields";
import { DAMAGE_OPTIONS } from "./labels";

const COLUMN_OPTIONS = [
  ["0", "Own column"],
  ["1", "Own and neighbours"],
  ["2", "Two to each side"],
  ["any", "Any column"],
] as const;
const DEPTH_OPTIONS = [
  ["1", "Front-most unit"],
  ["2", "Front two units"],
  ["any", "Any unit (ignores cover)"],
] as const;
const KIND_OPTIONS = [
  ["melee", "Melee (rows matter)"],
  ["ranged", "Ranged"],
] as const;

const reach = (value: string): number | "any" =>
  value === "any" ? "any" : Number(value);

interface WeaponFieldsProps {
  legend: string;
  weapon: Weapon;
  onChange: (weapon: Weapon) => void;
}

/** How a weapon attacks: its reach, damage type and whether rows matter. */
export function WeaponFields({ legend, weapon, onChange }: WeaponFieldsProps) {
  return (
    <fieldset className="group">
      <legend>{legend}</legend>
      <TextField
        label="Weapon name"
        value={weapon.name}
        onChange={(name) => onChange({ ...weapon, name })}
      />
      <div className="grid-fields wide">
        <SelectField
          label="Columns"
          value={String(weapon.columns) as (typeof COLUMN_OPTIONS)[number][0]}
          options={COLUMN_OPTIONS}
          onChange={(v) => onChange({ ...weapon, columns: reach(v) })}
        />
        <SelectField
          label="Depth"
          value={String(weapon.depth) as (typeof DEPTH_OPTIONS)[number][0]}
          options={DEPTH_OPTIONS}
          onChange={(v) => onChange({ ...weapon, depth: reach(v) })}
        />
        <SelectField
          label="Damage type"
          value={weapon.damageType}
          options={DAMAGE_OPTIONS}
          onChange={(damageType) => onChange({ ...weapon, damageType })}
        />
        <SelectField
          label="Kind"
          value={weapon.kind}
          options={KIND_OPTIONS}
          onChange={(kind) => onChange({ ...weapon, kind })}
        />
      </div>
    </fieldset>
  );
}
