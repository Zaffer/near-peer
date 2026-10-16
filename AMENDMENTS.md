# Near Peer — rule amendments

How the rules got to where they are, and the changes still to consider.
- [RULES.md](RULES.md) is the current rulebook. This file is the history and the to-do list.
- Where an idea already has a switch in [js/rules.js](js/rules.js) (`options`), it's named below.
  Flip the switch to try it in a game without any code changes.

**How to use this file**
- New idea: add it under *Open ideas* with where it came from.
- Adopted or rejected: move it to the *Decision log* with the date, what changed and why.
  Then update RULES.md and the matching test in `tests/rules.test.js`.

---

## Open ideas

| # | Idea | Source | Switch | Notes |
|---|------|--------|--------|-------|
| A1 | **Hold the capital to win.** You must control the enemy capital for a whole turn, rather than just stepping onto it. | description.md | — | Currently the win is instant, even when only passing through. Would need a "held since" marker on the capital. |
| A2 | **Ranged coverage shape.** Change exactly which hexes the ranged unit can hit. | description.md | — | Currently it hits anything within 2 hexes with no line of sight, and adjacent hexes count. Options: straight lines only, a minimum range of 2, or blocked by units. |
| A3 | **Blind build phase (fog of war).** Both players place terrain and units at the same time without seeing each other's side, rather than taking turns. | description.md | — | Needs a hidden or simultaneous placement step and a "reveal" moment. |
| A4 | **Capturing ends the move.** Defeating a unit ends the capturing unit's move. | Play discussion, 2026-10-15 | `captureEndsMove` | Currently off: the capturing unit can keep moving and still gets road bonuses. |
| A5 | **Only coverts can share hexes and block.** Normal units can't move onto another unit's hex at all, so a covert sitting alone also blocks normal units. | Play discussion, 2026-10-15 | `normalUnitsCanJoinOccupiedHex: false` | Currently a normal unit may move onto a lone covert. |
| A6 | **Move → attack → keep moving.** Let a unit stop partway through its move (e.g. on a road), attack, then finish the move. | Play discussion, 2026-10-16 | `attackEndsMoveInProgress: false` | Currently attacking ends any move in progress. If adopted, add a test for the road case. |

## Not rules, but later
- Polish pass on the interface.
- A Three.js version of the board.

---

## Decision log

Newest first.

### 2026-10-16 — Starting on a road no longer gives +1 movement
- **What:** Roads only reward *landing* on them. Starting your turn on a road gives nothing extra.
  Minefields keep their start penalty. The road a unit starts on now counts as "not yet landed on" for the
  once-per-road limit, so stepping off and back onto it gives the bonus.
  14 worked examples are in RULES.md and are checked by tests.
- **Why:** Found in play. An Armour that started on a road got 2 moves without landing on anything.
  The original description only gives the bonus for *landing* on a road. The start bonus was an
  assumption made in the first round of questions to mirror the minefield.
- **Status:** Confirmed, including all 14 examples (2026-10-16).

### 2026-10-16 — Occupancy becomes the Covert's *Insurgency* skill
- **What:** Units no longer carry an occupancy number. The Covert has a special skill, **Insurgency**
  (two-people symbol), which gives dual occupancy: a hex with an Insurgency unit on it holds two units.
  How the game plays doesn't change.
- **Why:** Only one unit ever differed, so a column of 1s was noise. A named skill reads better and leaves room
  for other units to get their own skills later (add them under `skills` in `rules.js`).

### 2026-10-16 — Defeating a vulnerable unit you already share a hex with
- **What:** A unit on the same hex as a vulnerable enemy can defeat it in place. It counts as that unit's move
  for the turn, works with 0 movement, and leftover movement can still be used afterwards.
  The `captureEndsMove` switch (A4) also applies.
- **Why:** Found in play. A Light made an enemy Ranged on a minefield vulnerable, but the Covert already
  sharing that minefield couldn't defeat it. The rule only covered *moving onto* a unit, and the Covert had
  0 movement anyway. Making it cost the move keeps it from being a free extra action.
- **Status:** My call to unblock play. Confirm, or pick another cost (e.g. free, or the unit must have movement left).

### 2026-10-16 — Fortress renamed to Fortification
- **What:** The terrain is now called *Fortification*, with a sandbag icon. Same effect: +1 defence.
- **Why:** That's its real name in the game design.

### 2026-10-15 — Terrain has no owner once placed (except capitals)
- **What:** Placed terrain doesn't record or show who placed it. Capitals still belong to their player.
- **Why:** Ownership is irrelevant in play, because terrain affects any unit standing on it.
  Capitals are the exception: taking the *enemy's* capital is how you win.

### 2026-10-15 — First playable ruleset (prototype v0.1)
These came from clarifying the original description before building.

| Rule | Decision | Why |
|------|----------|-----|
| Road movement | Landing on a road guarantees at least one more step. Light: road then plain = 2 moves; plain then road = 3; road, road, road = 4. | Matches every example in the original description. A simple "+1 per road" would give Light 3 moves for road then plain. |
| Road loops | Each road gives its bonus once per move. Switch: `roadBonusOncePerHexPerMove`. | Without it, a unit could bounce between two adjacent roads forever. |
| Starting on terrain | Starting movement = base + the terrain's modifier. A road start gives +1. A minefield start gives −1, so an Armour on a minefield can't move. *(Road part reversed 2026-10-16.)* | Treats roads and minefields the same way. |
| Minefield on entry | Entering a minefield takes 1 movement away immediately. | From the description: a Light stepping onto a minefield forfeits its second move. |
| Terrain bonuses | Apply to any unit on the tile, from either side. | Confirmed in discussion. |
| Turn structure | One attack and one move per turn, in either order. The move is one unit's continuous path. | Confirmed in discussion. See A6 for a possible change. |
| Capturing | Doesn't end the capturing unit's move. | Confirmed in discussion. See A4. |
| Blocking | All units block normal units, including your own. Coverts can pass through. | Confirmed in discussion. |
| Stacking | A hex holds at most 2 units, and at most one of them can be a normal unit. Two coverts can share. A normal unit may move onto a lone covert. | Confirmed in discussion. The normal-onto-covert part is a prototype rule (see A5). |
| Same-hex attacks | Units sharing a hex can attack each other (distance 0). Switch: `allowSameHexAttack`. | Confirmed in discussion. |
| Range | "Range 2" means up to 2 hexes, adjacent included, with no line of sight. | Confirmed in discussion. See A2. |
| Capital win | Your unit is on the enemy capital and no enemy unit is there. An enemy covert sharing it blocks the win; your own covert doesn't. The win is instant, even when only passing through. | You said a covert sharing the capital doesn't count. Your own covert alongside was my call, since the capital is clearly yours. See A1. |
| Elimination win | Defeating every enemy unit also wins. | Confirmed in discussion. |
| Build order | The Challenger places first. Players alternate one tile at a time, then one unit at a time. The Challenged player also gets the centre hex. | From the description, confirmed in discussion. |
