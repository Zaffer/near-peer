/*
 * Near Peer — a fast model of the battle, for the computer player (ai.js).
 *
 * The engine is the rulebook, but it clones the whole game with JSON on every
 * step, which is too slow to look several turns ahead. This model plays the
 * same battle rules on small arrays so the AI can search thousands of turns a
 * second. It only ever suggests moves: ai.js replays the chosen one through the
 * engine before playing it, and tests/ai.test.js checks this model against the
 * engine on random games, so a rule change that it misses shows up there.
 *
 * Simplifications that keep it small:
 * - A unit is just a set of base units, a bitmask (bit i = R.base[i]). Merging
 *   is OR, splitting picks a subset, and stats come from rules.js, so the 31
 *   names never matter.
 * - Stats, terrain, skills, options and the small rule functions (movement,
 *   stacking, beats) are read from rules.js, so tuning numbers there needs no
 *   change here.
 * - Only one unit moves per turn, so a turn is the set of places it can end up.
 *   turns() lists every different end position once, with the shortest list of
 *   engine actions that gets there.
 * - Hexes are numbered 0–18 with neighbour and distance tables made once.
 */
import R from './rules.js';
import * as Hex from './hex.js';

const KEYS = Hex.all(R.boardRadius);
const N = KEYS.length;
const INDEX = Object.fromEntries(KEYS.map((k, i) => [k, i]));
const NB = KEYS.map((k) => Hex.neighbors(k, R.boardRadius).map((n) => INDEX[n]));
const DIST = KEYS.map((a) => KEYS.map((b) => Hex.distance(a, b)));

// Every unit kind by bitmask: its type id, stats and what its skills do.
const FULL = (1 << R.base.length) - 1;
const partsOf = (m) => R.base.filter((b, i) => m & (1 << i));
const KIND = [null];
for (let m = 1; m <= FULL; m++) {
  const type = R.typeOf(partsOf(m));
  const u = R.units[type];
  KIND[m] = {
    type,
    size: partsOf(m).length,
    attack: u.attack, defence: u.defence, movement: u.movement, range: u.range,
    cap: R.logic.hexCapacity([type]),
    noCapture: R.logic.skillFlag(type, 'cannotCapture'),
    noCapital: R.logic.skillFlag(type, 'cannotTakeCapital'),
    enemyDefence: R.logic.skillSum(type, 'enemyDefence'),
    deterrent: R.logic.skillFlag(type, 'mutualStalemate'),
  };
}
const MASK = Object.fromEntries(KIND.slice(1).map((k, i) => [k.type, i + 1]));
const IDS = [0, 1].map((p) => KIND.map((k) => k && `p${p}-${k.type}`)); // the engine's id for a new unit
const makeId = (p, m) => IDS[p][m];

// winner: PLAYING while the game goes on, 0 or 1, or STALEMATE.
const PLAYING = -1;
const STALEMATE = 2;
const END = { type: 'endTurn' };

// The fixed part of a game: terrain modifiers per hex, the capitals and the options.
function board(es) {
  const t = KEYS.map((k) => R.terrain[es.hexes[k].terrain].mods);
  const capital = [0, 1].map((p) => KEYS.findIndex((k) => es.hexes[k].owner === p && R.terrain[es.hexes[k].terrain].capital));
  let roads = 0;
  t.forEach((mods, i) => { if ((mods.movement || 0) > 0) roads |= 1 << i; });
  return {
    options: es.options,
    atk: t.map((m) => m.attack || 0),
    def: t.map((m) => m.defence || 0),
    mov: t.map((m) => m.movement || 0),
    rng: t.map((m) => m.range || 0),
    capital, // hex index of each player's capital, -1 if none
    roads, // hexes where a road bonus can pay, so visiting them matters
    roadCount: t.filter((mods) => (mods.movement || 0) > 0).length,
  };
}

// The changing part: { cur, units: [{ p, m, h, id }], winner }. Units are never mutated.
function fromEngine(es) {
  const units = Object.values(es.units).filter((u) => !u.dead)
    .map((u) => ({ p: u.player, m: MASK[u.type], h: INDEX[u.hex], id: u.id }));
  const winner = es.phase !== 'over' ? PLAYING : es.winner === null ? STALEMATE : es.winner;
  return { cur: es.current, units, winner };
}

// ---------------------------------------------------------------- stats (same maths as engine.stats)

