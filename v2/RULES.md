# Near Peer v2 — rules (v0.3)

The original rules ([../RULES.md](../RULES.md)) plus **merging units**, with new base stats and the
Recon Drone in place of the Covert. Numbers and switches live in [js/rules.js](js/rules.js);
[tests.html](tests.html) checks each rule below. The unit names, the 31 merges and the ideas for
later abilities are in [../UNITS.md](../UNITS.md).

## Board and setup
Unchanged from v1:
- 19-hex board, 3 hexes per side (Catan layout), rows of 3/4/5/4/3.
- **Blue** (bottom) goes first. **Red** (top) goes second.
- Zones: your back row (3) + next row (4) + the two middle-row hexes on your right (9 hexes).
  Red also gets the centre hex (10 hexes).
- **Build phase:** players alternate, Blue first, placing one terrain tile at a time
  (one each of capital, town, road, fortification, minefield) anywhere in their own zone.
  Zone hexes left over are plain. Then the players alternate placing their 5 base units in the same way.

## Base units
| Unit | Recipe | Atk | Def | Mov | Rng | Skill |
|------|--------|-----|-----|-----|-----|-------|
| Rifle Squad      | L | 1 | 1 | 1 | 1 | — |
| Armoured Carrier | A | 0 | 2 | 1 | 1 | — |
| Mortar Team      | R | 2 | 0 | 1 | 2 | — |
| Recon Drone      | F | 0 | 0 | 2 | 1 | Surveillance |
| Commander        | H | 2 | 2 | 1 | 1 | — |

### Surveillance (Recon Drone)
- Shares a hex with one other unit, friend or enemy, and can fly through occupied hexes.
- An **enemy** unit on its hex has **−1 defence** (never below 0). Your own units aren't affected.
- It **can't capture** units. Moving onto an enemy's hex, it always moves in beside it.
- It **can't take the capital**. Standing on the enemy capital doesn't win.
- Only the Recon Drone itself has Surveillance. A merged unit with a drone in it doesn't.

## Merging
- Move a unit onto another of your units and the two **merge** into one new unit on that hex.
  It can walk up first and merge at the end of its move. **Merging ends the move**
  (switch: `mergeEndsMove`).
- Two of your units that already share a hex (one of them must be a Recon Drone) can merge where they
  stand. That's your move for the turn, and it works even with 0 movement (e.g. on a minefield).
- A merged unit is defined by the base units in it, whatever order they joined in.
  Any mix of your five makes a different unit: 5 base, 10 pairs, 10 triples, 5 special units and the
  Nuke, **31 in all**. Merged units can merge again (Rifle Squad + Armoured Carrier = Infantry Fighting
  Vehicle, + Mortar Team = Main Battle Tank).
- Units can only merge if they share no base unit. With one of each per player, any two of your units
  always can.
- **Stats:** attack and defence are the **sum** of the parts. Movement and range are the **best** of the
  parts (a placeholder until the real rule is decided). Terrain applies to the merged unit as usual.
- Merged units have **no abilities yet**.
- Stepping onto a hex to merge still captures any enemy there that you beat first (e.g. an enemy Recon
  Drone sitting with your unit).

## Splitting
- On your turn, select a merged unit and untick the parts to leave behind. The ticked parts **split off**
  and move as a unit of their own, with their own movement. The rest stays where it was.
- The split is the first step of that unit's move, so it has to step off the hex, and it can carry on
  moving, capture, or merge into another of your units on the way. The part left behind can't move this turn.
- Example: a Drone Operators unit (Rifle Squad + Recon Drone) splits off its Recon Drone, which flies 2 hexes.
  The Rifle Squad stays.

## Terrain
Unchanged from v1. A terrain tile's modifier applies to **any** unit standing on it, from either side.
- Capital: +1 atk, +1 def. Town: +1 atk. Fortification: +1 def.
- Road: +1 movement. Minefield: −1 movement.

## Turns and movement
Unchanged from v1:
- Each turn, **move one unit** (one continuous path), merge two units, or pass.
  The turn ends automatically once the move is spent (a UI toggle).
- Each step goes to an adjacent hex. **Starting on a minefield** costs 1 movement (minimum 0).
  **Entering a minefield** takes 1 movement away immediately. **Landing on a road** guarantees at least
  one more step, once per road each move. Starting on a road gives nothing extra.

The movement examples from v1 still hold. A "2-move unit" is now the Recon Drone or anything merged with one
(the tests use Drone Operators). Every example is checked by a test in `tests/rules.test.js` ("ex 1" … "ex 14").

## Stacking
- A hex normally holds one unit. With a **Recon Drone** on it, it holds two:
  a drone can share a hex with one other unit (friend or enemy), and two drones can share.
- For now, a normal unit may also move onto a hex holding a lone enemy Recon Drone without capturing it
  (switch: `normalUnitsCanJoinOccupiedHex`).
- Normal units are blocked by any unit that isn't sharable, including your own (unless they merge with it).

## Attack and capturing
Unchanged from v1. Attack is passive. Every one of your units is always "attacking" every enemy within its range.
- **Combined attack** on an enemy = the attack of all your units within range of it, added together
  (terrain included). A unit on the same hex as the enemy is at distance 0, so it counts too.
- **Capturing:** step onto an enemy whose defence is **≤** your combined attack and it is captured.
  The unit stepping in counts from the hex it steps in from. A unit with 0 attack still captures a unit with
  0 defence, as long as it's in range.
- **Several units on the hex:** stepping in captures every enemy there that you beat. Then you must fit
  with whoever is left.
- **No limit per turn.** Capturing doesn't end the move.
- **Already on its hex?** A unit sharing a hex with an enemy it beats (e.g. an enemy Recon Drone) can
  capture it where it stands. That's the unit's move for the turn.

## Winning
- **Capital:** a unit of yours (not a Recon Drone) is on the enemy capital and no enemy unit is on it.
  An enemy Recon Drone sharing the capital blocks the win (capture it instead and you win).
  It triggers the moment you step there, even while passing through, or when you merge there.
- **Elimination:** defeat every enemy unit.
