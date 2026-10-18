/*
 * Near Peer — online play tests (the game record and seats; no network).
 * Open tests.html to run them, after the rule tests.
 */
(function (global) {
  'use strict';

  const E = global.NP_ENGINE;
  const O = global.NP_ONLINE;
  const results = global.NP_TEST_RESULTS;

  function test(name, fn) {
    try {
      fn();
      results.push({ name: `online: ${name}`, ok: true });
    } catch (e) {
      results.push({ name: `online: ${name}`, ok: false, err: e.message });
    }
  }
  const ok = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
  const eq = (a, b, msg) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  };
  const throws = (fn, msg) => {
    try { fn(); } catch (e) { return; }
    throw new Error(msg || 'expected an error');
  };
  // The first legal placement for whoever is to play, as a batch.
  const place = (s) => ({ by: s.current, actions: [E.legalPlacements(s)[0]] });

  test('replay rebuilds the state, with the state before each batch as history', () => {
    const s0 = E.newGame();
    const b1 = place(s0);
    const s1 = E.apply(s0, b1.actions[0]);
    const b2 = place(s1);
    const s2 = E.apply(s1, b2.actions[0]);
    const r = O.replay([b1, b2]);
    eq(r.state.hexes, s2.hexes);
    eq(r.state.current, s2.current);
    eq(r.history.length, 2);
    eq(r.history[1].hexes, s1.hexes);
  });

  test('replay rejects a batch played out of turn', () => {
    const s0 = E.newGame();
    const b = place(s0);
    throws(() => O.replay([{ by: 1 - b.by, actions: b.actions }]));
  });

  test('replay rejects a batch that breaks the rules', () => {
    const s0 = E.newGame();
    const theirZone = Object.keys(s0.hexes).find((k) => s0.hexes[k].zone === 1 - s0.current);
    throws(() => O.replay([{ by: s0.current, actions: [{ type: 'placeTerrain', terrain: 'road', to: theirZone }] }]));
  });

  test('you can take back your own move only while it is still your turn', () => {
    // Blue places, and the turn passes to Red: Blue can no longer take it back.
    const s0 = E.newGame();
    const b1 = place(s0);
    const r1 = O.replay([b1]);
    ok(!O.canUndo([b1], r1.state, 0), 'Blue undid after the turn passed');
    ok(!O.canUndo([b1], r1.state, 1), 'Red undid Blue\'s move');

    // In battle, a Light unit (2 movement) steps once: still Blue's turn, so Blue can take it back.
    const b = E.scenario({ units: [{ player: 0, type: 'light', hex: '0,2' }, { player: 1, type: 'hero', hex: '2,-2' }] });
    const stepped = E.apply(b, { type: 'step', unitId: 'p0-light', to: '0,1' });
    ok(O.canUndo([{ by: 0, actions: [] }], stepped, 0), 'Blue could not undo during their turn');
    const ended = E.apply(stepped, { type: 'endTurn' });
    ok(!O.canUndo([{ by: 0, actions: [] }], ended, 0), 'Blue undid after ending the turn');
  });

  test('seats: the creator keeps Blue and the first to join takes Red', () => {
    eq(O.settleSeat({ seat: 0, at: 1, id: 'a' }, []), 0);
    eq(O.settleSeat({ seat: null, at: null, id: 'b' }, [{ seat: 0, at: 1, id: 'a' }]), 1);
    eq(O.settleSeat({ seat: null, at: null, id: 'b' }, [{ seat: 1, at: 1, id: 'a' }]), 0);
  });

  test('seats: with both seats taken, a newcomer watches', () => {
    eq(O.settleSeat({ seat: null, at: null, id: 'c' }, [{ seat: 0, at: 1, id: 'a' }, { seat: 1, at: 2, id: 'b' }]), null);
  });

  test('seats: when two claim the same seat, the earlier claim keeps it', () => {
    // c grabbed Red before hearing from b, who had Red first: c moves on (and Blue is taken, so it watches).
    eq(O.settleSeat({ seat: 1, at: 5, id: 'c' }, [{ seat: 0, at: 1, id: 'a' }, { seat: 1, at: 2, id: 'b' }]), null);
    // b keeps Red against c's later claim.
    eq(O.settleSeat({ seat: 1, at: 2, id: 'b' }, [{ seat: 0, at: 1, id: 'a' }, { seat: 1, at: 5, id: 'c' }]), 1);
    // Two strangers both took Blue: the later one switches to Red.
    eq(O.settleSeat({ seat: 0, at: 9, id: 'x' }, [{ seat: 0, at: 3, id: 'y' }]), 1);
    eq(O.settleSeat({ seat: 0, at: 3, id: 'y' }, [{ seat: 0, at: 9, id: 'x' }]), 0);
  });
})(typeof window !== 'undefined' ? window : globalThis);
