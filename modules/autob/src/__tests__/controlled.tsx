import { useState, type ReactNode } from "react";
import { render } from "@testing-library/react";

/**
 * Renders an editor that keeps what it last sent to onChange, as the app
 * does, and returns that value as the edits come in.
 */
export function renderControlled<T>(
  initial: T,
  view: (value: T, onChange: (value: T) => void) => ReactNode,
): { current: T } {
  const latest = { current: initial };
  function Harness() {
    const [value, setValue] = useState(initial);
    return view(value, (next) => {
      latest.current = next;
      setValue(next);
    });
  }
  render(<Harness />);
  return latest;
}
