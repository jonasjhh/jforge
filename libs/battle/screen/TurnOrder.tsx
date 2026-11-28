import { getUnit, turnOrder, type BattleState } from "../engine";

/** How many upcoming turns the strip shows. */
const TURNS_SHOWN = 5;

/** The next few turns, party and enemies in their own colours. */
export function TurnOrder({ state }: { state: BattleState }) {
  if (state.phase.kind === "over") return null;
  const now =
    state.phase.kind === "awaitingCommand" ? state.phase.unitId : null;
  const order = turnOrder(state, TURNS_SHOWN);
  return (
    <ol className="turn-order" aria-label="Turn order">
      {order.map((id, i) => {
        const unit = getUnit(state, id);
        const classes = [
          "turn",
          `turn-${unit.side}`,
          i === 0 && id === now ? "turn-now" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <li key={`${id}-${i}`} className={classes}>
            {unit.name}
          </li>
        );
      })}
    </ol>
  );
}
