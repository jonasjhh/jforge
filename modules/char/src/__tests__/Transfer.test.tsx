// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { starterLibrary } from "../../shared";
import { Transfer } from "../Transfer";

afterEach(cleanup);

const upload = (name: string, text: string) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File([text], name, { type: "application/json" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
};

describe("Transfer", () => {
  it("exports the library as a JSON file", () => {
    const library = starterLibrary();
    render(<Transfer library={library} onImport={() => {}} />);
    const link = screen.getByRole("link", { name: "Export" });
    expect(link.getAttribute("download")).toBe("jforge-char.json");
    const href = link.getAttribute("href")!;
    const prefix = "data:application/json;charset=utf-8,";
    expect(href.startsWith(prefix)).toBe(true);
    expect(JSON.parse(decodeURIComponent(href.slice(prefix.length)))).toEqual(
      library,
    );
  });

  it("imports an exported library", async () => {
    const library = starterLibrary();
    const onImport = vi.fn();
    render(<Transfer library={library} onImport={onImport} />);
    upload("backup.json", JSON.stringify(library));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Imported backup.json.",
      ),
    );
    expect(onImport).toHaveBeenCalledWith(library);
  });

  it("refuses a file that is not a library", async () => {
    const onImport = vi.fn();
    render(<Transfer library={starterLibrary()} onImport={onImport} />);
    upload("notes.json", '{"hello": 1}');
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "notes.json is not a char library.",
      ),
    );
    expect(onImport).not.toHaveBeenCalled();
  });
});
