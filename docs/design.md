# jforge game framework: design

jforge is a small game development framework: build characters and skills
in **char**, test them in fights in **melee**, and use them in games such
as **jrpg**. The combat is inspired by classic time-based JRPG battles
(gauges that fill with speed, front and back rows, elements), but all
content (classes, monsters, skills, names) is original.

## Modules

```
melee  <-  char  <-  jrpg
  ^_______________/
```

| Module  | Role                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `melee` | Battle engine and rules: what combatants, stats, damage types, statuses and skills are. Starter content. Runs any fight. |
| `char`  | Character creator and skill designer. Builds on melee's definitions. Stores the roster. "Test in melee".                 |
| `jrpg`  | The game. Uses melee for battles and char for the party (later).                                                         |

**melee never depends on char.** It accepts plain data (a party and an
encounter); char converts its characters into that format. Otherwise the
two would depend on each other.

## Battle engine (`modules/melee/shared`)

Pure TypeScript, no React, usable in the browser and the Worker.

- **Pure and deterministic.** `advance(state)` and `act(state, command)`
  return a new state plus a list of events. The random number generator's
  seed lives in the state, so the same setup, seed and commands always give
  the same fight: testable, replayable, and able to run thousands of
  automated fights for balance.
- **Events drive the screen.** The UI animates from events (turn ready,
  attack, damage, knocked out, battle over) and never calculates rules.

### Grid

Each side has **5 columns x 3 rows** (row 0 front, 1 middle, 2 back). One
unit per cell (multi-cell bosses later). **Up to 5 player characters**;
enemies may fill more cells.

**Reach comes from the weapon** (done). Columns line up across the two
grids: column 2 faces enemy column 2. Within a column, living units are
counted from the front; a unit is covered by the units in front of it, and
an empty front cell leaves the unit behind it exposed.

| Weapon       | Columns                        | Depth                         |
| ------------ | ------------------------------ | ----------------------------- |
| Sword, claws | Own column and both neighbours | Front-most unit only          |
| Spear        | Own column and both neighbours | Front-most and the one behind |
| Bow          | Any                            | Front-most unit only          |
| Staff/magic  | Any                            | Any unit, ignores cover       |

A weapon is data (`columns`, `depth`), so equipment can swap it and char
can design new ones. Until units can move, a melee unit with no enemy in
range attacks the nearest occupied column instead.

Planned: the attacker's own row matters (with movement); moving uses a
turn; some skills push or pull. Area effects are **targeting shapes**:
single, row, column, line, cross, 3x3 blast, whole side, N random.

### Time

Each unit has a gauge from 0 to 1000 that fills at `speed` per unit of game
time. The engine jumps straight to the next moment something happens (a
unit is ready, a modifier expires) instead of ticking frame by frame.

- **Time freezes** while a player unit waits for a command, and during
  animations (the UI simply doesn't call `advance` until it is done).
- Monsters (AI) act immediately when ready.
- Units ready at the same moment act by speed, then by ID.
- Haste, slow and stop are speed modifiers (x1.5, x0.5, x0).
- Durations are in game time, not turns: haste gives more actions during a
  poison, but does not make it end sooner.
- If no unit can ever act again (everyone stopped), the battle ends in a
  draw.

### Stats and modifiers

For now a fixed set of combat stats: `maxHp`, `maxMp`, `attack`, `magic`,
`defense`, `spirit`, `speed`. Character attributes and equipment come later
and plug in as modifiers.

A modifier is `{ stat, op: add | mul, value, source, expiresAt? }`.
Effective stat = (base + sum of adds) x product of muls, never below 0.
Statuses, buffs and (later) equipment are all modifiers.

### Damage

`raw x K / (K + defense) x element x row x random(0.9..1.1)`, at least 1.
Dividing by defense means damage never hits zero and scales smoothly with
player-designed skills. Physical uses attack vs defense, magical uses magic
vs spirit.

Elements (phase 2): none, fire, ice, lightning, water, earth, wind, holy,
dark, poison. Resistances are multipliers per element: 2 weak, 1 normal,
0.5 resist, 0 immune, -1 absorb.

### Skills (phase 2), as data

```
Skill {
  id, name, description, schemaVersion
  cost:      { mp?, hp?, cooldown? }
  castTime?
  targeting: { side: enemy|ally|self|any, shape, reach: melee|ranged }
  effects:   Effect[]
}
Effect = damage { kind, element, power, stat } | heal { power } | drain
       | revive | applyStatus { status, chance, duration } | removeStatus
       | modify { modifier } | move { push|pull|swap }
```

Skills are built from a fixed set of effect blocks, no scripting. Saved
data is validated and carries a `schemaVersion` so it can be upgraded.
char computes a **power budget** per skill to flag overpowered designs.

### Starting types

Generic types, kept as presets in melee so it can set up fights on its own
(char later turns them into class templates):

| Type    | Role                       |
| ------- | -------------------------- |
| Fighter | Melee damage, front row    |
| Archer  | Ranged damage, ignores row |
| Mage    | Magic damage, area attacks |
| Healer  | Healing and support        |

Monsters use the same combatant definition plus AI (weighted rules, later
editable as data).

## char (phase 4)

Character builder (name, type, skills) and skill designer (form over the
effect blocks, live damage preview, power budget). Stored in the browser
(IndexedDB) with JSON export and import; cloud sync later. **Test in
melee**: all modules share one origin, so char writes a fight setup in
melee's format to a storage key melee defines, then opens `/melee/`.

## Phases

1. **Engine core** (done): types, seeded RNG, stats and modifiers, time and
   gauges, basic attack, KO, victory, defeat, draw. Tests, no new screens.
2. **Grid and skills**: rows and reach, targeting shapes, elements and
   resistances, statuses, skills as data, the 4 types' skills, monsters.
3. **melee screens**: battle screen (playable: you control the party, AI
   the enemies), sandbox, auto-battle, simulation.
4. **char**: character builder, storage, export/import, Test in melee.
5. **Skill designer**: form editor, validation, power budget.
6. **jrpg**: wired to char's roster and melee battles.

Later: equipment, character attributes, levels and growth, more classes,
multi-cell bosses, editable monster AI, cloud saves.
