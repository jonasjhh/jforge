import {
  GEAR_CATEGORY_NAMES,
  GEAR_SLOTS,
  archetypeOf,
  canWear,
  type Character,
  type GearSlot,
} from "@jforge/rules/core";
import { changeGear, gearOf, gearSummary, xpToNext, type Run } from "../shared";

const SLOT_LABELS: Record<GearSlot, string> = {
  weapon: "Weapon",
  armor: "Armor",
  accessory: "Accessory",
};

interface PartyPanelProps {
  run: Run;
  onChange: (run: Run) => void;
}

/** The party between encounters: levels, and gear to swap with the bag. */
export function PartyPanel({ run, onChange }: PartyPanelProps) {
  // What in the bag fits the slot and the member's class.
  const inBag = (member: Character, slot: GearSlot) =>
    [...new Set(run.bag)].flatMap((id) => {
      const gear = gearOf(run, id);
      return gear && gear.slot === slot && canWear(run.library, member, gear)
        ? [gear]
        : [];
    });
  return (
    <section className="panel" aria-label="Party">
      <h2>Party</h2>
      {run.party.map((member) => {
        const type = archetypeOf(run.library, member);
        const needed = xpToNext(member.level);
        return (
          <div key={member.id} className="member">
            <p className="member-name">
              <strong>{member.name}</strong>{" "}
              <span className="muted small">
                {type?.name} · Level {member.level}
                {needed > 0 && ` · ${member.xp} / ${needed} XP`}
              </span>
            </p>
            {type?.proficiencies && (
              <p className="muted small member-uses">
                Uses:{" "}
                {type.proficiencies
                  .map((c) => GEAR_CATEGORY_NAMES[c])
                  .join(", ")}
              </p>
            )}
            <div className="member-gear">
              {GEAR_SLOTS.map((slot) => {
                const worn = gearOf(run, member.gear[slot]);
                return (
                  <label key={slot} className="gear-slot">
                    <span className="muted small">{SLOT_LABELS[slot]}</span>
                    <select
                      aria-label={`${member.name}: ${SLOT_LABELS[slot]}`}
                      value={worn?.id ?? ""}
                      disabled={run.defeated || run.committed === true}
                      onChange={(e) =>
                        onChange(
                          changeGear(
                            run,
                            member.id,
                            slot,
                            e.target.value || null,
                          ),
                        )
                      }
                    >
                      <option value="">None</option>
                      {worn && <option value={worn.id}>{worn.name}</option>}
                      {inBag(member, slot)
                        .filter((g) => g.id !== worn?.id)
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({gearSummary(g)})
                          </option>
                        ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="muted small">
        Bag:{" "}
        {run.bag.map((id) => gearOf(run, id)?.name ?? "?").join(", ") ||
          "empty"}
      </p>
    </section>
  );
}
