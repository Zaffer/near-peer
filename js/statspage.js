/*
 * Near Peer — the statistics page (stats.html): how the games played on the website went.
 *
 * Reads data/games.json, which tools/games.js keeps up to date: one entry per game,
 * with how it went worked out when it arrived. Everything is drawn as plain HTML (tiles,
 * bars, a list of games), and each game links to its replay (index.html?replay=<id>).
 * Hovering or focusing a bar shows its number; the list of games has every number too.
 */
import R from './rules.js';
import { LEVELS } from './ai.js';
import { rulesId } from './stats.js';

const $ = (id) => document.getElementById(id);

function h(tag, props, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    n.append(kid instanceof Node ? kid : String(kid));
  }
  return n;
}

const name = (p) => R.players[p].name;
const level = (g) => (/^vs-(.+)$/.exec(g.mode) || [])[1] || null;
const MODES = [...Object.keys(LEVELS).map((k) => `vs-${k}`), 'online', 'local'];
const modeName = (mode) => {
  const k = (/^vs-(.+)$/.exec(mode) || [])[1];
  return k ? `vs ${LEVELS[k] ? LEVELS[k].name : k}` : mode === 'online' ? 'Online' : 'One computer';
};
const modesIn = (games) => [...new Set(games.map((g) => g.mode))]
  .sort((a, b) => (MODES.indexOf(a) + 1 || 99) - (MODES.indexOf(b) + 1 || 99));
const over = (g) => g.phase === 'over';
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// "Player won (Red)", "Blue won", "Unfinished", … for one game.
function result(g) {
  if (!g.phase) return 'Played under older rules';
  if (!over(g)) return 'Unfinished';
  if (g.winner === null) return 'Stalemate';
  if (level(g)) return `${g.winner === g.seat ? 'Player' : 'Computer'} won (${name(g.winner)})`;
  return `${name(g.winner)} won`;
}

// ---------------------------------------------------------------- tooltip

// A mark with a number: the tooltip shows `value` (strong) then `label`, on hover and on focus.
const mark = (value, label, extra) => Object.assign({ 'data-value': value, 'data-label': label, tabindex: 0 }, extra);

