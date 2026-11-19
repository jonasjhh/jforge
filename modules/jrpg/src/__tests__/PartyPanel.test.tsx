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
  it("shows each member's class, level and experience", () => {
    show(at([battle]));
    const lines = screen.getAllByText(/ · Level /, { selector: "span" });
    expect(lines.map((l) => l.textContent)).toEqual([
      `Knight · Level 3 · 0 / ${xpToNext(3)} XP`,
      `Sage · Level 3 · 0 / ${xpToNext(3)} XP`,
    ]);
    expect(screen.getAllByText(/^Uses: /).length).toBeGreaterThan(0);
    expect(screen.getByText("Bag: empty")).toBeTruthy();
  });

  it("offers only bag gear the member's class can wear", () => {
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

  it("swaps gear with the bag", () => {
    const run = show(at([battle], { bag: ["gear-ring"] }));
    fireEvent.change(slot("Mira: Accessory"), {
      target: { value: "gear-ring" },
    });
    expect(run.current.party[1]!.gear.accessory).toBe("gear-ring");
    expect(run.current.bag).toEqual([]);
    fireEvent.change(slot("Aldric: Armor"), { target: { value: "" } });
    expect(run.current.party[0]!.gear.armor).toBeUndefined();
    expect(run.current.bag).toEqual(["gear-mail"]);
  });

  it("locks gear once the fight is on, or the run is lost", () => {
    show(at([battle], { committed: true }));
    expect(slot("Aldric: Weapon").disabled).toBe(true);
    cleanup();
    show(at([battle], { defeated: true }));
    expect(slot("Mira: Armor").disabled).toBe(true);
  });
});
