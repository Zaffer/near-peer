# Near Peer

Use strategy to defeat your opponent on the battlefield with using terrain and movement.
A two-player hex board game where you control military troops and place fortifications.
Combine and seperate units to concentrate power where you need it.

## Play
Serve the folder and open it in a browser, e.g. `python3 -m http.server` and then http://localhost:8000. Browsers won't load modules from a file, so double-clicking `index.html` doesn't work. The page needs an internet connection the first time, to load [alien-signals](https://github.com/stackblitz/alien-signals) from jsDelivr.
- `index.html?quick` skips the build phase with a random setup.
- **Play the computer** from the Menu, as Blue or Red, on Easy, Medium or Hard. `index.html?vs=hard` (or `vs=easy`, `vs=medium`, add `&side=red` to play Red) starts one straight away. It runs in your browser, so there's still no server.
- Keys: `E` end turn (or pass), `Z` undo, `Esc` deselect or close the menu.
- The game fills the window. Whose turn it is sits at the top left, and what you can do right now is in a panel beside the board (under it on a narrow screen): placing pieces, ending the turn, and the selected unit with its split, merge and capture buttons. The panel scrolls on its own, so the board keeps its size whatever the panel shows. Online play, settings, rules and the log are in the **Menu** (top right), which opens full screen.
- Dark mode follows your system. The **Theme** setting in the Menu can set Light or Dark instead, and the browser remembers it.
- Hover any unit to see curved arrows from every enemy unit attacking it, with the total vs its defence.
- To move, select a unit and click where it should go, or drag it there (works on touch screens). An arrow shows where it's heading: in your colour if it can get there, magenta if it would capture, grey if it can't. A hex more than one step away is reached by the shortest route that doesn't fight on the way.

## Merging units
Move a unit onto another of yours and they **merge** into one new unit, with their attack and defence added up.
Any mix of your five base units (Rifle Squad, Armoured Carrier, Mortar Team, Recon Drone and Commander) makes a different unit, 31 in all, and merged units can split back up.
The only special abilities so far are the Recon Drone's Surveillance and the Nuke's Nuclear Deterrence.
- With the Graphic unit style, every one of the 31 units has its own picture (`js/unitart.js`). Special units get a
  second ring and the Nuke a third. The Symbols style shows a merged unit as the icons of the units in it.

## Play online
Click **Create a game and get a link** and send the link to a friend. They play Red, and anyone else who opens it watches.
- Moves go straight between the two browsers ([Trystero](https://github.com/dmotz/trystero), WebRTC). There's no game server, and both browsers check every move against the rules.
- To play someone on another computer, host the folder online (e.g. GitHub Pages). A link from `localhost` only works on your own machine, which is handy for testing in two tabs.
- Some strict office or mobile networks block direct connections.

The rules are in [RULES.md](RULES.md). Ideas and past rule decisions are tracked in [AMENDMENTS.md](AMENDMENTS.md). The unit names, the 31 merges and ideas for their abilities are in [UNITS.md](UNITS.md). Open `tests.html` (served, like the game) to run the tests.

## Roadmap

### Naval expansion
An expansion version of the game with the sea and naval units. Nothing is decided yet. These are the ideas so far:
- **Ocean around the map.** The board is surrounded by ocean.
- **Ports.** A new terrain tile on the coast where land and sea meet.
- **Boats on the river.** Some boats could travel along the river.
- **How the ocean works (open question):**
  - The ocean is a ring of new hexes that naval units move across, or
  - The ocean isn't played on directly, and navy units only affect the game through the ports.

## Changing the rules
| File | What lives there |
|------|------------------|
| `js/rules.js` | Every number, zone, terrain effect, the 31 units and their skills, option switch, and the small rule functions (hit check, movement maths, stacking). **Tune the game here.** |
| `js/engine.js` | Pure game logic: `apply(state, action)`. Every legality check is in one action handler. `assault()` works out a combined attack. |
| `js/ui.js` | SVG board, the cards under it and the Menu. It only ever asks the engine what's legal. What's on screen lives in signals, and each part of the page is an effect that redraws itself when the signals it read change. |
| `js/signals.js` | Signals, computeds and effects from alien-signals (version pinned here), plus `batch` and `untracked`. |
| `js/hex.js` | Hex grid maths. |
| `js/colours.js` | Terrain colours. Purely visual. |
| `js/mapview.js` | The "Graphic" map style: blended terrain, joined-up roads, river between the zones. Purely visual. |
| `js/unitart.js` | The "Graphic" unit style: a picture for each of the 31 units. Purely visual. |
| `js/effects.js` | Short animations after each action: units sliding between hexes, attack streaks and captures, minefield blasts, river splashes, taking the capital, whose turn it is. Purely visual. |
| `js/icons.js` | One SVG icon per unit and terrain type, using the same type ids as `rules.js`. |
| `js/online.js` | Online play: joins a peer-to-peer room, sends the game record, replays the other side's moves through the engine, settles who sits where. The room's state, seat, status and peers are signals. |
| `js/ai.js` | The computer player. Battle: a search over whole turns, several turns deep, scoring positions by material (what each unit's stats are worth; other terms in `W` are off). Build: no rules of thumb; each placement is tried by finishing the build at random many times and searching the battles that follow (Monte Carlo). `LEVELS` lists the levels: Easy only looks at its own move (never your reply) and plays a random move 40% of the time; Medium looks 2 turns ahead and plays a random move 30% of the time. Every move it picks is replayed through the engine first. |
| `js/ai-sim.js` | A fast copy of the battle rules for the AI to search with, about 150 times faster than the engine. It reads every number and switch from `rules.js`. A unit is just the set of base units in it. |
| `js/versus.js`, `js/ai-worker.js` | A game against the computer, with the same shape as a local or online game. The AI thinks in a Web Worker so the page doesn't freeze. |
| `tools/arena.js` | Plays the AI against itself, another set of weights, or random moves, without a browser: `bun tools/arena.js 64 200 '{"advance":1.2}' hard`. |
| `tests/rules.test.js` | One test per rule. Update the matching test when you change a rule on purpose. |
| `tests/online.test.js` | Online play without the network: replaying the game record, who may undo, who gets which seat. |
| `tests/ai.test.js` | The AI's rules copy finds exactly the engine's moves on random games (this fails if a rule changes in the engine only), and the AI plays legal moves, takes a win and stops one. |
