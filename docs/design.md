# jforge game framework: design

jforge is a small game development framework: content (classes, enemy
types, skills, gear, characters) is written as code in **libs/content**,
fought with in **melee**, used in games such as **jrpg** and **autob**,
and browsed read-only in **char**. The combat is inspired by classic time-based JRPG battles
(gauges that fill with speed, front and back rows, elements), but all
content (classes, monsters, skills, names) is original.

How stats, gear, levels and a run's progression add up, and where to tune
them, is in [progression.md](progression.md).

## Modules

```
melee  <-  rules  <-  content  <-  char
  ^          ^          ^
  +----------+----------+------  jrpg, autob
```

| Package   | Role                                                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `melee`   | Battle engine and rules: what combatants, stats, damage types, statuses and skills are. Starter content. Runs any fight.     |
| `rules`   | A library: what content is (types) and the logic on it, `core/` for every game; a game's own rules stay in the game.         |
| `content` | A library: the content as code. `catalogue/` holds all of it; `jrpg/` and `autob/` say what each game uses.                  |
| `char`    | The codex: shows all content, or one game's, read-only. Saves only which tab and game were open.                             |
| `jrpg`    | The game: runs through levels of encounters. Uses melee for battles and its content for the party, enemies and gear.         |
| `autob`   | An autobattler: shop, bench and a hex board. Uses its content's classes as units and melee's unit data, with its own engine. |

**melee depends on nothing.** It accepts plain data (a party and an
encounter); `rules` compiles content into that format. **rules never
imports content**, and **no package imports char**. ESLint enforces it.

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
| Bow, staff   | Any                            | Front-most unit only          |

**Cover holds against skills too** (done): a skill aimed at a single
enemy (damage, a debuff, a heave) can only pick an **exposed** one, the
front-most living unit in its column, as a bow does; any column is fine.
Areas still land on covered units. A skill with `ignoreCover` may single
out any visible enemy (Aimed Shot; Volley's strike also reaches past
cover); char can set it on any skill. So a caster can't focus a frail
unit that stands behind a friend.

**The board shows cover when it matters** (done): while the player aims an
attack or a single-target skill, an enemy that only cover keeps out of
reach shows a shield in place of its bars (its name stays). In the Move
menu, a cell where the step would end behind a living ally shows the
shield. While an enemy's attack or single-target skill is shown, the party
members it couldn't single out because of cover show the same shield.
Areas show none, as they land on covered units anyway.

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

**Armour Pierce** (Lancer): a spear strike at x1.0 where only half the
target's defense counts (`armourPierce: 0.5` on a strike), 5 MP. Modifiers
to defense (Shield Wall, Braced) are halved with it; spirit is untouched.
With DEFENSE_K 50 it adds about a sixth against defense 20 and a quarter
against 40, so it pays against armoured foes and the Knight.

