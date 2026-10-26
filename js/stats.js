/*
 * Near Peer — anonymous play statistics, through GoatCounter (goatcounter.com).
 *
 * GoatCounter counts page views by itself (the script tag in index.html). On top
 * of that, every game played here is sent as an event whose name carries the
 * whole game record, compressed: g/<game>-<n>/<part>of<parts>/<data>. GoatCounter
 * takes names up to 2048 bytes, and even a game that runs to turn 150 compresses
 * to well under 1000 characters, so most games are a single event. Nothing about
 * the player is sent. tools/games.js fetches the games back and replays them.
 *
 * A game is sent when it ends, and when it's left unfinished (a new game, another
 * mode, the tab hidden or closed), if it changed since it was last sent. <game> is
 * a random id for the game and n counts its sends, so tools/games.js keeps only
 * the latest of each game.
 *
 * The engine has no randomness, so the batches of actions replay the game exactly,
 * as long as the rules are the same: `rules` is a hash of rules.js, and games
 * played under other rules are counted but not replayed.
 */
import R from './rules.js';

const FORMAT = 1;
const PART = 1900; // characters of data per event, leaving room for the rest of the name

// A short hash of the rules' numbers and switches (rules.js, without its functions).
const rulesId = (() => {
  let h = 0x811c9dc5;
  for (const c of JSON.stringify(R)) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  return (h >>> 0).toString(36);
})();

const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');

// ---------------------------------------------------------------- the format (pure)

const base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unbase64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

// record → URL-safe text: JSON, deflated.
async function encode(record) {
  return base64url(await pipe(new TextEncoder().encode(JSON.stringify(record)), new CompressionStream('deflate-raw')));
}

async function decode(data) {
  return JSON.parse(new TextDecoder().decode(await pipe(unbase64url(data), new DecompressionStream('deflate-raw'))));
}

// The event names that carry the nth send of a game's record.
function names(id, n, data) {
  const parts = Math.max(1, Math.ceil(data.length / PART));
  return Array.from({ length: parts }, (_, i) => `g/${id}-${n}/${i + 1}of${parts}/${data.slice(i * PART, (i + 1) * PART)}`);
}

// Event names (any, in any order) → { id, n, data } for the latest send of each game whose parts all arrived.
function join(paths) {
  const sends = new Map(); // "id-n" → { id, n, parts, got: part → data }
  for (const p of paths) {
    const m = /^g\/([a-z0-9]+)-(\d+)\/(\d+)of(\d+)\/([A-Za-z0-9_-]*)$/.exec(p);
    if (!m) continue;
    const key = `${m[1]}-${m[2]}`;
    const s = sends.get(key) || { id: m[1], n: +m[2], parts: +m[4], got: new Map() };
    s.got.set(+m[3], m[5]);
    sends.set(key, s);
  }
  const latest = new Map();
  for (const s of sends.values()) {
    if (s.got.size === s.parts && !(latest.get(s.id) && latest.get(s.id).n > s.n)) latest.set(s.id, s);
  }
  return [...latest.values()].map((s) => ({ id: s.id, n: s.n, data: Array.from({ length: s.parts }, (_, i) => s.got.get(i + 1)).join('') }));
}

// A line for the GoatCounter dashboard: "vs-hard as Red, Blue won, turn 34".
function title(record, st) {
  const name = (p) => R.players[p].name;
  const who = record.mode === 'local' ? 'local' : `${record.mode} as ${name(record.seat)}`;
  const end = st.phase !== 'over' ? 'unfinished' : st.winner === null ? 'stalemate' : `${name(st.winner)} won`;
  return `${who}, ${end}, turn ${st.turn}`;
}

// ---------------------------------------------------------------- sending (browser)

let game = null; // the game object being played (ui.game())
let now = null; // { id, n, data, title, sent }: its record, encoded, and the data last sent

// Called on every change to the game being played. record: { mode, seat, level, undos, batches },
// or null when this computer shouldn't send it (watching an online game, or playing Red in one).
function note(g, record, st) {
  if (g !== game || !record || !record.batches.length) {
    flush();
    game = g;
    now = null;
  }
  if (!record || !record.batches.length) return;
  if (!now) now = { id: newId(), n: 0, data: null, title: null, sent: null };
  const mine = now;
  const full = Object.assign({ v: FORMAT, rules: rulesId, date: new Date().toISOString().slice(0, 10) }, record);
  // Encoded straight away, so a closing tab can send it without waiting.
  encode(full).then((data) => {
    mine.data = data;
    mine.title = title(record, st);
    if (st.phase === 'over' && mine === now) flush();
  }).catch(() => { /* an old browser without CompressionStream */ });
}

// Send the game being played, if it changed since it was last sent. GoatCounter's filter
// says no on localhost, so games played while working on the game aren't sent.
function flush() {
  const gc = window.goatcounter;
  if (!now || !now.data || now.data === now.sent || !gc || !gc.count || (gc.filter && gc.filter())) return;
  now.sent = now.data;
  now.n += 1;
  for (const path of names(now.id, now.n, now.data)) gc.count({ path, title: now.title, event: true });
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
}

export { rulesId, encode, decode, names, join, title, note, flush, FORMAT };
