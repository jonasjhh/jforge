// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { content, type Skill } from "@jforge/melee/shared";
import { SkillPicker } from "../SkillPicker";
import { renderControlled } from "./controlled";

afterEach(cleanup);

const named = (n: number): Skill => ({
  ...content.heal,
  id: `skill-${n}`,
  name: `Skill ${n}`,
});

function pick(
  skills: Skill[],
  known: string[] = [],
  onOpen?: (id: string) => void,
) {
  return renderControlled(known, (value, onChange) => (
    <SkillPicker
      known={value}
      skills={skills}
      onChange={onChange}
      onOpen={onOpen}
    />
  ));
}

const offers = () =>
  within(screen.getByRole("list", { name: "Skills to add" }))
    .queryAllByRole("button")
    .map((b) => b.getAttribute("aria-label"));
const find = (value: string) =>
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Find a skill to add" }),
    { target: { value } },
  );

describe("SkillPicker", () => {
  it("given a class that knows Heal, when the picker shows, then Heal is known and only Fireball is offered", () => {
    pick([content.fireball, content.heal], [content.heal.id]);

    const known = screen.getByRole("list", { name: "Known skills" });

    expect(known.textContent).toContain("Heal");
    expect(offers()).toEqual(["Add Fireball"]);
  });

  it("given a class that knows nothing, when the picker shows, then it says so", () => {
    pick([content.heal]);

    const note = screen.getByText("Knows no skills yet.");

    expect(note).toBeTruthy();
  });

  it("given a class that knows every skill, when the picker shows, then nothing is offered and it says so", () => {
    pick([content.heal], [content.heal.id]);

    const note = screen.getByText("Knows every skill.");

    expect(note).toBeTruthy();
    expect(offers()).toEqual([]);
  });

  it("given a known skill that was deleted, when the picker shows, then it is not listed", () => {
    pick([content.heal], ["skill-gone"]);

    const note = screen.getByText("Knows no skills yet.");

    expect(note).toBeTruthy();
  });

  it("given two skills, when the search matches one, then only that one is offered", () => {
    pick([content.fireball, content.heal]);

    find("fire");

    expect(offers()).toEqual(["Add Fireball"]);
  });

  it("given two skills, when the search matches what one does, then only that one is offered", () => {
    pick([content.fireball, content.heal]);

    find("heals");

    expect(offers()).toEqual(["Add Heal"]);
  });

  it("given two skills, when the search matches none, then it says so", () => {
    pick([content.fireball, content.heal]);

    find("zap ");

    expect(screen.getByText("No other skill matches “zap”.")).toBeTruthy();
  });

  it("given ten skills, when the picker shows, then it offers eight and a way to see all ten", () => {
    pick(Array.from({ length: 10 }, (_, i) => named(i)));

    const showAll = screen.getByRole("button", { name: "Show all 10" });

    expect(offers()).toHaveLength(8);
    expect(showAll).toBeTruthy();
  });

  it("given ten skills, when Show all is pressed, then all ten are offered", () => {
    pick(Array.from({ length: 10 }, (_, i) => named(i)));

    fireEvent.click(screen.getByRole("button", { name: "Show all 10" }));

    expect(offers()).toHaveLength(10);
  });

  it("given a way to open skills, when a known skill is pressed, then it is opened", () => {
    const onOpen = vi.fn();
    pick([content.heal], [content.heal.id], onOpen);

    fireEvent.click(screen.getByRole("button", { name: "Open Heal" }));

    expect(onOpen).toHaveBeenCalledWith(content.heal.id);
  });
});
