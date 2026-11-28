# jforge

A monorepo of small apps ("modules"). Each module lives in its own folder
under `modules/`, opens on its own at `/<name>/`, installs as its own PWA,
and can use code from other modules. A landing page at `/` lists them all.
The game framework design is in [`docs/design.md`](docs/design.md), and how
stats, levels and progression work is in
[`docs/progression.md`](docs/progression.md).

Every module is served by **one** Cloudflare Worker, so Cloudflare
credentials, deploys and secrets are set up once, not per module.

## Modules

| Module  | Path      | Depends on                          | What it is                                  |
| ------- | --------- | ----------------------------------- | ------------------------------------------- |
| `melee` | `/melee/` | `rules`, `look`                     | Battle engine: time-based turns, 5x3 grid   |
| `jrpg`  | `/jrpg/`  | `melee`, `rules`, `content`, `look` | Runs through levels of encounters           |
| `char`  | `/char/`  | `rules`, `content`                  | Codex: all content, read-only, and per game |
| `autob` | `/autob/` | `melee`, `rules`, `content`, `look` | Autobattler: shop, bench, hex board         |

And three libraries, which are packages but no apps:

| Library   | Package           | Depends on       | What it is                                               |
| --------- | ----------------- | ---------------- | -------------------------------------------------------- |
| `rules`   | `@jforge/rules`   | —                | Logic on content: `core/` is what every game shares      |
| `content` | `@jforge/content` | `melee`, `rules` | The content as code: `catalogue/`, and a folder per game |
| `look`    | `@jforge/look`    | —                | What every game looks like: portraits, colours, font     |

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
libs/
  rules/core/         the design format (format.ts: stats, damage types,
                      traits, weapons, statuses, skills, the creature), what
                      content is (types) and the rules on it every game
                      shares: gear, compiling to creatures, the class graph,
                      checks.
                      A game's own rules stay in the game (jrpg's growth and
                      gear tiers in modules/jrpg/shared); only those another
                      package needs (char to show them) go in rules/<game>/.
  look/               portraits (Portrait, the icons and their generator in
                      scripts/), and base.css: colours, the font, buttons
  content/catalogue/  every class, enemy type, skill, gear and character
                      (melee.ts melee's, world.ts the world's enemies and gear)
  content/<game>/     what that game uses of the catalogue (jrpg/, autob/)
worker/index.ts       the one Worker: mounts every module's API, serves dist/
tooling/              shared Vite/PWA config, dev ports, icon generator,
                      icons/jforge.svg (source of the jforge app icon)
wrangler.toml         the one Worker's config
```

Modules and libraries depend on each other through pnpm workspace
packages: `jrpg` lists `"@jforge/melee": "workspace:*"` and imports
`@jforge/melee/shared`. A package exposes what others may import through
the `exports` field of its `package.json`. The concerns are kept apart:

- **Content is code.** Classes, enemy types, skills, gear and characters
  are written in `libs/content`, not in an app. The catalogue holds all of
  it; `content/jrpg` and `content/autob` pick (and, to rebalance for one
  game, replace) what that game uses. Content imports only `rules` (for
  the format and helpers) and `melee` (for its data).
- **Rules are logic, not data, and import nothing of jforge's.**
  `libs/rules` owns the design format every game reads; it never imports
  content or a game: its tests build their own fixtures, and tests that
  need the real catalogue live in `libs/content`. A creature carries no
  targeting or threat: each game adds its own (melee's battle adds both).
  A saved library carries `LIBRARY_VERSION`.
- **char only shows.** It reads `@jforge/content` and `@jforge/rules` and
  saves nothing but which tab and game were open. No app imports char.
- **Games read their content from `@jforge/content/<game>`** and its
  rules from `@jforge/rules`. `jrpg` shows melee's battle screen
  (`@jforge/melee/battle`); `autob` has its own board and fight engine and
  uses only melee's unit data. Every game takes its portraits and base
  styles from `@jforge/look` (`@jforge/look/base.css`).
- **melee depends only on `rules`**, for the design format. For now
  `content` uses melee's data (`@jforge/melee/shared`); the battle UI stays
  in melee.

ESLint enforces these imports (`no-restricted-imports` in
`eslint.config.js`).

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
pnpm dev:autob        # http://localhost:5184/autob/
pnpm dev:landing      # http://localhost:5180/
```

## Credits

The unit icons (`libs/look`) are from [game-icons.net](https://game-icons.net) by
Lorc and Delapouite, under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Only the icons
in use are bundled: `pnpm portraits` regenerates
`libs/look/portraitIcons.ts` from the list in
`libs/look/scripts/portraits.mjs`.

The display font (`libs/look/base.css`) is [Oxanium](https://fonts.google.com/specimen/Oxanium)
by Severin Meyer, under the
[SIL Open Font License](https://openfontlicense.org), bundled from
`@fontsource-variable/oxanium` so it works offline.

## Testing

Mostly unit tests, each isolating one rule or helper (Vitest, in
`__tests__/` folders next to the code), component tests of the React
screens (`*.test.tsx`, under happy-dom with Testing Library), plus a few
end-to-end smoke tests of the happy paths (Playwright, in
`modules/<name>/e2e/`).

Test names follow given/when/then in one sentence, under a `describe`
for the unit: `it("given an empty cell, when a member is moved there, then
they stand in it")`. Each test arranges, acts once and asserts, with a blank
line between the three. A test may act and assert more than once only when
the steps are the behaviour under test (paused, then resumed) and splitting
it would cost much more time without reading better.

```
pnpm test             # unit tests
pnpm coverage         # unit tests with a coverage report (coverage/) and its floors
pnpm mutation         # mutation testing of modules/*/shared and libs (reports/mutation/)
pnpm build && pnpm e2e   # starts the Worker on :8791 and drives Chromium
```

The end-to-end tests seed `Math.random`, so the app picks the same
encounter every run. CI runs both, and keeps Playwright traces of failures.
CI runs the unit tests with coverage, and fails when coverage drops below
the floors in `vitest.config.ts`; raise them as tests are added.

Every night, `.github/workflows/nightly.yml` runs coverage and mutation
testing (Stryker, configured in `stryker.config.json`). Mutation testing
leaves out the balance tests (`*.balance.test.ts`, see
`vitest.stryker.config.ts`), which play hundreds of whole battles. It writes the
coverage percentages and each module's mutation score to the job summary
and keeps both HTML reports as artifacts for 14 days. It can also be run
by hand from the Actions tab.

The nightly run is incremental: Stryker keeps its results in the Actions
cache and tests again only the mutants whose code or tests changed. Every
Sunday's run, a change to the dependencies or the test setup, and a manual
run with "full" ticked test every mutant again, since a change elsewhere
that the tests rely on goes unnoticed otherwise.

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
