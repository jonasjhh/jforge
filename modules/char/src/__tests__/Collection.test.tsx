// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Collection } from "../Collection";

afterEach(cleanup);

const items = [
  { id: "a", name: "Axe" },
  { id: "b", name: "" },
];

interface ShowOptions {
  onNew?: () => string;
  onDelete?: () => void;
  items?: { id: string; name: string }[];
}

function show(more: ShowOptions = {}) {
  const onDelete = more.onDelete ?? vi.fn();
  function Harness() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    return (
      <Collection
        noun="tool"
        title="Tools"
        items={more.items ?? items}
        note={(item) => `note ${item.id}`}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={more.onNew}
        onDelete={onDelete}
      >
        {(item) => <p>Editing {item.id}</p>}
      </Collection>
    );
  }
  render(<Harness />);
  return { onDelete };
}

const search = (value: string) =>
  fireEvent.change(screen.getByRole("searchbox", { name: "Search tools" }), {
    target: { value },
  });

describe("Collection", () => {
  it("given a named and an unnamed item, when the list shows, then each has its note and the unnamed one is marked", () => {
    show();

    const list = screen.getByRole("list", { name: "tool list" });

    expect(list.textContent).toContain("Axenote a");
    expect(list.textContent).toContain("(unnamed)note b");
  });

  it("given a closed item, when it is picked, then its editor opens", () => {
    show();
    const axe = screen.getByRole("button", { name: /Axe/ });

    fireEvent.click(axe);

    expect(axe.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Editing a")).toBeTruthy();
  });

  it("given an open item, when it is picked again, then its editor closes", () => {
    show();
    const axe = screen.getByRole("button", { name: /Axe/ });
    fireEvent.click(axe);

    fireEvent.click(axe);

    expect(screen.queryByText("Editing a")).toBeNull();
  });

  it("given an open item, when the back button is pressed, then its editor closes", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /Axe/ }));

    fireEvent.click(screen.getByRole("button", { name: "← Tools" }));

    expect(screen.queryByText("Editing a")).toBeNull();
  });

  it("given nothing open, when the list shows, then it hints to pick or make one", () => {
    show();

    const hint = screen.getByText("Pick a tool to edit it, or make a new one.");

    expect(hint).toBeTruthy();
  });

  it("given an open item, when Delete is pressed, then it asks first and deletes nothing yet", () => {
    const { onDelete } = show();
    fireEvent.click(screen.getByRole("button", { name: /Axe/ }));

    fireEvent.click(screen.getByRole("button", { name: "Delete Axe" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Delete Axe?" })).toBeTruthy();
  });

  it("given a delete being asked about, when it is kept, then nothing is deleted and Delete is back", () => {
    const { onDelete } = show();
    fireEvent.click(screen.getByRole("button", { name: /Axe/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Axe" }));

    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete Axe" })).toBeTruthy();
  });

  it("given a delete being asked about, when it is confirmed, then the item is removed and its editor closes", () => {
    const { onDelete } = show();
    fireEvent.click(screen.getByRole("button", { name: /unnamed/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete tool" }));

    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(onDelete).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("region", { name: "Edit tool" })).toBeNull();
  });

  it("given two items, when the search matches one name, then only that one is listed", () => {
    show();

    search("ax");

    const list = screen.getByRole("list", { name: "tool list" });
    expect(list.textContent).toContain("Axe");
    expect(list.textContent).not.toContain("(unnamed)");
  });

  it("given two items, when the search matches one note, then only that one is listed", () => {
    show();

    search("NOTE B");

    const list = screen.getByRole("list", { name: "tool list" });
    expect(list.textContent).toBe("(unnamed)note b");
  });

  it("given two items, when the search matches none, then it says so", () => {
    show();

    search("saw ");

    expect(screen.getByText("Nothing matches “saw”.")).toBeTruthy();
  });

  it("given a search, when New is pressed, then the search is cleared and the new item's editor opens", () => {
    show({ onNew: () => "a" });
    search("zzz");

    fireEvent.click(screen.getByRole("button", { name: "New tool" }));

    expect(screen.getByText("Editing a")).toBeTruthy();
    expect(
      (
        screen.getByRole("searchbox", {
          name: "Search tools",
        }) as HTMLInputElement
      ).value,
    ).toBe("");
  });

  it("given no way to add items, when the list shows, then New is disabled", () => {
    show();

    const add = screen.getByRole("button", { name: "New tool" });

    expect((add as HTMLButtonElement).disabled).toBe(true);
  });

  it("given no items, when the list shows, then it says there is nothing yet", () => {
    show({ items: [] });

    const empty = screen.getByText("Nothing here yet.");

    expect(empty).toBeTruthy();
  });
});
