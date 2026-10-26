/*
 * Near Peer — online play, peer to peer.
 *
 * Two browsers connect directly over WebRTC; there is no game server. Trystero
 * finds the other player through public Nostr relays (used only to swap
 * connection details), then every message goes straight between the players.
 *
 * What gets sent is the whole game record: each player's batches of actions
 * since the game began. A batch is one commit (a route of steps plus any
 * automatic end of turn), so undo takes back exactly one. Both sides replay the
 * record through the engine, so neither can make an illegal move or move the
 * other's pieces. `rev` counts every change (a move, an undo, a new game); on
 * every message the higher rev wins, which also brings a reconnecting player
 * up to date.
 *
 * Seats: 0 = Blue, 1 = Red, null = watching. Whoever creates the room takes
 * Blue; the first to join takes the other seat. If two people claim the same
 * seat, the earlier claim keeps it.
 */
import * as E from './engine.js';
import { signal, batch } from './signals.js';

const TRYSTERO = 'https://cdn.jsdelivr.net/npm/trystero@0.25.4/+esm';
// Named from when the original game (v1) ran alongside this one; keeping it means old v1 links
// can't join these games with a record the engine can't replay.
const APP_ID = 'near-peer-v2';

// ---------------------------------------------------------------- the game record (pure)

// → { state, history } where history[i] is the state before batch i.
// Throws a RuleError if any batch breaks the rules or was played out of turn.
function replay(batches) {
  let state = E.newGame();
  const history = [];
  for (const b of batches) {
    if (b.by !== state.current) throw new E.RuleError(`${b.by === 0 ? 'Blue' : 'Red'} moved out of turn`);
    history.push(state);
    for (const a of b.actions) state = E.apply(state, a);
  }
  return { state, history };
}

// Can `seat` take back the last batch? Only their own, and only while it's still their turn.
function canUndo(batches, state, seat) {
  const last = batches[batches.length - 1];
  return !!last && last.by === seat && state.current === seat && state.phase !== 'over';
}

// Which seat to hold, given my claim and the claims of the players in the room.
// claims: [{ seat, at, id }]. The earlier claim to a seat keeps it (ties go to the lower id).
function settleSeat(me, others) {
  const beats = (a, b) => a.at < b.at || (a.at === b.at && a.id < b.id);
  const held = (seat) => others.find((o) => o.seat === seat && (me.seat !== seat || beats(o, me)));
  if (me.seat !== null && !held(me.seat)) return me.seat;
  for (const seat of [0, 1]) if (!others.some((o) => o.seat === seat)) return seat;
  return null;
}

// ---------------------------------------------------------------- the connection


const store = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(`near-peer-v2:room:${k}`)); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(`near-peer-v2:room:${k}`, JSON.stringify(v)); } catch (e) { /* private window etc. */ } },
};

const newRoomId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');

