# Near Peer — rules (prototype v0.2)

The agreed rules as implemented. Numbers and switches live in [js/rules.js](js/rules.js);
[tests.html](tests.html) checks each rule below.

## Board and setup
- 19-hex board, 3 hexes per side (Catan layout), rows of 3/4/5/4/3.
- **Blue** (bottom) goes first. **Red** (top) goes second.
- Zones: your back row (3) + next row (4) + the two middle-row hexes on your right (9 hexes).
  Red also gets the centre hex (10 hexes).
- **Build phase:** players alternate, Blue first, placing one terrain tile at a time
  (one each of capital, town, road, fortification, minefield) anywhere in their own zone.
  Zone hexes left over are plain. Then the players alternate placing their 5 units in the same way.

## Units
| Unit   | Atk | Def | Mov | Rng | Skill |
|--------|-----|-----|-----|-----|-------|
| Light  | 2   | 2   | 2   | 1   | — |
| Armour | 1   | 3   | 1   | 1   | — |
| Ranged | 3   | 1   | 1   | 2   | — |
| Covert | 1   | 1   | 1   | 1   | Insurgency |
| Hero   | 3   | 3   | 1   | 1   | — |

### Skills
- **Insurgency** (Covert): dual occupancy. The unit can share a hex with one other unit,
  friend or enemy, and can pass through occupied hexes. It also **takes the enemy capital even with an
  enemy unit on it** (see Winning).

## Terrain
A terrain tile's modifier applies to **any** unit standing on it, from either side.
Once placed, terrain belongs to no one, except each capital, which stays its player's (that's what you win by taking).
Colours are cosmetic and switchable (see `js/palettes.js`).
- Capital: +1 atk, +1 def. Town: +1 atk. Fortification: +1 def.
- Road: +1 movement. Minefield: −1 movement.

## Turns
- Each turn, **move one unit**: a single continuous path. There is no separate attack action
  (see *Attack and capturing*). Captures happen during the move.
- You can pass. The turn ends automatically once the move is spent (this is a UI toggle).

## Movement
- Each step goes to an adjacent hex.
- **Starting on a minefield** costs 1 movement (minimum 0). So an Armour starting on a minefield can't move,
  and a Light starting on one moves 1.
- **Starting on a road** gives nothing extra. Roads only reward *landing* on them.
- **Entering a minefield** takes 1 movement away immediately. A Light stepping onto one stops there.
- **Entering a road** guarantees at least one more step.
- Each road gives its bonus at most once per move, so a unit can't bounce between two roads forever.
  The road you started on hasn't been landed on yet, so stepping off it and back on does count.

| # | Unit and path | Moves |
|---|---------------|-------|
| 1 | Armour starts on road → plain | 1 |
| 2 | Armour starts on road → road → plain | 2 |
| 3 | Armour plain → road → plain | 2 |
| 4 | Light starts on road → plain → plain | 2 |
| 5 | Light road → plain | 2 |
| 6 | Light plain → road → plain | 3 |
| 7 | Light road → road → road → plain | 4 |
| 8 | Light starts on minefield → plain | 1 |
| 9 | Light starts on minefield → road → plain | 2 |
| 10 | Armour starts on minefield | can't move |
| 11 | Light plain → minefield | 1 (stops on the mines) |
| 12 | Light starts on road → plain → back onto that road → plain | 3 |
| 13 | Armour plain → road → minefield | 2 |
| 14 | Armour road → road → back onto the first road | 3 (each road pays once) |

Every row is checked by a test in `tests/rules.test.js` ("ex 1" … "ex 14").

## Stacking
- A hex normally holds one unit. With an **Insurgency** unit on it, it holds two. In practice that means:
  - A covert can share a hex with one other unit, friend or enemy.
  - Two coverts can share a hex.
  - Two normal units can never share a hex.
- Prototype rule: a normal unit may also move onto a hex holding a lone covert.
- Normal units are blocked by any unit that isn't sharable, including your own.

## Attack and capturing
Attack is passive. Every one of your units is always "attacking" every enemy within its range.
- **Combined attack** on an enemy = the attack of all your units within range of it, added together
  (terrain included). Distance is counted in hexes and needs no line of sight. Range 2 includes adjacent
  hexes, and a unit on the same hex as the enemy is at distance 0, so it counts too.
- **Capturing:** step onto an enemy whose defence (terrain included) is **≤** your combined attack and it is
  captured. The unit stepping in counts from the hex it steps in from, so it can walk up and capture in one move.
  Terrain bonuses count where each unit is standing at that moment: leave a town and you lose its +1.
- A dashed magenta ring marks every enemy you can capture right now.
- **Several units on the hex:** stepping in captures every enemy there that you beat. Then you must fit on the hex
  with whoever is left (see Stacking). A Light facing Hero + Covert must beat the Hero; beating only the Covert
  isn't enough to get in. Beat both and both are captured.
- **No limit per turn.** Capturing doesn't end the move, so a unit can keep going (with road bonuses) and capture
  again. Four in one turn is possible against a bad enough layout.
- **Walking in beside instead:** if you could also share the hex, you can choose not to capture
  (e.g. a covert slipping in beside an enemy).
- **Already on its hex?** A unit sharing a hex with an enemy it beats (e.g. a covert) can capture it where it stands.
  That counts as the unit's move for the turn. It works even with 0 movement (e.g. on a minefield),
  and the unit can spend any movement it has left afterwards.

| # | Situation | Combined attack | Result |
|---|-----------|-----------------|--------|
| 1 | Hero on its capital (def 3 + 1 = 4). Your Light, Armour and Covert are next to it | 2 + 1 + 1 = 4 | Any of the three steps on: Hero captured, and you're on the capital, so you win |
| 2 | Same, but your Covert is gone | 2 + 1 = 3 | Can't capture. Bring the Ranged (3) within 2, or a unit on a town |
| 3 | Light on a town next to an Armour (def 3) | 2 + 1 = 3 | Captured |
| 4 | Light steps off the town, then onto the Armour | 2 | Blocked: the town bonus stayed behind |
| 5 | Light 2 hexes from a lone Covert (def 1) | 2 | Walks up and captures it in one move |
| 6 | Hero + Covert share a hex; only your Light (2) reaches it | 2 vs Hero 3, Covert 1 | Blocked: the Hero still fills the hex |
| 7 | Same, but your Hero is also adjacent | 2 + 3 = 5 | Both captured |
| 8 | Ranged 3 hexes from an enemy | — | Out of range: adds nothing |

## Winning
- **Capital:** a unit of yours is on the enemy capital and no enemy unit is on it.
  An enemy covert sharing the capital blocks the win (capture it instead and you win).
  It triggers the moment you step there, even while passing through.
- **Insurgency takes it anyway:** your Covert on the enemy capital wins even if an enemy unit is there.
  The defence: fill the capital (e.g. Hero + Covert, 2 units) so an enemy Covert can't step in without capturing one.
- **Elimination:** defeat every enemy unit.

## Changes and ideas
See [AMENDMENTS.md](AMENDMENTS.md) for the ideas we're considering and a log of every rule decision and why.
