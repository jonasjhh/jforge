// Empties dist/ before the per-package builds write into it. The landing
// page builds into dist/ itself and each module into dist/<name>/, so none
// of them may empty the shared folder on its own.
import { rmSync } from "node:fs";

rmSync(new URL("../dist", import.meta.url), { recursive: true, force: true });
