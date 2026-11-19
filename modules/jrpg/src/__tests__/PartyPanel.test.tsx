// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { xpToNext, type Run } from "../../shared";
import { PartyPanel } from "../PartyPanel";
import { renderControlled } from "./controlled";
import { at, battle } from "./runs";

afterEach(cleanup);

const show = (run: Run) =>
  renderControlled(run, (value, onChange) => (
    <PartyPanel run={value} onChange={onChange} />
  ));
const slot = (label: string) =>
  screen.getByLabelText(label) as HTMLSelectElement;
const options = (label: string) =>
  Array.from(slot(label).options, (o) => o.textContent);

describe("PartyPanel", () => {
  it("given a party with an empty bag, when the panel shows, then each member's class, level, XP and weapons show, and the bag is empty", () => {
    show(at([battle]));

    const lines = screen.getAllByText(/ · Level /, { selector: "span" });
    expect(lines.map((l) => l.textContent)).toEqual([
      `Knight · Level 3 · 0 / ${xpToNext(3)} XP`,
      `Sage · Level 3 · 0 / ${xpToNext(3)} XP`,
    ]);
    expect(screen.getAllByText(/^Uses: /).length).toBeGreaterThan(0);
    expect(screen.getByText("Bag: empty")).toBeTruthy();
  });

  it("given rings and a bow in the bag, when the panel shows, then the bag lists them and a knight is offered only what they can wear", () => {
    show(at([battle], { bag: ["gear-ring", "gear-bow", "gear-ring"] }));

    expect(options("Aldric: Accessory")).toEqual([
      "None",
      expect.stringMatching(/^Swift Ring \(/),
    ]);
    expect(options("Aldric: Weapon")).toEqual(["None", "Iron Sword"]);
    expect(
      screen.getByText("Bag: Swift Ring, Short Bow, Swift Ring"),
    ).toBeTruthy();
  });

  it("given a ring in the bag, when a member puts it on, then they wear it and the bag is empty", () => {
    const run = show(at([battle], { bag: ["gear-ring"] }));

    fireEvent.change(slot("Mira: Accessory"), {
      target: { value: "gear-ring" },
    });

    expect(run.current.party[1]!.gear.accessory).toBe("gear-ring");
    expect(run.current.bag).toEqual([]);
  });

  it("given worn armor, when its slot is set to none, then the armor goes in the bag", () => {
    const run = show(at([battle]));

    fireEvent.change(slot("Aldric: Armor"), { target: { value: "" } });

    expect(run.current.party[0]!.gear.armor).toBeUndefined();
    expect(run.current.bag).toEqual(["gear-mail"]);
  });

  it.each([
    ["committed to a fight", { committed: true }],
    ["defeated", { defeated: true }],
  ])(
    "given a run %s, when the panel shows, then gear can't be changed",
    (_, changes) => {
      show(at([battle], changes));

      const weapon = slot("Aldric: Weapon");

      expect(weapon.disabled).toBe(true);
    },
  );
});
