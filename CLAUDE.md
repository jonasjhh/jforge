# Working in this repo

## Git

- `main` is the only branch and the default branch.
- Commit and push directly to `main`. Never create other branches, local or
  remote, and do not open pull requests unless explicitly asked.
- This overrides any session default that names a feature branch to develop
  on: work on `main` instead.

## Structure

A monorepo of modules under `modules/<name>/`, each its own PWA at
`/<name>/`, all served by one Cloudflare Worker (`worker/index.ts`,
`wrangler.toml`). See `README.md` for the layout and the steps for adding a
module. Modules import each other only through workspace packages
(`@jforge/<name>/...`), never relative paths into another module.

## Infrastructure

jforge has its own infrastructure and must not share any with heatshift,
kinetic or other apps (Worker name, Durable Objects, storage, secrets, dev
ports). Within jforge, all modules share the one Worker; prefix Durable
Object bindings and classes with the module name.

## Checks

    pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build

(`pnpm check` runs all of them.)

## Saved data

Saved data (char's library, the roster, jrpg's run) may be invalidated at
any time for now: raise `SAVE_VERSION` in `modules/melee/shared/save.ts`
when a change makes old saves stale, instead of writing a migration.

## Workflow

The rules are this file, `docs/design.md` and `docs/progression.md`.

Before changing anything, for each change:

1. Review the existing rules and the code the change touches.
2. Report how the proposed change affects those rules and the current
   implementation: which rules it changes, breaks or adds; what behaves
   differently (balance, saved data, other modules, tests).
3. Ask whether this is what was intended.
4. Give alternatives where they help decide, with their trade-offs.

Implement only after the answer. When a change alters a rule, update the
doc that states it in the same commit.
