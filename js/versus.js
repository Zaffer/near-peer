/*
 * Near Peer — temporary: play against Claude (index.html?vs=claude).
 *
 * Same shape as an online game (online.js join), but the record lives on
 * tools/bridge.py instead of going peer to peer. You play Blue; Claude plays
 * Red with tools/claude.js. The page posts the record after each of your moves
 * and checks the bridge every second for Claude's. Every record is replayed
 * through the engine, so Claude can't make an illegal move either.
 */
import { replay, canUndo } from './online.js';
import { signal, batch } from './signals.js';

const CLAUDE = 1;
const API = 'api/game';

function claudeGame() {
  const game = { rev: 0, batches: [] };
  const start = replay(game.batches);
  const g = { vs: 'claude', state: signal(start.state), history: signal(start.history), lastChange: null };
  const setGame = ({ state, history }, actions) => batch(() => {
    g.lastChange = { prev: g.state(), next: state, actions };
    g.state(state);
    g.history(history);
  });
  // A change made on this side: the new record, and the game it gives.
  const change = (batches, next, actions = null) => {
    game.batches = batches;
    game.rev += 1;
    setGame(next, actions);
    fetch(API, { method: 'POST', body: JSON.stringify(game) }).catch((e) => console.warn('vs Claude:', e.message));
  };

  async function pull() {
    try {
      const msg = await (await fetch(API, { cache: 'no-store' })).json();
      if (msg.rev <= game.rev) return;
      const next = replay(msg.batches);
      const appended = msg.batches.length === game.batches.length + 1;
      game.rev = msg.rev;
      game.batches = msg.batches;
      setGame(next, appended ? msg.batches[msg.batches.length - 1].actions : null);
    } catch (e) {
      console.warn('vs Claude:', e.message);
    }
  }
  pull();
  setInterval(pull, 1000);

  g.isMyTurn = (st = g.state()) => st.current !== CLAUDE && st.phase !== 'over';
  g.canUndo = () => canUndo(game.batches, g.state(), 1 - CLAUDE);
  // quiet: don't animate (a whole build phase placed at random).
  g.play = (actions, next, { quiet = false } = {}) => change(
    game.batches.concat([{ by: g.state().current, actions }]),
    { state: next, history: g.history().concat([g.state()]) },
    quiet ? null : actions);
  g.undo = () => change(game.batches.slice(0, -1), replay(game.batches.slice(0, -1)));
  g.reset = () => change([], replay([]));
  return g;
}

export { claudeGame };
