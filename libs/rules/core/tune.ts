/**
 * `base` with `changes` on top: how a game makes its own version of a
 * design (other stats, its own targeting or threat) where it takes it,
 * leaving the design as it is. Nested values are replaced, not merged;
 * designs are never changed in place, so the rest is shared, not copied.
 */
export function tune<E extends object>(base: E, changes: Partial<E>): E {
  return { ...base, ...changes };
}
