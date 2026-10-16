# Near Peer — rules (prototype v0.1)

The agreed rules as implemented. Numbers and switches live in [js/rules.js](js/rules.js);
[tests.html](tests.html) checks each rule below.

## Board and setup
- 19-hex board, 3 hexes per side (Catan layout), rows of 3/4/5/4/3.
- **Challenger** (blue, bottom) goes first. **Challenged** (red, top) goes second.
- Zones: your back row (3) + next row (4) + the two middle-row hexes on your right (9 hexes).
  The Challenged player also gets the centre hex (10 hexes).
- **Build phase:** players alternate, Challenger first, placing one terrain tile at a time
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
  friend or enemy, and can pass through occupied hexes.

## Terrain
A terrain tile's modifier applies to **any** unit standing on it, from either side.
Once placed, terrain belongs to no one, except each capital, which stays its player's (that's what you win by taking).
- Capital: +1 atk, +1 def. Town: +1 atk. Fortification: +1 def.
- Road: +1 movement. Minefield: −1 movement.

## Turns
- Each turn, take up to **one attack** and **one move**, in either order. The same unit or different units can do them.
- A move is a single unit's continuous path. Attacking while a unit is mid-move ends that move,
  so there is no move → attack → move.
- You can skip either action. The turn ends automatically once nothing legal is left (this is a UI toggle).

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
- Only one unit may move per turn.

## Stacking
- A hex normally holds one unit. With an **Insurgency** unit on it, it holds two. In practice that means:
  - A covert can share a hex with one other unit, friend or enemy.
  - Two coverts can share a hex.
  - Two normal units can never share a hex.
- Prototype rule: a normal unit may also move onto a hex holding a lone covert.
- Normal units are blocked by any unit that isn't sharable, including your own.

## Attacking and defeating units
- Pick an enemy within your range. Distance is counted in hexes and needs no line of sight.
  Range 2 includes adjacent hexes, and units sharing a hex are at distance 0.
- If your attack is **≥** the target's defence (both including terrain), the target becomes **vulnerable**.
- Moving a unit onto a vulnerable enemy defeats it. That does **not** end the capturing unit's move,
  so it can keep going and does get road bonuses.
- **Already on its hex?** A unit sharing a hex with a vulnerable enemy (e.g. a covert) can defeat it where it stands.
  That counts as the unit's move for the turn. It works even with 0 movement (e.g. on a minefield),
  and the unit can still spend any movement it has left afterwards.
- Vulnerability wears off at the end of the turn.

## Winning
- **Capital:** a unit of yours is on the enemy capital and no enemy unit is on it.
  A covert sharing the capital blocks the win. It triggers the moment you step there, even while passing through.
- **Elimination:** defeat every enemy unit.

## Changes and ideas
See [AMENDMENTS.md](AMENDMENTS.md) for the ideas we're considering and a log of every rule decision and why.
