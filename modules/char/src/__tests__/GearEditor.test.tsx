// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { blankGear, type Gear } from "../../shared";
import { GearEditor } from "../GearEditor";
import { renderControlled } from "./controlled";

afterEach(cleanup);

const edit = (gear: Gear = blankGear("gear-1")) =>
  renderControlled(gear, (value, onChange) => (
    <GearEditor gear={value} onChange={onChange} />
  ));
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const bonuses = () => screen.getByRole("group", { name: "Stat bonuses" });

describe("GearEditor", () => {
  it("renames the gear", () => {
    const gear = edit();
    change("Name", "Helm");
    expect(gear.current.name).toBe("Helm");
  });

  it("gives gear made a weapon an attack named after it", () => {
    const gear = edit({ ...blankGear("gear-1"), name: "Club" });
    change("Slot", "weapon");
    expect(gear.current.slot).toBe("weapon");
    expect(gear.current.weapon).toMatchObject({ id: "gear-1", name: "Club" });
    expect(screen.getByRole("group", { name: "How it attacks" })).toBeTruthy();
  });

  it("drops the attack and the category when it stops being a weapon", () => {
    const gear = edit();
    change("Slot", "weapon");
    change("Category", "bow");
    expect(gear.current.category).toBe("bow");
    change("Slot", "accessory");
    expect(gear.current.weapon).toBeUndefined();
    expect(gear.current.category).toBeUndefined();
    // Accessories have no categories to choose from.
    expect(screen.queryByLabelText("Category")).toBeNull();
  });

  it("sets and clears the category", () => {
    const gear = edit();
    change("Category", "robe");
    expect(gear.current.category).toBe("robe");
    change("Category", "");
    expect("category" in gear.current).toBe(false);
  });

  it("adds, edits and removes stat bonuses", () => {
    const gear = edit();
    fireEvent.click(screen.getByRole("button", { name: "Add bonus" }));
    expect(gear.current.bonuses).toHaveLength(2);
    expect(gear.current.bonuses[1]).toEqual({
      stat: "attack",
      op: "add",
      value: 5,
    });
    const second = within(bonuses()).getAllByLabelText("Stat")[1]!;
    fireEvent.change(second, { target: { value: "speed" } });
    fireEvent.change(within(bonuses()).getAllByLabelText("Value")[1]!, {
      target: { value: "8" },
    });
    expect(gear.current.bonuses[1]).toEqual({
      stat: "speed",
      op: "add",
      value: 8,
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove bonus 1" }));
    expect(gear.current.bonuses).toEqual([
      { stat: "speed", op: "add", value: 8 },
    ]);
  });

  it("starts a changed kind of bonus at a sensible value", () => {
    const gear = edit();
    change("Change", "mul");
    expect(gear.current.bonuses[0]).toMatchObject({ op: "mul", value: 1.1 });
    change("Change", "add");
    expect(gear.current.bonuses[0]).toMatchObject({ op: "add", value: 5 });
  });

  it("edits how a weapon attacks", () => {
    const gear = edit();
    change("Slot", "weapon");
    change("Weapon name", "Long Club");
    change("Columns", "any");
    change("Depth", "2");
    change("Damage type", "pierce");
    fireEvent.change(
      within(
        screen.getByRole("group", { name: "How it attacks" }),
      ).getByLabelText("Kind"),
      { target: { value: "ranged" } },
    );
    expect(gear.current.weapon).toMatchObject({
      name: "Long Club",
      columns: "any",
      depth: 2,
      damageType: "pierce",
      kind: "ranged",
    });
  });
});
