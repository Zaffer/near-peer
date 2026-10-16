/*
 * Near Peer — rule tests. Open tests.html to run them.
 * Each test builds a small battle scenario and checks one rule. When a rule is
 * changed on purpose, update the test that pins it.
 */
(function (global) {
  'use strict';

  const E = global.NP_ENGINE;
  const R = global.NP_RULES;
  const Hex = global.NP_HEX;
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, err: e.message });
    }
  }
  const ok = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
  const eq = (a, b, msg) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  };
  const step = (s, unitId, to) => E.apply(s, { type: 'step', unitId, to });
  const share = (s, unitId, to) => E.apply(s, { type: 'step', unitId, to, capture: false });
  const illegal = (s, action) => ok(E.whyIllegal(s, action), `expected illegal: ${JSON.stringify(action)}`);
  const cannotStep = (s, unitId, to) => illegal(s, { type: 'step', unitId, to });
  // Walk a path and return the state; fails if any step is illegal.
  const walk = (s, unitId, path) => path.reduce((st, to) => step(st, unitId, to), s);

  // Scenarios with no enemy units would end in an elimination win on the first
  // step, so give any empty side a bystander in a far corner.
  const scenario = (spec) => {
    const units = (spec.units || []).slice();
    if (!units.some((u) => u.player === 0)) units.push({ player: 0, type: 'hero', hex: '-2,2', id: 'p0-bystander' });
    if (!units.some((u) => u.player === 1)) units.push({ player: 1, type: 'hero', hex: '2,-2', id: 'p1-bystander' });
    return E.scenario(Object.assign({}, spec, { units }));
  };

  // A straight row through the middle of the board, left to right.
  const ROW = ['-2,0', '-1,0', '0,0', '1,0', '2,0'];

  // ---------------------------------------------------------------- board & zones

  test('board has 19 hexes', () => eq(Hex.all(R.boardRadius).length, 19));

  test('zones are 9 and 10 hexes, disjoint, and cover the board', () => {
    eq(R.zones[0].length, 9);
    eq(R.zones[1].length, 10);
    const all = new Set([...R.zones[0], ...R.zones[1]]);
    eq(all.size, 19);
    for (const k of all) ok(Hex.inBoard(k, R.boardRadius), `${k} is off the board`);
    ok(R.zones[1].includes('0,0'), 'centre belongs to the second player');
  });

  // ---------------------------------------------------------------- build phase

  test('build phase alternates players and moves on to units, then battle', () => {
    let s = E.newGame();
    eq(s.current, 0);
    s = E.apply(s, { type: 'placeTerrain', terrain: 'capital', to: R.zones[0][0] });
    eq(s.current, 1);
    illegal(s, { type: 'placeTerrain', terrain: 'town', to: R.zones[0][1] }); // not your zone
    while (s.phase === 'terrain') s = E.apply(s, E.legalPlacements(s)[0]);
    eq(s.phase, 'units');
    eq(s.current, 0);
    while (s.phase === 'units') s = E.apply(s, E.legalPlacements(s)[0]);
    eq(s.phase, 'battle');
    eq(s.current, 0);
    eq(E.aliveUnits(s).length, 10);
  });

  test('cannot place terrain on a hex that already has terrain', () => {
    let s = E.newGame();
    s = E.apply(s, { type: 'placeTerrain', terrain: 'capital', to: R.zones[0][0] });
    s = E.apply(s, { type: 'placeTerrain', terrain: 'capital', to: R.zones[1][0] });
    illegal(s, { type: 'placeTerrain', terrain: 'town', to: R.zones[0][0] });
  });

  // ---------------------------------------------------------------- movement

  test('light moves 2 on plain ground', () => {
    const s = scenario({ units: [{ player: 0, type: 'light', hex: ROW[0] }] });
    const s2 = walk(s, 'p0-light', [ROW[1], ROW[2]]);
    ok(s2.turnState.moveDone);
    cannotStep(s2, 'p0-light', ROW[3]);
  });

  test('stepping onto a minefield uses up the rest of the move', () => {
    const s = scenario({ terrain: { [ROW[1]]: ['minefield', 0] }, units: [{ player: 0, type: 'light', hex: ROW[0] }] });
    const s2 = step(s, 'p0-light', ROW[1]);
    ok(s2.turnState.moveDone, 'light should stop on the minefield');
  });

  test('a light starting on a minefield can move 1', () => {
    const s = scenario({ terrain: { [ROW[0]]: ['minefield', 0] }, units: [{ player: 0, type: 'light', hex: ROW[0] }] });
    eq(E.stat(s, 'p0-light', 'movement'), 1);
    ok(step(s, 'p0-light', ROW[1]).turnState.moveDone);
  });

  test('an armour on a minefield cannot move', () => {
    const s = scenario({ terrain: { [ROW[0]]: ['minefield', 0] }, units: [{ player: 0, type: 'armour', hex: ROW[0] }] });
    cannotStep(s, 'p0-armour', ROW[1]);
    eq(E.reachable(s, 'p0-armour'), []);
  });

  test('a 1-move unit landing on a road gets one more step', () => {
    const s = scenario({ terrain: { [ROW[1]]: ['road', 0] }, units: [{ player: 0, type: 'armour', hex: ROW[0] }] });
    const s2 = walk(s, 'p0-armour', [ROW[1], ROW[2]]);
    ok(s2.turnState.moveDone);
  });

  test('light: road then plain = 2 moves in total', () => {
    const s = scenario({ terrain: { [ROW[1]]: ['road', 0] }, units: [{ player: 0, type: 'light', hex: ROW[0] }] });
    ok(walk(s, 'p0-light', [ROW[1], ROW[2]]).turnState.moveDone);
  });

  test('light: plain then road = a 3rd move', () => {
    const s = scenario({ terrain: { [ROW[2]]: ['road', 0] }, units: [{ player: 0, type: 'light', hex: ROW[0] }] });
    const s2 = walk(s, 'p0-light', [ROW[1], ROW[2]]);
    ok(!s2.turnState.moveDone);
    ok(walk(s2, 'p0-light', [ROW[3]]).turnState.moveDone);
  });

  test('light: road, road, road = a 4th move', () => {
    const s = scenario({
      terrain: { [ROW[1]]: ['road', 0], [ROW[2]]: ['road', 0], [ROW[3]]: ['road', 1] },
      units: [{ player: 0, type: 'light', hex: ROW[0] }],
    });
    ok(walk(s, 'p0-light', [ROW[1], ROW[2], ROW[3], ROW[4]]).turnState.moveDone);
  });

  test('starting on a road gives no extra movement (only landing on one does)', () => {
    const s = scenario({ terrain: { [ROW[0]]: ['road', 0] }, units: [{ player: 0, type: 'armour', hex: ROW[0] }] });
    eq(E.stat(s, 'p0-armour', 'movement'), 1);
  });

  // ---------------------------------------------------------------- movement examples
  // Each example walks a path and checks the move ends after exactly that many steps.
  // T = terrain as { "q,r": type }, path = hexes stepped into, in order.
  const movesExactly = (type, start, T, path) => {
    const terrain = Object.fromEntries(Object.entries(T).map(([k, t]) => [k, [t, 0]]));
    let st = scenario({ terrain, units: [{ player: 0, type, hex: start }] });
    const id = `p0-${type}`;
    if (!path.length) {
      eq(E.legalSteps(st, id), [], 'should not be able to move at all');
      return;
    }
    path.forEach((to, i) => {
      ok(!st.turnState.moveDone, `move ended early, after ${i} step(s)`);
      st = step(st, id, to);
    });
    ok(st.turnState.moveDone, `move should end after ${path.length} step(s) but has ${st.turnState.move.remaining} left`);
  };
  const [a, b, c, d, e] = ROW;

  test('ex 1: Armour starts on road → plain = 1 move', () => movesExactly('armour', a, { [a]: 'road' }, [b]));
  test('ex 2: Armour starts on road → road → plain = 2 moves', () => movesExactly('armour', a, { [a]: 'road', [b]: 'road' }, [b, c]));
  test('ex 3: Armour plain → road → plain = 2 moves', () => movesExactly('armour', a, { [b]: 'road' }, [b, c]));
  test('ex 4: Light starts on road → plain → plain = 2 moves', () => movesExactly('light', a, { [a]: 'road' }, [b, c]));
  test('ex 5: Light road → plain = 2 moves', () => movesExactly('light', a, { [b]: 'road' }, [b, c]));
  test('ex 6: Light plain → road → plain = 3 moves', () => movesExactly('light', a, { [c]: 'road' }, [b, c, d]));
  test('ex 7: Light road → road → road → plain = 4 moves', () =>
    movesExactly('light', a, { [b]: 'road', [c]: 'road', [d]: 'road' }, [b, c, d, e]));
  test('ex 8: Light starts on minefield → plain = 1 move', () => movesExactly('light', a, { [a]: 'minefield' }, [b]));
  test('ex 9: Light starts on minefield → road → plain = 2 moves', () => movesExactly('light', a, { [a]: 'minefield', [b]: 'road' }, [b, c]));
  test('ex 10: Armour starts on minefield = cannot move', () => movesExactly('armour', a, { [a]: 'minefield' }, []));
  test('ex 11: Light plain → minefield = 1 move (stops on the mines)', () => movesExactly('light', a, { [b]: 'minefield' }, [b]));
  test('ex 12: Light starts on road → plain → back onto that road → plain = 3 moves', () =>
    movesExactly('light', b, { [b]: 'road' }, [c, b, a]));
  test('ex 13: Armour plain → road → minefield = 2 moves', () => movesExactly('armour', a, { [b]: 'road', [c]: 'minefield' }, [b, c]));
  test('ex 14: Armour road → road → back onto the first road = 3 moves (each road pays once)', () =>
    movesExactly('armour', a, { [b]: 'road', [c]: 'road' }, [b, c, b]));

  test('bouncing between two roads only pays out once per road', () => {
    const s = scenario({
      terrain: { [ROW[1]]: ['road', 0], [ROW[2]]: ['road', 1] },
      units: [{ player: 0, type: 'armour', hex: ROW[0] }],
    });
    const s2 = walk(s, 'p0-armour', [ROW[1], ROW[2], ROW[1]]);
    ok(s2.turnState.moveDone, 'third step back onto a used road should end the move');
  });

  test('units cannot step through or onto a friendly normal unit', () => {
    const s = scenario({ units: [{ player: 0, type: 'light', hex: ROW[0] }, { player: 0, type: 'armour', hex: ROW[1] }] });
    cannotStep(s, 'p0-light', ROW[1]);
    ok(!E.reachable(s, 'p0-light').includes(ROW[2]), 'the hex behind the armour is only reachable through it');
  });

  test('cannot step onto an enemy normal unit you can\'t beat', () => {
    const s = scenario({ units: [{ player: 0, type: 'light', hex: ROW[0] }, { player: 1, type: 'armour', hex: ROW[1] }] });
    cannotStep(s, 'p0-light', ROW[1]);
  });

  test('only one unit may move per turn', () => {
    const s = scenario({ units: [{ player: 0, type: 'light', hex: ROW[0] }, { player: 0, type: 'hero', hex: ROW[4] }] });
    const s2 = step(s, 'p0-light', ROW[1]);
    cannotStep(s2, 'p0-hero', ROW[3]);
  });

  test('cannot move an enemy unit', () => {
    const s = scenario({ units: [{ player: 1, type: 'light', hex: ROW[0] }] });
    cannotStep(s, 'p1-light', ROW[1]);
  });

  // ---------------------------------------------------------------- covert & stacking

  test('covert can share a hex with a friendly or enemy normal unit', () => {
    const s = scenario({ units: [
      { player: 0, type: 'covert', hex: ROW[0] },
      { player: 0, type: 'armour', hex: ROW[1] },
      { player: 1, type: 'hero', hex: '-2,1' },
    ] });
    step(s, 'p0-covert', ROW[1]);
    step(s, 'p0-covert', '-2,1');
  });

  test('covert cannot join a hex that already holds two units it can\'t beat', () => {
    const s = scenario({
      terrain: { [ROW[1]]: ['fortification', 1] },
      units: [
        { player: 0, type: 'covert', hex: ROW[0] },
        { player: 1, type: 'armour', hex: ROW[1] },
        { player: 1, type: 'covert', hex: ROW[1] },
      ],
    });
    cannotStep(s, 'p0-covert', ROW[1]); // covert 1 vs covert 2 (fortified) and armour 4
  });

  test('two coverts can share a hex', () => {
    const s = scenario({ units: [{ player: 0, type: 'covert', hex: ROW[0] }, { player: 1, type: 'covert', hex: ROW[1] }] });
    ok(!share(s, 'p0-covert', ROW[1]).units['p1-covert'].dead);
  });

  test('a normal unit may move onto a lone covert without capturing it (for now)', () => {
    const s = scenario({ units: [{ player: 0, type: 'light', hex: ROW[0] }, { player: 1, type: 'covert', hex: ROW[1] }] });
    const s2 = share(s, 'p0-light', ROW[1]);
    ok(!s2.units['p1-covert'].dead);
    eq(E.unitsAt(s2, ROW[1]).length, 2);
  });

  test('option: only coverts may share hexes', () => {
    const s = scenario({
      options: { normalUnitsCanJoinOccupiedHex: false },
      units: [{ player: 0, type: 'light', hex: ROW[0] }, { player: 1, type: 'covert', hex: ROW[1] }],
    });
    illegal(s, { type: 'step', unitId: 'p0-light', to: ROW[1], capture: false });
  });

  // ---------------------------------------------------------------- combined attack & capturing
  // Attack is passive. Stepping onto an enemy captures it if the attack of every
  // one of your units in range of it adds up to at least its defence.

  test('a unit alone captures when its attack ≥ the defence', () => {
    const s = scenario({ units: [
      { player: 0, type: 'hero', hex: ROW[1] },
      { player: 1, type: 'armour', hex: ROW[2] },
      { player: 1, type: 'light', hex: ROW[4] },
    ] });
    ok(step(s, 'p0-hero', ROW[2]).units['p1-armour'].dead, 'hero 3 vs armour 3');
  });

  test('units in range add their attacks together', () => {
    const s = scenario({ units: [
      { player: 0, type: 'light', hex: ROW[1] },
      { player: 0, type: 'covert', hex: '-1,1' },
      { player: 1, type: 'armour', hex: ROW[2] },
      { player: 1, type: 'hero', hex: ROW[4] },
    ] });
    const a = E.assault(s, 'p1-armour');
    eq([a.total, a.defence, a.beats], [3, 3, true], 'light 2 + covert 1 vs armour 3');
    ok(step(s, 'p0-light', ROW[2]).units['p1-armour'].dead);
  });

  test('town adds attack, fortification adds defence, capital adds both', () => {
    const s = scenario({
      terrain: { [ROW[1]]: ['town', 0], [ROW[2]]: ['fortification', 1], [ROW[3]]: ['capital', 1] },
      units: [
        { player: 0, type: 'light', hex: ROW[1] },
        { player: 1, type: 'armour', hex: ROW[2] },
        { player: 1, type: 'hero', hex: ROW[3] },
      ],
    });
    eq(E.stat(s, 'p0-light', 'attack'), 3);
    eq(E.stat(s, 'p1-armour', 'defence'), 4);
    eq(E.stat(s, 'p1-hero', 'attack'), 4);
    eq(E.stat(s, 'p1-hero', 'defence'), 4);
  });

  test('ranged adds its attack to anything within 2 hexes, not 3', () => {
    const s = scenario({ units: [
      { player: 0, type: 'ranged', hex: ROW[0] },
      { player: 1, type: 'light', hex: ROW[1] },
      { player: 1, type: 'hero', hex: ROW[2] },
      { player: 1, type: 'covert', hex: ROW[3] },
    ] });
    eq(E.assault(s, 'p1-hero').total, 3);
    eq(E.assault(s, 'p1-covert').contributors, []);
    ok(!E.assault(s, 'p1-covert').beats, 'nobody in range means no capture');
  });

  test('a hero on its capital (defence 4) falls to Light + Armour + Covert', () => {
    const units = [
      { player: 0, type: 'light', hex: ROW[1] },
      { player: 0, type: 'armour', hex: '0,1' },
      { player: 0, type: 'covert', hex: '-1,1' },
      { player: 1, type: 'hero', hex: ROW[2] },
      { player: 1, type: 'armour', hex: '2,-2' },
    ];
    const terrain = { [ROW[2]]: ['capital', 1] };
    const s = scenario({ terrain, units });
    const s2 = step(s, 'p0-light', ROW[2]);
    ok(s2.units['p1-hero'].dead);
    eq(s2.winner, 0, 'and the light is now on the capital');
    const noCovert = scenario({ terrain, units: units.filter((u) => u.type !== 'covert' || u.player !== 0) });
    cannotStep(noCovert, 'p0-light', ROW[2]); // 2 + 1 = 3 vs 4
  });

  test('a unit sharing the target\'s hex adds its attack', () => {
    const s = scenario({ units: [
      { player: 0, type: 'light', hex: ROW[1] },
      { player: 0, type: 'covert', hex: ROW[2] },
      { player: 1, type: 'armour', hex: ROW[2] },
      { player: 1, type: 'hero', hex: ROW[4] },
    ] });
    const s2 = step(s, 'p0-light', ROW[2]); // 2 + 1 vs 3, then the light joins its own covert
    ok(s2.units['p1-armour'].dead);
    eq(E.unitsAt(s2, ROW[2]).length, 2);
  });

  test('the moving unit counts from the hex it steps in from, so it can walk up and capture', () => {
    const s = scenario({ units: [
      { player: 0, type: 'light', hex: ROW[0] },
      { player: 1, type: 'covert', hex: ROW[2] },
      { player: 1, type: 'hero', hex: '2,-2' },
    ] });
    ok(walk(s, 'p0-light', [ROW[1], ROW[2]]).units['p1-covert'].dead);
  });

  test('a town only helps while you stand on it', () => {
    const s = scenario({
      terrain: { [ROW[1]]: ['town', 0] },
      units: [
        { player: 0, type: 'light', hex: ROW[1] },
        { player: 1, type: 'armour', hex: ROW[2] },
        { player: 1, type: 'hero', hex: '2,-2' },
      ],
    });
    ok(step(s, 'p0-light', ROW[2]).units['p1-armour'].dead, 'from the town: 3 vs 3');
    const s2 = scenario({
      terrain: { [ROW[0]]: ['town', 0] },
      units: [
        { player: 0, type: 'light', hex: ROW[0] },
        { player: 1, type: 'armour', hex: ROW[2] },
        { player: 1, type: 'hero', hex: '2,-2' },
      ],
    });
    cannotStep(step(s2, 'p0-light', ROW[1]), 'p0-light', ROW[2]); // left the town: 2 vs 3
  });

  test('one move can capture several units', () => {
    const s = scenario({ units: [
      { player: 0, type: 'light', hex: ROW[0] },
      { player: 1, type: 'covert', hex: ROW[1] },
      { player: 1, type: 'ranged', hex: ROW[2] },
      { player: 1, type: 'hero', hex: '2,-2' },
    ] });
    const s2 = walk(s, 'p0-light', [ROW[1], ROW[2]]);
    ok(s2.units['p1-covert'].dead && s2.units['p1-ranged'].dead);
  });

  test('a stacked hex: beat both units and you capture both', () => {
    const s = scenario({ units: [
      { player: 0, type: 'light', hex: ROW[1] },
      { player: 0, type: 'hero', hex: '0,1' },
      { player: 1, type: 'hero', hex: ROW[2] },
      { player: 1, type: 'covert', hex: ROW[2] },
      { player: 1, type: 'armour', hex: '2,-2' },
    ] });
    const s2 = step(s, 'p0-light', ROW[2]); // 2 + 3 = 5 vs hero 3 and covert 1
    ok(s2.units['p1-hero'].dead && s2.units['p1-covert'].dead);
  });

  test('a stacked hex: beating only the covert is not enough to get in', () => {
    const s = scenario({ units: [
      { player: 0, type: 'light', hex: ROW[1] },
      { player: 1, type: 'hero', hex: ROW[2] },
      { player: 1, type: 'covert', hex: ROW[2] },
    ] });
    cannotStep(s, 'p0-light', ROW[2]); // beats the covert (2 vs 1) but not the hero (2 vs 3)
  });

  test('you may walk in beside an enemy you could capture (capture: false)', () => {
    const s = scenario({ units: [
      { player: 0, type: 'covert', hex: ROW[1] },
      { player: 1, type: 'ranged', hex: ROW[2] },
      { player: 1, type: 'hero', hex: '2,-2' },
    ] });
    ok(!share(s, 'p0-covert', ROW[2]).units['p1-ranged'].dead);
    ok(step(s, 'p0-covert', ROW[2]).units['p1-ranged'].dead);
  });

  test('capturing does not end the move', () => {
    const s = scenario({ units: [
      { player: 0, type: 'light', hex: ROW[0] },
      { player: 1, type: 'ranged', hex: ROW[1] },
      { player: 1, type: 'armour', hex: ROW[4] },
    ] });
    const s2 = step(s, 'p0-light', ROW[1]);
    ok(s2.units['p1-ranged'].dead);
    ok(!s2.turnState.moveDone);
    step(s2, 'p0-light', ROW[2]);
  });

  test('capturing on a road gives a 1-move unit another step', () => {
    const s = scenario({
      terrain: { [ROW[1]]: ['road', 1] },
      units: [
        { player: 0, type: 'armour', hex: ROW[0] },
        { player: 1, type: 'ranged', hex: ROW[1] },
        { player: 1, type: 'hero', hex: ROW[4] },
      ],
    });
    const s2 = step(s, 'p0-armour', ROW[1]); // armour 1 vs ranged 1
    ok(s2.units['p1-ranged'].dead);
    step(s2, 'p0-armour', ROW[2]);
  });

  test('option: capturing ends the move', () => {
    const s = scenario({
      options: { captureEndsMove: true },
      units: [
        { player: 0, type: 'light', hex: ROW[0] },
        { player: 1, type: 'ranged', hex: ROW[1] },
        { player: 1, type: 'armour', hex: ROW[4] },
      ],
    });
    ok(step(s, 'p0-light', ROW[1]).turnState.moveDone);
  });

  test('a covert stuck on a minefield can capture an enemy sharing its hex', () => {
    const s = scenario({
      terrain: { [ROW[2]]: ['minefield', 1] },
      units: [
        { player: 0, type: 'light', hex: ROW[1] },
        { player: 0, type: 'covert', hex: ROW[2] },
        { player: 1, type: 'ranged', hex: ROW[2] },
        { player: 1, type: 'hero', hex: ROW[4] },
      ],
    });
    eq(E.stat(s, 'p0-covert', 'movement'), 0);
    eq(E.captureTargets(s, 'p0-covert'), ['p1-ranged']);
    const s2 = E.apply(s, { type: 'capture', unitId: 'p0-covert', targetId: 'p1-ranged' });
    ok(s2.units['p1-ranged'].dead);
    ok(s2.turnState.moveDone, 'capturing in place used the move (0 movement left)');
  });

  test('capturing in place uses the move, so no other unit can move', () => {
    const s = scenario({ units: [
      { player: 0, type: 'covert', hex: ROW[1] },
      { player: 0, type: 'light', hex: '-2,2' },
      { player: 1, type: 'ranged', hex: ROW[1] },
      { player: 1, type: 'hero', hex: ROW[4] },
    ] });
    const s2 = E.apply(s, { type: 'capture', unitId: 'p0-covert', targetId: 'p1-ranged' });
    cannotStep(s2, 'p0-light', '-1,2');
    step(s2, 'p0-covert', ROW[2]); // the covert still has its 1 movement
  });

  test('cannot capture in place an enemy you can\'t beat, or after moving another unit', () => {
    const units = [
      { player: 0, type: 'covert', hex: ROW[1] },
      { player: 0, type: 'light', hex: '-2,2' },
      { player: 1, type: 'hero', hex: ROW[1] },
      { player: 1, type: 'armour', hex: '2,-2' },
    ];
    const capture = { type: 'capture', unitId: 'p0-covert', targetId: 'p1-hero' };
    illegal(scenario({ units }), capture); // covert 1 vs hero 3
    const s = scenario({ units: units.concat({ player: 0, type: 'hero', hex: '-1,1' }) });
    ok(E.isLegal(s, capture), 'covert 1 + hero 3 vs hero 3');
    illegal(step(s, 'p0-light', '-1,2'), capture);
  });

  // ---------------------------------------------------------------- winning

  test('stepping onto the enemy capital alone wins', () => {
    const s = scenario({
      terrain: { [ROW[2]]: ['capital', 1] },
      units: [{ player: 0, type: 'light', hex: ROW[1] }, { player: 1, type: 'hero', hex: ROW[4] }],
    });
    const s2 = step(s, 'p0-light', ROW[2]);
    eq(s2.phase, 'over');
    eq(s2.winner, 0);
  });

  test('passing through the enemy capital also wins', () => {
    const s = scenario({
      terrain: { [ROW[1]]: ['capital', 1] },
      units: [{ player: 0, type: 'light', hex: ROW[0] }, { player: 1, type: 'hero', hex: ROW[4] }],
    });
    eq(step(s, 'p0-light', ROW[1]).winner, 0);
  });

  test('an enemy covert left on the capital blocks the win', () => {
    const s = scenario({
      terrain: { [ROW[2]]: ['capital', 1] },
      units: [{ player: 0, type: 'light', hex: ROW[1] }, { player: 1, type: 'covert', hex: ROW[2] }, { player: 1, type: 'hero', hex: '2,-2' }],
    });
    const s2 = share(s, 'p0-light', ROW[2]);
    eq(s2.phase, 'battle');
    eq(s2.winner, null);
    eq(step(s, 'p0-light', ROW[2]).winner, 0, 'capturing the covert instead wins');
  });

  test('your own covert on the capital does not block the win', () => {
    const s = scenario({
      terrain: { [ROW[2]]: ['capital', 1] },
      units: [
        { player: 0, type: 'covert', hex: ROW[2] },
        { player: 0, type: 'light', hex: ROW[1] },
        { player: 1, type: 'hero', hex: ROW[4] },
      ],
    });
    eq(step(s, 'p0-light', ROW[2]).winner, 0);
  });

  test('a covert (Insurgency) takes the capital even with an enemy unit on it', () => {
    const s = scenario({
      terrain: { [ROW[2]]: ['capital', 1] },
      units: [{ player: 0, type: 'covert', hex: ROW[1] }, { player: 1, type: 'hero', hex: ROW[2] }, { player: 1, type: 'armour', hex: '2,-2' }],
    });
    const s2 = step(s, 'p0-covert', ROW[2]); // can't beat the hero (1 vs 4), so it walks in beside it
    ok(!s2.units['p1-hero'].dead);
    eq(s2.winner, 0);
  });

  test('hero + covert on a capital fill it, keeping an enemy covert out', () => {
    const s = scenario({
      terrain: { [ROW[2]]: ['capital', 1] },
      units: [{ player: 0, type: 'covert', hex: ROW[1] }, { player: 1, type: 'hero', hex: ROW[2] }, { player: 1, type: 'covert', hex: ROW[2] }],
    });
    cannotStep(s, 'p0-covert', ROW[2]); // 1 vs hero 4 and covert 2
  });

  test('defeating the last enemy unit wins', () => {
    const s = scenario({ units: [{ player: 0, type: 'hero', hex: ROW[0] }, { player: 1, type: 'light', hex: ROW[1] }] });
    eq(step(s, 'p0-hero', ROW[1]).winner, 0);
  });

  test('nothing is legal after the game is over', () => {
    const s = scenario({
      terrain: { [ROW[2]]: ['capital', 1] },
      units: [{ player: 0, type: 'light', hex: ROW[1] }, { player: 1, type: 'hero', hex: ROW[4] }],
    });
    const s2 = step(s, 'p0-light', ROW[2]);
    illegal(s2, { type: 'endTurn' });
    eq(E.hasAnyAction(s2), false);
  });

  // ---------------------------------------------------------------- turn flow

  test('hasAnyAction is false once the move is spent', () => {
    const s = scenario({ units: [{ player: 0, type: 'hero', hex: ROW[0] }, { player: 1, type: 'light', hex: ROW[1] }, { player: 1, type: 'armour', hex: ROW[4] }] });
    ok(E.hasAnyAction(s));
    eq(E.hasAnyAction(step(s, 'p0-hero', ROW[1])), false);
  });

  test('a random full game never breaks the rules engine', () => {
    for (let g = 0; g < 20; g++) {
      let s = E.newGame();
      while (s.phase === 'terrain' || s.phase === 'units') {
        const opts = E.legalPlacements(s);
        s = E.apply(s, opts[Math.floor(Math.random() * opts.length)]);
      }
      for (let i = 0; i < 300 && s.phase === 'battle'; i++) {
        const mine = E.unitsOf(s, s.current);
        const acts = [{ type: 'endTurn' }];
        for (const u of mine) {
          for (const k of E.legalSteps(s, u.id)) {
            acts.push({ type: 'step', unitId: u.id, to: k });
            const sideBySide = { type: 'step', unitId: u.id, to: k, capture: false };
            if (E.isLegal(s, sideBySide)) acts.push(sideBySide);
          }
          for (const t of E.captureTargets(s, u.id)) acts.push({ type: 'capture', unitId: u.id, targetId: t });
        }
        s = E.apply(s, acts[Math.floor(Math.random() * acts.length)]);
        for (const k of Object.keys(s.hexes)) {
          const types = E.unitsAt(s, k).map((u) => u.type);
          ok(types.length <= 2, `hex ${k} holds ${types.length} units`);
        }
      }
    }
  });

  global.NP_TEST_RESULTS = results;
})(typeof window !== 'undefined' ? window : globalThis);