**Staggering Thrust** (Lancer): a spear strike at x0.8 that knocks a
quarter of a full gauge off a target it doesn't knock out (`stagger: 0.25`
on a strike, see stagger.ts), 5 MP: its next turn comes later, at once,
where Slow works over time. Never below 0, a gauge already below 0 (a
bow's late start) is left as it is, and a unit busy casting is not
affected. A ready unit knocked below full leaves the ready queue. The AI
values the gauge lost the way a gauge effect is valued.

**Weakening Strike** (Lancer): a spear strike at x0.8 that **weakens** a
target it doesn't knock out: for 150 game time every hit it deals, weapon,
skill or spell, is x0.75 (`weaken: 0.75` on the strike, the "Weakened" status in
weaken.ts, its `dealt` strength), 5 MP. It is the mirror of
Expose. Damage over time and bombs it applies while weakened are set
x0.75 too, as with Blessing. Previews and the AI see it; the AI values it
as any status.

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
time. It starts a battle at 0, or at the weapon's `startGauge`: a bow's is
-500 (drawing and nocking takes time), so an archer acts after most units
at first however fast it is, then at its full rate. Effects that halve a
gauge never raise one still below 0. The engine jumps straight to the next moment something happens (a
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

| Type   | Typical sources                                  | Identity                                         |
| ------ | ------------------------------------------------ | ------------------------------------------------ |
| Slash  | swords, claws, whips, glaives, scythes           | Strong vs flesh; poor vs armour, stone, bone     |
| Pierce | arrows, spears, fangs, daggers, rapiers, darts   | Strong vs beasts, light armour; poor vs oozes    |
| Chop   | axes, cleavers, halberds, throwing axes          | Splitting blows: strong vs wood, shields, armour |
| Crush  | maces, clubs, staffs, flails, hammers, fists     | Strong vs armour, bone, stone; poor vs oozes     |
| Impact | siege engines, giants, collisions, falls, blasts | Beyond human scale; strong vs structures         |

Crush is anything a person swings; impact is beyond human scale.
**Collisions** (blocked pushes and pulls) and **Shatter** deal impact.

**Magical types**

| Type      | Identity                                              |
| --------- | ----------------------------------------------------- |
| Fire      | Strong vs beasts, plants, oozes                       |
| Cold      | Strong vs reptiles, fire creatures                    |
| Lightning | Strong vs armoured and metal targets                  |
| Acid      | Eats armour                                           |
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
| Slash     | Bleed: worsening damage over time (Rend)       |
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
| armoured  | slash/pierce x0.75, chop/crush/lightning x1.25, acid x1.5     |

**Current content:** Sword, Claws: slash. Spear, Bow, Fangs, Venom
Fangs, Daggers: pierce. Staff, Slam, Hourglass, Rod: crush. Blessed
Blade: holy. Grimoire, Drain, Blood Bolt: shadow. Fireball, Meteor,
Firebolt: fire. Shatter and collisions: impact. Slime: ooze. Wolf: beast.
Viper: beast + reptile, immune to poison. Imp: demon. Boulder: stone.

### Skills, as data

Started: units have MP; a skill costs MP and is aimed at a **cell**. Its
`target` says where it may be aimed (a living ally, a living enemy, or any
cell) and its `area` which cells it hits around the aimed one.

**Strengths are data.** A status's factors live on the status in the
skill, not in the engine: `dealt` (damage the unit deals, weapons, skills
and the damage over time and bombs it applies), `taken` (damage it takes,
folded into `resistance`), `defense` (multiplies the defense stat) and
`ambush` (a stealth status's first hit). A status that leaves one out
gets its kind's default (`STRENGTH_DEFAULTS` in strengths.ts: Expose taken
1.3, Weaken dealt 0.75, Blessing dealt 1.2 and taken 0.8, Petrify taken
0.5, Stone Skin defense 1.5, stealth ambush 2). Statuses multiply. A
strike's `weaken` is the dealt factor it applies, and its `finishBelow`
the finisher threshold. So char can make a lesser Blessing or a deeper
Expose without new code.

- **Cleave** (Fighter): a slash strike at x0.7 on **every enemy the
  sword can reach** (the `reach` area: whatever the weapon could attack
  right now, so covered units are safe and the aimed cell only picks the
  swing), 5 MP. Reusable for any weapon: a spear's reach is deeper, a
  bow's covers every column.
- **Provoke** (Fighter): a **taunt** status on the Fighter itself (150
  game time, 5 MP). While it lasts, an enemy that singles out a target (a
  weapon attack, or a skill with a `single` area aimed at an enemy) must
  pick a taunting unit among those it could pick: for attacks and
  strikes, those in reach; for other skills, every exposed enemy (every
  visible one with `ignoreCover`). An enemy that
  can't reach the Fighter is free; area skills are free; stealth wins
  over taunt (a hidden taunter binds no one). The AI casts it only with
  allies to cover, and less the more the Fighter is hurt.
- **Iron Stance** (Fighter): the Fighter's own defense x2 for 150 game
  time, 4 MP. With Provoke it soaks the weapon hits it draws; it stacks
  with Shield Wall.
- **Second Wind** (Fighter): heals the Fighter by a quarter of its max HP,
  6 MP. A heal `of` max HP, so it doesn't depend on the Fighter's poor
  magic; the AI casts it only when hurt.
- **War Cry** (Fighter): a `self` skill with the row area: the Fighter and
  every ally in its row get attack x1.3 for 150 game time, 5 MP. Weapon
  hits and strikes only; spells use magic.
- **Rend** (Fighter, its sixth skill): a sword strike at x0.8 that leaves
  a target it doesn't knock out **bleeding**: slash damage over time,
  0.15 x attack every 30 game time, 5 ticks (`bleed` on a strike, the
  "Bleeding" status in bleed.ts), 5 MP. Each time the bleeding unit
  attacks, uses a skill or moves, every later tick deals half the first
  tick's amount more (`worsens` on a status: 1x, 1.5x, 2x, ...);
  defending and waiting don't worsen it, so holding still is the answer.
  Slash resistance applies (stone and construct take half); Cure removes
  it; a second Rend restarts it at its first amount. The AI values it as
  a damage status, without the worsening; threat counts it as Fire
  Arrow's burn.
- **Shield Wall** (Knight): a `self` skill with the **row** area (the
  aimed cell's whole row, on its own side only): the Knight and every
  ally in its row get defense x1.5 for 150 game time, 6 MP. It hardens
  the front line against weapons; spells go through spirit and are not
  affected.
- **Guard** (Knight): a **guard** status on an ally **next to** the
  Knight (one cell across or along; `adjacent` on the skill), 150 game
  time, 5 MP. While it lasts and the Knight stands, an enemy's
  single-target hit on that ally (a weapon attack, or a strike or damage
  spell with the `single` area) lands on the Knight instead, against the
  Knight's own defense, row and resistances, and the log says so. Area
  skills, statuses and debuffs still reach the ally. The guard holds for
  its time even if the two move apart. The AI casts it the more the ally
  is frailer than the Knight (HP and defense), and less the more the
  Knight is hurt; an AI attacker scores a guarded target as the Knight.
- **Shield Bash** (Knight): a lance strike at x0.8 that pushes the enemy
  one row back (5 MP); blocked, it crashes for x1.5 impact instead (the
  same rule as other pushes).
- **Charge** (Knight): a lance strike at x1.0 that first runs the Knight
  to the **front row of its own column** (`advance` on a strike), 6 MP.
  The way there must be clear (no unit, standing or knocked out, in the
  cells ahead) and the Knight must not be in the front row already. Reach
  and damage count from the front row, so a Knight pushed or placed back
  hits at the full front-row factor; the preview and the AI see it that
  way. Moving this way is part of the action: no extra half turn.
- **Rescue** (Knight): pulls an ally **next to** the Knight out of the
  line, 7 MP. In the ally's column the Knight takes the middle row and
  the ally the back row behind it; both cells must be free of anyone
  else (a knocked-out body blocks too), and it can't be aimed when the
  two already stand there. Being dragged back halves the ally's gauge.
  It also braces the Knight (defense x1.3 for 125 game time, about one
  Knight turn; `RESCUE_BRACE`, part of the rescue effect itself), which
  is how it meets "utility pays its way". It pairs with Charge: pull a
  hurt ally back, charge back into the front. The AI values it only for
  an ally at half HP or less, by how much less damage it takes in the
  back row, how hurt and how much frailer than the Knight it is; half as
  much for a melee ally, and less the gauge it loses; the brace adds to
  that only when it is already worth it.
- **Expose** (Sage): an **expose** status on one enemy (150 game time,
  8 MP): it takes x1.3 from every damage type (its `taken` strength,
  applied in `resistance`, so previews and the AI see it). Resisted types stay
  resisted, only less so; immune stays immune. It is harmful, so Cure
  removes it.
- **Silence** (Sage): a **silence** status on one enemy (150 game time,
  9 MP): it can't use skills, only attack, move, defend or wait, and a
  skill it is in the middle of casting fizzles, so it answers Aimed Shot
  and Meteor. Harmful, so Cure removes it. Cheap, under a quarter of the
  Sage's MP, as utility should be. The AI values it for a foe with a
  skill it could use, and a cast in progress as much as that cast is
  worth to its side.
- **Mana Burn** (Sage): an arcane spell at x0.8 on one enemy that also
  burns 10 of its MP (as much as it has; `burnMp` on a damage effect),
  7 MP. A caster hit by it has fewer skills left; a foe with no MP only
  takes the hit. The AI adds the MP burned, as a share of the foe's MP
  bar, when the foe has skills to spend it on.
- **Rebuke** (Sage): an arcane spell at x1.0 on one enemy, x1.6 if it is
  **empowered**: casting, or with any helpful status (Regen, a shield,
  Provoke's taunt) or helpful modifier (Haste, Iron Stance)
  (`vsEmpowered` on a damage effect, `isEmpowered`), 6 MP. Previews and
  the AI see the bonus. It punishes buffs and casts, as Silence does.
- **Arcane Wave** (Sage): an arcane spell on a whole enemy row (the
  **row** area, enemy side only, so it never hits your own units) whose
  power is **split**: x2 in total, shared evenly by everyone hit, at most
  x1.5 each (`split` on a damage effect). A lone foe takes x1.5, two take
  x1 each, five x0.4 each; boulders in the row count as hit. 10 MP.
  Previews and the AI use the share for the units actually hit; threat
  counts its x2 total.
- **Aimed Shot** (Archer): a bow strike at x1.5 that **ignores cover**
  (`ignoreCover` on the skill), so it reaches any visible enemy, back row
  included, 6 MP. Its job is picking off casters and the wounded behind a
  front line; stealth still hides a unit from it. It **takes aim first**
  (cast time 40, which x1.5 makes up for) and lands on the aimed cell:
  the target can step out of it, be guarded or rescued, or the archer
  knocked out first. It can't be used from the **front row**, where the
  archer is locked in hand-to-hand combat (`notFromFront`), so pulling an
  archer forward (Hook) takes it away.
- **Volley** (Archer): a bow strike at x0.5 on a **3x3** square that
  ignores cover, 8 MP. Aimed past the enemy front row it hits only
  enemies; aimed at the front row it spills onto your own front row, as
  Fireball does. Like Aimed Shot it can't be used from the front row.
- **Pinning Shot** (Archer): a bow strike at x0.7 that **pins** a target
  it doesn't knock out: speed x0.7 for 120 game time (the "Pinned"
  modifier, `pin` on a strike, see pin.ts), 5 MP. It is built into the
  strike, not a general second effect. Pinned stacks with Slow. The AI
  values the pin like a slow, and nothing on a target already pinned.
- **Quick Shot** (Archer): a bow strike at x0.6 that costs only **half a
  turn** (`halfTurn`, as Shadowstep), 3 MP. The AI counts a half-turn
  skill's value double, for the gauge it saves.
- **Fire Arrow** (Archer): a bow strike at x0.8 with the bow's **pierce**
  that sets a target it doesn't knock out **burning**: fire damage over
  time, 0.15 x attack every 30 game time, 5 ticks (`ignite` on a strike,
  the "Burning" status in ignite.ts), 6 MP. Fire resistance applies to
  the burn only. Built into the strike, as the pin is; a second Fire
  Arrow restarts the burn. The AI values the burn as a damage status;
  threat counts it the way a weapon's poison is counted.
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
- **Lightning Bolt** (Mage): lightning at x0.9 on one enemy and the unit
  right behind it (the **line** area), 10 MP. Constructs and armoured foes
  take more from lightning.
- **Mana Tap** (Mage): pays 10 HP to regain 15 MP, never above max, no MP
  (`restoreMp` effect). Not allowed at full MP. The AI taps only once it
  can't afford any of its other spells; threat ignores it (it is not
  support for allies).
- **Frost Lance** (Mage): cold at x1.1 on one enemy that also **chills**
  a target it doesn't knock out: speed x0.85 for 90 game time (the
  "Chilled" modifier, `chill` on a damage effect, see chill.ts), 6 MP.
  Built into the spell, as the pin is; it stacks with Pinned and Slow.
  The AI values the chill at half a slow.
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
- **Stone Skin** (Geomancer): 6 MP, one ally, a helpful `stoneSkin`
  status for 150 game time: defense x1.5 (its `defense` strength), and pushes and pulls don't move
  it (Upheaval, pushing and pulling strikes). A pushing strike then lands
  as a normal hit, not a crash (`stoneSkin.ts`).
- **Petrify** (Geomancer): 8 MP, one enemy, a harmful `petrify` status
  for 60 game time. Its gauge doesn't fill and it takes no turn; it takes
  x0.5 damage (its `taken` strength, folded into `resistance`). Petrifying breaks a cast in
  progress (the MP stays spent) and takes a unit waiting to act out of
  line; its full gauge brings it back as soon as the stone wears off. It
  can't be quickened. The AI values it by the share of an ally's HP the
  foe's weapon would take in the turns it loses, minus what the caster's
  next blow loses on stone, plus a broken cast (`petrify.ts`).
- **Aegis / Last Rites** (Paladin): all damage (weapons, spells,
  collisions, poison) goes through one function. A **shield** status
  absorbs first (Aegis: 2 x magic, 150 game time, refreshes on recast); a
  **ward** status keeps a lethal blow at 1 HP (Last Rites: 120 game time,
  any number of hits). Drain only counts damage that got through. The AI
  knows a shield soaks part of a hit and a warded unit can't be finished.
  The Blessed Blade deals **holy** damage.
- **Consecrate** (Paladin): 10 MP, a plus of enemies, a harmful holy
  `damage` status (0.25 x magic every 30 game time, 4 ticks): an area
  Curse, counted by the threat estimate as damage over time times the
  plus's reach.
- **Judgment** (Paladin): 6 MP, a single-enemy strike x1.0 (`mend` on
  the strike, see `judgment.ts`). The living ally missing the largest
  share of its max HP (the Paladin included, obstacles not) heals half
  the damage that got through; no one hurt, no heal. The AI values the
  heal on that ally; the threat estimate counts only the strike.
- **Blessing** (Paladin): 6 MP, one ally (the Paladin included), a
  helpful `bless` status for 150 game time; recasting refreshes it. The
  blessed unit deals x1.2 damage and takes x0.8 of every kind (weapons,
  spells, damage over time, bombs): its `dealt` 1.2 and `taken` 0.8
  strengths. Taken is folded into `resistance`, as Expose is; dealt
  multiplies with Weaken's in `dealtFactor`, and a blessed caster's
  damage-over-time statuses and bombs are set x1.2 when applied.
- **Vanish / Shadowstep** (Rogue): **Stealth** is a timed status (one
  silent tick that just ends it). A stealthed unit can't be picked by
  enemies for weapon attacks or single-target skills (areas and poison
  still hit it; it still covers units behind it). Its first damaging
  action is an **ambush** for x2 (the stealth status's `ambush`
  strength), which ends stealth. Shadowstep is a
  `teleport` effect to any empty cell on its side and a **half-turn**
  skill (gauge drops to half, like Move); it keeps stealth. Skills can
  target `self` only.
- **Poison Blade** (Rogue): 5 MP, self, a helpful `coat` status for 450
  game time. While it lasts, every weapon hit that gets through (plain
  attacks and strike skills) poisons a living, non-boulder target with
  the Viper's venom (0.4 x the Rogue's attack per tick, 5 ticks);
  poisoning again restarts it, never stacks. The AI adds the poison's
  value to the Rogue's strikes while coated; the threat estimate counts
  the coating like a venomous weapon.