const attackOf = (b, u) => Math.max(0, KIND[u.m].attack + b.atk[u.h]);
const rangeOf = (b, u) => Math.max(0, KIND[u.m].range + b.rng[u.h]);
const startMovement = (b, u) => R.logic.startMovement(KIND[u.m].movement, b.mov[u.h], b.options);
function defenceOf(b, units, u) {
  let d = KIND[u.m].defence + b.def[u.h];
  for (const o of units) if (o.h === u.h && o.p !== u.p) d += KIND[o.m].enemyDefence;
  return Math.max(0, d);
}
const inRange = (b, a, h) => {
  const d = DIST[a.h][h];
  return d <= rangeOf(b, a) && (d > 0 || b.options.allowSameHexAttack);
};
// The combined attack of everyone of player `p` on hex h (whoever stands there).
function attackOn(b, units, p, h) {
  let total = 0;
  let n = 0;
  for (const a of units) {
    if (a.p === p && inRange(b, a, h)) {
      total += attackOf(b, a);
      n++;
    }
  }
  return { total, n };
}
// Does the other side's combined attack capture unit t where it stands?
function beaten(b, units, t) {
  const { total, n } = attackOn(b, units, 1 - t.p, t.h);
  return n > 0 && R.logic.beats(total, defenceOf(b, units, t));
}

function canShare(b, stays, arriving) {
  let cap = KIND[arriving].cap;
  for (const m of stays) cap = Math.max(cap, KIND[m].cap);
  if (stays.length + 1 > cap) return false;
  if (!b.options.normalUnitsCanJoinOccupiedHex && stays.length > 0 && KIND[arriving].cap <= 1) return false;
  return true;
}

// The same order of checks as engine checkWin. `cur` is the player who just acted.
function checkWin(b, units, cur) {
  const o = b.options;
  for (const p of [cur, 1 - cur]) {
    const enemy = 1 - p;
    if (o.winByElimination && !units.some((u) => u.p === enemy)) return p;
    const cap = o.winByCapital ? b.capital[enemy] : -1;
    if (cap >= 0) {
      let mine = false;
      let enemyThere = false;
      for (const u of units) {
        if (u.h !== cap) continue;
        if (u.p === p && !KIND[u.m].noCapital) mine = true;
        if (u.p === enemy) enemyThere = true;
      }
      if (mine && !(o.capitalNeedsNoEnemyPresent && enemyThere)) return p;
    }
  }
  const deter = [false, false];
  for (const u of units) if (KIND[u.m].deterrent) deter[u.p] = true;
  return deter[0] && deter[1] ? STALEMATE : PLAYING;
}

// ---------------------------------------------------------------- moving

// A turn in progress: { cur, units, mover (index into units), remaining, visited (bitmask), done, winner, actions }.

// The mover steps to hex `to` (engine moveOne). merge: the index of one of your units there to merge with.
// action: the engine action that does it. → the new node, or null if it's illegal.
function moveOne(b, node, to, capture, merge, action) {
  if (node.remaining <= 0) return null;
  const units = node.units;
  const u = units[node.mover];
  const canCapture = capture && !KIND[u.m].noCapture;
  const caps = [];
  const stays = [];
  let arriving = u.m;
  for (let i = 0; i < units.length; i++) {
    const o = units[i];
    if (i === node.mover || o.h !== to) continue;
    if (i === merge) continue;
    if (o.p !== u.p && canCapture && beaten(b, units, o)) caps.push(i);
    else stays.push(o.m);
  }
  if (merge !== null) {
    const partner = units[merge];
    if (!partner || partner.p !== u.p || partner.h !== to || (partner.m & u.m)) return null;
    arriving = u.m | partner.m;
  }
  if (!canShare(b, stays, arriving)) return null;

  const moved = { p: u.p, m: arriving, h: to, id: merge !== null ? makeId(u.p, arriving) : u.id };
  const next = [];
  for (let i = 0; i < units.length; i++) {
    if (i !== node.mover && i !== merge && !caps.includes(i)) next.push(units[i]);
  }
  next.push(moved);
  const bit = 1 << to;
  let remaining = R.logic.afterEnter(node.remaining - 1, b.mov[to], !(node.visited & bit), b.options);
  if (caps.length && b.options.captureEndsMove) remaining = 0;
  if (merge !== null && b.options.mergeEndsMove) remaining = 0;
  return {
    cur: node.cur, units: next, mover: next.length - 1, remaining, visited: node.visited | bit,
    done: remaining <= 0, winner: checkWin(b, next, node.cur), actions: action && node.actions.concat([action]),
  };
}

// Merge with, or capture, a unit already on the mover's hex (engine H.merge, H.capture).
function inPlace(b, node, out) {
  const units = node.units;
  const u = units[node.mover];
  for (let i = 0; i < units.length; i++) {
    const o = units[i];
    if (i === node.mover || o.h !== u.h) continue;
    let next;
    let remaining = node.remaining;
    let action;
    if (o.p === u.p) {
      if (o.m & u.m) continue;
      const merged = { p: u.p, m: u.m | o.m, h: u.h, id: makeId(u.p, u.m | o.m) };
      next = units.filter((x, j) => j !== i && j !== node.mover).concat([merged]);
      if (b.options.mergeEndsMove) remaining = 0;
      action = node.actions && { type: 'merge', unitId: u.id, targetId: o.id };
    } else {
      if (KIND[u.m].noCapture || !beaten(b, units, o)) continue;
      next = units.filter((x, j) => j !== i && j !== node.mover).concat([u]);
      if (b.options.captureEndsMove) remaining = 0;
      action = node.actions && { type: 'capture', unitId: u.id, targetId: o.id };
    }
    out.push({
      cur: node.cur, units: next, mover: next.length - 1, remaining, visited: node.visited,
      done: remaining <= 0, winner: checkWin(b, next, node.cur), actions: action && node.actions.concat([action]),
    });
  }
}

