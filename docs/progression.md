# Stats, levels and progression

How a character's numbers come about and what they do, from the battle
engine (melee) through design (char) to a run (jrpg). Each section names
the code it describes; when a number there changes, change it here too.

In short: stats decide battles; levels raise stats and unlock skills;
gear adds on top. In jrpg, enemies keep pace with whatever the party
gains, so progression changes how the party fights more than how easily
it wins.

## 1. Stats in battle (`modules/melee/shared`)

| Stat    | What it does                                                                                                                |
| ------- | --------------------------------------------------------------------------------------------------------------------------- |
| Max HP  | HP at the start of every battle.                                                                                            |
| Max MP  | MP at the start of every battle. Nothing restores MP during a fight, so it is the number of skills a unit casts per battle. |
| Attack  | Weapon hits and weapon skills.                                                                                              |
| Defense | Lets `50 / (50 + defense)` of physical damage through.                                                                      |
| Magic   | Spells, and also heals and revives.                                                                                         |
| Spirit  | Lets `50 / (50 + spirit)` of spell damage through.                                                                          |
| Speed   | Fills the turn gauge; a unit acts at 1000.                                                                                  |

- **Weapon hit** (`damage.ts`): attack × row factor × skill power ×
  defense factor × resistance × stance × random 0.9–1.1, at least 1
  unless the target is immune.
- **Spell** (`damage.ts`): power × magic × spirit factor × resistance ×
  stance × random 0.9–1.1.
- **Defense and spirit give diminishing returns** (`DEFENSE_K = 50`).
  Defense 16 lets 76% through; defense 27 lets 65% through.
- **Speed** (`timeline.ts`): twice the speed means twice the turns, which
  makes speed the strongest stat per point.
- **Rows** (`ROW_DEALT`, `ROW_TAKEN`): melee weapons deal and take ×1,
  ×0.75 and ×0.5 from and into the front, middle and back rows. A
  back-row swordsman hitting the back row deals ×0.25. Ranged weapons
  ignore rows.
- **Modifiers** (`stats.ts`): buffs, debuffs, statuses and gear apply as
  (stat + adds) × multipliers, never below 0.

## 2. Gear (`modules/char/shared/gear.ts`)

- **Stats with gear:** (stat at level + every add) × every multiplier,
  rounded. HP is always at least 1.
- **Weapons:** a weapon also replaces the class's unarmed attack, so it
  changes reach, damage type and melee or ranged, not only numbers.
- **Restrictions:** a class can use only its categories; gear it can't
  use adds nothing. See "Gear restrictions" in [design.md](design.md).
- **Tiers** (jrpg, `world.ts`): Fine, Superior and Masterwork increase a
  piece's positive adds by +50%, +100% and +150%. Multipliers and
  drawbacks stay the same.

## 3. Levels (`modules/char/shared/progression.ts`)

- **Stats at a level:** base + growth × (level − 1), rounded. Levels run
  from 1 to 50 (`MAX_LEVEL`).
- **Melee classes** (`melee.ts`): they have exactly melee's stats at
  level 3 (`MELEE_CLASS_LEVEL`). They grow 8% of their level-1 value per
  level (`MELEE_GROWTH`); speed grows 2% (`MELEE_SPEED_GROWTH`).

  | Class                                  | Level 1            | Level 3            | Level 10           |
  | -------------------------------------- | ------------------ | ------------------ | ------------------ |
  | Fighter: HP / attack / defense / speed | 103 / 19 / 16 / 10 | 120 / 22 / 18 / 10 | 178 / 33 / 27 / 11 |
  | Mage: HP / MP / magic / spirit         | 60 / 52 / 21 / 16  | 70 / 60 / 24 / 18  | 104 / 89 / 36 / 27 |

  Growth is linear, but defense and spirit give diminishing returns, so
  offence gains more from levels than toughness does. Speed barely moves,
  so turn order stays mostly the same at every level.

