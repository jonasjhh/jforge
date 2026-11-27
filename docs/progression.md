# Stats, levels and progression

How a character's numbers come about and what they do, from the battle
engine (melee) through design (char) to a run (jrpg). Each section names
the code it describes; when a number there changes, change it here too.

In short: stats decide battles; levels (jrpg's) raise stats and unlock
skills; gear adds on top. Char designs everything at level 1 and knows no
levels; it can link classes into a graph, which jrpg2 is to walk. In jrpg, enemies keep pace with whatever the party
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

- **Stats with gear:** (stat before gear + every add) × every multiplier,
  rounded. HP is always at least 1.
- **Weapons:** a weapon also replaces the class's unarmed attack, so it
  changes reach, damage type and melee or ranged, not only numbers.
- **Restrictions:** a class can use only its categories; gear it can't
  use adds nothing. See "Gear restrictions" in [design.md](design.md).
- **Tiers** (jrpg, `world.ts`): Fine, Superior and Masterwork increase a
  piece's positive adds by +50%, +100% and +150%. Multipliers and
  drawbacks stay the same.

## 3. Levels (`modules/jrpg/shared/progression.ts`, `growth.ts`, `learning.ts`)

Levels belong to jrpg: a run keeps each member's level and experience.
Char's classes and enemy types have their level-1 stats.

- **Stats at a level:** base + growth × (level − 1), rounded, before
  gear. Levels run from 1 to 50 (`MAX_LEVEL`).
- **Stat growth** (`STAT_GROWTH`): one table with a row per class and
  enemy type. Melee's classes and creatures grow 8% of their level-1
  stats per level, speed 2%; the world's enemies have their own rows. A
  designed type with no row grows by those same shares
  (`DEFAULT_GROWTH`, `DEFAULT_SPEED_GROWTH`). Melee's classes have
  exactly melee's stats at level 1.

  | Class                                  | Level 1            | Level 3            | Level 10            |
  | -------------------------------------- | ------------------ | ------------------ | ------------------- |
  | Fighter: HP / attack / defense / speed | 120 / 22 / 18 / 10 | 139 / 26 / 21 / 10 | 206 / 38 / 31 / 12  |
  | Mage: HP / MP / magic / spirit         | 70 / 60 / 24 / 18  | 81 / 70 / 28 / 21  | 120 / 103 / 41 / 31 |

  Growth is linear, but defense and spirit give diminishing returns, so
  offence gains more from levels than toughness does. Speed barely moves,
  so turn order stays mostly the same at every level.

- **Skill growth** (`SKILL_GROWTH`): one table with a row per skill, of
  what each caster level above 1 adds to any of its numbers (power, a
  status's power or ticks, MP cost, ...); counts and costs stay whole.
  Every row is empty for now, so skills grow through the caster's stats
  only: a level-5 witch's Fireball hits harder than a level-1 one because
  her magic is higher.
- **Summons** are at their summoner's level, grown by their type's row.
- **Skills learned** (`LEARNING_ORDER`): each class has its own order;
  it knows two skills at level 1 and learns one more each level until it
  knows them all. When a class gains a skill, its order is rebalanced. A
  class with no order, and every enemy, knows all its skills. A level-up
  early on often matters more for the skill it brings than for its stats.
- **Experience:** going from level L to L+1 costs 100 × L
  (`xpToNext`). Extra experience carries over and can level up more than
  once at a time (`gainXp`).

## 4. Threat (`modules/melee/shared/threat.ts`)

A unit's threat estimates how dangerous it is:
`0.023 × √(offence × durability)`, at least 1.

- **Offence:** stats, weapon reach and area skills.
- **Durability:** HP, defense and spirit, with bonuses for support and
  revives.
- **Growth:** threat grows with level and gear. Melee's Fighter in basic
  gear is about 5.5 at level 1 and about 8.1 at level 3.

Threat decides how many enemies make up an encounter and how much
experience they pay.

## 5. A run (`modules/jrpg/shared/run.ts`)

### What the party gains

- **Start:** the two chosen heroes set out at level 1 (`START_LEVEL`).
- **Experience per battle:** each member gains `40 × total enemy threat ÷
party size` (`XP_PER_THREAT`, `xpFor`).
  - The first battle on Normal pays a party of two about 150 each.
  - Level 1 to 2 costs 100 and 2 to 3 costs 200, so the first levels
    come about one battle each, then slow down.
  - A bigger party splits the experience: four members level about half
    as fast per battle as two.
- **Recruits** join at the level of the weakest member.
- **Training** gives one member a level.
- **Gear** comes from finds and drops, which are a tier better per depth,
  with some luck.
- **HP and MP** are full at the start of every battle. Nothing carries
  over, so there is no reward for dragging a fight out to heal.

### How enemies keep pace

- **Enemy level** (`enemyLevelBonus`): enemies start at level 1
  (`START_LEVEL`) and go up by the party's average levels gained since
  the start, plus 1 per depth
  (`ENEMY_LEVELS_PER_DEPTH`). Elite battles add 2 more and the final
  battle of a level adds 3 (`RANK_LEVELS`).
- **Enemy count** (`threatBudget`): the total threat of an encounter's
  enemies is the party's own total threat × a share (`BUDGET_SHARE`: Easy
  0.52, Normal 0.68, Hard 0.8) × 1.06 per depth (`DEPTH_GROWTH`).

### What follows from this

- **Levels, gear and recruits don't make battles easier on their own.**
  - Each average level the party gains raises enemy levels by one.
  - The party's threat sets the budget, so better gear and more members
    bring more or stronger enemies.
  - Battles get somewhat harder with depth on purpose: +1 enemy level and
    +6% budget per level of the run.
- **Real advantages come from what the threat estimate misses:**
  - skills learned by level, especially those threat barely counts,
    such as Provoke pulling attacks off frail allies;
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
  | 1     | 96%  | 74%    | 60%  |

  Measured with the party starting at level 1 and the budget shares
  above. Deeper levels have not been measured since.

### Where to change the feel

- **To make levels feel more rewarding:** let enemies follow only part of
  the party's level gains (`enemyLevelBonus`), or leave the party's levels
  out of the budget (`threatBudget`).
- **To make depth harder or easier:** change `ENEMY_LEVELS_PER_DEPTH` and
  `DEPTH_GROWTH`.
- **To speed up or slow down levelling:** change `XP_PER_THREAT` or
  `xpToNext`.
- **To make a class or skill scale differently:** change its row in
  `STAT_GROWTH` or `SKILL_GROWTH`.

## 6. Class paths (planned for jrpg2)

jrpg2 is to be a separate game, built on char and melee only, with
progression along char's class graph (see "Class graph" in
[design.md](design.md)). char holds the graph; these rules belong to
jrpg2 and are decided so far as follows. jrpg ignores the graph.

- **Start** as a base class: Squire (strength), Scout (agility) or
  Apprentice (magic), from char's starter library. Each leads to the
  second level of broad roles (Guardian, Warrior, Spearman; Thief,
  Archer, Duelist, Beastmaster; Mage, Cleric, Enchanter, Summoner);
  specialisation starts at the third level.
- **Forward only:** a character takes links out of the class it holds,
  never back.
- **Taking two links at once** (a Fighter becoming both Paladin and
  Berserker) makes a **multiclass** character. What a multiclass
  character can use from its classes is not decided.
- **Skills start fresh:** after a change, the character has the new
  class's skills only. The class design rule of stand-ins for a source's
  key skills keeps that from feeling like a loss.
- **Stats add up along the path:** each level's growth comes from the
  class held at that level, so a long-time Fighter turned Mage stays
  tougher than a Mage from the start.
- **When a character may change class** is not decided.
