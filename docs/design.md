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
| `jrpg`  | The game: runs through levels of encounters. Uses melee for battles and char for the party, enemies and gear.            |

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
the new position at once. AI units move too (see Enemy AI).

**Rows matter for melee** (done). Every weapon is melee or ranged; spells
count as ranged. Melee damage dealt is x1 / x0.75 / x0.5 from the front /
middle / back row, and melee damage taken is x1 / x0.75 / x0.5 in those
rows; they stack (back row hitting back row: x0.25). Ranged weapons and
spells ignore rows. Reach is unchanged. The AI's expected damage includes
it.

**Push and pull** (done, Lancer's Hook): a `strike` skill effect is a
weapon attack (reach, rows, damage type) at a power, with an optional
`push` (negative pulls). If the destination is off the grid or occupied
(knocked-out units count), the target doesn't move and takes a collision
instead: x1.5 damage, reported before the blow.

**Defend and Wait** (done): two commands every unit has, always allowed.
**Defend** spends the whole turn; until the unit acts again, every hit on it
(weapons, spells, collisions) is halved. Damage over time is not, and the
damage preview and the AI's expected damage include it. **Wait** does
nothing and keeps three quarters of the gauge, so the unit acts again soon:
a way to let an ally go first or to wait for an enemy to come into reach.
Monsters don't use either yet.

Area effects are **targeting shapes**:
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
- The battle screen shows a **turn order forecast** (`turnOrder`): the next
  5 turns at today's speeds, a caster's after its spell lands. Expiring
  modifiers, Quicken, half turns and knockouts can change it.
- Above the commands, a caption keeps the **latest action and its result**
  ("Wolf attacks Fighter — 12", "Mage casts Meteor at Slime A — 3 hit,
  Slime A KO") until the next action, so enemy turns aren't missed.
- The player can **pause** (header button, or P / Space; tap the overlay or
  Escape to resume). Leaving the app pauses too, so the battle doesn't carry
  on the moment they return. Open unit details also hold time.
- A **battle speed** toggle (1× / 2×, remembered on the device) speeds up
  gauges and action pauses together. Player turns still wait, so speed
  never rushes a decision; the engine itself is unaffected.

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

While aiming, each unit the action would hit shows its **expected damage**
(`previewDamage`): the formula without the random spread, gold if weak, grey
if resisted, red "KO" if it would empty their HP past any shield. Healing
and status skills show no preview.

### Damage types

Two separate axes:

- **Delivery** decides which stats apply: **physical** (attack vs
  defense; weapons, weapon skills) or **magical** (magic vs spirit;
  spells).
- **Type** decides which resistances apply. Types describe what the
  damage _is_, not who causes it: a Geomancer's hurled rock is magical
  delivery with crush or impact type; a flaming arrow would be physical
  with fire type.

**One type per hit.** A weapon has one **primary** type for basic
attacks; a skill may strike with another (a sword's thrust is pierce, a
halberd's spike is pierce, a warhammer's pick is pierce).

**Physical types**

| Type   | Typical sources                                  | Identity                                        |
| ------ | ------------------------------------------------ | ----------------------------------------------- |
| Slash  | swords, claws, whips, glaives, scythes           | Strong vs flesh; poor vs armor, stone, bone     |
| Pierce | arrows, spears, fangs, daggers, rapiers, darts   | Strong vs beasts, light armor; poor vs oozes    |
| Chop   | axes, cleavers, halberds, throwing axes          | Splitting blows: strong vs wood, shields, armor |
| Crush  | maces, clubs, staffs, flails, hammers, fists     | Strong vs armor, bone, stone; poor vs oozes     |
| Impact | siege engines, giants, collisions, falls, blasts | Beyond human scale; strong vs structures        |

Crush is anything a person swings; impact is beyond human scale.
**Collisions** (blocked pushes and pulls) and **Shatter** deal impact.

**Magical types**

| Type      | Identity                                              |
| --------- | ----------------------------------------------------- |
| Fire      | Strong vs beasts, plants, oozes                       |
| Cold      | Strong vs reptiles, fire creatures                    |
| Lightning | Strong vs armored and metal targets                   |
| Acid      | Eats armor                                            |
| Poison    | Living things only (undead, constructs, oozes immune) |
| Holy      | Strong vs undead and demons                           |
| Shadow    | Strong vs holy and celestial creatures                |
| Arcane    | Pure magic, the neutral baseline; rarely resisted     |

Later: **sonic** (instruments, a future Bard) and psychic.

**Drain is not a type** but a property of a hit: heal the attacker by a
share of the damage dealt (the Warlock's Drain is shadow type with
drain).

**Weapon families** (primary type): swords, glaives, scythes, whips,
claws: slash. Rapiers, daggers, spears, pikes, lances, tridents,
javelins, bows, crossbows, blowguns, darts, firearms: pierce. Axes,
cleavers, halberds, throwing axes: chop. Maces, clubs, staffs, flails,
morning stars, warhammers, mauls, fists, slings, boomerangs, shield
bashes: crush. Siege engines, explosives, giant blows, falling objects:
impact. Wands, orbs, rods: arcane unless the spell says otherwise. Nets
and bolas deal no damage (control effects).

**Signature effects** (optional, per skill, never automatic):

| Type      | Effect                                         |
| --------- | ---------------------------------------------- |
| Slash     | Bleed: physical damage over time (later)       |
| Pierce    | Puncture: ignores part of defense              |
| Chop      | Sunder: defense down                           |
| Crush     | Stagger: knocks the target's gauge back        |
| Impact    | Knockback: pushes the target a row             |
| Fire      | Burn: damage over time                         |
| Cold      | Chill: speed down                              |
| Lightning | Interrupt: cancels a delayed cast              |
| Acid      | Corrode: defense down                          |
| Poison    | Poison: damage over time (exists, Viper venom) |

**Resistances** are multipliers per type (2 weak, 1 normal, 0.5
resistant, 0 immune), applied after defense; the AI's expected damage
includes them and hits show WEAK / RESIST tags. They come from **creature
traits**: each trait brings defaults, several traits multiply, and a
creature's own `resistances` override them (`traits.ts`).

| Trait     | Defaults                                                      |
| --------- | ------------------------------------------------------------- |
| beast     | pierce x1.5                                                   |
| reptile   | cold x1.5                                                     |
| ooze      | crush x0.5, pierce x0.5, fire x2, cold x1.5, poison immune    |
| stone     | slash x0.5, pierce x0.5, crush x1.5, impact x2, poison immune |
| demon     | holy x2, fire x0.5, shadow x0.5                               |
| undead    | holy x2, shadow x0.5, poison immune                           |
| construct | slash x0.5, crush x1.5, lightning x1.5, poison immune         |
| armored   | slash/pierce x0.75, chop/crush/lightning x1.25, acid x1.5     |

**Current content:** Sword, Claws: slash. Spear, Bow, Fangs, Venom
Fangs, Daggers: pierce. Staff, Slam, Hourglass, Rod: crush. Blessed
Blade: holy. Grimoire, Drain, Blood Bolt: shadow. Fireball, Meteor,
Firebolt: fire. Shatter and collisions: impact. Slime: ooze. Wolf: beast.
Viper: beast + reptile, immune to poison. Imp: demon. Boulder: stone.

### Skills, as data

Started: units have MP; a skill costs MP and is aimed at a **cell**. Its
`target` says where it may be aimed (a living ally, a living enemy, or any
cell) and its `area` which cells it hits around the aimed one.

- **Cleave** (Fighter): a slash strike at x0.7 on **every enemy the
  sword can reach** (the `reach` area: whatever the weapon could attack
  right now, so covered units are safe and the aimed cell only picks the
  swing), 5 MP. Reusable for any weapon: a spear's reach is deeper, a
  bow's covers every column.
- **Aimed Shot** (Archer): a bow strike at x1.0 that **ignores cover**
  (`ignoreCover` on a strike), so it reaches any visible enemy, back row
  included, 6 MP. Its job is picking off casters and the wounded behind a
  front line; stealth still hides a unit from it.
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
- **Raise Boulder / Shatter / Upheaval** (Geomancer): boulders are
  **obstacle** units (40 HP, very high defense and spirit, never act)
  raised in any empty cell on either side, two per Geomancer (a third
  replaces the oldest). They block movement, pushes and teleports, give
  cover to units behind them, can be attacked, vanish when destroyed and
  never decide a battle; ally skills can't target them. Shatter destroys
  one of your boulders and deals impact damage (power 1.2) to everyone in
  the plus around it, friends included. Upheaval heaves any unit or
  boulder one row back (no damage; nothing happens if blocked). The Rod
  deals crush damage and Shatter impact (boulders are stone: weak to
  impact).
- **Aegis / Last Rites** (Paladin): all damage (weapons, spells,
  collisions, poison) goes through one function. A **shield** status
  absorbs first (Aegis: 2 x magic, 150 game time, refreshes on recast); a
  **ward** status keeps a lethal blow at 1 HP (Last Rites: 120 game time,
  any number of hits). Drain only counts damage that got through. The AI
  knows a shield soaks part of a hit and a warded unit can't be finished.
  The Blessed Blade deals **holy** damage.
- **Vanish / Shadowstep** (Rogue): **Stealth** is a timed status (one
  silent tick that just ends it). A stealthed unit can't be picked by
  enemies for weapon attacks or single-target skills (areas and poison
  still hit it; it still covers units behind it). Its first damaging
  action is an **ambush** for x2, which ends stealth. Shadowstep is a
  `teleport` effect to any empty cell on its side and a **half-turn**
  skill (gauge drops to half, like Move); it keeps stealth. Skills can
  target `self` only.
- **Drain / Blood Bolt / Summon Imp** (Warlock): damage effects can
  **drain** (heal the caster by a share of the damage dealt; nothing from
  an immune target). Skills can cost **HP**, refused unless the caster has
  more HP than the cost. A `summon` effect puts a creature (data) in an
  empty cell on the caster's side, controlled like the caster; one per
  caster, and summoning again replaces the old one (even in its cell). The
  **Imp** (30 HP, fast, melee claws, Firebolt 4 MP) lasts until knocked out
  or replaced. Summons **vanish** when knocked out (no body), don't count
  toward the 5-unit party limit, and don't keep a lost battle going.
- **Haste / Slow / Quicken** (Chronomancer): Haste and Slow are timed
  speed modifiers (x1.5 / x0.5 for 150 game time) applied by a `modify`
  skill effect; Slow is harmful, so Cure removes it. Quicken (a `gauge`
  effect) fills another ally's gauge so it acts right after this turn;
  not on the caster, a unit already ready, or one that is casting.
- **Cure** (Healer): 5 MP, one living ally, removes every **harmful**
  status (Poison) and keeps helpful ones (Regen). Statuses carry a
  harmful flag, so a cleanse needs no list of what to remove. While
  choosing, allies with a harmful status are highlighted.
- **Revive** (Healer): 20 MP, one knocked-out ally (not a boulder or a
  summon, which vanish), brings it back with 1.5 x magic HP (at least 1)
  and an empty gauge. Aimed at a living ally or an empty cell it is not
  allowed; a delayed revive that finds its ally already up does nothing.
  While choosing, fallen allies are highlighted. The AI values a revive
  above most heals, so enemy healers bring their side back too.

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
targets.

**Skills** (done): an AI unit weighs every skill it can afford at every
cell it may aim it, and uses the best one if it beats its best attack.
A skill's worth is summed over everyone it would hit, friend or foe, in
the same units as a target score (a plain attack on a healthy, unarmored
target is about 1):

- damage (spells, strikes, shatter): the target score scaled by the
  expected damage compared with a plain attack, plus the finish bonus;
  against it for allies caught in the area;
- heal: 4 x share of max HP restored x share missing;
- buffs on allies and debuffs on foes: 1 each, nothing if already on;
  damage or healing over time counts at 0.6 of its total;
- cleanse: 1 per harmful status or modifier removed;
- gauge: 1.2 x the share of a full gauge an ally gains (or a foe loses);
- summon: 1.5 (a boulder 0.4) until the limit, on its own side;
- heave: 0.5 for pushing a melee foe back.

Delayed skills count 0.75; the price costs 0.5 x the share of max MP and
2 x the share of current HP. Every option gets the same seeded noise.

**Movement** (done): before acting, an AI unit checks each adjacent empty
cell (and each teleport it can afford). A cell is worth 2 x its best weapon
hit there (as a share of the target's max HP) minus the hits of every foe
that could reach it there (as a share of its own). It moves if a cell
beats its own by 0.2 (0.4 for a teleport that takes a whole turn, plus its
price); moving costs half a turn, so it acts again soon. So melee units
step out of the back rows and frail ranged units get out of melee reach.

### Monsters

| Monster | Role                                  | Traits         | Notes            | Threat |
| ------- | ------------------------------------- | -------------- | ---------------- | ------ |
| Slime   | Slow, sturdy, clumsy                  | ooze           |                  | 2      |
| Wolf    | Fast finisher                         | beast          |                  | 3      |
| Viper   | Fast, frail; venom bite poisons (DoT) | beast, reptile | immune to poison | 2      |

A weapon can carry an **on-hit status**: the Viper's bite poisons whoever
it wounds (0.4 x attack poison damage every 30 game time, 5 times). Poison
can knock a unit out, refreshes rather than stacks, and doesn't take hold
on a target immune to poison. Statuses say which stat scales them (attack
for venom, magic for Regen).

### Random encounters

Done. `randomEncounter(seed, difficulty)` builds a battle from the existing
types and monsters; the same seed gives the same encounter. The party
stands in each type's `preferredRow` in random columns. Monsters are drawn
until a **threat budget** is spent (Slime 2, Wolf 3, Viper 2; Easy 15,
Normal 19, Hard 25, which is 30% more than Normal) and lean toward the
front. Budgets are tuned with auto-played battles where both sides use
their skills and move, to about 99% / 89% / 56% party wins; a test keeps
each difficulty in its band. New monsters join the pool
automatically once they have a `threat`.

Designed enemies (from char) get an **estimated threat**
(`estimateThreat`): `0.023 x sqrt(offense x durability)`, so twice the
stats all round is twice the threat. Offense is the best of its weapon
(plus a share of on-hit poison) and its affordable damaging skills (times
the foes an area usually catches, less for delayed or expensive ones),
raised by 40% per support skill (up to +160%), times speed. Durability is
max HP raised by defense and spirit and by its resistances, x1.4 if it can
revive. It was fitted to how many copies of a range of monsters the party
beats about half the time on Hard; mixed pools of designed monsters land
in Hard's band, a pool of one big monster less exactly (a copy more or
less is a big step). If every monster costs more than the budget, one of
the cheapest is placed anyway.

After a victory, **Next battle** draws a new encounter (new encounter seed,
same difficulty). After a defeat or draw, **Try again** replays the same
encounter with a new battle seed.

## Open questions

**Knocked-out units.** Decided: bodies stay. A knocked-out unit keeps its
cell for the rest of the battle (so a later Revive can bring it back). It
**blocks movement, teleports and pushes** (a push or pull into a body is a
collision), but never attacks, reach, cover or areas: the unit behind it is
exposed at once, and areas pass over it. Its turn, statuses and any cast
are cleared. Summons and boulders are the exception: they vanish and free
their cell.

Still open:

- Whether a row emptied by knockouts changes anything beyond cover.

## Roadmap rules

- **No new skills for existing classes until there are at least 10
  distinct class archetypes.** Reached with the Geomancer (10 classes):
  new skills for existing classes may now be proposed.

### Class roster plan (10 archetypes)

Existing (10): **Fighter** (melee, front; Cleave hits all in reach), **Archer** (ranged; Aimed Shot ignores cover), **Mage**
(area magic), **Healer** (support), **Lancer** (spear: reaches behind the
front unit; Skewer hits a line of two, Hook pulls an enemy forward), **Chronomancer** (time control:
Haste, Slow, and Quicken to give an ally its turn now), **Warlock** (spends its own HP:
Blood Bolt costs HP, Drain wins it back, Summon Imp puts a player-controlled
Imp on the field), **Rogue** (Vanish into stealth, Shadowstep anywhere on its
side, ambush from stealth for x2), **Paladin** (holy blade; Aegis shields
an ally, Last Rites keeps an ally from being knocked out), **Geomancer** (crush
and impact; raises boulders, shatters them on crowds, heaves units back).

Planned, in rough order (names and kits are proposals):

| Class    | Role                                                | Signature mechanics        |
| -------- | --------------------------------------------------- | -------------------------- |
| Guardian | Tank (on hold: needs a mechanic no other class has) | To be designed             |
| Bard     | Support through songs (on hold)                     | Channeled party-wide auras |

With more than five classes, random encounters pick a seeded party of up
to five from the roster (kept in roster order) instead of every class.

## Backlog

Ideas to build in small steps, roughly in this order when they fit:

- **Burn** (fire damage over time), e.g. on Fireball.
- **Bleed** (physical damage over time, the slash signature effect).
- **Signature effects** for the other types (puncture, sunder, stagger,
  knockback, chill, interrupt, corrode) as skills call for them.
- **Sonic** damage type, with a future Bard.
- **Push on spells**: reuse the strike push on a spell (e.g. a blast that
  knocks enemies back).

## char (phase 4)

**Bootstrapped** (`modules/char`). A library of four lists, all plain data:

- **Skills**: melee's own `Skill` type. The designer edits spell damage,
  weapon strikes, heals and buffs/debuffs; other effects pass through.
- **Gear**: a slot (weapon, armor, accessory) and stat bonuses (`add` or
  `mul`). A weapon also says how it attacks (melee's `Weapon`).
- **Types**: a class or an enemy type. Stats at level 1, growth per level,
  an unarmed attack, traits, an icon, and the level each skill is learned
  at. An enemy's threat is not typed in: it is estimated from the
  compiled character (stats, weapon, skills), so a higher level or better
  gear means fewer of it per encounter. The character editor shows it.
- **Characters**: a type at a level (1 to 50), wearing gear. Characters of
  a class form the party; characters of an enemy type the monster pool.

**Melee's classes** (`shared/melee.ts`): every melee class is also a char
class (`melee-fighter`, ...), in the starter library and added to saved
libraries when they load, so each can be levelled, geared, edited and
used by jrpg. At level 3 it has exactly melee's stats; they grow 8% of the
level-1 value per level (speed 2%). Skills are learned in melee's order at
levels 1, 2, 4, 6, 8. An edited copy is kept; a deleted one comes back.

**Stats**: `round(base + growth x (level - 1))`, then gear the way melee
applies modifiers: `(stat + adds) x muls`, rounded. Experience: a level
costs `100 x level`; `gainXp` levels up as often as it pays for.

**Import into melee and jrpg**: melee owns a roster format (`shared/roster.ts`:
party and monster pool as `CombatantDef`s under one storage key). Char
compiles every character into a `CombatantDef` (levels and gear worked into
plain stats) and writes the roster on every change; melee offers it as the
**Custom** roster on its start screen, and jrpg sets out with the imported
party. All modules share one origin, so no server is involved. Char depends
on melee, never the other way round.

The library is saved in the browser (localStorage), with JSON export and
import.

## The run (`modules/jrpg`)

Jrpg is a run through **levels**, each a sequence of 12 to 15 encounters
generated from the run's seed (`shared/run.ts`, pure like the engine):

- **Battle**: melee's battle screen (`@jforge/melee/battle`). The first
  third are Easy, the rest Normal. One battle past the middle is an
  **elite** (Hard, enemies 2 levels up) and the last is the **final
  battle** (Hard, 3 levels up). Each battle fields a **pack** of 1 to 3
  kinds of enemy drawn from the pool by its seed. Winning gives every
  member `40 x enemy threat / party size` experience and sometimes gear
  (40%; elites and the final battle always), which goes in the bag. Losing
  or drawing **ends the run**. The party can **retreat** to the map (to
  change gear, say) until it gives its first command; from then on the
  fight is won or the run is over: giving up loses, gear is locked, and a
  reload opens the same battle from its start. Starting a battle over is
  allowed (the ↺ button, once the party has acted). An encounter is always
  fought with the same battle seed, so coming back never rerolls its luck.
- **Ally**: a traveller who isn't in the party offers to join, at the
  level of the party's weakest member if that is higher. The party holds
  five.
- **Gear**: three different pieces; take one, for a member (what they wore
  goes in the bag) or for the bag.
- **Training**: one member gains a level.
- **Fork**: two ways, each one of ally, gear, training or an elite battle;
  the party meets the one it picks.

Every level has an ally, gear and training, plus two more finds drawn at
random (gear, forks, another ally or training), between the first and
last battle and never two in a row. Between encounters gear can be
swapped with the bag. A cleared level leads to the next, deeper one.

**The world** (`shared/world.ts`): the run plays with char's library (the
starter library if it has no class character) plus jrpg's own content,
copied when the run starts so later edits don't break it: 9 enemy types
(Wolf, Slime, Viper, Bandit Archer, Hedge Witch, Bone Priest, Stone Golem,
Imp, Raider), 10 named travellers (one of each melee class, which char
provides) and 16 pieces of gear. All gear exists at four **tiers** (plain,
Fine, Superior, Masterwork: each adds half again to what the piece adds);
finds are a tier better per depth, with some luck.

**The party is drawn by lot**: two of the heroes (the travellers and every
class character designed in char), by the run's seed, both raised to the
level of the higher one and at least level 3. The start screen shows the
draw and can draw again; whoever isn't drawn can be met as an ally.

Enemies gain the party's average levels gained plus one per depth. The
**threat budget** of a battle is a share of the party's own estimated
threat (Easy 0.6, Normal 0.8, Hard 0.9), so encounters keep pace with
levels, gear and party size, and the share grows 6% per depth, so deeper
levels are harder. Auto-played parties win about 94% / 76% / 56% of the
first level's battles and 84% / 61% / 36% of the fifth's (every battle
counted, not only those of parties that got that far); a test keeps the
first level in its bands. The run is saved in the browser after every
encounter.

Not yet: HP carrying over between battles, shops, rest stops, replacing a
member when the party is full.

Still to come: a live damage preview and power budget in the skill
designer, the remaining effect types (statuses, summons), resistances per
type, AI targeting profiles, IndexedDB or cloud saves.

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
