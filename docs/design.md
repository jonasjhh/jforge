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

**Moving** (done): a unit may step to an adjacent empty cell on its own
side (knocked-out units still block their cell). It costs half a turn: the
gauge drops to half instead of empty. Reach, cover and area spill follow
the new position at once. Monsters don't move yet.

**Rows matter for melee** (done). Every weapon is melee or ranged; spells
count as ranged. Melee damage dealt is x1 / x0.75 / x0.5 from the front /
middle / back row, and melee damage taken is x1 / x0.75 / x0.5 in those
rows; they stack (back row hitting back row: x0.25). Ranged weapons and
spells ignore rows. Reach is unchanged. The AI's expected damage includes
it.

Planned: some skills push or pull. Area effects are **targeting shapes**:
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

**Damage types** (done): every weapon and damaging spell has one: slash
(sword), pierce (bow, spear, fangs), blunt (staff, slam), fire
(Fireball). Each combatant has **resistances**: a multiplier per type, 2
weak, 1 normal (the default), 0.5 resistant, 0 immune. Slimes are weak to
fire and resist blunt; Wolves are weak to pierce. The multiplier applies
after defense, the AI's expected damage includes it, and hits show a WEAK
or RESIST tag. More elements (ice, lightning, holy, ...) and absorb (-1)
can be added the same way.

### Skills, as data

Started: units have MP; a skill costs MP and is aimed at a **cell**. Its
`target` says where it may be aimed (a living ally, a living enemy, or any
cell) and its `area` which cells it hits around the aimed one.

- **Heal** (Healer): one living ally, restores power x magic HP, never
  above max.
- **Fireball** (Mage): any cell, hits a **plus** (the cell and its four
  neighbours). The two grids form one battlefield 5 wide and 6 deep with
  the front rows touching, so a blast aimed at the enemy front row also
  burns your unit standing opposite. Aiming takes two taps: preview the
  area (allies caught in it are flagged), then cast.
- **Meteor** (Mage): a **delayed** spell. Any cell, hits a 3x3 **square**,
  power 2 fire, 24 MP. A skill with a `castTime` is paid for at once, then
  the caster is busy (its gauge waits and shows the cast instead) until the
  impact, which hits whoever stands in the marked zone at that moment, so
  allies can step out. If the caster is knocked out first, it fizzles.
- **Regen** (Healer): the first **effect over time**. One living ally gains
  a status that heals 0.4 x magic every 30 game time, 5 times. Statuses
  tick on game time (haste doesn't stretch them), recasting refreshes
  instead of stacking, and a knockout clears them. Ticks don't pause the
  battle; the unit shows a badge.
- **Cure** (Healer): 5 MP, one living ally, removes every **harmful**
  status (Poison) and keeps helpful ones (Regen). Statuses carry a
  harmful flag, so a cleanse needs no list of what to remove. While
  choosing, allies with a harmful status are highlighted.

The full shape below is the goal.

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

Monsters use the same combatant definition plus AI.

### Enemy AI

AI units attack the reachable enemy with the highest **target score**
(done). Each factor is weighted by the unit's `targeting` profile (data, so
char can edit it later):

- **finish**: the expected hit (the damage formula without the random
  spread) would knock the target out;
- **wounded**: how much HP the target has lost;
- **soft**: how little the target's defense blocks;
- **noise**: seeded randomness, so enemies aren't fully predictable but
  battles still replay exactly.

The Wolf is a finisher; the Slime is clumsy; the Viper picks on soft
targets. Monsters don't cast skills or move yet.

### Monsters

| Monster | Role                                  | Weak to | Resists / immune     | Threat |
| ------- | ------------------------------------- | ------- | -------------------- | ------ |
| Slime   | Slow, sturdy, clumsy                  | fire    | blunt; poison immune | 2      |
| Wolf    | Fast finisher                         | pierce  |                      | 3      |
| Viper   | Fast, frail; venom bite poisons (DoT) |         | poison immune        | 2      |

A weapon can carry an **on-hit status**: the Viper's bite poisons whoever
it wounds (0.4 x attack poison damage every 30 game time, 5 times). Poison
can knock a unit out, refreshes rather than stacks, and doesn't take hold
on a target immune to poison. Statuses say which stat scales them (attack
for venom, magic for Regen).

### Random encounters

Done. `randomEncounter(seed, difficulty)` builds a battle from the existing
types and monsters; the same seed gives the same encounter. The party
stands in each type's `preferredRow` in random columns. Monsters are drawn
until a **threat budget** is spent (Slime 2, Wolf 3, Viper 2; Easy 13,
Normal 15, Hard 16) and lean toward the front. Budgets are tuned with
auto-played battles where both sides only attack, to about 92% / 66% / 47%
party wins;
a test keeps each difficulty in its band. New monsters join the pool
automatically once they have a `threat`.

## Open questions

**Knocked-out units.** Today a knocked-out unit stays in its cell for the
rest of the battle. It no longer counts for cover, reach, area effects or
targeting (the unit behind it is exposed at once), but it still **blocks
movement** into its cell. Its turn, statuses and any cast are cleared.

To decide before push/pull lands:

- Keep bodies (needed for a later Revive) and let them block movement and
  pushes (bashing into a body is a collision) but never attacks, reach or
  areas. **Recommended.**
- Or remove bodies when a unit falls: simpler, but no Revive.
- Also open: Revive itself, and whether a row emptied by deaths changes
  anything beyond cover.

## Roadmap rules

- **No new skills for existing classes until there are at least 10
  distinct class archetypes.** Each new class ships with its own starting
  skills; after that it counts as existing too.

### Class roster plan (10 archetypes)

Existing: **Fighter** (melee, front), **Archer** (ranged), **Mage** (area
magic), **Healer** (support).

Planned, in rough order (names and kits are proposals):

| Class        | Role                                      | Signature mechanics         |
| ------------ | ----------------------------------------- | --------------------------- |
| Lancer       | Spear user: reaches behind the front unit | Line strike, pull           |
| Guardian     | Tank: protects allies                     | Taunt, cover an ally        |
| Rogue        | Fast skirmisher                           | Bleed/poison, repositioning |
| Warlock      | Dark caster                               | Drain (heals the caster)    |
| Chronomancer | Time control                              | Haste, slow, stop           |
| Bard         | Support through buffs                     | Party-wide buffs over time  |

With more than five classes, random encounters will pick a party of up to
five from the roster instead of using every class.

## Backlog

Ideas to build in small steps, roughly in this order when they fit:

- **Drain spells** that heal the caster by part of the damage dealt, for a
  future dark-caster class (not the Mage).
- **Burn** (fire damage over time), e.g. on Fireball.
- **Push and pull**: movement as a skill effect, also as part of spells.
- **Casting monsters**: monsters that use skills, not just weapons.

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
