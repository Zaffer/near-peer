/*
 * Near Peer — computer player tests. Open tests.html to run them.
 * The AI searches with its own fast model of the battle (js/ai-sim.js). These
 * tests check that model against the engine on random games, so a rule change
 * the model misses fails here, and that the AI only ever plays legal moves.
 */
import * as E from '../js/engine.js';
import * as S from '../js/ai-sim.js';
import * as AI from '../js/ai.js';

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

// A seeded random number generator, so a failure can be repeated.
function rng(seed) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}
const pick = (list, rand) => list[Math.floor(rand() * list.length)];

// The model's key for an engine state at the end of a turn (cur is whoever plays next,
// or the other player when the game is over).
function engineKey(es) {
  const s = S.fromEngine(es);
  return S.keyOf(Object.assign(s, { cur: es.phase === 'over' ? 1 - es.current : es.current }));
}

// Every way the player to move can end their turn, found by trying every engine action.
function engineOutcomes(es) {
  const keys = new Set();
  const seen = new Set();
  const visit = (s) => {
    keys.add(engineKey(s.phase === 'over' ? s : E.apply(s, { type: 'endTurn' })));
    if (s.phase === 'over' || s.turnState.moveDone) return;
    const sig = JSON.stringify([s.units, s.turnState]);
    if (seen.has(sig)) return;
    seen.add(sig);
    const units = E.unitsOf(s, s.current);
    const tries = [];
    for (const u of units) {
      for (const o of E.unitsAt(s, u.hex)) {
        tries.push({ type: 'merge', unitId: u.id, targetId: o.id }, { type: 'capture', unitId: u.id, targetId: o.id });
      }
      const firsts = [{ type: 'step', unitId: u.id }];
      if (!s.turnState.move) for (const parts of E.splitChoices(u.type)) firsts.push({ type: 'split', unitId: u.id, parts });
      for (const n of S.NB[S.INDEX[u.hex]].map((i) => S.KEYS[i])) {
        for (const f of firsts) {
          tries.push(Object.assign({ to: n }, f), Object.assign({ to: n, capture: false }, f));
          for (const o of E.unitsAt(s, n)) tries.push(Object.assign({ to: n, merge: o.id }, f));
        }
      }
    }
    for (const a of tries) {
      const next = E.tryApply(s, a);
      if (next) visit(next);
    }
  };
  visit(Object.assign({}, es, { log: [] }));
  return keys;
}

// A random battle: random build, then some random turns.
function randomBattle(rand, turns) {
  let s = E.newGame();
  while (s.phase !== 'battle') s = E.apply(s, pick(E.legalPlacements(s), rand));
  for (let i = 0; i < turns && s.phase === 'battle'; i++) {
    const b = S.board(s);
    const t = pick(S.turns(b, S.fromEngine(s)), rand);
    for (const a of t.actions) s = E.apply(s, a);
  }
  return s;
}

test('the AI model finds exactly the engine\'s turns, and its actions replay in the engine', () => {
  const rand = rng(7);
  let checked = 0;
  for (let g = 0; g < 12; g++) {
    for (const depth of [0, 6, 14, 24]) {
      const es = randomBattle(rand, depth);
      if (es.phase !== 'battle') continue;
      const b = S.board(es);
      const mine = S.turns(b, S.fromEngine(es));
      const want = engineOutcomes(es);
      const got = new Set(mine.map((t) => S.keyOf(t.s)));
      for (const k of want) ok(got.has(k), `model misses a turn (game ${g}, ${depth} turns in): ${k}`);
      for (const t of mine) {
        let s = es;
        for (const a of t.actions) s = E.apply(s, a);
        ok(engineKey(s) === S.keyOf(t.s), `model's actions end somewhere else: ${JSON.stringify(t.actions)}`);
      }
      ok(got.size === want.size, `model has ${got.size} turns, engine ${want.size}`);
      checked++;
    }
  }
  ok(checked > 20, `only ${checked} positions checked`);
});

test('the AI plays a whole game against itself with only legal moves', () => {
  let s = E.newGame();
  for (let i = 0; i < 200 && s.phase !== 'over'; i++) {
    const actions = AI.choose(s, { level: 'hard', timeMs: 5, seed: i, weights: { buildMs: 5 } });
    ok(actions.length > 0, 'no actions');
    for (const a of actions) s = E.apply(s, a);
  }
});

test('the AI takes a win on the spot', () => {
  // Blue's Rifle Squad is next to Red's capital, with nothing on it.
  const s = E.scenario({
    terrain: { '0,-2': ['capital', 1], '0,2': ['capital', 0] },
    units: [
      { player: 0, type: 'light', hex: '0,-1' }, { player: 0, type: 'armour', hex: '0,2' },
      { player: 1, type: 'hero', hex: '2,-2' }, { player: 1, type: 'armour', hex: '-2,0' },
    ],
  });
  const actions = AI.choose(s, { level: 'hard', timeMs: 100 });
  let next = s;
  for (const a of actions) next = E.apply(next, a);
  ok(next.phase === 'over' && next.winner === 0, `expected a win, got ${JSON.stringify(actions)}`);
});

test('the AI stops a win next turn', () => {
  // Red's Commander is one step from Blue's empty capital; Blue must block or capture it.
  const s = E.scenario({
    terrain: { '0,-2': ['capital', 1], '0,2': ['capital', 0] },
    units: [
      { player: 0, type: 'armour', hex: '1,1' }, { player: 0, type: 'light', hex: '-2,1' },
      { player: 1, type: 'hero', hex: '0,1' }, { player: 1, type: 'armour', hex: '0,-2' },
    ],
  });
  const actions = AI.choose(s, { level: 'hard', timeMs: 200 });
  let next = s;
  for (const a of actions) next = E.apply(next, a);
  const replies = S.turns(S.board(next), S.fromEngine(next));
  ok(!replies.some((t) => t.s.winner === 1), `Red can still win after ${JSON.stringify(actions)}`);
});
