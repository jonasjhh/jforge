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
  it("lists each item with its note, and names unnamed ones", () => {
    show();
    const list = screen.getByRole("list", { name: "tool list" });
    expect(list.textContent).toContain("Axenote a");
    expect(list.textContent).toContain("(unnamed)note b");
  });

  it("opens an item's editor, and closes it when picked again", () => {
    show();
    const axe = screen.getByRole("button", { name: /Axe/ });
    fireEvent.click(axe);
    expect(axe.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Editing a")).toBeTruthy();
    fireEvent.click(axe);
    expect(screen.queryByText("Editing a")).toBeNull();
  });

  it("deletes the open item and closes its editor", () => {
    const { onDelete } = show();
    fireEvent.click(screen.getByRole("button", { name: /unnamed/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete tool" }));
    expect(onDelete).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("region", { name: "Edit tool" })).toBeNull();
  });

  it("opens a new item's editor, and can't add without onNew", () => {
    show({ onNew: () => "a" });
    fireEvent.click(screen.getByRole("button", { name: "New tool" }));
    expect(screen.getByText("Editing a")).toBeTruthy();
    cleanup();
    show();
    expect(
      (screen.getByRole("button", { name: "New tool" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("says when there is nothing yet", () => {
    render(
      <Collection noun="tool" items={[]} note={() => ""} onDelete={vi.fn()}>
        {() => null}
      </Collection>,
    );
    expect(screen.getByText("Nothing here yet.")).toBeTruthy();
  });
});
