# Near Peer — unit merges (design, v0.3)

**Status: merging is playable in [v2](v2/) (`/v2`), with no abilities yet.** The names and stats
below are what v2 uses (`v2/js/rules.js`, rules in [v2/RULES.md](v2/RULES.md)). The only skill is the
Recon Drone's Surveillance. The ideas are starting points for abilities. They aren't rules yet.
The original game (`/`, [RULES.md](RULES.md)) is unchanged.

## The merge rule
- Each player has one each of the five base units, so a recipe never uses the same unit twice.
- Merging two or more different units makes one new unit. Order doesn't matter: a unit is defined by
  which base units are in it, so L+A+R is the same unit however it was built
  (L+A then R, L+R then A, or A+R then L).
- That gives 2⁵ − 1 = **31 units**: 5 base, 10 pairs, 10 triples, 5 quads and 1 ultimate.
- Units can only merge if they share no base unit (L+A can merge with R+F, but not with A+R).
- **Stats:** attack and defence are the **sum** of the parts. Movement and range are **not summed**.
  For now v2 uses the highest of the parts, and the tables show that, until the real rule is decided.
- **Merging in play (v2):** move a unit onto another of yours and they merge, which ends the move.
  Two of your units already sharing a hex (one of them a Recon Drone) can merge where they stand.
- **Splitting:** part of a merged unit can split off and move away as a unit of its own, with its own
  movement. The rest stays behind. That's the move for the turn (for now).
- Quads are **special units** (strategic weapons and assets), not army formations. The five-unit
  merge is the Nuke.

Recipe letters: **L** Light · **A** Armour · **R** Range · **F** Flying · **H** Hero.

## Naming rules
- No acronyms.
- General modern near-peer warfare, not US/EU-centric. No national system names.
- No naval units. They belong to the naval expansion (see the README roadmap).
- British spelling (Armour, Defence, Mechanised).

## Design notes
- **What each ingredient means:** Armour = heavier and tougher · Range = firepower and reach ·
  Hero = elite or advanced tech · Light = troops · Flying = air. A merged unit's name should read as
  "the unit below it plus one ingredient", following the lines on the merge graph.
- **Progression lines:**
  - Helicopters: Attack Helicopter (F+H) → Gunship (A+F+H).
  - Transport: Recon Drone (F) → Transport Helicopter (A+F) → Heliborne Troops (L+A+F).
  - Drones: Recon Drone → Drone Operators (L+F) / Long-Range Drone (R+F) → Bomber Drones (L+R+F)
    → Drone Swarm (L+A+R+F).
- **Quads and the ultimate should be about the unit itself.** With one of each base unit, a quad
  leaves just one other unit on your side, and the Nuke leaves none, so abilities that buff or carry
  friendly units do little at the top tiers. Support abilities belong on pairs and triples.
- **Avoid overlapping abilities.** Only Transport Helicopter carries another unit. Paratroopers
  and Massive Ordnance shouldn't both "drop anywhere".
- **Hidden units** (the Special Forces stealth idea): fine on one device, but in online play the
  other browser knows every position.

- **Surveillance** (Recon Drone only, not passed on when it merges): shares a hex with one other unit,
  friend or enemy, and flies through occupied hexes. An enemy unit on its hex has −1 defence.
  It can't capture units and can't take the capital.

## Still to do
- Decide how movement and range work for merged units (v2 uses the highest of the parts).
- Turn the ideas below into actual abilities.
- Done in v2: the base unit types are `light`, `armour`, `range`, `flying` and `hero` in code
  (v1 still has `ranged` and `covert`).

## Base units

| Recipe | Name | Atk | Def | Mov | Rng | Idea |
|--------|------|-----|-----|-----|-----|------|
| L | **Rifle Squad** | 1 | 1 | 1 | 1 | Riflemen on foot. Cheap, quick and good at holding towns. |
| A | **Armoured Carrier** | 0 | 2 | 1 | 1 | Armoured personnel carrier. Thick armour and room for troops, but almost no firepower of its own. |
| R | **Mortar Team** | 2 | 0 | 1 | 2 | Light crew with a mortar. Can fire over a unit in the way to hit the one behind it. |
| F | **Recon Drone** | 0 | 0 | 2 | 1 | Small drone that scouts ahead and spots targets for others. Weak on its own, but flies over terrain. **Surveillance** (in v2). |
| H | **Commander** | 2 | 2 | 1 | 1 | Veteran officer who leads from the front. Strong in attack and defence. |

## Pairs