// Every legal step from a node to a neighbouring hex: capture what you beat there, walk in beside
// it instead, or merge with one of your units there. first: build split actions (see turns).
// Engine actions are only built when the node carries them (node.actions isn't null).
function steps(b, node, out, first = null) {
  const units = node.units;
  const u = units[node.mover];
  const acts = !!node.actions;
  for (const to of NB[u.h]) {
    const base = !acts ? null : first ? { type: 'split', unitId: first.unitId, parts: first.parts, to: KEYS[to] } : { type: 'step', unitId: u.id, to: KEYS[to] };
    let enemy = false;
    for (let i = 0; i < units.length; i++) {
      const o = units[i];
      if (i === node.mover || o.h !== to) continue;
      if (o.p !== u.p) enemy = true;
      else out.push(moveOne(b, node, to, true, i, acts && Object.assign({}, base, { merge: o.id })));
    }
    out.push(moveOne(b, node, to, true, null, base));
    if (enemy && !KIND[u.m].noCapture) out.push(moveOne(b, node, to, false, null, acts && Object.assign({}, base, { capture: false })));
  }
}

// A key for the position: who stands where, whose turn it is and whether it's over.
// One character per unit (its side, kind and hex), sorted.
const codeOf = (u) => (u.p * 32 + u.m) * 32 + u.h;
function keyOf(s) {
  const codes = s.units.map(codeOf).sort((x, y) => x - y);
  return String.fromCharCode(s.cur * 4 + s.winner + 1, ...codes);
}

// Every different position the player to move can end their turn in.
// → [{ s: the position after the turn (cur is the other player even when the game is over), actions }]
// actions are engine actions, ending with endTurn unless the game ended. withActions: false
// leaves them out (null), which the search does, since it only plays the first turn.
function turns(b, s, withActions = true) {
  const none = withActions ? [] : null;
  const out = new Map();
  const seen = new Set();
  const queue = [];
  const record = (node) => {
    const child = { cur: 1 - s.cur, units: node.units, winner: node.winner };
    const key = keyOf(child);
    if (!out.has(key)) out.set(key, { s: child, key, actions: node.actions && node.winner === PLAYING ? node.actions.concat([END]) : node.actions });
  };
  const add = (list) => {
    for (const node of list) {
      if (!node) continue;
      record(node);
      if (node.winner !== PLAYING || node.done) continue;
      const mover = node.units[node.mover];
      const sig = `${keyOf(node)}${String.fromCharCode(codeOf(mover), node.remaining + 1)}${node.visited & b.roads}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      queue.push(node);
    }
  };

  record({ units: s.units, winner: PLAYING, actions: none }); // pass
  s.units.forEach((u, i) => {
    if (u.p !== s.cur) return;
    const start = { cur: s.cur, units: s.units, mover: i, remaining: startMovement(b, u), visited: 0, done: false, winner: PLAYING, actions: none };
    const first = [];
    inPlace(b, start, first);
    steps(b, start, first);
    // Split: some of the parts step off as a unit of their own, the rest stay.
    for (let sub = (u.m - 1) & u.m; sub > 0; sub = (sub - 1) & u.m) {
      const leaving = { p: u.p, m: sub, h: u.h, id: makeId(u.p, sub) };
      const staying = { p: u.p, m: u.m ^ sub, h: u.h, id: makeId(u.p, u.m ^ sub) };
      const units = s.units.filter((x) => x !== u).concat([staying, leaving]);
      const node = { cur: s.cur, units, mover: units.length - 1, remaining: startMovement(b, leaving), visited: 0, done: false, winner: PLAYING, actions: none };
      steps(b, node, first, { unitId: u.id, parts: partsOf(sub) });
    }
    add(first);
  });
  while (queue.length) {
    const node = queue.shift();
    const next = [];
    inPlace(b, node, next);
    steps(b, node, next);
    add(next);
  }
  return [...out.values()];
}

export {
  KEYS, N, INDEX, NB, DIST, KIND, MASK, FULL, PLAYING, STALEMATE,
  partsOf, board, fromEngine, attackOf, rangeOf, defenceOf, startMovement, attackOn, beaten, checkWin, turns, keyOf,
};
