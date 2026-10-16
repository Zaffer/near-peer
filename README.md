# Near Peer

Use strategy to defeat your opponent on the battlefield with using terrain and movement.
A two-player hex board game where you control military troops and place fortifications.
Plain HTML, CSS and JS, with no build step.

## Play
Open `index.html` in a browser. Double-clicking the file works fine.
- `index.html?quick` skips the build phase with a random setup.
- Keys: `E` end turn (or pass), `Z` undo, `Esc` deselect.
- Hover any unit to see curved arrows from every enemy unit attacking it, with the total vs its defence.

The rules are in [RULES.md](RULES.md). Ideas and past rule decisions are tracked in [AMENDMENTS.md](AMENDMENTS.md). Open `tests.html` to run the rule tests.

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
| `js/icons.js` | One SVG icon per unit and terrain type, using the same type ids as `rules.js`. |
| `tests/rules.test.js` | One test per rule. Update the matching test when you change a rule on purpose. |