// Join a room. Everything that changes is a signal (signals.js), so the page redraws
// itself: state, history, seat, status (connecting → ready | failed), error, peers
// (peerId → { seat, at, id }) and hovers (seat → the hex that player's pointer is over).
// lastChange is how the latest state came about, { prev, next, actions }, where actions
// is set only for a single new move, the one to animate.
// Saved per browser tab, so a reload rejoins the same game in the same seat.
function join(roomId, { create = false } = {}) {
  const saved = store.get(roomId);
  const me = { at: saved ? saved.at : create ? Date.now() : null, id: null };
  const game = { rev: saved ? saved.rev : 0, batches: saved ? saved.batches : [] };
  const start = replay(game.batches);
  const on = {
    roomId,
    state: signal(start.state),
    history: signal(start.history),
    seat: signal(saved ? saved.seat : create ? 0 : null),
    status: signal('connecting'),
    error: signal(null),
    peers: signal({}),
    hovers: signal({}),
    lastChange: null,
  };
  let undos = 0; // taken back on this side, since this page joined
  let send = () => {};
  let sendHover = () => {};
  let room = null;

  const save = () => store.set(roomId, { seat: on.seat(), at: me.at, rev: game.rev, batches: game.batches });
  const message = () => ({ seat: on.seat(), at: me.at, rev: game.rev, batches: game.batches });
  const broadcast = () => { save(); send(message()); };
  const setGame = ({ state, history }, actions) => batch(() => {
    on.lastChange = { prev: on.state(), next: state, actions };
    on.state(state);
    on.history(history);
  });
  const setHover = (seat, k) => {
    const next = Object.assign({}, on.hovers());
    if (k) next[seat] = k;
    else delete next[seat];
    on.hovers(next);
  };

  // Take or give up a seat once we know who else is here.
  function reseat() {
    const seat = settleSeat({ seat: on.seat(), at: me.at, id: me.id }, Object.values(on.peers()));
    if (seat !== on.seat()) {
      me.at = seat === null ? null : Date.now();
      on.seat(seat);
      save();
      send(message());
    }
  }

  function receive(msg, peerId) {
    if (!msg || !Array.isArray(msg.batches)) return;
    batch(() => {
      const p = on.peers()[peerId];
      if (!p || p.seat !== msg.seat || p.at !== msg.at) on.peers(Object.assign({}, on.peers(), { [peerId]: { seat: msg.seat, at: msg.at, id: peerId } }));
      if (msg.rev > game.rev) {
        let next;
        try {
          next = replay(msg.batches);
        } catch (e) {
          on.error(`Ignored a game from the other side that breaks the rules: ${e.message}`);
          return;
        }
        const appended = msg.batches.length === game.batches.length + 1 && msg.rev === game.rev + 1;
        game.rev = msg.rev;
        game.batches = msg.batches;
        setGame(next, appended ? msg.batches[msg.batches.length - 1].actions : null);
        save();
      } else if (msg.rev < game.rev) {
        send(message(), peerId); // they're behind: catch them up
      }
      reseat();
    });
  }

  import(TRYSTERO).then((T) => {
    if (on.left) return;
    me.id = T.selfId;
    room = T.joinRoom({ appId: APP_ID }, roomId, {
      onJoinError: (d) => on.error(`Couldn't connect to a player: ${d.error}`),
    });
    const action = room.makeAction('game');
    send = (data, target) => action.send(data, target ? { target } : undefined);
    action.onMessage = (data, { peerId }) => receive(data, peerId);
    room.onPeerJoin = (peerId) => send(message(), peerId);
    room.onPeerLeave = (peerId) => batch(() => {
      const p = on.peers()[peerId];
      if (p && p.seat !== null) setHover(p.seat, null);
      const rest = Object.assign({}, on.peers());
      delete rest[peerId];
      on.peers(rest);
    });
    // Where a player's pointer is, so the others can see what they're looking at.
    // Not part of the game record; only players send it.
    const hover = room.makeAction('hover');
    sendHover = (k) => hover.send({ k });
    hover.onMessage = (data, { peerId }) => {
      const p = on.peers()[peerId];
      if (!p || p.seat === null || !data) return;
      setHover(p.seat, typeof data.k === 'string' ? data.k : null);
    };
    on.status('ready');
  }).catch((e) => batch(() => {
    on.status('failed');
    on.error(`Couldn't load the networking library (${e.message}). Are you offline?`);
  }));

  // How many people are here, me included: { playing, watching }.
  on.counts = () => {
    const all = Object.values(on.peers()).concat({ seat: on.seat() });
    const playing = all.filter((p) => p.seat !== null).length;
    return { playing, watching: all.length - playing };
  };
  on.hover = (k) => { if (on.seat() !== null) sendHover(k || null); };

  // The other player, if they're here right now.
  on.opponent = () => {
    const seat = on.seat();
    return seat === null ? null : Object.values(on.peers()).find((p) => p.seat === 1 - seat) || null;
  };
  on.isMyTurn = (st = on.state()) => on.seat() !== null && st.current === on.seat() && st.phase !== 'over' && !!on.opponent();
  // Reads state() as well as the record, so an effect that asks is told again when it changes.
  on.canUndo = () => canUndo(game.batches, on.state(), on.seat()) && !!on.opponent();

  // A move made on this side: actions already applied locally, giving `next`.
  on.play = (actions, next) => {
    game.batches = game.batches.concat([{ by: on.seat(), actions }]);
    game.rev += 1;
    setGame({ state: next, history: on.history().concat([on.state()]) }, actions);
    broadcast();
  };
  on.undo = () => {
    game.batches = game.batches.slice(0, -1);
    undos += 1;
    game.rev += 1;
    setGame(replay(game.batches), null);
    broadcast();
  };
  on.reset = () => {
    if (on.seat() === null) return;
    game.batches = [];
    undos = 0;
    game.rev += 1;
    setGame(replay(game.batches), null);
    broadcast();
  };
  // What stats.js sends. Only Blue sends it, so each game is sent once.
  on.record = () => (on.seat() === 0 ? { mode: 'online', seat: 0, undos, batches: game.batches } : null);
  on.leave = () => {
    on.left = true;
    if (room) room.leave();
  };
  return on;
}

export { join, newRoomId, replay, canUndo, settleSeat };
