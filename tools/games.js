// Games played on the website: fetches them from GoatCounter (js/stats.js sends them),
// replays each one through the engine and keeps them in an archive. Run with Bun:
//
//   GOATCOUNTER_TOKEN=… bun tools/games.js [--out data/games.json]
//
// The token is an API token from the GoatCounter site's settings, allowed to read statistics.
// The site's address comes from the script tag in index.html. Prints how many games there were
// for each way of playing and how they ended.
//
// --out adds new and changed games to that archive, which stats.html and the replay viewer
// (index.html?replay=<id>) read. A game is replayed once, when it arrives, under the rules of
// the day, so what it says about how the game went stays true after the rules change. Each
// game: { id, n, date, mode, seat, undos, rules, moves, data } (data: the record as sent, see
// stats.js decode), plus, when it replayed: { phase, winner, turn, reason, merged } (merged:
// the merged unit types each player made).
// The GitHub Action in .github/workflows/games.yml runs it every day.
import { existsSync, readFileSync, writeFileSync } from 'fs';
import R from '../js/rules.js';
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
    // GoatCounter's API answers 404 without the Content-Type, even on a GET.
    const res = await fetch(`${site}/api/v0/paths?limit=200&after=${after}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`GoatCounter said ${res.status}: ${await res.text()}`);
    const { paths: page, more } = await res.json();
    all.push(...page.map((p) => p.path));
    if (!more || !page.length) return all;
    after = page[page.length - 1].id;
  }
}

// How a game went. Throws if a move breaks the rules.
function replay(batches) {
  let s = E.newGame();
  const merged = [new Set(), new Set()];
  for (const b of batches) {
    for (const a of b.actions) {
      s = E.apply(s, a);
      for (const u of Object.values(s.units)) if (!u.dead && R.units[u.type].tier > 1) merged[u.player].add(u.type);
    }
  }
  return { phase: s.phase, winner: s.winner, turn: s.turn, reason: s.winReason, merged: merged.map((m) => [...m]) };
}

const archive = new Map((out && existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : []).map((g) => [g.id, g]));
let added = 0;
let broken = 0;
for (const { id, n, data } of Stats.join(await paths())) {
  if (archive.has(id) && archive.get(id).n >= n) continue;
  let rec;
  try {
    rec = await Stats.decode(data);
  } catch (e) {
    broken += 1;
    continue;
  }
  const g = { id, n, date: rec.date, mode: rec.mode, seat: rec.seat, undos: rec.undos, rules: rec.rules, moves: rec.batches.length, data };
  if (rec.v === Stats.FORMAT && rec.rules === Stats.rulesId) {
    try {
      Object.assign(g, replay(rec.batches));
    } catch (e) {
      broken += 1; // breaks the rules: made up, or sent by a page with other rules
      continue;
    }
  }
  archive.set(id, g);
  added += 1;
}

const games = [...archive.values()].sort((a, b) => (a.date + a.id < b.date + b.id ? -1 : 1));
const name = (p) => R.players[p].name;
for (const mode of [...new Set(games.map((g) => g.mode))].sort()) {
  const all = games.filter((g) => g.mode === mode);
  const over = all.filter((g) => g.phase === 'over');
  const ends = mode.startsWith('vs-')
    ? `player won ${over.filter((g) => g.winner === g.seat).length}, computer won ${over.filter((g) => g.winner === 1 - g.seat).length}`
    : `${name(0)} won ${over.filter((g) => g.winner === 0).length}, ${name(1)} won ${over.filter((g) => g.winner === 1).length}`;
  const turns = over.length ? (over.reduce((t, g) => t + g.turn, 0) / over.length).toFixed(1) : '-';
  console.log(`${mode}: ${all.length} games, ${over.length} finished (${ends}, ${over.filter((g) => g.winner === null).length} stalemates, `
    + `average ${turns} turns)`);
}
const unknown = games.filter((g) => !g.phase).length;
console.log(`${games.length} games${unknown ? ` (${unknown} played under other rules, not replayed)` : ''}, ${added} new or changed`
  + `${broken ? `, ${broken} that wouldn't replay` : ''}.`);
if (out) {
  // One game per line, so each day's change is a short diff.
  writeFileSync(out, `[\n${games.map((g) => JSON.stringify(g)).join(',\n')}\n]\n`);
  console.log(`Wrote ${out}.`);
}
