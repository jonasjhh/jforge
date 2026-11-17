# jforge game framework: design

jforge is a small game development framework: build characters and skills
in **char**, test them in fights in **melee**, and use them in games such
as **jrpg**. The combat is inspired by classic time-based JRPG battles
(gauges that fill with speed, front and back rows, elements), but all
content (classes, monsters, skills, names) is original.

How stats, gear, levels and a run's progression add up, and where to tune
them, is in [progression.md](progression.md).

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

**Armor Pierce** (Lancer): a spear strike at x1.0 where only half the
target's defense counts (`armorPierce: 0.5` on a strike), 5 MP. Modifiers
to defense (Shield Wall, Braced) are halved with it; spirit is untouched.
With DEFENSE_K 50 it adds about a sixth against defense 20 and a quarter
against 40, so it pays against armored foes and the Knight.

**Staggering Thrust** (Lancer): a spear strike at x0.8 that knocks a
quarter of a full gauge off a target it doesn't knock out (`stagger: 0.25`
on a strike, see stagger.ts), 5 MP: its next turn comes later, at once,
where Slow works over time. Never below 0, a gauge already below 0 (a
bow's late start) is left as it is, and a unit busy casting is not
affected. A ready unit knocked below full leaves the ready queue. The AI
values the gauge lost the way a gauge effect is valued.

**Weakening Strike** (Lancer): a spear strike at x0.8 that **weakens** a
target it doesn't knock out: for 150 game time every hit it deals, weapon,
skill or spell, is x0.75 (`weaken` on a strike, the "Weakened" status in
weaken.ts, `WEAKEN_FACTOR` in damage.ts), 5 MP. It is the mirror of
Expose. Damage over time it applies (poison, burns) is not reduced. Previews and
the AI see it; the AI values it as any status.

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
- **Provoke** (Fighter): a **taunt** status on the Fighter itself (150
  game time, 5 MP). While it lasts, an enemy that singles out a target (a
  weapon attack, or a skill with a `single` area aimed at an enemy) must
  pick a taunting unit among those it could pick: for attacks and
  strikes, those in reach; for spells, every visible enemy. An enemy that
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
  8 MP): it takes x1.3 from every damage type (`EXPOSE_FACTOR`, applied
  in `resistance`, so previews and the AI see it). Resisted types stay
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
  (`ignoreCover` on a strike), so it reaches any visible enemy, back row
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
  right behind it (the **line** area), 10 MP. Constructs and armored foes
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
Normal 21, Hard 27, about 30% more than Normal) and lean toward the
front. Budgets are tuned with auto-played battles where both sides use
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
- **Five unique skills per class.** Every player class gets five skills
  that no other class has, mixing roles (a Fighter deals damage and
  tanks), learned at levels 1, 2, 4, 6 and 8. They are added one skill at
  a time, each reviewed first.
- **Saved data.** For now, every save may be invalidated: the library,
  the roster char publishes to melee and the run in progress all carry
  `SAVE_VERSION` (`melee/shared/save.ts`), and a save of any other version
  is ignored as if there were none (char starts from the starter library,
  jrpg has no run). Raise it whenever a change makes old saves stale,
  such as a class gaining a skill; saves are never migrated. Exported
  library files of an older version no longer import.

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

