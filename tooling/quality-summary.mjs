// Prints a Markdown summary of the coverage and mutation reports, for the
// nightly workflow's job summary. Reads coverage/coverage-summary.json
// (`pnpm coverage`) and reports/mutation/mutation.json (`pnpm mutation`);
// a report that is missing is noted rather than failing the summary.
import { existsSync, readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);

function readJson(path) {
  const url = new URL(path, root);
  return existsSync(url) ? JSON.parse(readFileSync(url, "utf8")) : null;
}

function percent(part, whole) {
  return whole === 0 ? "n/a" : `${((100 * part) / whole).toFixed(1)}%`;
}

function coverageSection(summary) {
  if (!summary) return ["_No coverage report was written._"];
  const { total } = summary;
  const kinds = ["statements", "branches", "functions", "lines"];
  return [
    "| Statements | Branches | Functions | Lines |",
    "| ---: | ---: | ---: | ---: |",
    `| ${kinds.map((kind) => `${total[kind].pct.toFixed(1)}%`).join(" | ")} |`,
  ];
}

// The statuses Stryker gives a mutant, grouped as its own score counts them.
const DETECTED = new Set(["Killed", "Timeout"]);
const UNDETECTED = new Set(["Survived", "NoCoverage"]);

function tally(mutants) {
  const count = (status) => mutants.filter((m) => m.status === status).length;
  const detected = mutants.filter((m) => DETECTED.has(m.status)).length;
  const undetected = mutants.filter((m) => UNDETECTED.has(m.status)).length;
  return {
    score: percent(detected, detected + undetected),
    killed: count("Killed"),
    timeout: count("Timeout"),
    survived: count("Survived"),
    noCoverage: count("NoCoverage"),
    errors: count("CompileError") + count("RuntimeError"),
    // Static mutants (see `ignoreStatic` in stryker.config.json) are not run.
    ignored: count("Ignored"),
    total: mutants.length,
  };
}

function mutationSection(report) {
  if (!report) return ["_No mutation report was written._"];
  const byModule = new Map();
  for (const [path, file] of Object.entries(report.files)) {
    const name = path.split("/")[1] ?? path;
    byModule.set(name, [...(byModule.get(name) ?? []), ...file.mutants]);
  }
  const rows = [...byModule]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, mutants]) => [name, tally(mutants)]);
  rows.push(["**All**", tally([...byModule.values()].flat())]);
  return [
    "| Module | Score | Killed | Timeout | Survived | No coverage | Errors | Ignored | Mutants |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map(
      ([name, t]) =>
        `| ${name} | ${t.score} | ${t.killed} | ${t.timeout} | ${t.survived} | ${t.noCoverage} | ${t.errors} | ${t.ignored} | ${t.total} |`,
    ),
  ];
}

console.log(
  [
    "## Coverage",
    "",
    ...coverageSection(readJson("coverage/coverage-summary.json")),
    "",
    "## Mutation testing (`modules/*/shared`)",
    "",
    ...mutationSection(readJson("reports/mutation/mutation.json")),
  ].join("\n"),
);
