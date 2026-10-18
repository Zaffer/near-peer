# Near Peer

Use strategy to defeat your opponent on the battlefield with using terrain and movement.
A two-player hex board game where you control military troops and place fortifications.
Plain HTML, CSS and JS, with no build step.

## Play
Open `index.html` in a browser. Double-clicking the file works fine.
- `index.html?quick` skips the build phase with a random setup.
- Keys: `E` end turn (or pass), `Z` undo, `Esc` deselect.
- Hover any unit to see curved arrows from every enemy unit attacking it, with the total vs its defence.
- To move, select a unit and click where it should go, or drag it there (works on touch screens). An arrow shows where it's heading: in your colour if it can get there, magenta if it would capture, grey if it can't. A hex more than one step away is reached by the shortest route that doesn't fight on the way.

## Play online
Click **Create a game and get a link** in the side panel and send the link to a friend. The first person to open it plays Red; anyone after that watches.
- The two browsers connect directly (WebRTC, peer to peer). No game server is involved. [Trystero](https://github.com/dmotz/trystero) uses public Nostr relays only to swap connection details, then every move goes straight between the players.
- Each move sends the whole game record, and both browsers replay it through the rules engine. So neither side can make an illegal move, and a player who reloads or drops out is brought back up to date.
- You can only act on your own turn. Undo takes back your own move while it's still your turn, and **New game** resets it for both players.
- To play a friend, the page has to be online (GitHub Pages or any static host works). Opened from a file, the link only works on your own computer, which is handy for testing in two tabs.
- Some strict networks (some offices, some mobile carriers) block direct connections. Those players would need a TURN relay server, which this doesn't set up.

The rules are in [RULES.md](RULES.md). Ideas and past rule decisions are tracked in [AMENDMENTS.md](AMENDMENTS.md). Open `tests.html` to run the tests.

## Changing the rules
| File | What lives there |
|------|------------------|
| `js/rules.js` | Every number, zone, terrain effect, option switch, and the small rule functions (hit check, movement maths, stacking). **Tune the game here.** |
| `js/engine.js` | Pure game logic: `apply(state, action)`. Every legality check is in one action handler. `assault()` works out a combined attack. |
| `js/ui.js` | SVG board and side panel. It only ever asks the engine what's legal. |
| `js/hex.js` | Hex grid maths. |
| `js/colours.js` | Terrain colours. Purely visual. |
| `js/mapview.js` | The "Graphic" map style: blended terrain, joined-up roads, river between the zones. Purely visual. |
| `js/unitart.js` | The "Graphic" unit style: illustrated tokens (infantry, tank, truck-mounted howitzer, special forces, general). Purely visual. |
| `js/effects.js` | Short animations after each action: units sliding between hexes, attack streaks and captures, minefield blasts, river splashes, taking the capital, whose turn it is. Purely visual. |
| `js/icons.js` | One SVG icon per unit and terrain type, using the same type ids as `rules.js`. |
| `js/online.js` | Online play: joins a peer-to-peer room, sends the game record, replays the other side's moves through the engine, settles who sits where. |
| `tests/rules.test.js` | One test per rule. Update the matching test when you change a rule on purpose. |
| `tests/online.test.js` | Online play without the network: replaying the game record, who may undo, who gets which seat. |
