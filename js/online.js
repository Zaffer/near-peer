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
(function (global) {
  'use strict';

  const E = global.NP_ENGINE;
  const TRYSTERO = 'https://cdn.jsdelivr.net/npm/trystero@0.25.4/+esm';
  const APP_ID = 'near-peer';

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
    get(k) { try { return JSON.parse(sessionStorage.getItem(`near-peer:room:${k}`)); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(`near-peer:room:${k}`, JSON.stringify(v)); } catch (e) { /* private window etc. */ } },
  };

  const newRoomId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');

  // Join a room. hooks.onChange({ state, history, prev, batch }) runs whenever the game
  // changes from the other side (batch is set when it's a single new move to animate);
  // hooks.onStatus() runs when people come and go or the connection state changes.
  // Saved per browser tab, so a reload rejoins the same game in the same seat.
  function join(roomId, { create = false, onChange, onStatus } = {}) {
    const saved = store.get(roomId);
    const me = {
      seat: saved ? saved.seat : create ? 0 : null,
      at: saved ? saved.at : create ? Date.now() : null,
      id: null,
    };
    const game = { rev: saved ? saved.rev : 0, batches: saved ? saved.batches : [] };
    let { state, history } = replay(game.batches);
    const peers = {}; // peerId → { seat, at, id }
    const on = {
      roomId,
      status: 'connecting', // connecting → ready | failed
      error: null,
      get seat() { return me.seat; },
      get state() { return state; },
      get history() { return history; },
      peers,
    };
    let send = () => {};
    let room = null;

    const save = () => store.set(roomId, { seat: me.seat, at: me.at, rev: game.rev, batches: game.batches });
    const message = () => ({ seat: me.seat, at: me.at, rev: game.rev, batches: game.batches });
    const broadcast = () => { save(); send(message()); };

    // Take or give up a seat once we know who else is here.
    function reseat() {
      const seat = settleSeat(me, Object.values(peers));
      if (seat !== me.seat) {
        me.seat = seat;
        me.at = seat === null ? null : Date.now();
        save();
        send(message());
      }
    }

    function receive(msg, peerId) {
      if (!msg || !Array.isArray(msg.batches)) return;
      peers[peerId] = { seat: msg.seat, at: msg.at, id: peerId };
      if (msg.rev > game.rev) {
        let next;
        try {
          next = replay(msg.batches);
        } catch (e) {
          on.error = `Ignored a game from the other side that breaks the rules: ${e.message}`;
          onStatus && onStatus();
          return;
        }
        const prev = state;
        const appended = msg.batches.length === game.batches.length + 1 && msg.rev === game.rev + 1;
        game.rev = msg.rev;
        game.batches = msg.batches;
        state = next.state;
        history = next.history;
        save();
        onChange && onChange({ state, history, prev, batch: appended ? msg.batches[msg.batches.length - 1] : null });
      } else if (msg.rev < game.rev) {
        send(message(), peerId); // they're behind: catch them up
      }
      reseat();
      onStatus && onStatus();
    }

    import(TRYSTERO).then((T) => {
      if (on.left) return;
      me.id = T.selfId;
      room = T.joinRoom({ appId: APP_ID }, roomId, {
        onJoinError: (d) => { on.error = `Couldn't connect to a player: ${d.error}`; onStatus && onStatus(); },
      });
      const action = room.makeAction('game');
      send = (data, target) => action.send(data, target ? { target } : undefined);
      action.onMessage = (data, { peerId }) => receive(data, peerId);
      room.onPeerJoin = (peerId) => send(message(), peerId);
      room.onPeerLeave = (peerId) => { delete peers[peerId]; onStatus && onStatus(); };
      on.status = 'ready';
      onStatus && onStatus();
    }).catch((e) => {
      on.status = 'failed';
      on.error = `Couldn't load the networking library (${e.message}). Are you offline?`;
      onStatus && onStatus();
    });

    // The other player, if they're here right now.
    on.opponent = () => (me.seat === null ? null : Object.values(peers).find((p) => p.seat === 1 - me.seat) || null);
    on.isMyTurn = (st = state) => me.seat !== null && st.current === me.seat && st.phase !== 'over' && !!on.opponent();
    on.canUndo = () => canUndo(game.batches, state, me.seat) && !!on.opponent();

    // A move made on this side: actions already applied locally, giving `next`.
    on.play = (actions, next) => {
      history = history.concat([state]);
      state = next;
      game.batches = game.batches.concat([{ by: me.seat, actions }]);
      game.rev += 1;
      broadcast();
    };
    on.undo = () => {
      game.batches = game.batches.slice(0, -1);
      ({ state, history } = replay(game.batches));
      game.rev += 1;
      broadcast();
    };
    on.reset = () => {
      if (me.seat === null) return;
      game.batches = [];
      ({ state, history } = replay(game.batches));
      game.rev += 1;
      broadcast();
    };
    on.leave = () => {
      on.left = true;
      if (room) room.leave();
    };
    return on;
  }

  global.NP_ONLINE = { join, newRoomId, replay, canUndo, settleSeat };
})(typeof window !== 'undefined' ? window : globalThis);
