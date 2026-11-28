import { STAT_NAMES, type Stats } from "@jforge/rules/core";
import { STAT_LABELS } from "./labels";

interface StatsTableProps {
  stats: Stats;
  /** With gear on, shown beside `stats` when given. */
  total?: Stats;
}

/** Stats by name; with `total`, before gear and with it. */
export function StatsTable({ stats, total }: StatsTableProps) {
  return (
    <table className="stats" aria-label="Stats">
      <thead>
        <tr>
          <th scope="col">Stat</th>
          <th scope="col">{total ? "Base" : "Level 1"}</th>
          {total && <th scope="col">With gear</th>}
        </tr>
      </thead>
      <tbody>
        {STAT_NAMES.map((stat) => (
          <tr key={stat}>
            <th scope="row">{STAT_LABELS[stat]}</th>
            <td>{stats[stat]}</td>
            {total && <td>{total[stat]}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
