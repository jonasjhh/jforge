import { LANES, choices, encounterLabel, travel, type Run } from "../shared";
import { iconOf } from "./icons";

const STEP = 30;
const LANE_HEIGHT = 30;
const RADIUS = 11;

interface LevelMapProps {
  run: Run;
  onChange: (run: Run) => void;
}

/**
 * The level's map, first row on the left: stops, the roads between them,
 * the way the party came and where it can go next (those can be tapped).
 */
export function LevelMap({ run, onChange }: LevelMapProps) {
  const open = choices(run);
  const x = (row: number) => STEP / 2 + row * STEP;
  const y = (lane: number) => LANE_HEIGHT / 2 + lane * LANE_HEIGHT;
  const taken = (row: number, index: number) => run.path[row] === index;
  return (
    <svg
      className="map"
      viewBox={`0 0 ${run.map.length * STEP} ${LANES * LANE_HEIGHT}`}
      role="group"
      aria-label="Map"
    >
      {run.map.flatMap((stops, row) =>
        stops.flatMap((stop, index) =>
          stop.next.map((to) => {
            const there = run.map[row + 1]?.[to];
            if (!there) return null;
            const walked = taken(row, index) && taken(row + 1, to);
            return (
              <line
                key={`${row}-${index}-${to}`}
                className={walked ? "road walked" : "road"}
                x1={x(row)}
                y1={y(stop.lane)}
                x2={x(row + 1)}
                y2={y(there.lane)}
              />
            );
          }),
        ),
      )}
      {run.map.flatMap((stops, row) =>
        stops.map((stop, index) => {
          const here = row === run.position && taken(row, index);
          const reachable = row === run.position && open.includes(index);
          const state = here
            ? run.defeated
              ? "lost"
              : "here"
            : reachable
              ? "open"
              : taken(row, index)
                ? "done"
                : row < run.position
                  ? "missed"
                  : "ahead";
          const label = `${encounterLabel(stop.encounter)}, stop ${row + 1}`;
          return (
            <g
              key={`${row}-${index}`}
              className={`stop stop-${state}`}
              transform={`translate(${x(row)} ${y(stop.lane)})`}
              {...(reachable
                ? {
                    role: "button",
                    tabIndex: 0,
                    "aria-label": `Go to ${label}`,
                    onClick: () => onChange(travel(run, index)),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onChange(travel(run, index));
                      }
                    },
                  }
                : { "aria-label": label, "aria-current": here || undefined })}
            >
              <circle r={RADIUS} />
              <text textAnchor="middle" dominantBaseline="central">
                {iconOf(stop.encounter)}
              </text>
            </g>
          );
        }),
      )}
    </svg>
  );
}
