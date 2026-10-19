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
| A8 | **Merging units.** Any set of 2+ different units merges into one new unit (31 in total), with names and starting ideas in [UNITS.md](UNITS.md). | Design session, 2026-10-18 | `mergeEndsMove` | Playable without abilities (see the decision log, 2026-10-18). Still open: the real movement and range rule for merged units (the game uses the best of the parts), and turning the ideas into abilities. |
| A9 | **Make Surveillance worth using.** As it stands, a Recon Drone that moves onto an enemy's hex is captured there next turn, so the −1 defence almost never pays off. | Computer player playtesting, 2026-10-19 | — | The drone has 0 defence, and a 0-attack unit still captures it from the same hex (distance 0 counts as in range; it can capture in place). Moving the drone in is your move, so you can't use the −1 that turn. In 32 games the AI never once put a drone on an enemy's hex, and only used drones for their 2 movement when merging. Options: the watched unit can't capture the drone, the drone works from an adjacent hex, or it gets some defence. |

## Not rules, but later
- Polish pass on the interface.
- A Three.js version of the board.

---

## Decision log

Newest first. Entries before "v2 replaces v1" describe two versions side by side: v1 (the original game at `/`)
and v2 (merging units, in `v2/`). Their file paths are as they were then.

### 2026-10-18 — v2 replaces v1
- **What:** v2 is now the only version of the game. Its files moved from `v2/` to the top of the repository
  (`index.html`, `js/`, `tests/`, `tools/`, `RULES.md`), and the v1 files were deleted (they're still in git history).
- **Rules:** Those of v2. RULES.md is the former `v2/RULES.md`, now standing on its own, with the movement
  examples written for 1-move and 2-move units.
- **Online:** Rooms keep v2's namespace (`near-peer-v2`), so an old v1 link can't join a game with a record
  the engine can't replay.
- **Playing against Claude:** the bridge keeps one game record at `/api/game`.
- **Why:** The user approved v2 and asked for it to replace v1 completely.

### 2026-10-18 — v2: Nuclear Deterrence and stalemates; skills table; no terrain labels on the board
- **What:** The Nuke (all five base units merged) has a new skill, **Nuclear Deterrence**. If both sides have a Nuke
  on the board, the game ends at once in a **stalemate**: phase over, no winner.
  - A win on the same move still comes first.
  - The game shows "Stalemate" at the top, under the board and as a grey banner.
- **Skills by combination:** skills now belong to an exact combination of base units (`UNIT_SKILLS` in `v2/js/rules.js`):
  `F` has Surveillance and `LARFH` has Nuclear Deterrence. Merged units still don't keep their parts' skills.
- **Rules card:** the Skill column left the base unit table. A table of its own lists each skill, the combination that
  has it and what it does.
- **Board:** the terrain modifier labels on tiles are gone in v2. The hover bar and the rules still give them.
- **Why:** The Nuke is the ultimate unit. Mutual deterrence makes building one a race with a real downside.

### 2026-10-18 — v2: full-screen board with a menu; shorter unit reference
- **What:** v2 fills the window with no page scrolling. The side panel is gone:
  - Over the board: whose turn it is (top left) and a **Menu** button (top right).
  - Under the board: what you can do right now (placing pieces, ending the turn, the selected unit with its split, merge and capture buttons), and the hover details.
  - Online, until the other player joins, the space under the board offers the invite link.
  - The Menu opens full screen and scrolls. It holds Play online, Settings, Rules and Log, and `Esc` closes it.
  - The list of every unit on each side was dropped.
  - The selected unit shows its stats on one line (green or red where terrain changes them) instead of a table.
  - The rules show the five base types (Light, Armour, Range, Flying, Hero) and their stats, plus a worked merge example from `rules.js`. The list of all 31 units is gone.
  - Fixed: tables nested two deep printed "[object HTMLTableRowElement]" instead of rows, which is why the live rules showed no unit names.
- **Rules:** None. v1 keeps its side panel.

### 2026-10-18 — v2: a picture for every unit; three swaps and singular names
- **What:** With the Graphic unit style, all 31 v2 units have their own picture (`v2/js/unitart.js`). Special units get a
  second ring and the Nuke a third. The Symbols style still shows a merged unit as the icons of its parts.
  The pictures were reviewed unit by unit, and the feedback changed them: the Armoured Carrier has no gun,
  the Infantry Fighting Vehicle uses the carrier's wheels, the Howitzer is a big gun on a truck, the Strike Drone is the drone itself,
  the Scout wears a ghillie suit, Special Forces carry a knife,
  the Nuke is a multiple-warhead missile in space with its warheads still on board, and parachutes, rotors, smoke and aircraft noses may reach out over the ring.
- **Names:** units swap recipes, each keeping its name, picture and idea. Where they ended up:
  Electronic Warfare L+A+H (was L+A+R+H), Assault Trooper (was Assault Brigade, L+A+H) L+A+R, Main Battle Tank L+A+R+H (was L+A+R),
  Special Forces L+A+F+H (was L+R+F+H), Massive Bomb (was Massive Ordnance, L+A+F+H) L+R+F+H.
  Air Defence and Strategic Bomber swapped and then swapped back, so they're where they started (A+R+H and A+R+F).
  Pairs are single units, so their names are singular: Drone Operators → Strike Drone, Scout Team → Scout, Combat Engineers → Combat Engineer.
  Bomber Drones → Bomber Drone and Paratroopers → Paratrooper too.
- **Rules:** Stats follow the recipe, so the swapped units take the stats of their new recipes.

### 2026-10-18 — v2: merging units (`/v2`)
- **What:** A second version of the game in `v2/`, served at `/v2`, with its own rules file, tests and [v2/RULES.md](v2/RULES.md).
  v1 at `/` is unchanged. Online v2 games use their own room namespace, so they never meet v1 games.
- **Rules (v2 only):**
  - **New base units and stats** (Atk/Def/Mov/Rng): Rifle Squad 1/1/1/1, Armoured Carrier 0/2/1/1, Mortar Team 2/0/1/2,
    Recon Drone 0/0/2/1, Commander 2/2/1/1. In code they're `light`, `armour`, `range`, `flying` and `hero`.
  - **Renames** (the unit list in UNITS.md): Tank → Armoured Carrier, Armoured Carrier → Infantry Fighting Vehicle,
    Mechanised Infantry → Main Battle Tank, Artillery → Mortar Team, Mortar Team → Machine Gunner. Each idea moved with its name.
    Machine Gunner got a new idea, and so did Armoured Carrier and Infantry Fighting Vehicle, which inherited
    the old ideas of the units renamed away from them.
  - **Merging:** move a unit onto another of yours and they merge, which ends the move (`mergeEndsMove`).
    Two of your units sharing a hex can merge in place. Attack and defence add up; movement and range are the best of the parts
    (a placeholder). No abilities yet.
  - **Splitting:** some of a merged unit's parts step off as a unit of their own, with their own movement. The rest stays.
    The split is the first step of the move, so the part leaving can carry on, capture, or merge.
  - **Surveillance replaces Insurgency** and is the only skill: the Recon Drone shares a hex and flies through occupied ones,
    gives an enemy on its hex −1 defence, and can't capture or take the capital. Merged units don't inherit it.
- **Why:** The user asked for the merge mechanic as a separate v2, without abilities for now, and gave the base stats
  and the Surveillance rule. The renames came in the same request.
- **My calls, to check:**
  - Surveillance's −1 applies to enemies only.
  - A merged unit with a drone in it loses Surveillance.
  - Merging ends the move.
  - A split must step off the hex.

### 2026-10-18 — Dark mode
- **What:** The page has a dark theme. It follows the system setting by default, and the **Theme** picker (Auto / Light / Dark, next to Map and Units) can override that. The choice is remembered in the browser.
  The side panel, hover bar, buttons, menus and toasts change. The board stays the same in both themes, because it already sits on its own dark table.
  Each page colour is a `light-dark()` pair in `style.css`, so a new colour only needs adding in one place.
  The board's table colour changed from a cool blue slate (`#2b333c`) to a warm charcoal (`#262320`), and the page's greys (both themes) are warm too,
  so everything matches the "pastel stone" terrain. The table is dark enough that minefield tiles still stand out against it.
- **Rules:** None.

### 2026-10-17 — Online: board turned round for Red, shared pointer, people count; terrain numbers back on the tiles
- **What:** Online, Red sees the board turned round, so each player's own side is at the bottom (text and pictures stay upright).
  Each player sees a dashed outline in the other's colour on the hex the other's pointer is over. Watchers see both, but their own pointers aren't shared.
  It's sent on a separate channel from the game record and only when the pointer moves to another hex.
  The online card shows "2 playing · 1 watching" (everyone connected, you included).
  Each tile with terrain has a small label near its top showing what the terrain does to a unit on it (`+1` attack, `+1` defence, `+1` / `-1` movement),
  on both map styles. These were taken off when the tiles became one big symbol. They're back because the hover bar alone made them easy to miss.
- **Rules:** None.

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
- **Later:** A TURN relay for players on networks that block direct connections.

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
