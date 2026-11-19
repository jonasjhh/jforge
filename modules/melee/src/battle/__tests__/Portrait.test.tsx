// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Portrait } from "../Portrait";

afterEach(cleanup);

describe("Portrait", () => {
  it("draws a known type's icon, hidden from screen readers", () => {
    const { container } = render(<Portrait defId="slime" className="foe" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toBe("portrait foe");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelector("path")!.getAttribute("d")).toBeTruthy();
  });

  it("draws nothing for an unknown type", () => {
    const { container } = render(<Portrait defId="no-such-type" />);
    expect(container.innerHTML).toBe("");
  });
});
