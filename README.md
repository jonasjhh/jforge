# jforge

A monorepo of small apps ("modules"). Each module lives in its own folder
under `modules/`, opens on its own at `/<name>/`, installs as its own PWA,
and can use code from other modules. A landing page at `/` lists them all.
The game framework design is in [`docs/design.md`](docs/design.md).

Every module is served by **one** Cloudflare Worker, so Cloudflare
credentials, deploys and secrets are set up once, not per module.

## Modules

| Module  | Path      | Depends on | What it is                                |
| ------- | --------- | ---------- | ----------------------------------------- |
| `melee` | `/melee/` | —          | Battle engine: time-based turns, 5x3 grid |
| `jrpg`  | `/jrpg/`  | `melee`    | Turn-based adventure (placeholder)        |
| `char`  | `/char/`  | `melee`    | Designer: classes, enemies, skills, gear  |

## Layout

```
landing/              landing page at /, the installable "jforge" app;
                      lists every modules/*/meta.ts
modules/<name>/
  meta.ts             name, title, description, theme colour, dev port
  index.html, src/    the module's React app (its own PWA, scoped to /<name>/)
  shared/             rules and types used by the app, the API and other modules
  worker/             the module's Hono API, mounted at /api/<name>
  e2e/                Playwright smoke tests (see Testing)
  public/             icons
worker/index.ts       the one Worker: mounts every module's API, serves dist/
tooling/              shared Vite/PWA config, dev ports, icon generator,
                      icons/jforge.svg (source of the jforge app icon)
wrangler.toml         the one Worker's config
```

Modules depend on each other through pnpm workspace packages: `jrpg`
lists `"@jforge/melee": "workspace:*"` and imports
`@jforge/melee/shared`. `char` publishes the characters designed in it as a
roster in melee's format (browser storage, one origin), which `melee` and
`jrpg` read: so both import from char without depending on it. A module exposes what others may import through
the `exports` field of its `package.json`.

## Development

```
pnpm install
pnpm check            # lint, format, typecheck, test, build
```

Whole site through the real Worker (landing, all modules and APIs):

```
pnpm build && pnpm worker:dev     # http://localhost:8790
```

One module with hot reload (run `pnpm worker:dev` alongside for its API):

```
pnpm dev:melee        # http://localhost:5181/melee/
pnpm dev:jrpg         # http://localhost:5182/jrpg/
pnpm dev:char         # http://localhost:5183/char/
pnpm dev:landing      # http://localhost:5180/
```

## Credits

melee's unit icons are from [game-icons.net](https://game-icons.net) by
Lorc and Delapouite, under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Only the icons
in use are bundled: `pnpm portraits` regenerates
`modules/melee/src/battle/portraitIcons.ts` from the list in
`modules/melee/scripts/portraits.mjs`.

melee's display font is [Oxanium](https://fonts.google.com/specimen/Oxanium)
by Severin Meyer, under the
[SIL Open Font License](https://openfontlicense.org), bundled from
`@fontsource-variable/oxanium` so it works offline.

## Testing

Mostly unit tests, each isolating one rule or helper (Vitest, in
`__tests__/` folders next to the code), plus a few end-to-end smoke tests
of the happy paths (Playwright, in `modules/<name>/e2e/`).

```
pnpm test             # unit tests
pnpm coverage         # unit tests with a coverage report
pnpm build && pnpm e2e   # starts the Worker on :8791 and drives Chromium
```

The end-to-end tests seed `Math.random`, so the app picks the same
encounter every run. CI runs both, and keeps Playwright traces of failures.

## Adding a module

1. Copy `modules/melee` to `modules/<name>` and change `package.json`
   (`@jforge/<name>`), `meta.ts` (pick an unused `devPort`), `index.html`
   and the screens.
2. Make icons: `python3 tooling/make-icons.py modules/<name>/public X "#bg" "#ink"`.
3. Mount its API in `worker/index.ts` and add `"@jforge/<name>": "workspace:*"`
   to the root `package.json`.
4. Add `{ "path": "./modules/<name>" }` to the root `tsconfig.json`, and a
   `dev:<name>` script to the root `package.json`.
5. `pnpm install && pnpm check`. The landing page picks it up from `meta.ts`.

To use another module, add it to the new module's `dependencies` as
`"@jforge/<other>": "workspace:*"`.

## Infrastructure

jforge has its own Worker (`jforge`, on workers.dev) and shares nothing
with heatshift, kinetic or other apps. Durable Object bindings are prefixed
with the module name (e.g. `MELEE_ARENA`) because all modules share the one
Worker; see `wrangler.toml`.

Pushing to `main` deploys through `.github/workflows/deploy.yml`, which
needs the repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`.
