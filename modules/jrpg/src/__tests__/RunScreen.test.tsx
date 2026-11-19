// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MAX_PARTY_SIZE } from "@jforge/melee/shared";
import { heroes, type Encounter, type Reward, type Run } from "../../shared";
import { RunScreen } from "../RunScreen";
import { renderControlled } from "./controlled";
import { ally, at, battle, library, training } from "./runs";

afterEach(cleanup);

const play = (run: Run) =>
  renderControlled(run, (value, onChange) => (
    <RunScreen
      run={value}
      reward={null}
      onChange={onChange}
      onFight={() => {}}
      onAbandon={() => {}}
    />
  ));
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const encounterPanel = () => screen.getByRole("region", { name: "Encounter" });

describe("RunScreen", () => {
  it("lets the party choose where the road splits", () => {
    const run = at([battle], {
      map: [
        [
          { encounter: battle, lane: 0, next: [] },
          { encounter: training, lane: 1, next: [] },
        ],
      ],
      path: [],
    });
    const played = play(run);
    expect(screen.getByText(/The road splits/)).toBeTruthy();
    fireEvent.click(button(/A quiet clearing: a place to train/));
    expect(played.current.path).toEqual([1]);
    expect(
      screen.getByText("Time to train: one of you gains a level."),
    ).toBeTruthy();
  });

  it("shows the battle ahead and starts the fight", () => {
    const onFight = vi.fn();
    render(
      <RunScreen
        run={at([battle])}
        reward={null}
        onChange={() => {}}
        onFight={onFight}
        onAbandon={() => {}}
      />,
    );
    expect(screen.getByRole("grid", { name: "Enemies ahead" })).toBeTruthy();
    expect(screen.getByRole("grid", { name: "Formation" })).toBeTruthy();
    expect(screen.getByText(/Easy · 1 of 1/)).toBeTruthy();
    fireEvent.click(button("Fight"));
    expect(onFight).toHaveBeenCalledOnce();
  });

  it("trains the member chosen", () => {
    const played = play(at([training, battle]));
    fireEvent.click(button("Train Aldric"));
    expect(played.current.party.map((m) => m.level)).toEqual([4, 3]);
    expect(played.current.position).toBe(1);
  });

  it("welcomes a traveller while there is room, or moves on", () => {
    const played = play(at([ally, battle]));
    expect(screen.getByText(/offers to join you/)).toBeTruthy();
    fireEvent.click(button("Welcome Nell"));
    expect(played.current.party.map((m) => m.name)).toEqual([
      "Aldric",
      "Mira",
      "Nell",
    ]);
    cleanup();
    const declined = play(at([ally, battle]));
    fireEvent.click(button("Move on"));
    expect(declined.current.party).toHaveLength(2);
    expect(declined.current.position).toBe(1);
  });

  it("lets a traveller take someone's place in a full party", () => {
    const full = heroes(library)
      .filter((c) => c.id !== "new")
      .slice(0, MAX_PARTY_SIZE)
      .map((c) => ({ ...c, level: 2, xp: 0 }));
    const played = play(at([ally, battle], { party: full }));
    expect(screen.getByText(/Your party is full/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Welcome Nell" })).toBeNull();
    fireEvent.click(button(`Replace ${full[0]!.name}`));
    expect(played.current.party.map((m) => m.id)).toEqual([
      "new",
      ...full.slice(1).map((m) => m.id),
    ]);
  });

  it("gives found gear to someone who can use it, or bags it", () => {
    const find: Encounter = {
      kind: "gear",
      gearIds: ["gear-ring", "gear-bow"],
    };
    const played = play(at([find, battle]));
    const ring = screen.getByRole("radio", { name: /Swift Ring/ });
    expect(ring.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(button("Give to Mira"));
    expect(played.current.party[1]!.gear.accessory).toBe("gear-ring");
    cleanup();
    const bagged = play(at([find, battle]));
    fireEvent.click(screen.getByRole("radio", { name: /Short Bow/ }));
    expect(screen.getByText(/Nobody in the party can use it/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Give to/ })).toBeNull();
    fireEvent.click(button("Keep in the bag"));
    expect(bagged.current.bag).toEqual(["gear-bow"]);
  });

  it("moves on from a find with nothing of use", () => {
    const played = play(at([{ kind: "gear", gearIds: [] }, battle]));
    expect(screen.getByText("Nothing of use.")).toBeTruthy();
    fireEvent.click(button("Move on"));
    expect(played.current.position).toBe(1);
  });

  it("goes on to the next level once this one is cleared", () => {
    const played = play(at([battle], { position: 1 }));
    expect(screen.getByText("Level 1 cleared")).toBeTruthy();
    fireEvent.click(button("On to level 2"));
    expect(played.current.depth).toBe(2);
    expect(screen.getByRole("heading", { name: "Level 2" })).toBeTruthy();
  });

  it("ends a defeated run", () => {
    const onAbandon = vi.fn();
    render(
      <RunScreen
        run={at([battle], { defeated: true })}
        reward={null}
        onChange={() => {}}
        onFight={() => {}}
        onAbandon={onAbandon}
      />,
    );
    expect(screen.getByText("The party has fallen")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Abandon run" })).toBeNull();
    for (const b of screen.getAllByRole("button", { name: "New run" })) {
      fireEvent.click(b);
    }
    expect(onAbandon).toHaveBeenCalledTimes(2);
  });

  it("shows what the last battle paid", () => {
    const reward: Reward = {
      xp: 30,
      levelUps: [{ name: "Mira", level: 4 }],
      loot: library.gear.find((g) => g.id === "gear-ring"),
    };
    render(
      <RunScreen
        run={at([battle, battle], { position: 1 })}
        reward={reward}
        onChange={() => {}}
        onFight={() => {}}
        onAbandon={() => {}}
      />,
    );
    const panel = screen.getByRole("region", { name: "Rewards" });
    expect(panel.textContent).toContain("Everyone gains 30 XP");
    expect(panel.textContent).toContain("Mira reaches level 4");
    expect(panel.textContent).toContain("Found Swift Ring");
    expect(encounterPanel()).toBeTruthy();
  });
});
