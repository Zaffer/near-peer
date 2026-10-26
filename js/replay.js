/*
 * Near Peer — watching a recorded game (index.html?replay=<id>, linked from stats.html).
 *
 * Same shape as localGame() in ui.js, so the page draws it as usual, but nobody can
 * move: the replay controls step through the record one move at a time, and a step
 * forward animates like the move did when it was played. The record is a game from
 * data/games.json (tools/games.js), replayed through the engine.
 */
import * as E from './engine.js';
import { signal, batch } from './signals.js';

const SPEEDS = { 0.5: 2400, 1: 1200, 2: 600, 4: 300 }; // × → ms per move

// game: the archive entry (date, mode, seat, …). batches: its moves, from stats.js decode.
// Throws a RuleError if the moves don't replay under the current rules.
function replayGame(game, batches) {
  const states = [E.newGame()];
  for (const b of batches) {
    let s = states[states.length - 1];
    for (const a of b.actions) s = E.apply(s, a);
    states.push(s);
  }
  const g = {
    replay: game,
    batches,
    states,
    state: signal(states[0]),
    history: signal([]),
    lastChange: null,
    at: signal(0), // moves played so far
    playing: signal(false),
    speed: signal(1),
  };
  let timer = null;

  // Show the game after move i. One step forward animates that move, unless it's a
  // whole build phase placed at once.
  g.go = (i) => {
    const to = Math.max(0, Math.min(states.length - 1, i));
    const forward = to === g.at() + 1 && batches[to - 1].actions.length <= 8;
    batch(() => {
      g.lastChange = { prev: g.state(), next: states[to], actions: forward ? batches[to - 1].actions : null };
      g.at(to);
      g.state(states[to]);
    });
    if (to === states.length - 1) g.pause();
  };
  g.pause = () => {
    clearInterval(timer);
    timer = null;
    g.playing(false);
  };
  g.resume = () => {
    g.pause();
    if (g.at() === states.length - 1) g.go(0);
    g.playing(true);
    g.go(g.at() + 1);
    timer = setInterval(() => g.go(g.at() + 1), SPEEDS[g.speed()]);
  };
  g.setSpeed = (x) => {
    g.speed(x);
    if (g.playing()) {
      clearInterval(timer);
      timer = setInterval(() => g.go(g.at() + 1), SPEEDS[x]);
    }
  };

  g.isMyTurn = () => false;
  g.canUndo = () => false;
  g.play = () => {};
  g.undo = () => {};
  g.reset = () => g.go(0);
  g.leave = g.pause;
  g.record = () => null; // a replay is never sent to the statistics
  return g;
}

export { replayGame, SPEEDS };