- **Smoke Bomb** (Rogue): 5 MP, another ally (not the Rogue), a helpful
  `smoke` status for 100 game time. Enemies can't single it out with
  weapon attacks or single-target skills, as with stealth; area skills
  and damage over time still hit it, and it still covers units behind
  it. Unlike stealth, acting doesn't end it and it gives no ambush.
- **Coup de Grâce** (Rogue): 8 MP, a single-enemy strike x1.0 that hits
  x2.5 against a target below 30% of its max HP (`finisher: 2.5` on the
  strike; `finishBelow` sets the threshold per skill, 30% by default in
  `finisher.ts`). The preview and the AI
  see the finishing hit; the threat estimate counts the base x1.0.
- **Drain / Blood Bolt / Summon Imp** (Warlock): damage effects can
  **drain** (heal the caster by a share of the damage dealt; nothing from
  an immune target). Skills can cost **HP**, refused unless the caster has
  more HP than the cost. A `summon` effect puts a creature (data) in an
  empty cell on the caster's side, controlled like the caster; one per
  caster, and summoning again replaces the old one (even in its cell). The
  **Imp** (30 HP, fast, melee claws, Firebolt 4 MP) lasts until knocked out
  or replaced. Summons **vanish** when knocked out (no body), don't count
  toward the 5-unit party limit, and don't keep a lost battle going.
