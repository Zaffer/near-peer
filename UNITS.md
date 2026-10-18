# Near Peer — unit merges (design, v0.1)

**Status: design only, not implemented.** The names below are locked in. The ideas are starting
points for the mechanics. They aren't rules yet.

## The merge rule
- Each player has one each of the five base units, so a recipe never uses the same unit twice.
- Merging two or more different units makes one new unit. Order doesn't matter: a unit is defined by
  which base units are in it, so L+A+R is the same unit however it was built
  (L+A then R, L+R then A, or A+R then L).
- That gives 2⁵ − 1 = **31 units**: 5 base, 10 pairs, 10 triples, 5 quads and 1 ultimate.
- Quads are **special units** (strategic weapons and assets), not army formations. The five-unit
  merge is the Nuke.
- The stats below are a straight sum of the base units. This is a placeholder: see the open questions.

Recipe letters: **L** Light · **A** Armour · **R** Range · **F** Flying · **H** Hero.

## Naming rules
- No acronyms.
- General modern near-peer warfare, not US/EU-centric. No national system names.
- No naval units. They belong to the naval expansion (see the README roadmap).
- British spelling (Armour, Defence, Mechanised).

## Open questions for the mechanics
1. **Summed range and movement break the board.** The furthest two hexes can be apart is 4. Every
   triple with R, every quad and the ultimate can already hit the whole board, and L+A+F moves 4.
   One option: attack and defence add up, while range and movement take the highest of the parts
   (or highest + 1).
2. **Can merged units split back up?** If so, is that available to every unit or only to some?
3. **Base unit types vs code.** This design uses Range and Flying. `js/rules.js` still has `ranged`
   and `covert` (with Insurgency). Flying's stats here are Covert's for now, without Insurgency.
4. **Hidden units** (Special Forces stealth idea): fine on one device, but in online play the other
   browser knows every position.

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
| L+A | **Armoured Carrier** | 3 | 5 | 3 | 2 | Armoured personnel carrier with infantry inside. Tougher than a Rifle Squad and still quick enough to grab towns. |
| L+R | **Mortar Team** | 5 | 3 | 3 | 3 | Light crew with a mortar. Can fire over a unit in the way to hit the one behind it. |
| L+F | **Drone Operators** | 3 | 3 | 3 | 2 | Infantry flying cheap first-person-view kamikaze drones. Short range, but very hard to hide from. |
| L+H | **Scout Team** | 5 | 5 | 3 | 2 | Elite scouts who move fast, see far and slip behind enemy lines. |
| A+R | **Howitzer** | 4 | 4 | 2 | 3 | Self-propelled gun. Slow, but its range lets it hit from behind the front line. |
| A+F | **Transport Helicopter** | 2 | 4 | 2 | 2 | Carries one friendly unit across the board. Weak in a fight on its own. |
| A+H | **Combat Engineers** | 4 | 6 | 2 | 2 | Armoured engineering vehicles that breach minefields and fortifications and clear the way for everyone else. |
| R+F | **Long-Range Drone** | 4 | 2 | 2 | 3 | Cheap one-way attack drone launched in swarms from far behind the lines to hit targets deep in enemy territory. |
| R+H | **Sniper** | 6 | 4 | 2 | 3 | One precise long-range shot. Best at finishing off damaged or exposed units. |
| F+H | **Attack Helicopter** | 4 | 4 | 2 | 2 | Agile helicopter gunship that hunts tanks at low altitude, popping up from behind terrain to strike. |

## Triples

| Recipe | Name | Atk | Def | Mov | Rng | Idea |
|--------|------|-----|-----|-----|-----|------|
| L+A+R | **Mechanised Infantry** | 6 | 6 | 4 | 4 | Infantry riding armoured fighting vehicles with their own cannon. Fights from the vehicle or dismounts to take ground. |
| L+A+F | **Heliborne Troops** | 4 | 6 | 4 | 3 | Helicopter-borne troops who strike, then pull back in the same turn. |
| L+A+H | **Assault Brigade** | 6 | 8 | 4 | 3 | Hardened assault troops with armoured support who break into trench lines and fortified towns. |
| L+R+F | **Bomber Drones** | 6 | 4 | 4 | 4 | Heavy multirotor drones that drop munitions on positions again and again, mostly at night. |
| L+R+H | **Rocket Artillery** | 8 | 6 | 4 | 4 | Truck-mounted multiple rocket launcher. Fires a salvo deep behind the front, then drives off before return fire lands. |
| L+F+H | **Paratroopers** | 6 | 6 | 4 | 3 | Elite airborne infantry who jump in behind enemy lines and seize ground before help arrives. |
| A+R+F | **Strategic Bomber** | 5 | 5 | 3 | 4 | Carpet bombing: attacks every enemy unit in a straight line of hexes at once. |
| A+R+H | **Air Defence** | 7 | 7 | 3 | 4 | Long-range surface-to-air missile system. Shoots down drones, missiles and aircraft. |
| A+F+H | **Gunship** | 5 | 7 | 3 | 3 | Heavily armoured helicopter gunship. A flying tank that can also carry troops. |
| R+F+H | **Stealth Fighter** | 7 | 5 | 3 | 4 | Fifth-generation fighter that's hard to detect. Owns the sky against other flying units. |

## Special units (quads)

| Recipe | Name | Atk | Def | Mov | Rng | Idea |
|--------|------|-----|-----|-----|-----|------|
| L+A+R+F | **Drone Swarm** | 7 | 7 | 5 | 5 | Hundreds of cheap drones launched at once to overwhelm air defences through sheer numbers. |
| L+A+R+H | **Electronic Warfare** | 9 | 9 | 5 | 5 | Electronic warfare trucks that jam drones, missiles and communications across a wide area. |
| L+A+F+H | **Massive Ordnance** | 7 | 9 | 5 | 4 | The biggest non-nuclear bombs there are, dropped from the air to flatten fortifications and bunkers. |
| L+R+F+H | **Special Forces** | 9 | 7 | 5 | 5 | Stealth: hidden from the enemy until it attacks, and may slip away after striking. |
| A+R+F+H | **Ballistic Missile** | 8 | 8 | 4 | 5 | Launched from far behind the lines. One huge strike anywhere on the board, then it's spent. |

## Ultimate

| Recipe | Name | Atk | Def | Mov | Rng | Idea |
|--------|------|-----|-----|-----|-----|------|
| L+A+R+F+H | **Nuke** | 10 | 10 | 6 | 6 | The ultimate deterrent. All five units merged into one weapon that can end the game. |
