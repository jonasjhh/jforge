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

const asWeapon = (gear: Gear = blankGear("gear-1")) => {
  const edited = edit(gear);
  change("Slot", "weapon");
  return edited;
};

describe("GearEditor", () => {
  it("given gear, when it is renamed, then it has the new name", () => {
    const gear = edit();

    change("Name", "Helm");

    expect(gear.current.name).toBe("Helm");
  });

  it("given gear called Club, when it is made a weapon, then it gets an attack named after it", () => {
    const gear = edit({ ...blankGear("gear-1"), name: "Club" });

    change("Slot", "weapon");

    expect(gear.current.slot).toBe("weapon");
    expect(gear.current.weapon).toMatchObject({ id: "gear-1", name: "Club" });
    expect(screen.getByRole("group", { name: "How it attacks" })).toBeTruthy();
  });

  it("given a weapon, when its category is set to bow, then it is a bow", () => {
    const gear = asWeapon();

    change("Category", "bow");

    expect(gear.current.category).toBe("bow");
  });

  it("given a bow, when it becomes an accessory, then its attack and category go, and there are no categories to choose", () => {
    const gear = asWeapon();
    change("Category", "bow");

    change("Slot", "accessory");

    expect(gear.current.weapon).toBeUndefined();
    expect(gear.current.category).toBeUndefined();
    expect(screen.queryByLabelText("Category")).toBeNull();
  });

  it("given armor, when its category is set to robe, then it is a robe", () => {
    const gear = edit();

    change("Category", "robe");

    expect(gear.current.category).toBe("robe");
  });

  it("given a robe, when its category is cleared, then it has none", () => {
    const gear = edit();
    change("Category", "robe");

    change("Category", "");

    expect("category" in gear.current).toBe(false);
  });

  it("given gear with one bonus, when a bonus is added, then a second +5 attack bonus follows it", () => {
    const gear = edit();

    fireEvent.click(screen.getByRole("button", { name: "Add bonus" }));

    expect(gear.current.bonuses).toHaveLength(2);
    expect(gear.current.bonuses[1]).toEqual({
      stat: "attack",
      op: "add",
      value: 5,
    });
  });

  it("given a second bonus, when its stat becomes speed, then it is +5 speed", () => {
    const gear = edit();
    fireEvent.click(screen.getByRole("button", { name: "Add bonus" }));

    fireEvent.change(within(bonuses()).getAllByLabelText("Stat")[1]!, {
      target: { value: "speed" },
    });

    expect(gear.current.bonuses[1]).toEqual({
      stat: "speed",
      op: "add",
      value: 5,
    });
  });

  it("given a second bonus, when its value becomes 8, then it is +8 attack", () => {
    const gear = edit();
    fireEvent.click(screen.getByRole("button", { name: "Add bonus" }));

    fireEvent.change(within(bonuses()).getAllByLabelText("Value")[1]!, {
      target: { value: "8" },
    });

    expect(gear.current.bonuses[1]).toEqual({
      stat: "attack",
      op: "add",
      value: 8,
    });
  });

  it("given two bonuses, when the first is removed, then only the second is left", () => {
    const gear = edit();
    fireEvent.click(screen.getByRole("button", { name: "Add bonus" }));
    fireEvent.change(within(bonuses()).getAllByLabelText("Stat")[1]!, {
      target: { value: "speed" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove bonus 1" }));

    expect(gear.current.bonuses).toEqual([
      { stat: "speed", op: "add", value: 5 },
    ]);
  });

  it("given an added bonus, when it becomes a multiplier, then it starts at ×1.1", () => {
    const gear = edit();

    change("Change", "mul");

    expect(gear.current.bonuses[0]).toMatchObject({ op: "mul", value: 1.1 });
  });

  it("given a multiplier bonus, when it becomes an addition, then it starts at +5", () => {
    const gear = edit();
    change("Change", "mul");

    change("Change", "add");

    expect(gear.current.bonuses[0]).toMatchObject({ op: "add", value: 5 });
  });

  it.each([
    ["Weapon name", "Long Club", { name: "Long Club" }],
    ["Columns", "any", { columns: "any" }],
    ["Depth", "2", { depth: 2 }],
    ["Damage type", "pierce", { damageType: "pierce" }],
  ] as const)(
    "given a weapon, when its %s is set to %s, then its attack has it",
    (label, value, attack) => {
      const gear = asWeapon();

      change(label, value);

      expect(gear.current.weapon).toMatchObject(attack);
    },
  );

  it("given a weapon, when its attack kind becomes ranged, then it attacks from range", () => {
    const gear = asWeapon();
    const attack = screen.getByRole("group", { name: "How it attacks" });

    fireEvent.change(within(attack).getByLabelText("Kind"), {
      target: { value: "ranged" },
    });

    expect(gear.current.weapon).toMatchObject({ kind: "ranged" });
  });
});
