import type { ModuleMeta } from "../../tooling/module-meta";

// Every folder under modules/ with a meta.ts shows up here automatically.
const found = import.meta.glob<{ meta: ModuleMeta }>(
  "../../modules/*/meta.ts",
  {
    eager: true,
  },
);

export const modules: ModuleMeta[] = Object.values(found)
  .map((m) => m.meta)
  .sort((a, b) => a.title.localeCompare(b.title));