Existing (12): **Fighter** (melee, front; both damage and tank: Cleave hits all in reach, Provoke draws single-target attacks, Iron Stance doubles its defense, Second Wind heals it, War Cry raises its row's attack), **Archer** (ranged, starts late; Aimed Shot takes aim, ignores cover, not from the front row; Volley rains on a 3x3; Pinning Shot slows its target; Quick Shot costs half a turn; Fire Arrow burns), **Mage**
(area magic; Lightning Bolt hits a line of two, Mana Tap trades HP for MP, Frost Lance chills), **Healer** (support), **Lancer** (spear: reaches behind the
front unit; Skewer hits a line of two, Hook pulls an enemy forward, Armor Pierce halves defense, Staggering Thrust delays a turn, Weakening Strike makes its target deal less), **Chronomancer** (time control:
Haste, Slow, and Quicken to give an ally its turn now; Time Bomb explodes on an enemy and its neighbours), **Warlock** (spends its own HP:
Blood Bolt costs HP, Drain wins it back, Summon Imp puts a player-controlled
Imp on the field), **Rogue** (Vanish into stealth, Shadowstep anywhere on its
side, ambush from stealth for x2), **Paladin** (holy blade; Aegis shields
an ally, Last Rites keeps an ally from being knocked out), **Geomancer** (crush
and impact; raises boulders, shatters them on crowds, heaves units back),
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
  `mul`). A weapon also says how it attacks (melee's `Weapon`). Weapons
  and armor can have a **category**: blade, polearm, dagger, bow, staff or
  focus; heavy armor, light armor or robe. Accessories have none.
- **Types**: a class or an enemy type. Stats at level 1, growth per level,
  an unarmed attack, traits, an icon, and the level each skill is learned
  at. An enemy's threat is not typed in: it is estimated from the
  compiled character (stats, weapon, skills), so a higher level or better
  gear means fewer of it per encounter. The character editor shows it.
- **Characters**: a type at a level (1 to 50), wearing gear. Characters of
  a class form the party; characters of an enemy type the monster pool.

**Gear restrictions** (`canUse`, `canWear` in `shared/gear.ts`): a type
can list the categories it is **proficient** with. Its characters can use
gear of those categories and gear with no category; a type without a list
uses anything, as does every type of a library saved before categories.
Gear a character can't use is worn in name only: `equippedGear` leaves it
out, so it adds no stats and no weapon, and the character editor marks it
"(can't use)" and offers only what fits. The class editor sets the list
("Any gear" or a choice of categories); the gear editor sets a piece's
category.

**Melee's classes** (`shared/melee.ts`): every melee class is also a char
class (`melee-fighter`, ...), in the starter library and added to saved
libraries when they load, so each can be levelled, geared, edited and
used by jrpg. At level 3 it has exactly melee's stats; they grow 8% of the
level-1 value per level (speed 2%). Skills are learned in melee's order at
levels 1, 2, 4, 6, 8. An edited copy is kept; a deleted one comes back.
Their proficiencies (`MELEE_PROFICIENCIES`) include their own weapon's
category:

| Class              | Weapons        | Armor        |
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
(`melee-gear-fighter`, "Fighter's Sword", +3 to the class's best of
attack, magic and spirit) and two armors (Traveller's Jerkin, Traveller's
Robe). Basic gear has no drawbacks. `starterKit` fills a character's
empty slots with it: their melee class's weapon, and the robe if the
class's magic beats its attack, the jerkin if not, or the other when the
class can't wear that one (designed classes get armor only). Every hero starts in their kit. Like the classes, an edited
hero or piece is kept and a deleted one comes back. Melee's Custom roster
gets the heroes too and fields five of its party characters per
encounter.

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
import, both of the current `SAVE_VERSION` only.

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
  the pool by its seed. Winning gives every member `40 x enemy threat /
party size` experience and sometimes gear (40%; elites and the final
  battle always), which goes in the bag. Losing or drawing **ends the
  run**. The party can **retreat** to the map (to change gear, say) until
  it gives its first command; from then on the fight is won or the run is
  over: giving up loses, gear is locked, and a reload opens the same
  battle from its start. An encounter is always fought with the same
  battle seed, so coming back never rerolls its luck. Starting a battle
  over is allowed (the ↺ button, once the party has acted).
- **Ally**: a traveller who isn't in the party offers to join, at the
  level of the party's weakest member if that is higher, with char's
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

**The world** (`shared/world.ts`): the run plays with char's library (the
starter library if it has no class character) plus jrpg's own content,
copied when the run starts so later edits don't break it: 9 enemy types
(Wolf, Slime, Viper, Bandit Archer, Hedge Witch, Bone Priest, Stone Golem,
Imp, Raider) and 20 pieces of gear, each weapon and armor with a
category (two foci, Seer's Orb and Black Tome, so every class has finds); char provides the heroes and their
basic gear, which finds and drops leave out. All gear exists at four **tiers** (plain,
Fine, Superior, Masterwork: each adds half again to what the piece adds);
finds are a tier better per depth, with some luck.

**The player chooses the party**: two of the heroes (every class
character in char's library: melee's heroes and any designed), both raised to the level of the
higher one and at least level 3. The start screen preselects two drawn by
the run's seed and can draw again; choosing a third lets go of the first.
Whoever doesn't set out can be met as an ally.

Enemies gain the party's average levels gained plus one per depth. The
**threat budget** of a battle is a share of the party's own estimated
threat (Easy 0.6, Normal 0.8, Hard 0.9), so encounters keep pace with
levels, gear and party size, and the share grows 6% per depth, so deeper
levels are harder. Auto-played parties win about 94% / 76% / 56% of the
first level's battles and 84% / 61% / 36% of the fifth's (every battle
counted, not only those of parties that got that far); a test keeps the
first level in its bands. The run is saved in the browser after every
encounter, with `SAVE_VERSION`; a run of another version is dropped.

Not yet: shops.

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
