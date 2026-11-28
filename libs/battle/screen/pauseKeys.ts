/** The parts of a key press that decide what it does to the pause. */
export interface PauseKey {
  key: string;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** Pressed on a button or field, where Space already means "press". */
  onControl: boolean;
}

/**
 * P toggles the pause, as does Space unless it is pressing a focused
 * control; Escape resumes. Held keys and shortcuts with modifiers are left
 * alone.
 */
export function pauseKeyAction(e: PauseKey): "toggle" | "resume" | null {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === "p" || e.key === "P" || (e.key === " " && !e.onControl)) {
    return "toggle";
  }
  return e.key === "Escape" ? "resume" : null;
}