- **Curse** (Warlock): 6 MP, one enemy, a harmful shadow `damage` status
  (0.3 x magic per tick, 5 ticks every 30 game time), like poison. The
  threat estimate counts a damage-over-time skill as damage (a quarter of
  its total, as for a poisoning bite), not as a support skill.
- **Sacrifice** (Warlock): 0 MP, aimed at one of the caster's own living
  summons (the Imp). The summon vanishes, the Warlock heals by the HP it
  had left, and gains **Dark Pact** (magic x1.5 for 150 game time, a
  helpful modifier; recasting refreshes it). The AI weighs the healing
  and the boost against the Imp, counted for as much of a summon's worth
  as it has HP left, so it gives up a hurt Imp sooner.
- **Haste / Slow / Quicken** (Chronomancer): Haste and Slow are timed
  speed modifiers (x1.5 / x0.5 for 150 game time) applied by a `modify`
  skill effect; Slow is harmful, so Cure removes it. Quicken (a `gauge`
  effect) fills another ally's gauge so it acts right after this turn;
  not on the caster, a unit already ready, or one that is casting.
- **Time Bomb** (Chronomancer): 10 MP, one enemy, plants a harmful
  `bomb` status worth 1.0 x the caster's magic (fixed when planted). It
  **explodes** when its time runs out (90 game time) or at once when the
  carrier is knocked out, whichever comes first. The blast covers a plus
  around the carrier on the carrier's own side only, the carrier
  included, and hits everyone standing there (boulders too) for its
  amount as arcane damage: resistances apply, spirit doesn't, as with
  other damage over time. The bomb comes off before the blast, so it goes
  off once; a victim the blast knocks out sets off its own bomb in turn.
  Planting again refreshes the timer; Cure removes it unexploded. The AI
  values it as the blast's damage on everyone now around the target.
- **Rewind** (Chronomancer): 10 MP, one living ally (the caster too),
  gives back all the HP it lost since its last turn ended. Every unit
  keeps `rewindHp`, its HP when its last action ended (or the battle
  began, or it was revived); Rewind heals it up to that, never above.
  Refused when the ally has lost no HP since then. HP the ally spent on
  its own turn (Blood Bolt, Mana Tap) is not given back, as the mark is
  taken after the action. The AI values it as a heal of the difference.
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
- **Smite** (Healer): a holy spell at x1.2 on one enemy, 6 MP, so the
  Healer has something to do when no one is hurt. No extra rules.

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
data is validated and carries a version (`SAVE_VERSION`); a save of any
other version is dropped (see "Saved data" under the roadmap rules).
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

- **near**: a cost for a far target, up to its weight for the farthest
  and none for the one straight ahead. Distance is columns away plus the
  target's row, as a share of the most there can be (4 + 2). It is a cost
  rather than a bonus so attacks don't crowd out heals and buffs;
- **finish**: the expected hit (the damage formula without the random
  spread) would knock the target out;
- **wounded**: how much HP the target has lost;
- **soft**: how little the target's defense blocks;
- **noise**: seeded randomness, so enemies aren't fully predictable but
  battles still replay exactly.

The default profile is near 1, finish 3, wounded 1, soft 1, noise 0.5:
enemies hit what is close, but a badly hurt unit a little farther off, or
one they can finish anywhere, draws them away. A profile without `near`
takes the default's. The Wolf is a finisher; the Slime is clumsy; the
Viper picks on soft targets.

**Skills** (done): an AI unit weighs every skill it can afford at every
cell it may aim it, and uses the best one if it beats its best attack.
A skill's worth is summed over everyone it would hit, friend or foe, in
the same units as a target score (a plain attack on a healthy, unarmoured
target is about 1):

