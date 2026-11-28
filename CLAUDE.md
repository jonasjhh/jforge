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
`wrangler.toml`), and libraries under `libs/<name>/` that are packages but
no apps: `libs/rules` (logic on content: `core/`, plus a folder for a
game's rules only when another package needs them; otherwise they stay in
the game) and `libs/content` (the content as code: `catalogue/`
plus a folder per game). See `README.md` for the layout, the dependency
rules and the steps for adding a module. Modules and libraries import
each other only through workspace packages (`@jforge/<name>/...`), never
relative paths into another package.

Content is written in `libs/content`, never in an app: char is a
read-only codex of it.

## Infrastructure

jforge has its own infrastructure and must not share any with heatshift,
kinetic or other apps (Worker name, Durable Objects, storage, secrets, dev
ports). Within jforge, all modules share the one Worker; prefix Durable
Object bindings and classes with the module name.

## Checks

    pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build

(`pnpm check` runs all of them.)

## Tests

Name tests given/when/then in one sentence and write them
arrange/act/assert; see Testing in `README.md`.

## Spelling

British English everywhere, code included: `armour`, `colour`,
`behaviour` (CSS properties such as `color` excepted).

## Saved data

Saved data (jrpg's and autob's runs) may be invalidated at
any time for now: raise `SAVE_VERSION` in `modules/melee/shared/save.ts`
when a change makes old saves stale, instead of writing a migration.

## Goal

The goal is the most entertaining game possible, not following these
rules. When a better game needs a rule bent or broken, propose it: say
which rule, what it costs (balance, saved data, other modules,
complexity) and the alternatives, and change the rule's doc in the same
commit once agreed. Never break a rule silently.

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
