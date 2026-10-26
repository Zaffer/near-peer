/*
 * Near Peer — statistics tests (the game record as GoatCounter event names; no network).
 * Open tests.html to run them.
 */
import * as E from '../js/engine.js';
import * as S from '../js/stats.js';

export const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name: `stats: ${name}`, ok: true });
  } catch (e) {
    results.push({ name: `stats: ${name}`, ok: false, err: e.message });
  }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
const eq = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

// A finished build phase: every placement, first legal one each time, one batch per move.
function built() {
  let s = E.newGame();
  const batches = [];
  while (s.phase !== 'battle') {
    const a = E.legalPlacements(s)[0];
    batches.push({ by: s.current, actions: [a] });
    s = E.apply(s, a);
  }
  return { mode: 'local', undos: 0, batches };
}

await test('a record comes back from its encoding unchanged', async () => {
  const rec = built();
  const data = await S.encode(rec);
  ok(/^[A-Za-z0-9_-]+$/.test(data), 'URL-safe');
  eq(await S.decode(data), rec);
});

await test('a short record is one event name, within GoatCounter\'s 2048 bytes', async () => {
  const data = await S.encode(built());
  const names = S.names('abc', 1, data);
  eq(names.length, 1);
  ok(names[0].length <= 2048, `${names[0].length} bytes`);
  eq(S.join(names), [{ id: 'abc', n: 1, data }]);
});

await test('a long record is split, and joined back in any order', async () => {
  const data = 'x'.repeat(5000);
  const names = S.names('abc', 1, data);
  eq(names.length, 3);
  ok(names.every((n) => n.length <= 2048));
  eq(S.join(names.reverse()), [{ id: 'abc', n: 1, data }]);
});

await test('join keeps the latest send of each game, and skips ones with a part missing', () => {
  const names = [...S.names('a', 1, 'old'), ...S.names('a', 2, 'new'), ...S.names('b', 1, 'y'.repeat(4000)).slice(1), 'game-end', '/'];
  eq(S.join(names), [{ id: 'a', n: 2, data: 'new' }]);
});

await test('the dashboard title says who played and how it ended', () => {
  const s = E.newGame();
  eq(S.title({ mode: 'local' }, s), 'local, unfinished, turn 0');
  eq(S.title({ mode: 'vs-hard', seat: 1 }, Object.assign({}, s, { phase: 'over', winner: 0, turn: 34 })), 'vs-hard as Red, Blue won, turn 34');
});