- **Skills:** a class learns each skill at a set level. Melee classes
  learn theirs at levels 1, 2, 4, 6, 8 and 10 (`MELEE_SKILL_LEVELS`). A
  level-up often matters more for the skill it unlocks than for its stats.
- **Experience:** going from level L to L+1 costs 100 × L
  (`xpToNext`). Extra experience carries over and can level up more than
  once at a time (`gainXp`).

## 4. Threat (`modules/melee/shared/threat.ts`)

A unit's threat estimates how dangerous it is:
`0.023 × √(offence × durability)`, at least 1.

- **Offence:** stats, weapon reach and area skills.
- **Durability:** HP, defense and spirit, with bonuses for support and
  revives.
- **Growth:** threat grows with level and gear. A level-3 hero at about 8
  gains about 2.3 with two levels.

Threat decides how many enemies make up an encounter and how much
experience they pay.

## 5. A run (`modules/jrpg/shared/run.ts`)

### What the party gains

- **Start:** the two chosen heroes set out at the higher of their levels,
  and at least level 3 (`START_LEVEL`).
- **Experience per battle:** each member gains `40 × total enemy threat ÷
party size` (`XP_PER_THREAT`, `xpFor`).
  - The first battle pays about 100 each to a party of two.
  - Level 3 to 4 costs 300, so that takes about three battles.
  - A bigger party splits the experience: four members level about half
    as fast per battle as two.
- **Recruits** join at the level of the weakest member, if that is higher
  than their own.
- **Training** gives one member a level.
- **Gear** comes from finds and drops, which are a tier better per depth,
  with some luck.
- **HP and MP** are full at the start of every battle. Nothing carries
  over, so there is no reward for dragging a fight out to heal.

### How enemies keep pace

- **Enemy level** (`enemyLevelBonus`): designed enemies' levels go up by
  the party's average levels gained since the start, plus 1 per depth
  (`ENEMY_LEVELS_PER_DEPTH`). Elite battles add 2 more and the final
  battle of a level adds 3 (`RANK_LEVELS`).
- **Enemy count** (`threatBudget`): the total threat of an encounter's
  enemies is the party's own total threat × a share (`BUDGET_SHARE`: Easy
  0.6, Normal 0.8, Hard 0.9) × 1.06 per depth (`DEPTH_GROWTH`).

### What follows from this

- **Levels, gear and recruits don't make battles easier on their own.**
  - Each average level the party gains raises enemy levels by one.
  - The party's threat sets the budget, so better gear and more members
    bring more or stronger enemies.
  - Battles get somewhat harder with depth on purpose: +1 enemy level and
    +6% budget per level of the run.
- **Real advantages come from what the threat estimate misses:**
  - skills unlocked by level;
  - speed, which counts for more than its threat;
  - a party that works together: healing, buffs, area attacks on clumped
    enemies;
  - formation and rows;
  - choosing a route: around elites, through training and finds.
- **Training is the clearest gain.** Enemy levels follow the average, so
  one member's level in a party of two moves enemies about half a level
  (rounded).
- **Measured win rates** for auto-played parties, counting every battle
  (a test keeps level 1 in these bands):

  | Depth | Easy | Normal | Hard |
  | ----- | ---- | ------ | ---- |
  | 1     | 94%  | 76%    | 56%  |
  | 5     | 84%  | 61%    | 36%  |

  These were measured before the branching map, the chosen party, basic
  gear and gear restrictions, so they may no longer be accurate.

### Where to change the feel

- **To make levels feel more rewarding:** let enemies follow only part of
  the party's level gains (`enemyLevelBonus`), or leave the party's levels
  out of the budget (`threatBudget`).
- **To make depth harder or easier:** change `ENEMY_LEVELS_PER_DEPTH` and
  `DEPTH_GROWTH`.
- **To speed up or slow down levelling:** change `XP_PER_THREAT` or
  `xpToNext`.
