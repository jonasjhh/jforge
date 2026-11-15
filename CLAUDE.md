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
