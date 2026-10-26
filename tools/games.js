// Games played on the website: fetches them from GoatCounter (js/stats.js sends them) and
// replays each one through the engine. Run with Bun:
//
//   GOATCOUNTER_TOKEN=… bun tools/games.js [--out games.json]
//
// The token is an API token from the GoatCounter site's settings, allowed to read statistics.
// The site's address comes from the script tag in index.html. Prints how many games there were
// for each way of playing and how they ended. --out writes every game that replayed, as
// { id, date, mode, seat, undos, batches, phase, winner, turn, reason }, e.g. for tools/arena.js.
// Games played under other rules (a different rules.js) are counted but can't be replayed.
import { readFileSync, writeFileSync } from 'fs';
import * as E from '../js/engine.js';
import * as Stats from '../js/stats.js';

const token = process.env.GOATCOUNTER_TOKEN;
if (!token) {
  console.error('Set GOATCOUNTER_TOKEN to an API token from the GoatCounter site (Settings → API).');
  process.exit(1);
}
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const site = /data-goatcounter="([^"]+)\/count"/.exec(html)[1];

// Every event name on the site, 200 at a time.
async function paths() {
  const all = [];
  for (let after = 0; ;) {
    const res = await fetch(`${site}/api/v0/paths?limit=200&after=${after}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`GoatCounter said ${res.status}: ${await res.text()}`);
    const { paths: page, more } = await res.json();
    all.push(...page.map((p) => p.path));
    if (!more || !page.length) return all;
    after = page[page.length - 1].id;
  }
}

function replay(batches) {
  let s = E.newGame();
  for (const b of batches) for (const a of b.actions) s = E.apply(s, a);
  return s;
}

const games = [];
let otherRules = 0;
let broken = 0;
for (const { id, data } of Stats.join(await paths())) {
  let rec;
  try {
    rec = await Stats.decode(data);
  } catch (e) {
    broken += 1;
    continue;
  }
  if (rec.v !== Stats.FORMAT || rec.rules !== Stats.rulesId) {
    otherRules += 1;
    continue;
  }
  try {
    const s = replay(rec.batches);
    games.push(Object.assign({ id }, rec, { phase: s.phase, winner: s.winner, turn: s.turn, reason: s.winReason }));
  } catch (e) {
    broken += 1; // breaks the rules: made up, or sent by a page with other rules
  }
}

const name = (p) => (p === 0 ? 'Blue' : 'Red');
const modes = [...new Set(games.map((g) => g.mode))].sort();
for (const mode of modes) {
  const all = games.filter((g) => g.mode === mode);
  const over = all.filter((g) => g.phase === 'over');
  const wins = (p) => over.filter((g) => g.winner === p).length;
  const turns = over.length ? (over.reduce((n, g) => n + g.turn, 0) / over.length).toFixed(1) : '-';
  const ends = mode.startsWith('vs-')
    ? `player won ${over.filter((g) => g.winner === g.seat).length}, computer won ${over.filter((g) => g.winner === 1 - g.seat).length}`
    : `${name(0)} won ${wins(0)}, ${name(1)} won ${wins(1)}`;
  console.log(`${mode}: ${all.length} games, ${over.length} finished (${ends}, ${over.filter((g) => g.winner === null).length} stalemates, `
    + `average ${turns} turns), ${all.length - over.length} unfinished`);
}
console.log(`${games.length} games replayed${otherRules ? `, ${otherRules} played under other rules` : ''}${broken ? `, ${broken} that wouldn't replay` : ''}.`);
if (out) {
  writeFileSync(out, JSON.stringify(games));
  console.log(`Wrote them to ${out}.`);
}