const tip = $('tip');
function showTip(el, x, y) {
  tip.replaceChildren(h('b', {}, el.dataset.value), el.dataset.label);
  tip.hidden = false;
  const w = tip.offsetWidth;
  const ht = tip.offsetHeight;
  tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x + 12))}px`;
  tip.style.top = `${y + ht + 20 > innerHeight ? y - ht - 12 : y + 14}px`;
}
document.addEventListener('pointermove', (e) => {
  const el = e.target.closest('[data-value]');
  if (el) showTip(el, e.clientX, e.clientY);
  else tip.hidden = true;
});
document.addEventListener('focusin', (e) => {
  const el = e.target.closest('[data-value]');
  if (!el) return;
  const r = el.getBoundingClientRect();
  showTip(el, r.left, r.bottom - 6);
});
document.addEventListener('focusout', () => { tip.hidden = true; });
addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });

// ---------------------------------------------------------------- parts of the page

const card = (title, hint, ...body) => h('section', { class: 'card' }, h('h2', {}, title), hint ? h('p', { class: 'hint' }, hint) : null, body);
const tile = (big, small) => h('div', { class: 'tile' }, h('b', {}, big), h('span', {}, small));

function tiles(games) {
  const done = games.filter(over);
  const vs = done.filter(level);
  const mean = done.length ? (sum(done.map((g) => g.turn)) / done.length).toFixed(1) : '–';
  return h('div', { class: 'tiles' },
    tile(games.length, 'games recorded'),
    tile(done.length, `played to the end (${pct(done.length, games.length)})`),
    tile(pct(vs.filter((g) => g.winner === g.seat).length, vs.length), `of ${plural(vs.length, 'finished game')} against the computer won by the player`),
    tile(mean, 'turns in a finished game, on average'));
}

// Columns from a baseline. cols: [{ n, label }], axis: [left text, right text].
function columns(cols, axis, unit) {
  const max = Math.max(1, ...cols.map((c) => c.n));
  return [
    h('div', { class: 'ymax' }, `${max} ${unit}`),
    h('div', { class: 'cols' }, cols.map((c) => h('div', mark(plural(c.n, unit.replace(/s$/, '')), c.label),
      c.n ? h('i', { style: `height:${(100 * c.n) / max}%` }) : null))),
    h('div', { class: 'axis' }, h('span', {}, axis[0]), h('span', {}, axis[1])),
  ];
}

// Games per day, or per week once there's more than three months of them.
function perDay(games) {
  const day = (d) => new Date(`${d}T00:00:00Z`);
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const dates = games.map((g) => g.date).filter(Boolean).sort();
  const first = day(dates[0]).getTime();
  const last = day(dates[dates.length - 1]).getTime();
  const weekly = (last - first) / 864e5 > 90;
  const step = (weekly ? 7 : 1) * 864e5;
  const counts = new Map();
  for (const d of dates) {
    const k = first + Math.floor((day(d).getTime() - first) / step) * step;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const cols = [];
  for (let t = first; t <= last; t += step) cols.push({ n: counts.get(t) || 0, label: weekly ? `week of ${iso(t)}` : iso(t) });
  return card(weekly ? 'Games per week' : 'Games per day', null, columns(cols, [iso(first), iso(last)], 'games'));
}

// One row per group, a bar split by result. segs: [{ n, name, c }] in a fixed order.
function splitRows(rows, legend) {
  return [
    h('div', { class: 'legend' }, legend.map(([text, c]) => h('span', { style: `--c:${c}` }, text))),
    h('div', { class: 'split' }, rows.map(({ label, sub, segs }) => {
      const total = sum(segs.map((s) => s.n));
      return [
        h('div', { class: 'label' }, label, h('small', {}, sub)),
        total ? h('div', { class: 'bar' }, segs.filter((s) => s.n).map((s) => h('div',
          mark(`${s.n} (${pct(s.n, total)})`, `${s.name} · ${label}`, { style: `flex:${s.n};--c:${s.c}` }),
          s.n / total >= 0.1 ? s.n : null)))
          : h('div', { class: 'muted' }, 'No finished games yet'),
      ];
    })),
  ];
}

function versus(games) {
  const vs = games.filter(level);
  if (!vs.length) return null;
  const rows = modesIn(vs).map((mode) => {
    const all = vs.filter((g) => g.mode === mode);
    const done = all.filter(over);
    return {
      label: modeName(mode),
      sub: `${done.length} finished · ${all.length - done.length} unfinished`,
      segs: [
        { n: done.filter((g) => g.winner === g.seat).length, name: 'Player won', c: 'var(--player)' },
        { n: done.filter((g) => g.winner === 1 - g.seat).length, name: 'Computer won', c: 'var(--computer)' },
        { n: done.filter((g) => g.winner === null).length, name: 'Stalemate', c: 'var(--even)' },
      ],
    };
  });
  return card('Against the computer', 'How the finished games against each level went.',
    splitRows(rows, [['Player won', 'var(--player)'], ['Computer won', 'var(--computer)'], ['Stalemate', 'var(--even)']]));
}

function sides(games) {
  const rows = modesIn(games).map((mode) => {
    const done = games.filter((g) => g.mode === mode && over(g));
    return {
      label: modeName(mode),
      sub: plural(done.length, 'finished game'),
      segs: [
        { n: done.filter((g) => g.winner === 0).length, name: `${name(0)} won`, c: R.players[0].color },
        { n: done.filter((g) => g.winner === 1).length, name: `${name(1)} won`, c: R.players[1].color },
        { n: done.filter((g) => g.winner === null).length, name: 'Stalemate', c: 'var(--even)' },
      ],
    };
  });
  return card(`${name(0)} or ${name(1)}`, `Which side wins. ${name(R.firstPlayer)} moves first.`,
    splitRows(rows, [[`${name(0)} won`, R.players[0].color], [`${name(1)} won`, R.players[1].color], ['Stalemate', 'var(--even)']]));
}

function lengths(games) {
  const done = games.filter(over);
  if (!done.length) return null;
  const max = Math.max(...done.map((g) => g.turn));
  const size = Math.max(1, Math.ceil((max + 1) / 30));
  const cols = [];
  for (let lo = 0; lo <= max; lo += size) {
    const hi = lo + size - 1;
    cols.push({ n: done.filter((g) => g.turn >= lo && g.turn <= hi).length, label: size === 1 ? `ended on turn ${lo}` : `ended on turns ${lo}–${hi}` });
  }
  return card('How long games last', 'Finished games by the turn they ended on (turn 0 is the build).', columns(cols, ['turn 0', `turn ${max}`], 'games'));
}

// A ranked list: [{ label, n }], biggest first, as a share of `of`.
function ranked(items, of, unit) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return h('div', { class: 'ranked' }, items.map((i) => [
    h('div', {}, i.label),
    h('div', mark(`${i.n} (${pct(i.n, of)})`, `${i.label}, ${unit}`, { class: 'track' }), h('i', { style: `width:${(100 * i.n) / max}%` })),
    h('div', { class: 'n' }, i.n),
  ]));
}

function endings(games) {
  const done = games.filter(over);
  if (!done.length) return null;
  // "took the Blue capital" and "took the Red capital" are the same ending.
  const names = new RegExp(`\\b(${R.players.map((p) => p.name).join('|')})\\b`, 'g');
  const count = new Map();
  for (const g of done) {
    const why = g.winner === null ? `Stalemate: ${g.reason}` : g.reason.replace(names, 'enemy');
    const text = why.charAt(0).toUpperCase() + why.slice(1);
    count.set(text, (count.get(text) || 0) + 1);
  }
  const items = [...count].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  return card('How games end', null, ranked(items, done.length, 'of finished games'));
}

function merges(games) {
  const played = games.filter((g) => g.merged && (g.phase === 'battle' || over(g)));
  const count = new Map();
  for (const g of played) for (const type of new Set(g.merged.flat())) count.set(type, (count.get(type) || 0) + 1);
  if (!count.size) return null;
  const items = [...count].map(([type, n]) => ({ label: R.units[type] ? R.units[type].name : type, n }))
    .sort((a, b) => b.n - a.n).slice(0, 12);
  return card('Merged units made', `In how many of the ${plural(played.length, 'game')} that reached the battle someone made each one.`,
    ranked(items, played.length, 'of games'));
}

// The list of games, newest first, with filters and a replay link for each.
function list(games) {
  const shown = { mode: 'all', end: 'all', count: 30 };
  const body = h('tbody');
  const more = h('button', { class: 'more', onclick: () => { shown.count += 30; draw(); } });
  const pick = (key, options) => h('select', { 'aria-label': key, onchange: (e) => { shown[key] = e.target.value; shown.count = 30; draw(); } },
    options.map(([v, text]) => h('option', { value: v }, text)));
  const newest = games.slice().sort((a, b) => (a.date + a.id < b.date + b.id ? 1 : -1));
  function draw() {
    const rows = newest.filter((g) => (shown.mode === 'all' || g.mode === shown.mode)
      && (shown.end === 'all' || (shown.end === 'over') === over(g)));
    body.replaceChildren(...rows.slice(0, shown.count).map((g) => h('tr', {},
      h('td', {}, g.date),
      h('td', {}, modeName(g.mode), level(g) ? h('span', { class: 'muted' }, `, as ${name(g.seat)}`) : null),
      h('td', {}, result(g)),
      h('td', { class: 'num' }, g.phase ? g.turn : '–'),
      h('td', { class: 'num moves' }, g.moves),
      h('td', {}, g.rules === rulesId ? h('a', { class: 'button', href: `./?replay=${encodeURIComponent(g.id)}` }, 'Watch') : h('span', { class: 'muted' }, 'Older rules')))));
    more.hidden = rows.length <= shown.count;
    more.textContent = `Show more (${rows.length - shown.count} left)`;
  }
  draw();
  return card('Every game', 'Watch any of them on the board, move by move.',
    h('div', { class: 'filters' },
      pick('mode', [['all', 'All ways of playing'], ...modesIn(games).map((m) => [m, modeName(m)])]),
      pick('end', [['all', 'Finished or not'], ['over', 'Finished'], ['open', 'Unfinished']])),
    h('div', { class: 'table-wrap' }, h('table', { class: 'games' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Game'), h('th', {}, 'Result'),
        h('th', { class: 'num' }, 'Turns'), h('th', { class: 'num moves' }, 'Moves'), h('th', {}, 'Replay'))),
      body)),
    more);
}

// ---------------------------------------------------------------- the page

async function main() {
  const page = $('stats');
  let games;
  try {
    const res = await fetch('data/games.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    games = await res.json();
  } catch (e) {
    $('about').textContent = 'The record of games played didn\'t load.';
    return;
  }
  if (!games.length) {
    $('about').textContent = '';
    page.append(h('section', { class: 'card empty' }, h('p', {}, 'No games recorded yet.'),
      h('p', { class: 'hint' }, 'Games played on this site show up here the day after they\'re played.')));
    return;
  }
  const dates = games.map((g) => g.date).filter(Boolean).sort();
  $('about').textContent = `${plural(games.length, 'game')} from ${dates[0]} to ${dates[dates.length - 1]} · updated daily · recorded anonymously`;
  page.append(
    tiles(games),
    h('div', { class: 'grid2' }, perDay(games), lengths(games)),
    h('div', { class: 'grid2' }, versus(games), sides(games)),
    h('div', { class: 'grid2' }, endings(games), merges(games)),
    list(games));
}

main();