- damage (spells, strikes, shatter): the target score scaled by the
  expected damage compared with a plain attack (never below 0, so one
  more foe caught never counts against it), plus the finish bonus;
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
Normal 21, Hard 27, about 30% more than Normal). At most **two thirds**
of them are **back-liners** (a ranged weapon or a preferred row past the
front; `isBackLiner`): one is drawn only while there are at most two per
front-liner after it, so the first is always a front-liner. A pool with
no front-liner is free. Each monster stands in its `preferredRow`, or
the nearest row with room, in a random column. Budgets are tuned with auto-played battles where both sides use
their skills and move, to about 100% / 90% / 55% party wins; a test keeps
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
- **At least five unique skills per class.** Every player class gets at
  least five skills that no other class has, mixing roles (a Fighter
  deals damage and tanks). They are added one skill at a time, each
  reviewed first.
- **Saved data.** For now, every save may be invalidated: a run in
  progress (jrpg's and autob's) carries `SAVE_VERSION`
  (`melee/shared/save.ts`), and a save of any other version is ignored as
  if there were none. Raise it whenever a change makes old saves stale,
  such as a class gaining a skill; saves are never migrated.

### Skill design guidelines

Guidelines for good design, not hard rules: nothing enforces them, and a
skill may break one for a reason worth stating.

- **Utility pays its way.** A skill that neither deals damage nor heals
  should either do something else as well or be cheap: at most a quarter
  of its class's max MP, so it can be cast at least four times a battle
  (the same line threat counts a skill in full at, `FULL_CASTS`).
  Skills that don't follow it yet, to revisit one at a time: Provoke,
  Iron Stance and War Cry (Fighter), Shield Wall and Guard (Knight),
  Vanish (Rogue), Aegis and Last Rites (Paladin). Each is revisited in
  its own way; there is no general "second effect" to bolt on.

### Class roster plan (12 archetypes)