| Recipe | Name | Atk | Def | Mov | Rng | Idea |
|--------|------|-----|-----|-----|-----|------|
| L+A | **Infantry Fighting Vehicle** | 1 | 3 | 1 | 1 | Infantry riding an armoured fighting vehicle with its own cannon. Fights from the vehicle or dismounts to take ground. |
| L+R | **Machine Gunner** | 3 | 1 | 1 | 2 | Heavy machine gun team that pins enemy infantry down and covers open ground from a distance. |
| L+F | **Drone Operators** | 1 | 1 | 2 | 1 | Infantry flying cheap first-person-view kamikaze drones. Short range, but very hard to hide from. |
| L+H | **Scout Team** | 3 | 3 | 1 | 1 | Elite scouts who move fast, see far and slip behind enemy lines. |
| A+R | **Howitzer** | 2 | 2 | 1 | 2 | Self-propelled gun. Slow, but its range lets it hit from behind the front line. |
| A+F | **Transport Helicopter** | 0 | 2 | 2 | 1 | Carries one friendly unit across the board. Weak in a fight on its own. |
| A+H | **Combat Engineers** | 2 | 4 | 1 | 1 | Armoured engineering vehicles that breach minefields and fortifications and clear the way for everyone else. |
| R+F | **Long-Range Drone** | 2 | 0 | 2 | 2 | Cheap one-way attack drone launched in swarms from far behind the lines to hit targets deep in enemy territory. |
| R+H | **Sniper** | 4 | 2 | 1 | 2 | One precise long-range shot. Best at finishing off damaged or exposed units. |
| F+H | **Attack Helicopter** | 2 | 2 | 2 | 1 | Agile helicopter gunship that hunts tanks at low altitude, popping up from behind terrain to strike. |

## Triples

| Recipe | Name | Atk | Def | Mov | Rng | Idea |
|--------|------|-----|-----|-----|-----|------|
| L+A+R | **Main Battle Tank** | 3 | 3 | 1 | 2 | Big gun and thick armour. Hard to kill, but slow. |
| L+A+F | **Heliborne Troops** | 1 | 3 | 2 | 1 | Helicopter-borne troops who strike, then pull back in the same turn. |
| L+A+H | **Assault Brigade** | 3 | 5 | 1 | 1 | Hardened assault troops with armoured support who break into trench lines and fortified towns. |
| L+R+F | **Bomber Drones** | 3 | 1 | 2 | 2 | Heavy multirotor drones that drop munitions on positions again and again, mostly at night. |
| L+R+H | **Rocket Artillery** | 5 | 3 | 1 | 2 | Truck-mounted multiple rocket launcher. Fires a salvo deep behind the front, then drives off before return fire lands. |
| L+F+H | **Paratroopers** | 3 | 3 | 2 | 1 | Elite airborne infantry who jump in behind enemy lines and seize ground before help arrives. |
| A+R+F | **Strategic Bomber** | 2 | 2 | 2 | 2 | Carpet bombing: attacks every enemy unit in a straight line of hexes at once. |
| A+R+H | **Air Defence** | 4 | 4 | 1 | 2 | Long-range surface-to-air missile system. Shoots down drones, missiles and aircraft. |
| A+F+H | **Gunship** | 2 | 4 | 2 | 1 | Heavily armoured helicopter gunship. A flying tank that can also carry troops. |
| R+F+H | **Stealth Fighter** | 4 | 2 | 2 | 2 | Fifth-generation fighter that's hard to detect. Owns the sky against other flying units. |

## Special units (quads)

| Recipe | Name | Atk | Def | Mov | Rng | Idea |
|--------|------|-----|-----|-----|-----|------|
| L+A+R+F | **Drone Swarm** | 3 | 3 | 2 | 2 | Hundreds of cheap drones launched at once to overwhelm air defences through sheer numbers. |
| L+A+R+H | **Electronic Warfare** | 5 | 5 | 1 | 2 | Electronic warfare trucks that jam drones, missiles and communications across a wide area. |
| L+A+F+H | **Massive Ordnance** | 3 | 5 | 2 | 1 | The biggest non-nuclear bombs there are, dropped from the air to flatten fortifications and bunkers. |
| L+R+F+H | **Special Forces** | 5 | 3 | 2 | 2 | Stealth: hidden from the enemy until it attacks, and may slip away after striking. |
| A+R+F+H | **Ballistic Missile** | 4 | 4 | 2 | 2 | Launched from far behind the lines. One huge strike anywhere on the board, then it's spent. |

## Ultimate

| Recipe | Name | Atk | Def | Mov | Rng | Idea |
|--------|------|-----|-----|-----|-----|------|
| L+A+R+F+H | **Nuke** | 5 | 5 | 2 | 2 | The ultimate deterrent. All five units merged into one weapon that can end the game. |
