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

const find: Encounter = { kind: "gear", gearIds: ["gear-ring", "gear-bow"] };
const fullParty = () =>
  heroes(library)
    .filter((c) => c.id !== "new")
    .slice(0, MAX_PARTY_SIZE)
    .map((c) => ({ ...c, level: 2, xp: 0 }));

describe("RunScreen", () => {
  it("given a road that splits, when a way is picked, then the party takes it and meets its stop", () => {
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

  it("given a battle ahead, when the screen shows, then the enemies, the formation and the difficulty show", () => {
    play(at([battle]));

    expect(screen.getByRole("grid", { name: "Enemies ahead" })).toBeTruthy();
    expect(screen.getByRole("grid", { name: "Formation" })).toBeTruthy();
    expect(screen.getByText(/Easy · 1 of 1/)).toBeTruthy();
  });

  it("given a battle ahead, when Fight is pressed, then the fight starts", () => {
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

    fireEvent.click(button("Fight"));

    expect(onFight).toHaveBeenCalledOnce();
  });

  it("given training, when a member is trained, then they gain a level and the run moves on", () => {
    const played = play(at([training, battle]));

    fireEvent.click(button("Train Aldric"));

    expect(played.current.party.map((m) => m.level)).toEqual([4, 3]);
    expect(played.current.position).toBe(1);
  });

  it("given a traveller and room in the party, when they are welcomed, then they join", () => {
    const played = play(at([ally, battle]));
    expect(screen.getByText(/offers to join you/)).toBeTruthy();

    fireEvent.click(button("Welcome Nell"));

    expect(played.current.party.map((m) => m.name)).toEqual([
      "Aldric",
      "Mira",
      "Nell",
    ]);
  });

  it("given a traveller, when the party moves on, then they don't join", () => {
    const played = play(at([ally, battle]));

    fireEvent.click(button("Move on"));

    expect(played.current.party).toHaveLength(2);
    expect(played.current.position).toBe(1);
  });

  it("given a traveller and a full party, when the screen shows, then they can only take someone's place", () => {
    play(at([ally, battle], { party: fullParty() }));

    expect(screen.getByText(/Your party is full/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Welcome Nell" })).toBeNull();
  });

  it("given a traveller and a full party, when they replace a member, then they take that member's place", () => {
    const full = fullParty();
    const played = play(at([ally, battle], { party: full }));

    fireEvent.click(button(`Replace ${full[0]!.name}`));

    expect(played.current.party.map((m) => m.id)).toEqual([
      "new",
      ...full.slice(1).map((m) => m.id),
    ]);
  });

  it("given found gear, when the screen shows, then the first piece is chosen", () => {
    play(at([find, battle]));

    const ring = screen.getByRole("radio", { name: /Swift Ring/ });

    expect(ring.getAttribute("aria-checked")).toBe("true");
  });

  it("given a ring found, when it is given to a member, then they wear it", () => {
    const played = play(at([find, battle]));

    fireEvent.click(button("Give to Mira"));

    expect(played.current.party[1]!.gear.accessory).toBe("gear-ring");
  });

  it("given a bow found that no one can use, when it is chosen, then it can only be bagged", () => {
    play(at([find, battle]));

    fireEvent.click(screen.getByRole("radio", { name: /Short Bow/ }));

    expect(screen.getByText(/Nobody in the party can use it/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Give to/ })).toBeNull();
  });

  it("given a bow chosen, when it is kept in the bag, then the bag holds it", () => {
    const played = play(at([find, battle]));
    fireEvent.click(screen.getByRole("radio", { name: /Short Bow/ }));

    fireEvent.click(button("Keep in the bag"));

    expect(played.current.bag).toEqual(["gear-bow"]);
  });

  it("given a find with nothing of use, when the party moves on, then the run moves on", () => {
    const played = play(at([{ kind: "gear", gearIds: [] }, battle]));
    expect(screen.getByText("Nothing of use.")).toBeTruthy();

    fireEvent.click(button("Move on"));

    expect(played.current.position).toBe(1);
  });

  it("given a cleared level, when the party goes on, then the next level shows", () => {
    const played = play(at([battle], { position: 1 }));
    expect(screen.getByText("Level 1 cleared")).toBeTruthy();

    fireEvent.click(button("On to level 2"));

    expect(played.current.depth).toBe(2);
    expect(screen.getByRole("heading", { name: "Level 2" })).toBeTruthy();
  });

  it("given a defeated run, when the screen shows, then the party has fallen and the run can't be abandoned", () => {
    play(at([battle], { defeated: true }));

    expect(screen.getByText("The party has fallen")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Abandon run" })).toBeNull();
  });

  it.each([0, 1])(
    "given a defeated run, when New run button %i is pressed, then the run ends",
    (index) => {
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

      fireEvent.click(
        screen.getAllByRole("button", { name: "New run" })[index]!,
      );

      expect(onAbandon).toHaveBeenCalledOnce();
    },
  );

  it("given a battle just won, when the screen shows, then what it paid shows beside the next encounter", () => {
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