Existing (12): **Fighter** (melee, front; both damage and tank: Cleave hits all in reach, Provoke draws single-target attacks, Iron Stance doubles its defense, Second Wind heals it, War Cry raises its row's attack, Rend leaves a bleed that worsens as its target acts), **Archer** (ranged, starts late; Aimed Shot takes aim, ignores cover, not from the front row; Volley rains on a 3x3; Pinning Shot slows its target; Quick Shot costs half a turn; Fire Arrow burns), **Mage**
(area magic; Lightning Bolt hits a line of two, Mana Tap trades HP for MP, Frost Lance chills), **Healer** (support), **Lancer** (spear: reaches behind the
front unit; Skewer hits a line of two, Hook pulls an enemy forward, Armour Pierce halves defense, Staggering Thrust delays a turn, Weakening Strike makes its target deal less), **Chronomancer** (time control:
Haste, Slow, and Quicken to give an ally its turn now; Time Bomb explodes on an enemy and its neighbours, Rewind gives an ally back the HP it lost since its last turn), **Warlock** (spends its own HP:
Blood Bolt costs HP, Drain wins it back, Summon Imp puts a player-controlled
Imp on the field, Curse wears an enemy down, Sacrifice gives up the Imp
for HP and a magic boost), **Rogue** (Vanish into stealth, Shadowstep anywhere on its
side, ambush from stealth for x2, Poison Blade poisons its hits, Smoke
Bomb hides an ally, Coup de Grâce finishes the badly hurt), **Paladin** (holy blade; Aegis shields
an ally, Last Rites keeps an ally from being knocked out, Consecrate
burns a crowd with holy damage over time, Judgment heals the most-hurt
ally with its strikes, Blessing makes an ally hit harder and take less), **Geomancer** (crush
and impact; raises boulders, shatters them on crowds, heaves units back, Stone Skin roots an ally, Petrify
freezes a foe),
**Knight** (protector of the line: heavy and slow, with a lance; Shield
Wall hardens its whole row, Guard takes the hits meant for an ally next
to it, Shield Bash knocks an enemy a row back, Charge runs it back into the
front row with a strike, Rescue pulls a hurt ally back behind it),
**Sage** (knowledge and counter-magic, with a
tome of arcane words; Expose makes an enemy take more of everything, Silence stops its skills and breaks its casts, Mana Burn burns its MP, Rebuke hits harder the empowered, Arcane Wave splits x2 across a row).

Planned, in rough order (names and kits are proposals):

| Class | Role                            | Signature mechanics        |
| ----- | ------------------------------- | -------------------------- |
| Bard  | Support through songs (on hold) | Channeled party-wide auras |

With more than five classes, random encounters pick a seeded party of up
to five from the roster (kept in roster order) instead of every class.

## Backlog

Ideas to build in small steps, roughly in this order when they fit:

- **One "leaves a status" field on strikes**: replace the per-effect
  flags (`ignite`, `bleed`, ...) with one field naming the status a
  strike leaves, before more signature effects (sunder, corrode) arrive.
  Touches the existing skills and their checks in `libs/rules/core`.
- **Signature effects** for the other types (puncture, sunder, stagger,
  knockback, chill, interrupt, corrode) as skills call for them.
- **Sonic** damage type, with a future Bard.
- **Push on spells**: reuse the strike push on a spell (e.g. a blast that
  knocks enemies back).

## char: the codex (`modules/char`)

**Content is code.** All content is written in `libs/content` and
reviewed like any code; char shows it and changes nothing. A library of
four lists, all plain data (types in `libs/rules/core/types.ts`):

- **Skills**: melee's own `Skill` type.
- **Gear**: a slot (weapon, armour, accessory) and stat bonuses (`add` or
  `mul`). A weapon also says how it attacks (melee's `Weapon`). Weapons
  and armour can have a **category**: blade, polearm, dagger, bow, staff or
  focus; heavy armour, light armour or robe. Accessories have none.
- **Types**: a class, an enemy type or a summon. Stats at level 1, an unarmed
  attack, traits, an icon, and the skills it has. An enemy's threat is
  not written in: it is estimated from the compiled character (stats,
  weapon, skills), so stronger stats or better gear mean fewer of it per
  encounter. The codex shows it.
- **Characters**: a type wearing gear. Characters of a class form a
  party; characters of an enemy type a monster pool. A summon has none: a
  skill puts it in.

**Per-game content** (`libs/content/<game>/`): the catalogue holds every
design; a game's folder picks the archetypes it uses (`select`) and may
replace one with a changed copy to rebalance it for that game alone,
leaving the catalogue as it is. jrpg and autob read their own
(`@jforge/content/jrpg`, `@jforge/content/autob`) when a run starts, so
autob's shop sells only the classes autob picks. A summon a game leaves
out falls back to the creature saved in the skill.
Melee keeps its own content and needs none of this.

**The codex** shows, on tabs, the classes, the class graph (**Paths**),
enemy types, summons, characters, skills and gear, either all of it
(**Everything**) or what one game uses. Each item links to those it
names (a class to its skills, a skill to who knows it and what it puts
in, a summon to the skills that put it in, gear to who wears it). It saves only the tab and the game picked, on this device.

**The content knows no levels or progression**: classes, enemy types and
skills are at level 1. How they grow, when skills are learned and what
experience is for belong to the game that uses them (jrpg: see **Levels
and growth** under The run). A game's own rules on content stay in the
game (jrpg's growth, learning and gear tiers are in `modules/jrpg/shared`);
they move to `libs/rules/<game>/` only when another package needs them,
such as char showing them.

**Class graph** (`libs/rules/core/classGraph.ts`): classes can be linked into a
graph of related classes, where a base class leads to specialisations
(a Fighter to a Paladin or a Battle Mage, a Mage to a Battle Mage or an
Archmage). A class lists the classes it **comes from** (`comesFrom`);
any one of them is enough to reach it, and a class with none is a
**base class**. The links carry no levels, costs or conditions, so the
content knows no progression: a game that uses the graph decides when and
how a character may take a link (jrpg2: see section 6 of
[progression.md](progression.md)). Links go forward only and can be any
depth, but never loop; `graphProblems` lists what is wrong (a loop, a
link to itself or to no class) and the content's tests require it empty
in every view. Enemy types take no part. Melee's classes have no links.
The catalogue has the
graph's **base classes**, one per main stat line: **Squire** (strength:
attack, defense and HP, front row, blades, polearms, heavy and light
armour), **Scout** (agility: speed and attack, middle row, daggers, bows
and light armour) and **Apprentice** (magic: magic, spirit and MP, back
row, staves, foci and robes; it is to fork into offensive and defensive
magic). Their stats are close to melee's Fighter, Rogue, and Mage and
Healer. Each base leads to a **second level** of broad roles, linked in
the catalogue: Squire to **Warrior** (tank), **Fighter**
(two-handed fighter) and **Spearman**; Scout to **Thief**, **Archer**,
**Duelist** (agile front-line fighter) and **Hunter** (fights with a
pet); Apprentice to **Mage** (offensive magic), **Healer**, **Enchanter**
(buffs, debuffs and control) and **Summoner**. Second-level names stay
generic; specialised names (Guardian, Lancer, Beastmaster, Cleric) are
for the third level, which is not designed yet. The bases and the second
level have no skills yet and are in no game yet; the second level's
Fighter, Archer, Mage and Healer are apart from melee's classes of the
same name, which are not placed in the graph yet.

**Paths** shows the graph in columns by depth: the base classes, then
each step after them; classes not in the graph are listed apart. A
game can use the classes alone, as jrpg and autob do, or the classes and
the graph.

**Stand-ins for a source's skills** (a design rule, not checked): a
character that takes a link starts fresh with the new class's skills, so
a class that can be reached should have skills that stand in, roughly,
for its source's key ones (a Paladin a guard and a strike like a
Fighter's).

**Gear restrictions** (`canUse`, `canWear` in `libs/rules/core/gear.ts`): a type
can list the categories it is **proficient** with. Its characters can use
gear of those categories and gear with no category; a type without a list
uses anything. Gear a character can't use is worn in name only:
`equippedGear` leaves it out, so it adds no stats and no weapon, and the
codex marks it "(can't use)".

**Skill checks** (`libs/rules/core/skills.ts`): `effectSummary` says
what a skill does in words, as the codex shows it, and `skillProblems`
checks every kind (power above 0, a duration, a gauge share, a summon's
type, which must be a summon); the content's tests require it empty for
every skill.

**Summons are their own kind**: a creature a skill puts in is a
**summon** (`kind: "summon"`), not an enemy type, even when one shares
an enemy's name (the Warlock's Imp and the world's Imp are two designs).
A summon has no characters, so it is in neither the party nor a monster
pool: jrpg and autob never meet one as an enemy. A summon skill names
its summon, saved on the effect as its `source`. The creature is
compiled from it then, and again whenever the roster is compiled, so
changes to the summon reach it; if a game leaves the summon out, the
creature saved on the skill is used. A creature's own summons are
compiled one step deep (`SUMMON_DEPTH` 2), so one that summons itself
still compiles. Melee's Imp and boulder are summons (`summon-imp`,
`summon-boulder`, with melee's stats; an archetype can be an
`obstacle`), and Summon Imp and Raise Boulder point at them.

**Ids say what a thing is**: enemy types start with `enemy-`, summons
with `summon-`, gear with its slot: `weapon-`, `armour-` or `accessory-`; tiers add `+1` to `+3`. Classes are
`melee-…`/`class-…` and heroes `melee-hero-…`. A catalogue test checks
the prefixes. Skills keep melee's ids for now, but Summon Imp is
`skill-summon-imp`, apart from the summon it puts in.

**Melee's classes** (`libs/content/catalogue/melee.ts`): every melee
class is also a class of the catalogue (`melee-fighter`, ...), so each
can be geared and used by jrpg and autob. Its level-1 stats are melee's
own and it has all of melee's skills for it.
Their proficiencies (`MELEE_PROFICIENCIES`) include their own weapon's
category:

| Class              | Weapons        | Armour       |
| ------------------ | -------------- | ------------ |
| Fighter, Lancer    | blade, polearm | heavy, light |
| Paladin            | blade          | heavy, light |
| Archer, Rogue      | bow, dagger    | light        |
| Mage, Chronomancer | staff, focus   | robe         |
| Healer             | staff          | robe, light  |
| Warlock            | focus, dagger  | robe, light  |
| Geomancer          | staff, focus   | robe, light  |
| Knight             | polearm, blade | heavy, light |
| Sage               | focus, staff   | robe         |

**Heroes and basic gear**: with the classes come a named hero of each
(`melee-hero-fighter`, ...: Brann, Isolde, Vex, Tamsin, Orrin, Hale, Wren,
Cade, Sable, Lucan, Aldric, Mira) and basic gear: each class's own weapon as a piece
(`weapon-fighter`, "Fighter's Sword", +3 to the class's best of
attack, magic and spirit) and two armours (Traveller's Jerkin, Traveller's
Robe: `armour-travellers-jerkin`, `armour-travellers-robe`). Basic gear has no drawbacks. `starterKit` fills a character's
empty slots with it: their melee class's weapon, and the robe if the
class's magic beats its attack, the jerkin if not, or the other when the
class can't wear that one (designed classes get armour only). Every hero
starts in their kit.

**Stats**: the stats before gear (the type's own, or what a game passes
in, such as jrpg's levelled stats), then gear the way melee applies
modifiers: `(stat + adds) x muls`, rounded.

## The run (`modules/jrpg`)

Jrpg is a run through **levels**, each a **map** generated from the run's
seed (`shared/run.ts`, pure like the engine): 12 to 15 rows of stops,
travelled first to last. The first and last row have one stop; the rows
between have two or three, on up to three lanes. A stop's roads lead to
the stops of the next row on its own or a neighbouring lane, and every
stop has a road in and a road on. After each encounter the party stands
at the roadside and picks one of the stops its road leads to (with one
way on, it walks straight there). The map shows every stop, so a route
can be planned.

- **Battle**: melee's battle screen (`@jforge/melee/battle`). The first
  third of the rows are Easy, the rest Normal. Past the middle some battle
  rows have an **elite** on one lane (Hard, enemies 2 levels up; at least
  one row does), and the last stop is the **final battle** (Hard, 3 levels
  up). Each battle fields a **pack** of 1 to 3 kinds of enemy drawn from
  the pool by its seed; the first is a front-liner when the pool has one,
  so the back-liner share (see Random encounters) leaves room for more
  than one. Winning gives every member `40 x enemy threat /
party size` experience and sometimes gear (40%; elites and the final
  battle always), which goes in the bag. Losing or drawing **ends the
  run**. The party can **retreat** to the map (to change gear, say) until
  it gives its first command; from then on the fight is won or the run is
  over: giving up loses, gear is locked, and a reload opens the same
  battle from its start. An encounter is always fought with the same
  battle seed, so coming back never rerolls its luck. Starting a battle
  over is allowed (the ↺ button, once the party has acted).
- **Ally**: a traveller who isn't in the party offers to join, at the
  level of the party's weakest member, with the catalogue's
  `starterKit` in their empty slots (heroes already wear theirs).
  The party holds five; when it is full the recruit can take a member's
  place, standing where they stood, and the one who leaves puts their gear
  in the bag.
- **Gear**: three different pieces; take one, for a member whose class
  can use it (what they wore goes in the bag) or for the bag. The party
  panel shows what each member uses and offers only bag gear that fits;
  `changeGear` refuses the rest.
- **Training**: one member gains a level.

Up to six rows offer **finds** (never two such rows running): a different
find on each lane, sometimes with a battle on one of them. Finds are
dealt so that an ally, gear and training all come up before any repeats.
A cleared level leads to the next, deeper one.

**Formation** (`shared/formation.ts`): before a battle the map shows the
field: the enemies where they will stand and the party, which the player
arranges (tap a member, then a cell; an occupied cell swaps). Unplaced
members stand in their class's preferred row, filling from the middle.
The formation is kept for the rest of the run and locked once the party
has acted in a battle.

Every level has an ally, gear and training, plus two more finds drawn at
random (gear, forks, another ally or training), between the first and
last battle and never two in a row. Between encounters gear can be
swapped with the bag. A cleared level leads to the next, deeper one.

**The world**: the run plays with jrpg's content (`@jforge/content/jrpg`),
copied when the run starts so later changes don't break it. Besides
melee's classes and heroes, jrpg picks the world's content from the
catalogue (`libs/content/catalogue/world.ts`): 9 enemy types
(Wolf, Slime, Viper, Bandit Archer, Hedge Witch, Bone Priest, Stone Golem,
Imp, Raider) and 20 pieces of gear, each weapon and armour with a
category (two foci, Seer's Orb and Black Tome, so every class has finds); the catalogue provides the heroes and their
basic gear, which finds and drops leave out. The names of travellers
(`TRAVELLER_NAMES`) are in `@jforge/content/jrpg`. All gear exists at four **tiers**
(`shared/world.ts`: plain,
Fine, Superior, Masterwork: each adds half again to what the piece adds);
finds are a tier better per depth, with some luck.

**The player chooses the party**: two of the heroes (every class
character in jrpg's content: melee's heroes for now), both at
level 1 (`START_LEVEL`). The start screen preselects two drawn by
the run's seed and can draw again; choosing a third lets go of the first.
Whoever doesn't set out can be met as an ally.

**Levels and growth** (`shared/progression.ts`, `growth.ts`,
`learning.ts`): jrpg owns them; the content is level 1.

- **Party levels**: a run keeps each member's level (1 to 50) and
  experience. A level costs `100 x level`; `gainXp` levels up as often as
  it pays for.
- **Stat growth** (`STAT_GROWTH`): one table, a row per class and enemy
  type, of what each level above 1 adds to each stat:
  `round(base + growth x (level - 1))`, before gear. Melee's classes and
  creatures grow 8% of their level-1 stats per level (speed 2%); the
  world's enemies have their own rows. A designed type with no row grows
  by those same shares.
- **Skill growth** (`SKILL_GROWTH`): one table, a row per skill, of what
  each level of the caster above 1 adds to any of the skill's numbers (by
  path: power, a status's power or ticks, MP cost, ...). Every row is
  empty for now: skills grow only through the caster's stats, so a level-5
  Hedge Witch's Fireball does more than a level-1 one through her magic.
- **Summons** match their summoner's level, grown by their enemy type's
  row.
- **Skills learned** (`LEARNING_ORDER`): each class learns its skills in
  its own order, two at level 1 and one more every level after, until it
  knows them all. When a class gains a skill, its order is rebalanced in
  the same change. A class with no order, and every enemy, knows all its
  skills.

Enemies start at level 1 and gain the party's average levels gained plus
one per depth. The **threat budget** of a battle is a share of the
party's own estimated threat (Easy 0.52, Normal 0.68, Hard 0.8), so
encounters keep pace with levels, gear and party size, and the share
grows 6% per depth, so deeper levels are harder. Auto-played parties win
about 96% / 74% / 60% of the first level's battles (every battle counted,
not only those of parties that got that far); a test keeps the first
level in its bands. The run is saved in the browser after every
encounter, with `SAVE_VERSION`; a run of another version is dropped.

Not yet: shops.

Still to come: a live damage preview and power budget in the skill
designer, the remaining effect types (statuses, summons), resistances per
type, AI targeting profiles, IndexedDB or cloud saves.

## The autobattler (`modules/autob`)

Autob is a single-player autobattler: a run of `ROUNDS` (30) rounds
against monster packs, after TFT's shop, gold and board and in the manner
of a solo trial against the house. It reuses only units: its content's classes
(stats, weapon, skills) and creatures. Its board and fights are its own;
**melee's battle rules don't apply and melee is not changed for it**.
The rules are pure functions in `shared/` (`run.ts` the run, `fight.ts`
the engine), like melee's.

**Units and stars** (`units.ts`). The shop sells every class of the run's
library: the classes autob picks (`@jforge/content/autob`), copied at
the start so later changes can't break a run. A bought copy is a 1★ unit;
three of a class at the same star merge at once into one a star higher,
up to 3★, keeping the place of the first (board before bench). Stars
multiply max HP, attack and magic by 1 / 1.8 / 3.24. Each class has a
**cost tier** 1–3: the classes ranked by melee's threat estimate at 1★
and cut into thirds, ties by id; the tier is its price in gold. Selling
pays back what its copies cost.

**Shop and pool** (`shop.ts`). Each round the shop offers 5 units. A
slot draws a tier by the level's odds (`SHOP_ODDS`: level 1–2 all tier
1, level 10 5/30/65%), then a class of that tier weighted by copies left
in the run's **pool** (18 / 15 / 12 copies per class of tier 1 / 2 / 3).
Buying takes a copy out, selling puts its copies back. A tier with none
left gives way to the nearest one, cheaper first. A reroll costs 2. The
**bench** holds 9 units; a full bench still takes a copy that completes
a merge.

**Gold and levels** (`economy.ts`). Every round pays 5, plus 1 interest
per 10 gold held (at most 5), plus a streak bonus of 1 / 2 / 3 for 2–3 /
4 / 5+ wins or losses in a row; a win pays 1 more. Every round gives 2
experience, and 4 more cost 4 gold. Levels run 1–10, with 2, 2, 6, 10,
20, 36, 48, 76, 84 experience to the next. The **level is how many units
may stand on the board**.

**Monsters** (`monsters.ts`). Rounds come in stages of 5. Each round's
pack is drawn from the run's seed: monsters at random among those the
round's **budget** still affords (3 + 1 per round after the first, ×1.3
on a stage's last round), each costing its threat, at most 10. The
monsters are the library's non-obstacle enemy types (never its summons) plus melee's monsters;
each stage after the first adds 45% to their max HP, attack and magic.
Each stands in its own row (or by weapon: ranged behind) in a random free
hex, or the nearest row with room. The planning screen shows the pack
where it will stand.

**Lives and the end.** A run starts with 3 lives. A lost round (or a
draw) costs one; losing the last loses the run. Living through round 30
wins it. The score is the rounds lived through. The run is saved in the
browser after every change, with `SAVE_VERSION`. A fight follows from
the run alone, so a reload during one returns to planning and the same
fight.

**The board** (`hex.ts`). After TFT: each side has 4 rows of 7 hexes,
row 0 at the front, and the two sides form one 8×7 arena, the enemy's on
top, odd rows half a hex to the right. Distances are hex steps.

**The fight** (`fight.ts`). Real time in ticks of 0.1 s; melee's game
time 100 is one second. Each tick, timed effects run out, then every
unit acts in order:

- A unit with no enemy in range steps one hex along a shortest free way
  toward a hex from which it reaches one, every 0.5 s. Melee weapons
  reach 1 hex, ranged weapons 4. Speed 0 (an obstacle's) never acts.
- In range, it attacks its target (the nearest enemy; ties to the
  weakest) every 10 / speed seconds, at least 0.3 s: attack × 50 / (50 +
  defense) × the target's resistance to the weapon's damage type,
  ±10%, at least 1 unless immune.
- **Mana**: +10 per attack, +5 per hit taken. When a unit has the mana
  for its next skill (30 + 5 × the skill's MP cost) and a target for it,
  it casts that instead of attacking, empties its mana and moves on to
  its next skill.
- Skills hit by their area: single; plus and square the target and its
  neighbours; line the target and the hex behind it; row the target's
  row; reach every one of the target's side within the caster's range.
  Enemy skills aim at the target in range; ally skills at the most hurt
  ally; self skills at the caster; "any" skills at an ally when they
  help.
- **Effects that work**: strike (power, armour pierce, finisher), magical
  damage (power, element, drain), heal (by magic or max HP), timed stat
  modifiers, and heal / damage over time and shields. Any other effect
  makes a skill one autob doesn't cast.
- A side with nobody standing loses; both at once, or still fighting
  after 30 s, is a draw.

**Balance.** A simple bot (`bot.ts`: buys copies of what it owns first,
keeps 10 gold for interest, levels when rich, fields its strongest units
by their preferred rows) lives through about 25 rounds on average and
rarely wins; a test keeps it past the third stage on average, short of
the end, winning at most a quarter of its runs.

Not yet: traits and synergies, items, a choice between rewards after
stages, the remaining skill effects.

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
7. **autob**: a bootstrap autobattler on char's classes.

Later: equipment, character attributes, levels and growth, more classes,
multi-cell bosses, editable monster AI, cloud saves.
