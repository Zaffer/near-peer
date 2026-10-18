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
| A7 | **Limit captures per turn** (e.g. one). | Play discussion, 2026-10-16 | — | Currently unlimited ("wild west"): one move can capture as many units as it can reach and beat. Revisit if chain captures swing games too hard. A4 (`captureEndsMove`) is the blunter version. |

## Not rules, but later
- Polish pass on the interface.
- A Three.js version of the board.

---

## Decision log

Newest first.

### 2026-10-16 — Play online, peer to peer
- **What:** **Create a game and get a link** starts an online game (`js/online.js`). The link holds a room id (`?room=…`).
  The creator plays Blue, the first to open the link plays Red, and anyone after that watches.
  Browsers connect directly over WebRTC through [Trystero](https://github.com/dmotz/trystero) 0.25.4, loaded from jsDelivr.
  Public Nostr relays are used only to find each other. There is no game server.
  Every message carries the whole game record (batches of actions, each tagged with who played it, plus a change counter).
  Both sides replay it through the engine, so a move out of turn or against the rules is ignored, and a reconnecting player catches up.
  A batch includes any automatic end of turn, so the two players' "auto-end" settings can't make the games differ.
  Online, you can only act on your turn. Undo is limited to your own move while it's still your turn.
  "Random-place the rest" becomes "Place my pieces at random", because you can't place the other player's pieces.
  A reload rejoins the same game in the same seat (kept per browser tab).
- **Rules:** None.
- **Later:** Turn the board round for Red so their side is at the bottom. A TURN relay for players on networks that block direct connections.

### 2026-10-16 — Board effects; aim arrow and drag to move
- **What:** Short effects after each action (`js/effects.js`): units slide hex to hex; on a capture every other
  unit adding to the attack fires a streak at the target and it pops; entering a minefield gives a small blast and
  the unit shudders; crossing the river where there's no bridge makes a splash (Graphic map only); taking the capital
  sends out rings in the winner's colour with a banner; a new turn shows "Blue/Red to play"; placed units drop in
  and placed terrain lands with a puff of dust. Turned off when the system asks for reduced motion.
  A selected unit that can still move has an arrow to the cursor. You can also drag a unit to where it should go
  (mouse or touch). Clicking or dropping on a hex further than one step away moves there by the shortest route that
  doesn't fight on the way (most movement left on a tie), and undo takes back the whole route.
- **Rules:** None. A route is just the same single steps taken one after another.

### 2026-10-16 — Map and unit styles chosen separately
- **What:** The View picker is now two pickers in the panel: **Map** (Symbols / Graphic) and **Units** (Symbols / Graphic).
  Symbols is the flat look (plain tiles with a big terrain symbol, NATO-style unit symbols); Graphic is the illustrated
  map and unit pictures. Any mix works, and both start on Graphic. The choice is remembered in the browser.
- **Why:** Mix and match, e.g. the illustrated map with the clearer unit symbols.

### 2026-10-16 — Illustrated unit tokens
- **What:** With the Graphic unit style, units are small pictures in the map's style (`js/unitart.js`):
  Light = infantry (modern helmet, plate carrier, assault rifle), Armour = main battle tank,
  Ranged = truck-mounted howitzer, Covert = special forces operator (balaclava, night vision down),
  Hero = general with a sabre. One part of each sticks out past the token's ring: the rifle barrel, the tank gun,
  the howitzer barrel, the operator's radio antenna, the sabre. Uniforms and vehicles take the player's colour,
  on a pale team-tinted disc with a ring in the team colour (dashed for the Covert, as before).
  Chosen from options: the Covert over a contractor and a raider (and earlier a spy, ghillie sniper and paratrooper);
  the Ranged over a towed howitzer and a rocket truck.
- **Why:** Match the units to the illustrated map. Unit names and rules are unchanged.

### 2026-10-16 — One colour set; tidier board
- **What:** The colour picker is gone. Terrain uses one set ("Pastel stone"), in `js/colours.js`. The other schemes,
  including the colour-by-placer one, were dropped. The "Blue side / Red side" labels are gone from the board.
- **Why:** Settled on a look. Fewer options to maintain.

### 2026-10-16 — Optional "Map" view of the board
- **What:** A second way to draw the board (panel → View → Map), in `js/mapview.js`. Terrain blends at the
  hex edges. A road tile is a generic network with an exit on all six sides (a straight road crossed by one that
  forks in two on each side), so it joins up at any angle. Towns and capitals next to a road get a short street to
  meet it. Towns are clusters of roofs, capitals a dense city with an owner-coloured border and flag,
  fortifications scattered trenches and gun pits, minefields neat rows of mines. The straight road through
  each road tile keeps a dashed centre line. A river (a filled, meandering shape) runs along the
  edges between Blue's and Red's starting zones, with a bridge wherever a road crosses it.
- **Why:** To look like a real map (Catan / Civilization style) rather than separate tiles.
- **Rules:** None. The river is scenery only: it doesn't block or slow movement. The "Tiles" view is unchanged.

### 2026-10-16 — Bold terrain colours; towns remember who placed them (colour only)
- **What:** Plain white, minefield black, road grey, fortification dark grey. Capitals and towns take their
  placer's colour: Blue pink capital / purple town, Red orange capital / yellow town. Tiles show just a big
  symbol (no name or modifiers; those are in the hover bar). The "total vs defence" tag over attacked units is gone.
- **Why:** Tighter, bolder board to play with first; finesse later.
- **Update (same day):** Colours moved out of `rules.js` into switchable schemes in `js/palettes.js`
  ("Bold, by player" is the scheme above). Every tile records `placedBy` for schemes that colour by player.
  The rules ignore it; only a capital has an `owner`. *(Superseded: one colour set now, and `placedBy` is gone.)* Units now sit centred on their hex.

### 2026-10-16 — Attack becomes passive: combined attack on capture
- **What:** The attack action is gone, along with "one attack per turn" and the *vulnerable* state. A turn is now
  just one unit's move. Stepping onto an enemy captures it when the attack of **all** your units in range of it
  adds up to at least its defence. The unit stepping in counts from the hex it steps in from.
  Any number of captures per move (see A7). If you could also share the hex, you may walk in beside the enemy instead.
  In-place capture (a unit already on the enemy's hex) stays, now using the combined attack.
  The UI shows curved arrows from every contributing unit and "total vs defence"; capturable enemies get a dashed ring.
- **Why:** Found in play. A Hero on its own capital has defence 4, which only a Ranged or Hero standing on a +1 tile could
  ever hit, so a Hero could sit there forever. Combining attacks lets Light + Armour + Covert (2 + 1 + 1) beat it.
  Also, under the old rules an attack did nothing unless you captured that same turn, so attacking was a step to tick
  off rather than a decision. The real choice is which unit moves and where.
- **Removed:** the `attackEndsMoveInProgress` switch, and idea A6 (move → attack → keep moving), which no longer applies.
- **Choices made:** the mover counts from the hex it steps in from (so a Light can walk up and capture), and captures
  are unlimited for now (simplest rules first; balance later). Both agreed in discussion.
- **Stacked hexes:** you capture every enemy there that you beat, then must fit beside whoever's left. So a Light
  can't get at a Covert sharing with a Hero it can't beat. As you described: beat the Hero, and the Covert goes too.

### 2026-10-16 — Insurgency takes an occupied capital
- **What:** A Covert (Insurgency) on the enemy capital wins even if an enemy unit is on it. Other units still need
  the capital clear of enemies.
- **Why:** A second route to victory that doesn't depend on out-fighting a Hero on its capital, and it makes the
  Covert worth protecting. Counter-play: fill the capital with two units (e.g. Hero + Covert) so a Covert can't
  slip in without capturing one.

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
  Kept under the passive-attack rules (above): no prior attack needed now, just a combined attack that beats it.

### 2026-10-16 — Fortress renamed to Fortification
- **What:** The terrain is now called *Fortification*, with a sandbag icon. Same effect: +1 defence.
- **Why:** That's its real name in the game design.

### 2026-10-15 — Terrain has no owner once placed (except capitals)
- **What:** Placed terrain doesn't record or show who placed it. Capitals still belong to their player.
- **Why:** Ownership is irrelevant in play, because terrain affects any unit standing on it.
  Capitals are the exception: taking the *enemy's* capital is how you win.

### 2026-10-15 — First playable ruleset (v0.1)
These came from clarifying the original description before building.

| Rule | Decision | Why |
|------|----------|-----|
| Road movement | Landing on a road guarantees at least one more step. Light: road then plain = 2 moves; plain then road = 3; road, road, road = 4. | Matches every example in the original description. A simple "+1 per road" would give Light 3 moves for road then plain. |
| Road loops | Each road gives its bonus once per move. Switch: `roadBonusOncePerHexPerMove`. | Without it, a unit could bounce between two adjacent roads forever. |
| Starting on terrain | Starting movement = base + the terrain's modifier. A road start gives +1. A minefield start gives −1, so an Armour on a minefield can't move. *(Road part reversed 2026-10-16.)* | Treats roads and minefields the same way. |
| Minefield on entry | Entering a minefield takes 1 movement away immediately. | From the description: a Light stepping onto a minefield forfeits its second move. |
| Terrain bonuses | Apply to any unit on the tile, from either side. | Confirmed in discussion. |
| Turn structure | One attack and one move per turn, in either order. The move is one unit's continuous path. *(Replaced 2026-10-16 by passive combined attack.)* | Confirmed in discussion. |
| Capturing | Doesn't end the capturing unit's move. | Confirmed in discussion. See A4. |
| Blocking | All units block normal units, including your own. Coverts can pass through. | Confirmed in discussion. |
| Stacking | A hex holds at most 2 units, and at most one of them can be a normal unit. Two coverts can share. A normal unit may move onto a lone covert. | Confirmed in discussion. The normal-onto-covert part is provisional (see A5). |
| Same-hex attacks | Units sharing a hex can attack each other (distance 0). Switch: `allowSameHexAttack`. *(Now: a unit on the enemy's hex adds to the combined attack.)* | Confirmed in discussion. |
| Range | "Range 2" means up to 2 hexes, adjacent included, with no line of sight. | Confirmed in discussion. See A2. |
| Capital win | Your unit is on the enemy capital and no enemy unit is there. An enemy covert sharing it blocks the win; your own covert doesn't. The win is instant, even when only passing through. *(2026-10-16: a Covert now wins even with an enemy there.)* | You said a covert sharing the capital doesn't count. Your own covert alongside was my call, since the capital is clearly yours. See A1. |
| Elimination win | Defeating every enemy unit also wins. | Confirmed in discussion. |
| Build order | Blue places first. Players alternate one tile at a time, then one unit at a time. Red also gets the centre hex. | From the description, confirmed in discussion. |
