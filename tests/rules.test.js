/*
 * Near Peer — rule tests. Open tests.html to run them.
 * Each test builds a small battle scenario and checks one rule. When a rule is
 * changed on purpose, update the test that pins it.
 */
import * as E from '../js/engine.js';
import R from '../js/rules.js';
import * as Hex from '../js/hex.js';

export const results = [];

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
const merge = (s, unitId, to, target) => E.apply(s, { type: 'step', unitId, to, merge: target });
const split = (s, unitId, parts, to, extra) => E.apply(s, Object.assign({ type: 'split', unitId, parts, to }, extra));
const illegal = (s, action) => ok(E.whyIllegal(s, action), `expected illegal: ${JSON.stringify(action)}`);
const cannotStep = (s, unitId, to) => illegal(s, { type: 'step', unitId, to });
// Walk a path and return the state; fails if any step is illegal.
const walk = (s, unitId, path) => path.reduce((st, to) => step(st, unitId, to), s);
const alive = (s, id) => s.units[id] && !s.units[id].dead;

// Scenarios with no enemy units would end in an elimination win on the first
// step, so give any empty side a bystander in a far corner.
const scenario = (spec) => {
  const units = (spec.units || []).slice();
  if (!units.some((u) => u.player === 0)) units.push({ player: 0, type: 'hero', hex: '-2,2', id: 'p0-bystander' });
  if (!units.some((u) => u.player === 1)) units.push({ player: 1, type: 'hero', hex: '2,-2', id: 'p1-bystander' });
  return E.scenario(Object.assign({}, spec, { units }));
};

// All five base units merged.
const NUKE = 'light+armour+range+flying+hero';

// A straight row through the middle of the board, left to right.
const ROW = ['-2,0', '-1,0', '0,0', '1,0', '2,0'];
// A unit with 2 movement and no skill (Rifle Squad + Recon Drone), for the movement rules.
const M2 = 'light+flying';

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

// ---------------------------------------------------------------- units

test('there are 31 unit types, each with its own name', () => {
  const types = Object.keys(R.units);
  eq(types.length, 31);
  eq(new Set(types.map((t) => R.units[t].name)).size, 31);
  ok(types.every((t) => R.units[t].name), 'every unit has a name');
  eq(types.filter((t) => R.units[t].tier === 1), R.base);
});

test('base unit stats', () => {
  const row = (t) => [R.units[t].name, R.units[t].attack, R.units[t].defence, R.units[t].range, R.units[t].movement];
  eq(row('light'), ['Rifle Squad', 1, 1, 1, 1]);
  eq(row('armour'), ['Armoured Carrier', 0, 2, 1, 1]);
  eq(row('range'), ['Mortar Team', 2, 0, 2, 1]);
  eq(row('flying'), ['Recon Drone', 0, 0, 1, 2]);
  eq(row('hero'), ['Commander', 2, 2, 1, 1]);
});

test('merged units add attack and defence, and take the best movement and range', () => {
  const lar = R.units['light+armour+range'];
  eq([lar.name, lar.attack, lar.defence, lar.movement, lar.range], ['Assault Trooper', 3, 3, 1, 2]);
  const nuke = R.units['light+armour+range+flying+hero'];
  eq([nuke.name, nuke.attack, nuke.defence, nuke.movement, nuke.range], ['Nuke', 5, 5, 2, 2]);
  eq(R.units['light+armour'].name, 'Infantry Fighting Vehicle');
  eq(R.units['light+range'].name, 'Machine Gunner');
});

