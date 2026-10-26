/*
 * Near Peer — playing against the computer (the Menu, or index.html?vs=hard&side=red).
 *
 * Same shape as localGame() in ui.js and an online game (online.js join), so the
 * page doesn't mind which one it's showing. You take one seat and the computer
 * (ai.js) plays the other. It thinks in a Web Worker (ai-worker.js), so the page
 * stays responsive, and every move it sends back is applied through the engine.
 */
import * as E from './engine.js';
import { signal, batch } from './signals.js';

const MIN_DELAY = 400; // ms: even an instant reply waits this long, so you can see what happened

// seat: the one you play (0 Blue, 1 Red). level: a key of LEVELS in ai.js.
function aiGame({ seat = 0, level = 'hard' } = {}) {
  const ai = 1 - seat;
  const g = { vs: level, state: signal(E.newGame()), history: signal([]), lastChange: null, thinking: signal(false) };
  let worker = null;
  let asked = 0; // the latest request; replies to older ones (from before an undo or a new game) are dropped
  let sentAt = 0;
  let batches = []; // { by, actions } for each move, which replay the game (online.js replay)
  let undos = 0;

  const set = (next, history, actions) => {
    batch(() => {
      g.lastChange = { prev: g.state(), next, actions };
      g.state(next);
      g.history(history);
    });
    think();
  };

  function think() {
    const st = g.state();
    asked += 1;
    const mine = st.current === ai && st.phase !== 'over';
    g.thinking(mine);
    if (!mine) return;
    if (!worker) {
      worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = reply;
      worker.onerror = (e) => {
        console.error('Computer player:', e.message);
        g.thinking(false);
      };
    }
    // The log isn't needed to choose a move, and leaving it out keeps the messages small.
    const bare = (s) => Object.assign({}, s, { log: [] });
    sentAt = Date.now();
    worker.postMessage({
      id: asked, level, state: bare(st), history: g.history().filter((h) => h.phase === 'battle').map(bare),
    });
  }

  function reply({ data: { id, actions } }) {
    if (id !== asked) return;
    setTimeout(() => {
      if (id !== asked) return;
      let next = g.state();
      try {
        for (const a of actions) next = E.apply(next, a);
      } catch (e) {
        console.error('Computer player made an illegal move:', e.message, actions);
        g.thinking(false);
        return;
      }
      batches = batches.concat([{ by: ai, actions }]);
      set(next, g.history().concat([g.state()]), actions);
    }, Math.max(0, MIN_DELAY - (Date.now() - sentAt)));
  }

  g.seat = () => seat;
  g.isMyTurn = (st = g.state()) => st.current === seat && st.phase !== 'over';
  // quiet: don't animate (pieces placed at random).
  g.play = (actions, next, { quiet = false } = {}) => {
    batches = batches.concat([{ by: g.state().current, actions }]);
    set(next, g.history().concat([g.state()]), quiet ? null : actions);
  };
  // Undo takes back your last move and whatever the computer played after it.
  const lastMine = () => {
    const h = g.history();
    let i = h.length - 1;
    while (i >= 0 && h[i].current !== seat) i--;
    return i;
  };
  g.canUndo = () => lastMine() >= 0;
  g.undo = () => {
    const i = lastMine();
    if (i < 0) return;
    batches = batches.slice(0, i);
    undos += 1;
    set(g.history()[i], g.history().slice(0, i), null);
  };
  g.reset = () => {
    batches = [];
    undos = 0;
    set(E.newGame(), [], null);
  };
  // What stats.js sends.
  g.record = () => ({ mode: `vs-${level}`, seat, undos, batches });
  g.leave = () => {
    asked += 1;
    if (worker) worker.terminate();
    worker = null;
  };
  think(); // the computer moves first when it plays Blue
  return g;
}

export { aiGame };
