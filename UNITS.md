# Near Peer — unit merges (design, v0.2)

**Status: design only, not implemented.** The names below are locked in. The ideas are starting
points for the mechanics. They aren't rules yet. The rules (RULES.md, `js/rules.js`) still need
reworking to fit this, and that comes next.

## The merge rule
- Each player has one each of the five base units, so a recipe never uses the same unit twice.
- Merging two or more different units makes one new unit. Order doesn't matter: a unit is defined by
  which base units are in it, so L+A+R is the same unit however it was built
  (L+A then R, L+R then A, or A+R then L).
- That gives 2⁵ − 1 = **31 units**: 5 base, 10 pairs, 10 triples, 5 quads and 1 ultimate.
- Units can only merge if they share no base unit (L+A can merge with R+F, but not with A+R).
- **Stats:** attack and defence are the **sum** of the parts. Movement and range are **not summed**.
  The tables show the highest of the parts as a placeholder until the real rule is decided.
- **Splitting:** a merged unit can split back into its parts (for now).
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

## To do with the rules rework
- Decide how movement and range work for merged units.
- Rename the base unit types in code. `js/rules.js` still has `ranged` and `covert` (with
  Insurgency), but this design uses Range and Flying. Flying's stats here are Covert's for now,
  without Insurgency.
- Turn the ideas below into actual abilities.

## Base units

| Recipe | Name | Atk | Def | Mov | Rng | Idea |
|--------|------|-----|-----|-----|-----|------|
| L | **Rifle Squad** | 2 | 2 | 2 | 1 | Riflemen on foot. Cheap, quick and good at holding towns. |
| A | **Tank** | 1 | 3 | 1 | 1 | Big gun and thick armour. Hard to kill, but slow. |
| R | **Artillery** | 3 | 1 | 1 | 2 | Towed guns that hit from two hexes away but are fragile up close. |
| F | **Recon Drone** | 1 | 1 | 1 | 1 | Small drone that scouts ahead and spots targets for others. Weak on its own, but flies over terrain. |
| H | **Commander** | 3 | 3 | 1 | 1 | Veteran officer who leads from the front. Strong in attack and defence. |

## Pairs

| Recipe | Name | Atk | Def | Mov | Rng | Idea |
|--------|------|-----|-----|-----|-----|------|
| L+A | **Armoured Carrier** | 3 | 5 | 2 | 1 | Armoured personnel carrier with infantry inside. Tougher than a Rifle Squad and still quick enough to grab towns. |
| L+R | **Mortar Team** | 5 | 3 | 2 | 2 | Light crew with a mortar. Can fire over a unit in the way to hit the one behind it. |
| L+F | **Drone Operators** | 3 | 3 | 2 | 1 | Infantry flying cheap first-person-view kamikaze drones. Short range, but very hard to hide from. |
| L+H | **Scout Team** | 5 | 5 | 2 | 1 | Elite scouts who move fast, see far and slip behind enemy lines. |
| A+R | **Howitzer** | 4 | 4 | 1 | 2 | Self-propelled gun. Slow, but its range lets it hit from behind the front line. |
| A+F | **Transport Helicopter** | 2 | 4 | 1 | 1 | Carries one friendly unit across the board. Weak in a fight on its own. |
| A+H | **Combat Engineers** | 4 | 6 | 1 | 1 | Armoured engineering vehicles that breach minefields and fortifications and clear the way for everyone else. |
| R+F | **Long-Range Drone** | 4 | 2 | 1 | 2 | Cheap one-way attack drone launched in swarms from far behind the lines to hit targets deep in enemy territory. |
| R+H | **Sniper** | 6 | 4 | 1 | 2 | One precise long-range shot. Best at finishing off damaged or exposed units. |
| F+H | **Attack Helicopter** | 4 | 4 | 1 | 1 | Agile helicopter gunship that hunts tanks at low altitude, popping up from behind terrain to strike. |

## Triples

| Recipe | Name | Atk | Def | Mov | Rng | Idea |
|--------|------|-----|-----|-----|-----|------|
| L+A+R | **Mechanised Infantry** | 6 | 6 | 2 | 2 | Infantry riding armoured fighting vehicles with their own cannon. Fights from the vehicle or dismounts to take ground. |
| L+A+F | **Heliborne Troops** | 4 | 6 | 2 | 1 | Helicopter-borne troops who strike, then pull back in the same turn. |
| L+A+H | **Assault Brigade** | 6 | 8 | 2 | 1 | Hardened assault troops with armoured support who break into trench lines and fortified towns. |
| L+R+F | **Bomber Drones** | 6 | 4 | 2 | 2 | Heavy multirotor drones that drop munitions on positions again and again, mostly at night. |
| L+R+H | **Rocket Artillery** | 8 | 6 | 2 | 2 | Truck-mounted multiple rocket launcher. Fires a salvo deep behind the front, then drives off before return fire lands. |
| L+F+H | **Paratroopers** | 6 | 6 | 2 | 1 | Elite airborne infantry who jump in behind enemy lines and seize ground before help arrives. |
| A+R+F | **Strategic Bomber** | 5 | 5 | 1 | 2 | Carpet bombing: attacks every enemy unit in a straight line of hexes at once. |
| A+R+H | **Air Defence** | 7 | 7 | 1 | 2 | Long-range surface-to-air missile system. Shoots down drones, missiles and aircraft. |
| A+F+H | **Gunship** | 5 | 7 | 1 | 1 | Heavily armoured helicopter gunship. A flying tank that can also carry troops. |
| R+F+H | **Stealth Fighter** | 7 | 5 | 1 | 2 | Fifth-generation fighter that's hard to detect. Owns the sky against other flying units. |

## Special units (quads)

| Recipe | Name | Atk | Def | Mov | Rng | Idea |
|--------|------|-----|-----|-----|-----|------|
| L+A+R+F | **Drone Swarm** | 7 | 7 | 2 | 2 | Hundreds of cheap drones launched at once to overwhelm air defences through sheer numbers. |
| L+A+R+H | **Electronic Warfare** | 9 | 9 | 2 | 2 | Electronic warfare trucks that jam drones, missiles and communications across a wide area. |
| L+A+F+H | **Massive Ordnance** | 7 | 9 | 2 | 1 | The biggest non-nuclear bombs there are, dropped from the air to flatten fortifications and bunkers. |
| L+R+F+H | **Special Forces** | 9 | 7 | 2 | 2 | Stealth: hidden from the enemy until it attacks, and may slip away after striking. |
| A+R+F+H | **Ballistic Missile** | 8 | 8 | 1 | 2 | Launched from far behind the lines. One huge strike anywhere on the board, then it's spent. |

## Ultimate

| Recipe | Name | Atk | Def | Mov | Rng | Idea |
|--------|------|-----|-----|-----|-----|------|
| L+A+R+F+H | **Nuke** | 10 | 10 | 2 | 2 | The ultimate deterrent. All five units merged into one weapon that can end the game. |
