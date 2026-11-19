// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Portrait } from "../Portrait";

afterEach(cleanup);

describe("Portrait", () => {
  it("given a known type, when its portrait is drawn, then it is an icon hidden from screen readers", () => {
    const defId = "slime";

    const { container } = render(<Portrait defId={defId} className="foe" />);

    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toBe("portrait foe");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelector("path")!.getAttribute("d")).toBeTruthy();
  });

  it("given an unknown type, when its portrait is drawn, then nothing is drawn", () => {
    const defId = "no-such-type";

    const { container } = render(<Portrait defId={defId} />);

    expect(container.innerHTML).toBe("");
  });
});
