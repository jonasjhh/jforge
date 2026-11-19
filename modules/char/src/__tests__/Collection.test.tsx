// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Collection } from "../Collection";

afterEach(cleanup);

const items = [
  { id: "a", name: "Axe" },
  { id: "b", name: "" },
];

function show(more: { onNew?: () => string; onDelete?: () => void } = {}) {
  const onDelete = more.onDelete ?? vi.fn();
  render(
    <Collection
      noun="tool"
      items={items}
      note={(item) => `note ${item.id}`}
      onNew={more.onNew}
      onDelete={onDelete}
    >
      {(item) => <p>Editing {item.id}</p>}
    </Collection>,
  );
  return { onDelete };
}

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

  it("given an open item, when it is deleted, then it is removed and its editor closes", () => {
    const { onDelete } = show();
    fireEvent.click(screen.getByRole("button", { name: /unnamed/ }));

    fireEvent.click(screen.getByRole("button", { name: "Delete tool" }));

    expect(onDelete).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("region", { name: "Edit tool" })).toBeNull();
  });

  it("given a way to add items, when New is pressed, then the new item's editor opens", () => {
    show({ onNew: () => "a" });

    fireEvent.click(screen.getByRole("button", { name: "New tool" }));

    expect(screen.getByText("Editing a")).toBeTruthy();
  });

  it("given no way to add items, when the list shows, then New is disabled", () => {
    show();

    const add = screen.getByRole("button", { name: "New tool" });

    expect((add as HTMLButtonElement).disabled).toBe(true);
  });

  it("given no items, when the list shows, then it says there is nothing yet", () => {
    render(
      <Collection noun="tool" items={[]} note={() => ""} onDelete={vi.fn()}>
        {() => null}
      </Collection>,
    );

    const empty = screen.getByText("Nothing here yet.");

    expect(empty).toBeTruthy();
  });
});