test('only the Recon Drone (Surveillance) and the Nuke (Nuclear Deterrence) have skills', () => {
  const skilled = Object.keys(R.units).filter((t) => (R.units[t].skills || []).length);
  eq(skilled, ['flying', NUKE]);
  eq(R.units.flying.skills, ['surveillance']);
  eq(R.units[NUKE].skills, ['nuclearDeterrence']);
  eq(R.units['flying+hero'].skills, undefined, 'a merge with the drone in it doesn\'t keep Surveillance');
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
  eq(s.supply[0].units, R.base);
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

test('a 2-move unit moves 2 on plain ground', () => {
  const s = scenario({ units: [{ player: 0, type: M2, hex: ROW[0] }] });
  const s2 = walk(s, `p0-${M2}`, [ROW[1], ROW[2]]);
  ok(s2.turnState.moveDone);
  cannotStep(s2, `p0-${M2}`, ROW[3]);
});

test('stepping onto a minefield uses up the rest of the move', () => {
  const s = scenario({ terrain: { [ROW[1]]: ['minefield', 0] }, units: [{ player: 0, type: M2, hex: ROW[0] }] });
  ok(step(s, `p0-${M2}`, ROW[1]).turnState.moveDone, 'should stop on the minefield');
});

test('a 2-move unit starting on a minefield can move 1', () => {
  const s = scenario({ terrain: { [ROW[0]]: ['minefield', 0] }, units: [{ player: 0, type: M2, hex: ROW[0] }] });
  eq(E.stat(s, `p0-${M2}`, 'movement'), 1);
  ok(step(s, `p0-${M2}`, ROW[1]).turnState.moveDone);
});

test('an Armoured Carrier on a minefield cannot move', () => {
  const s = scenario({ terrain: { [ROW[0]]: ['minefield', 0] }, units: [{ player: 0, type: 'armour', hex: ROW[0] }] });
  cannotStep(s, 'p0-armour', ROW[1]);
  eq(E.reachable(s, 'p0-armour'), []);
});

test('a 1-move unit landing on a road gets one more step', () => {
  const s = scenario({ terrain: { [ROW[1]]: ['road', 0] }, units: [{ player: 0, type: 'armour', hex: ROW[0] }] });
  ok(walk(s, 'p0-armour', [ROW[1], ROW[2]]).turnState.moveDone);
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

test('ex 1: 1-move starts on road → plain = 1 move', () => movesExactly('armour', a, { [a]: 'road' }, [b]));
test('ex 2: 1-move starts on road → road → plain = 2 moves', () => movesExactly('armour', a, { [a]: 'road', [b]: 'road' }, [b, c]));
test('ex 3: 1-move plain → road → plain = 2 moves', () => movesExactly('armour', a, { [b]: 'road' }, [b, c]));
test('ex 4: 2-move starts on road → plain → plain = 2 moves', () => movesExactly(M2, a, { [a]: 'road' }, [b, c]));
test('ex 5: 2-move road → plain = 2 moves', () => movesExactly(M2, a, { [b]: 'road' }, [b, c]));
test('ex 6: 2-move plain → road → plain = 3 moves', () => movesExactly(M2, a, { [c]: 'road' }, [b, c, d]));
test('ex 7: 2-move road → road → road → plain = 4 moves', () =>
  movesExactly(M2, a, { [b]: 'road', [c]: 'road', [d]: 'road' }, [b, c, d, e]));
test('ex 8: 2-move starts on minefield → plain = 1 move', () => movesExactly(M2, a, { [a]: 'minefield' }, [b]));
test('ex 9: 2-move starts on minefield → road → plain = 2 moves', () => movesExactly(M2, a, { [a]: 'minefield', [b]: 'road' }, [b, c]));
test('ex 10: 1-move starts on minefield = cannot move', () => movesExactly('armour', a, { [a]: 'minefield' }, []));
test('ex 11: 2-move plain → minefield = 1 move (stops on the mines)', () => movesExactly(M2, a, { [b]: 'minefield' }, [b]));
test('ex 12: 2-move starts on road → plain → back onto that road → plain = 3 moves', () =>
  movesExactly(M2, b, { [b]: 'road' }, [c, b, a]));
test('ex 13: 1-move plain → road → minefield = 2 moves', () => movesExactly('armour', a, { [b]: 'road', [c]: 'minefield' }, [b, c]));
test('ex 14: 1-move road → road → back onto the first road = 3 moves (each road pays once)', () =>
  movesExactly('armour', a, { [b]: 'road', [c]: 'road' }, [b, c, b]));

test('units cannot step onto a friendly unit without merging', () => {
  const s = scenario({ units: [{ player: 0, type: 'light', hex: ROW[0] }, { player: 0, type: 'armour', hex: ROW[1] }] });
  cannotStep(s, 'p0-light', ROW[1]);
  ok(!E.reachable(s, 'p0-light').includes(ROW[1]));
});

test('cannot step onto an enemy unit you can\'t beat', () => {
  const s = scenario({ units: [{ player: 0, type: 'light', hex: ROW[0] }, { player: 1, type: 'armour', hex: ROW[1] }] });
  cannotStep(s, 'p0-light', ROW[1]); // 1 vs 2
});

test('only one unit may move per turn', () => {
  const s = scenario({ units: [{ player: 0, type: 'light', hex: ROW[0] }, { player: 0, type: 'hero', hex: ROW[4] }] });
  cannotStep(step(s, 'p0-light', ROW[1]), 'p0-hero', ROW[3]);
});

test('cannot move an enemy unit', () => {
  const s = scenario({ units: [{ player: 1, type: 'light', hex: ROW[0] }] });
  cannotStep(s, 'p1-light', ROW[1]);
});

// ---------------------------------------------------------------- Surveillance (Recon Drone)

test('a Recon Drone can share a hex with a friendly or an enemy unit', () => {
  const s = scenario({ units: [
    { player: 0, type: 'flying', hex: ROW[0] },
    { player: 0, type: 'armour', hex: ROW[1] },
    { player: 1, type: 'hero', hex: '-2,1' },
  ] });
  share(s, 'p0-flying', ROW[1]);
  step(s, 'p0-flying', '-2,1');
});

test('a Recon Drone flies through an occupied hex', () => {
  const s = scenario({ units: [{ player: 0, type: 'flying', hex: ROW[0] }, { player: 1, type: 'hero', hex: ROW[1] }] });
  eq(walk(s, 'p0-flying', [ROW[1], ROW[2]]).units['p0-flying'].hex, ROW[2]);
});

test('a Recon Drone never captures', () => {
  const s = scenario({ units: [
    { player: 0, type: 'flying', hex: ROW[1] },
    { player: 0, type: 'range', hex: '-2,1' },
    { player: 1, type: 'range', hex: ROW[2] },
    { player: 1, type: 'hero', hex: '2,-2' },
  ] });
  ok(E.assault(s, 'p1-range').beats, 'the enemy Mortar Team (defence 0) could be captured');
  const s2 = step(s, 'p0-flying', ROW[2]);
  ok(alive(s2, 'p1-range'), 'the drone moved in beside it instead');
  illegal(s2, { type: 'capture', unitId: 'p0-flying', targetId: 'p1-range' });
});

test('an enemy unit sharing a hex with a Recon Drone has −1 defence', () => {
  const s = scenario({ units: [
    { player: 0, type: 'flying', hex: ROW[2] },
    { player: 1, type: 'armour', hex: ROW[2] },
    { player: 1, type: 'range', hex: ROW[4] },
  ] });
  eq(E.stats(s, 'p1-armour').defence, { base: 2, mod: -1, total: 1 });
});

test('Surveillance doesn\'t take defence below 0 or weaken your own units', () => {
  const s = scenario({ units: [
    { player: 0, type: 'flying', hex: ROW[2] },
    { player: 1, type: 'range', hex: ROW[2] },
  ] });
  eq(E.stat(s, 'p1-range', 'defence'), 0);
  const own = scenario({ units: [{ player: 0, type: 'flying', hex: ROW[2] }, { player: 0, type: 'hero', hex: ROW[2] }] });
  eq(E.stat(own, 'p0-hero', 'defence'), 2);
});

test('a Recon Drone\'s spotting lets another unit capture', () => {
  const s = scenario({ units: [
    { player: 0, type: 'light', hex: ROW[1] },
    { player: 0, type: 'flying', hex: ROW[2] },
    { player: 1, type: 'armour', hex: ROW[2] },
    { player: 1, type: 'hero', hex: ROW[4] },
  ] });
  const s2 = step(s, 'p0-light', ROW[2]); // 1 vs 2 − 1, then the Rifle Squad joins its own drone
  ok(!alive(s2, 'p1-armour'));
  eq(E.unitsAt(s2, ROW[2]).length, 2);
});

test('two Recon Drones can share a hex', () => {
  const s = scenario({ units: [{ player: 0, type: 'flying', hex: ROW[0] }, { player: 1, type: 'flying', hex: ROW[1] }] });
  ok(alive(share(s, 'p0-flying', ROW[1]), 'p1-flying'));
});

test('a normal unit may move onto a lone enemy Recon Drone without capturing it (for now)', () => {
  const s = scenario({ units: [{ player: 0, type: 'light', hex: ROW[0] }, { player: 1, type: 'flying', hex: ROW[1] }] });
  const s2 = share(s, 'p0-light', ROW[1]);
  ok(alive(s2, 'p1-flying'));
  eq(E.unitsAt(s2, ROW[1]).length, 2);
  ok(!alive(step(s, 'p0-light', ROW[1]), 'p1-flying'), 'or capture it');
});

test('option: only Surveillance units may share hexes', () => {
  const s = scenario({
    options: { normalUnitsCanJoinOccupiedHex: false },
    units: [{ player: 0, type: 'light', hex: ROW[0] }, { player: 1, type: 'flying', hex: ROW[1] }],
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
  ok(!alive(step(s, 'p0-hero', ROW[2]), 'p1-armour'), 'Commander 2 vs Armoured Carrier 2');
});

test('attack 0 still captures a unit with defence 0', () => {
  const s = scenario({ units: [
    { player: 0, type: 'armour', hex: ROW[1] },
    { player: 1, type: 'range', hex: ROW[2] },
    { player: 1, type: 'hero', hex: ROW[4] },
  ] });
  ok(!alive(step(s, 'p0-armour', ROW[2]), 'p1-range'));
});

test('units in range add their attacks together', () => {
  const s = scenario({ units: [
    { player: 0, type: 'light', hex: ROW[1] },
    { player: 0, type: 'range', hex: '-2,1' },
    { player: 1, type: 'hero', hex: ROW[2] },
    { player: 1, type: 'armour', hex: ROW[4] },
  ] });
  const at = E.assault(s, 'p1-hero');
  eq([at.total, at.defence, at.beats], [3, 2, true], 'Rifle Squad 1 + Mortar Team 2 vs Commander 2');
  ok(!alive(step(s, 'p0-light', ROW[2]), 'p1-hero'));
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
  eq(E.stat(s, 'p0-light', 'attack'), 2);
  eq(E.stat(s, 'p1-armour', 'defence'), 3);
  eq(E.stat(s, 'p1-hero', 'attack'), 3);
  eq(E.stat(s, 'p1-hero', 'defence'), 3);
});

test('a Mortar Team adds its attack to anything within 2 hexes, not 3', () => {
  const s = scenario({ units: [
    { player: 0, type: 'range', hex: ROW[0] },
    { player: 1, type: 'light', hex: ROW[1] },
    { player: 1, type: 'hero', hex: ROW[2] },
    { player: 1, type: 'armour', hex: ROW[3] },
  ] });
  eq(E.assault(s, 'p1-hero').total, 2);
  eq(E.assault(s, 'p1-armour').contributors, []);
  ok(!E.assault(s, 'p1-armour').beats, 'nobody in range means no capture');
});

test('the moving unit counts from the hex it steps in from, so it can walk up and capture', () => {
  const s = scenario({ units: [
    { player: 0, type: M2, hex: ROW[0] },
    { player: 1, type: 'light', hex: ROW[2] },
    { player: 1, type: 'hero', hex: '2,-2' },
  ] });
  ok(!alive(walk(s, `p0-${M2}`, [ROW[1], ROW[2]]), 'p1-light'));
});

test('a town only helps while you stand on it', () => {
  const units = (from) => [
    { player: 0, type: M2, hex: from },
    { player: 1, type: 'armour', hex: ROW[2] },
    { player: 1, type: 'hero', hex: '2,-2' },
  ];
  const s = scenario({ terrain: { [ROW[1]]: ['town', 0] }, units: units(ROW[1]) });
  ok(!alive(step(s, `p0-${M2}`, ROW[2]), 'p1-armour'), 'from the town: 2 vs 2');
  const s2 = scenario({ terrain: { [ROW[0]]: ['town', 0] }, units: units(ROW[0]) });
  cannotStep(step(s2, `p0-${M2}`, ROW[1]), `p0-${M2}`, ROW[2]); // left the town: 1 vs 2
});

test('one move can capture several units', () => {
  const s = scenario({ units: [
    { player: 0, type: M2, hex: ROW[0] },
    { player: 1, type: 'flying', hex: ROW[1] },
    { player: 1, type: 'range', hex: ROW[2] },
    { player: 1, type: 'hero', hex: '2,-2' },
  ] });
  const s2 = walk(s, `p0-${M2}`, [ROW[1], ROW[2]]);
  ok(!alive(s2, 'p1-flying') && !alive(s2, 'p1-range'));
});

test('a stacked hex: beat both units and you capture both', () => {
  const s = scenario({ units: [
    { player: 0, type: 'hero', hex: ROW[1] },
    { player: 0, type: 'range', hex: ROW[0] },
    { player: 1, type: 'hero', hex: ROW[2] },
    { player: 1, type: 'flying', hex: ROW[2] },
    { player: 1, type: 'armour', hex: '2,-2' },
  ] });
  const s2 = step(s, 'p0-hero', ROW[2]); // 2 + 2 = 4 vs Commander 2 and drone 0
  ok(!alive(s2, 'p1-hero') && !alive(s2, 'p1-flying'));
});

test('a stacked hex: beating only the drone is not enough to get in', () => {
  const s = scenario({ units: [
    { player: 0, type: 'light', hex: ROW[1] },
    { player: 1, type: 'hero', hex: ROW[2] },
    { player: 1, type: 'flying', hex: ROW[2] },
  ] });
  cannotStep(s, 'p0-light', ROW[2]); // beats the drone (1 vs 0) but not the Commander (1 vs 2)
});

test('capturing does not end the move', () => {
  const s = scenario({ units: [
    { player: 0, type: M2, hex: ROW[0] },
    { player: 1, type: 'range', hex: ROW[1] },
    { player: 1, type: 'armour', hex: ROW[4] },
  ] });
  const s2 = step(s, `p0-${M2}`, ROW[1]);
  ok(!alive(s2, 'p1-range'));
  ok(!s2.turnState.moveDone);
  step(s2, `p0-${M2}`, ROW[2]);
});

test('capturing on a road gives a 1-move unit another step', () => {
  const s = scenario({
    terrain: { [ROW[1]]: ['road', 1] },
    units: [
      { player: 0, type: 'light', hex: ROW[0] },
      { player: 1, type: 'range', hex: ROW[1] },
      { player: 1, type: 'hero', hex: ROW[4] },
    ],
  });
  const s2 = step(s, 'p0-light', ROW[1]);
  ok(!alive(s2, 'p1-range'));
  step(s2, 'p0-light', ROW[2]);
});

test('option: capturing ends the move', () => {
  const s = scenario({
    options: { captureEndsMove: true },
    units: [
      { player: 0, type: M2, hex: ROW[0] },
      { player: 1, type: 'range', hex: ROW[1] },
      { player: 1, type: 'armour', hex: ROW[4] },
    ],
  });
  ok(step(s, `p0-${M2}`, ROW[1]).turnState.moveDone);
});

test('a unit stuck on a minefield can capture an enemy drone sharing its hex', () => {
  const s = scenario({
    terrain: { [ROW[2]]: ['minefield', 1] },
    units: [
      { player: 0, type: 'light', hex: ROW[2] },
      { player: 1, type: 'flying', hex: ROW[2] },
      { player: 1, type: 'hero', hex: ROW[4] },
    ],
  });
  eq(E.stat(s, 'p0-light', 'movement'), 0);
  eq(E.captureTargets(s, 'p0-light'), ['p1-flying']);
  const s2 = E.apply(s, { type: 'capture', unitId: 'p0-light', targetId: 'p1-flying' });
  ok(!alive(s2, 'p1-flying'));
  ok(s2.turnState.moveDone, 'capturing in place used the move (0 movement left)');
});

test('capturing in place uses the move, so no other unit can move', () => {
  const s = scenario({ units: [
    { player: 0, type: 'light', hex: ROW[1] },
    { player: 0, type: 'hero', hex: '-2,2' },
    { player: 1, type: 'flying', hex: ROW[1] },
    { player: 1, type: 'armour', hex: ROW[4] },
  ] });
  const s2 = E.apply(s, { type: 'capture', unitId: 'p0-light', targetId: 'p1-flying' });
  cannotStep(s2, 'p0-hero', '-1,2');
  step(s2, 'p0-light', ROW[2]); // the Rifle Squad still has its 1 movement
});

// ---------------------------------------------------------------- merging

test('stepping onto one of your units merges them into one new unit', () => {
  const s = scenario({ units: [{ player: 0, type: 'light', hex: ROW[0] }, { player: 0, type: 'armour', hex: ROW[1] }] });
  const s2 = merge(s, 'p0-light', ROW[1], 'p0-armour');
  ok(!s2.units['p0-light'] && !s2.units['p0-armour'], 'the two units are gone');
  const m = s2.units['p0-light+armour'];
  eq([m.hex, m.player, R.units[m.type].name], [ROW[1], 0, 'Infantry Fighting Vehicle']);
  eq([E.stat(s2, m.id, 'attack'), E.stat(s2, m.id, 'defence')], [1, 3]);
});

test('merging ends the move, even with movement left', () => {
  const s = scenario({ units: [{ player: 0, type: M2, hex: ROW[0] }, { player: 0, type: 'armour', hex: ROW[1] }] });
  const s2 = merge(s, `p0-${M2}`, ROW[1], 'p0-armour');
  ok(s2.turnState.moveDone);
  eq(s2.turnState.move.unitId, 'p0-light+armour+flying');
});

test('a unit can walk up to another of yours and merge in one move', () => {
  const s = scenario({ units: [{ player: 0, type: M2, hex: ROW[0] }, { player: 0, type: 'hero', hex: ROW[2] }] });
  const s2 = merge(step(s, `p0-${M2}`, ROW[1]), `p0-${M2}`, ROW[2], 'p0-hero');
  eq(s2.units['p0-light+flying+hero'].hex, ROW[2]);
  ok(E.moveReach(s, `p0-${M2}`).merges.includes('p0-hero'), 'moveReach lists the merge');
});

test('merging needs an adjacent unit and movement to get there', () => {
  const s = scenario({
    terrain: { [ROW[0]]: ['minefield', 0] },
    units: [{ player: 0, type: 'light', hex: ROW[0] }, { player: 0, type: 'armour', hex: ROW[1] }, { player: 0, type: 'hero', hex: ROW[3] }],
  });
  illegal(s, { type: 'step', unitId: 'p0-light', to: ROW[1], merge: 'p0-armour' }); // 0 movement on the minefield
  illegal(s, { type: 'step', unitId: 'p0-armour', to: ROW[3], merge: 'p0-hero' }); // two hexes away
});

test('cannot merge with an enemy unit', () => {
  const s = scenario({ units: [{ player: 0, type: 'flying', hex: ROW[0] }, { player: 1, type: 'armour', hex: ROW[1] }] });
  illegal(s, { type: 'step', unitId: 'p0-flying', to: ROW[1], merge: 'p1-armour' });
});

test('units only merge if they share no base unit', () => {
  ok(R.logic.canMerge(['light', 'armour'], ['range', 'flying']));
  ok(!R.logic.canMerge(['light', 'armour'], ['armour', 'range']));
});

test('two of your units sharing a hex can merge where they stand, even with 0 movement', () => {
  const s = scenario({
    terrain: { [ROW[2]]: ['minefield', 0] },
    units: [
      { player: 0, type: 'flying', hex: ROW[2] },
      { player: 0, type: 'hero', hex: ROW[2] },
      { player: 0, type: 'light', hex: ROW[0] },
    ],
  });
  eq(E.mergeTargets(s, 'p0-hero'), ['p0-flying']);
  const s2 = E.apply(s, { type: 'merge', unitId: 'p0-hero', targetId: 'p0-flying' });
  eq(R.units[s2.units['p0-flying+hero'].type].name, 'Attack Helicopter');
  ok(s2.turnState.moveDone);
  cannotStep(s2, 'p0-light', ROW[1]);
});

test('merging onto a hex can capture an enemy drone there first', () => {
  const s = scenario({ units: [
    { player: 0, type: 'light', hex: ROW[1] },
    { player: 0, type: 'hero', hex: ROW[2] },
    { player: 1, type: 'flying', hex: ROW[2] },
    { player: 1, type: 'armour', hex: ROW[4] },
  ] });
  const s2 = merge(s, 'p0-light', ROW[2], 'p0-hero');
  ok(!alive(s2, 'p1-flying'));
  ok(alive(s2, 'p0-light+hero'));
});

test('merged units can merge again, up to the Nuke', () => {
  let s = scenario({ units: [
    { player: 0, type: 'light', hex: ROW[0] },
    { player: 0, type: 'armour', hex: ROW[1] },
    { player: 0, type: 'range', hex: ROW[2] },
    { player: 0, type: 'flying+hero', hex: ROW[3] },
  ] });
  const next = (st) => E.apply(st, { type: 'endTurn' });
  s = next(next(merge(s, 'p0-light', ROW[1], 'p0-armour')));
  s = next(next(merge(s, 'p0-light+armour', ROW[2], 'p0-range')));
  eq(R.units[s.units['p0-light+armour+range'].type].name, 'Assault Trooper');
  s = merge(s, 'p0-light+armour+range', ROW[3], 'p0-flying+hero');
  const nuke = s.units['p0-light+armour+range+flying+hero'];
  eq([R.units[nuke.type].name, E.stat(s, nuke.id, 'attack'), E.stat(s, nuke.id, 'defence')], ['Nuke', 5, 5]);
  eq(E.unitsOf(s, 0).length, 1);
});

// ---------------------------------------------------------------- splitting

test('part of a merged unit can split off onto an adjacent hex', () => {
  const s = scenario({ units: [{ player: 0, type: 'light+armour', hex: ROW[1] }] });
  const s2 = split(s, 'p0-light+armour', ['light'], ROW[2]);
  ok(!s2.units['p0-light+armour']);
  eq(s2.units['p0-light'].hex, ROW[2]);
  eq(s2.units['p0-armour'].hex, ROW[1]);
  ok(s2.turnState.moveDone, 'the Rifle Squad has used its 1 movement');
});

test('the part that splits off moves on with its own movement', () => {
  const s = scenario({ units: [{ player: 0, type: 'armour+flying', hex: ROW[0] }] });
  const s2 = split(s, 'p0-armour+flying', ['flying'], ROW[1]);
  ok(!s2.turnState.moveDone);
  eq(s2.turnState.move.unitId, 'p0-flying');
  cannotStep(s2, 'p0-armour', '-2,1'); // the part left behind can't move this turn
  ok(step(s2, 'p0-flying', ROW[2]).turnState.moveDone);
  const twoAway = Hex.all(R.boardRadius).filter((k) => k !== ROW[0] && Hex.distance(k, ROW[0]) <= 2);
  eq(E.reachable(s, 'p0-armour+flying', { parts: ['flying'] }).sort(), twoAway.sort());
});

test('a split needs some parts to leave and some to stay, and starts the move', () => {
  const s = scenario({ units: [{ player: 0, type: 'light+armour+hero', hex: ROW[1] }] });
  illegal(s, { type: 'split', unitId: 'p0-light+armour+hero', parts: ['light', 'armour', 'hero'], to: ROW[2] });
  illegal(s, { type: 'split', unitId: 'p0-light+armour+hero', parts: [], to: ROW[2] });
  illegal(s, { type: 'split', unitId: 'p0-light+armour+hero', parts: ['range'], to: ROW[2] });
  const s2 = split(s, 'p0-light+armour+hero', ['light', 'hero'], ROW[2]);
  eq(R.units[s2.units['p0-light+hero'].type].name, 'Scout');
  eq(R.units[s2.units['p0-armour'].type].name, 'Armoured Carrier');
  const moved = step(scenario({ units: [{ player: 0, type: 'light+armour+hero', hex: ROW[0] }, { player: 0, type: 'range', hex: ROW[4] }] }), 'p0-range', ROW[3]);
  illegal(moved, { type: 'split', unitId: 'p0-light+armour+hero', parts: ['light'], to: ROW[1] });
});

test('a split-off part can capture, and can merge into another unit', () => {
  const s = scenario({ units: [
    { player: 0, type: 'armour+range', hex: ROW[1] },
    { player: 0, type: 'light', hex: '-1,1' },
    { player: 1, type: 'flying', hex: ROW[2] },
    { player: 1, type: 'hero', hex: ROW[4] },
  ] });
  ok(!alive(split(s, 'p0-armour+range', ['range'], ROW[2]), 'p1-flying'));
  const s2 = split(s, 'p0-armour+range', ['range'], '-1,1', { merge: 'p0-light' });
  eq(R.units[s2.units['p0-light+range'].type].name, 'Machine Gunner');
  eq(s2.units['p0-armour'].hex, ROW[1]);
});

// ---------------------------------------------------------------- winning

test('Nuclear Deterrence: when both sides have a Nuke, the game ends in a stalemate', () => {
  const s = scenario({ units: [
    { player: 0, type: 'light+armour+range+flying', hex: ROW[1] },
    { player: 0, type: 'hero', hex: ROW[2] },
    { player: 1, type: NUKE, hex: '2,-2' },
  ] });
  const s2 = merge(s, 'p0-light+armour+range+flying', ROW[2], 'p0-hero');
  ok(Object.values(s2.units).some((u) => !u.dead && u.player === 0 && u.type === NUKE), 'Blue merged a Nuke');
  eq([s2.phase, s2.winner], ['over', null]);
  ok(/Nuke/.test(s2.winReason), s2.winReason);
  illegal(s2, { type: 'endTurn' });
});

test('one Nuke on the board alone is not a stalemate', () => {
  const s = scenario({ units: [
    { player: 0, type: 'light+armour+range+flying', hex: ROW[1] },
    { player: 0, type: 'hero', hex: ROW[2] },
    { player: 1, type: 'hero', hex: '2,-2' },
  ] });
  eq(merge(s, 'p0-light+armour+range+flying', ROW[2], 'p0-hero').phase, 'battle');
});

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
    units: [{ player: 0, type: M2, hex: ROW[0] }, { player: 1, type: 'hero', hex: ROW[4] }],
  });
  eq(step(s, `p0-${M2}`, ROW[1]).winner, 0);
});

test('a Recon Drone can\'t take the capital', () => {
  const s = scenario({
    terrain: { [ROW[2]]: ['capital', 1] },
    units: [{ player: 0, type: 'flying', hex: ROW[1] }, { player: 1, type: 'hero', hex: ROW[4] }],
  });
  const s2 = step(s, 'p0-flying', ROW[2]);
  eq([s2.phase, s2.winner], ['battle', null]);
});

test('an enemy unit left on the capital blocks the win', () => {
  const s = scenario({
    terrain: { [ROW[2]]: ['capital', 1] },
    units: [{ player: 0, type: 'light', hex: ROW[1] }, { player: 1, type: 'flying', hex: ROW[2] }, { player: 1, type: 'hero', hex: '2,-2' }],
  });
  const s2 = share(s, 'p0-light', ROW[2]);
  eq([s2.phase, s2.winner], ['battle', null]);
  eq(step(s, 'p0-light', ROW[2]).winner, 0, 'capturing the drone instead wins');
});

test('your own Recon Drone on the capital does not block the win', () => {
  const s = scenario({
    terrain: { [ROW[2]]: ['capital', 1] },
    units: [
      { player: 0, type: 'flying', hex: ROW[2] },
      { player: 0, type: 'light', hex: ROW[1] },
      { player: 1, type: 'hero', hex: ROW[4] },
    ],
  });
  eq(step(s, 'p0-light', ROW[2]).winner, 0);
});

test('merging on the enemy capital wins', () => {
  const s = scenario({
    terrain: { [ROW[2]]: ['capital', 1] },
    units: [
      { player: 0, type: 'flying', hex: ROW[2] },
      { player: 0, type: 'light', hex: ROW[1] },
      { player: 1, type: 'hero', hex: ROW[4] },
    ],
  });
  const s2 = merge(s, 'p0-light', ROW[2], 'p0-flying');
  eq(s2.winner, 0);
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

// Every legal action for whoever is to play (steps, captures, merges, splits, end turn).
function allActions(s) {
  const acts = [{ type: 'endTurn' }];
  for (const u of E.unitsOf(s, s.current)) {
    for (const k of Hex.neighbors(u.hex, R.boardRadius)) {
      for (const capture of [true, false]) acts.push({ type: 'step', unitId: u.id, to: k, capture });
      for (const o of E.unitsAt(s, k)) if (o.player === u.player) acts.push({ type: 'step', unitId: u.id, to: k, merge: o.id });
      for (const parts of E.splitChoices(u.type)) acts.push({ type: 'split', unitId: u.id, parts, to: k });
    }
    for (const t of E.captureTargets(s, u.id)) acts.push({ type: 'capture', unitId: u.id, targetId: t });
    for (const t of E.mergeTargets(s, u.id)) acts.push({ type: 'merge', unitId: u.id, targetId: t });
  }
  return acts.filter((x) => E.isLegal(s, x));
}

test('a random full game with merges and splits never breaks the rules engine', () => {
  let merges = 0;
  let splits = 0;
  for (let g = 0; g < 20; g++) {
    let s = E.newGame();
    while (s.phase === 'terrain' || s.phase === 'units') {
      const opts = E.legalPlacements(s);
      s = E.apply(s, opts[Math.floor(Math.random() * opts.length)]);
    }
    for (let i = 0; i < 200 && s.phase === 'battle'; i++) {
      const acts = allActions(s);
      // Favour merges and splits so they get exercised.
      const special = acts.filter((x) => x.merge || x.type === 'merge' || x.type === 'split');
      const pick = special.length && Math.random() < 0.4 ? special : acts;
      const act = pick[Math.floor(Math.random() * pick.length)];
      if (act.merge || act.type === 'merge') merges++;
      if (act.type === 'split') splits++;
      s = E.apply(s, act);
      for (const k of Object.keys(s.hexes)) {
        ok(E.unitsAt(s, k).length <= 2, `hex ${k} holds ${E.unitsAt(s, k).length} units`);
      }
      for (const p of [0, 1]) {
        const parts = Object.values(s.units).filter((u) => u.player === p).flatMap((u) => R.units[u.type].parts);
        eq(parts.slice().sort(), R.base.slice().sort(), `${R.players[p].name}'s base units, alive or captured`);
      }
    }
  }
  ok(merges > 0 && splits > 0, `exercised ${merges} merges and ${splits} splits`);
});
