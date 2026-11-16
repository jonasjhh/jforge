import { STAT_NAMES, type Stats } from "@jforge/melee/shared";
import { NumberField } from "./fields";
import { STAT_LABELS } from "./labels";

interface StatsFieldsProps {
  legend: string;
  stats: Stats;
  step?: number;
  onChange: (stats: Stats) => void;
}

/** One number per stat, as a group. */
export function StatsFields({
  legend,
  stats,
  step = 1,
  onChange,
}: StatsFieldsProps) {
  return (
    <fieldset className="group">
      <legend>{legend}</legend>
      <div className="grid-fields">
        {STAT_NAMES.map((stat) => (
          <NumberField
            key={stat}
            label={STAT_LABELS[stat]}
            value={stats[stat]}
            step={step}
            min={0}
            onChange={(value) => onChange({ ...stats, [stat]: value })}
          />
        ))}
      </div>
    </fieldset>
  );
}
