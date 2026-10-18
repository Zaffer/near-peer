/*
 * Near Peer v2 — game engine.
 *
 * Pure functions: apply(state, action) returns a new state or throws a RuleError.
 * Every legality check lives in the action handlers (H.*). Queries such as
 * legalSteps, captureTargets and reachable work by *trying* actions, so the UI
 * can never disagree with the rules.
 *
 * There is no attack action. Attack is passive: stepping onto an enemy captures
 * it when the combined attack of every one of your units in range of it is at
 * least its defence (see assault).
 *
 * Merging: a unit stepping onto one of your other units can merge with it into
 * one new unit (step with merge: targetId), or two of your units already sharing
 * a hex can merge where they stand (merge). Splitting: part of a merged unit can
 * step away as a unit of its own (split), leaving the rest behind. A unit's id
 * is "p<player>-<type>", which is unique because each player has one of each
 * base unit. Units that merge or split are replaced by the new ones; captured
 * units stay in s.units with dead: true.
 */
import R from './rules.js';
import * as Hex from './hex.js';

class RuleError extends Error {}
const need = (cond, msg) => {
  if (!cond) throw new RuleError(msg);
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const other = (p) => 1 - p;
const pname = (p) => R.players[p].name;
const freshTurn = () => ({ move: null, moveDone: false });

// ---------------------------------------------------------------- setup

function newGame({ options } = {}) {
  const hexes = {};
  for (const k of Hex.all(R.boardRadius)) hexes[k] = { terrain: 'plain', owner: null, zone: null };
  R.zones.forEach((keys, p) => keys.forEach((k) => { hexes[k].zone = p; }));
  return {
    phase: 'terrain', // terrain → units → battle → over
    current: R.firstPlayer,
    turn: 0,
    options: Object.assign({}, R.options, options),
    hexes,
    units: {},
    supply: [0, 1].map(() => ({ terrain: R.terrainSet.slice(), units: R.army.slice() })),
    turnState: freshTurn(),
    winner: null,
    winReason: '',
    log: [{ p: null, text: `${pname(R.firstPlayer)} places terrain first.` }],
  };
}

// Build a battle-phase state directly (used by tests and for debugging).
// terrain: { "q,r": ["road", owner] }, units: [{ player, type, hex, id? }]
function scenario({ terrain = {}, units = [], current = R.firstPlayer, options } = {}) {
  const s = newGame({ options });
  for (const [k, [t, owner]] of Object.entries(terrain)) {
    s.hexes[k].terrain = t;
    s.hexes[k].owner = R.terrain[t].capital ? owner : null;
  }
  for (const u of units) {
    const id = u.id || `p${u.player}-${u.type}`;
    s.units[id] = { id, player: u.player, type: u.type, hex: u.hex, dead: false };
  }
  s.supply = [0, 1].map(() => ({ terrain: [], units: [] }));
  s.phase = 'battle';
  s.current = current;
  s.turn = 1;
  s.log = [];
  return s;
}

// ---------------------------------------------------------------- queries

const aliveUnits = (s) => Object.values(s.units).filter((u) => !u.dead);
const unitsOf = (s, p) => aliveUnits(s).filter((u) => u.player === p);
const unitsAt = (s, k) => aliveUnits(s).filter((u) => u.hex === k);
const terrainAt = (s, k) => R.terrain[s.hexes[k].terrain];
const terrainMod = (s, k, name) => terrainAt(s, k).mods[name] || 0;
const typeName = (s, id) => R.units[s.units[id].type].name;
const hexName = (s, k) => `${terrainAt(s, k).name} (${k})`;

// What enemy skills on this unit's hex do to its defence (e.g. Surveillance: −1).
function spottedMod(s, u) {
  return unitsAt(s, u.hex).filter((o) => o.player !== u.player)
    .reduce((n, o) => n + R.logic.skillSum(o.type, 'enemyDefence'), 0);
}

// { attack: { base, mod, total }, defence: …, movement: …, range: … }
// mod is everything on top of the unit's own stat: terrain, and for defence any enemy Surveillance on its hex.
function stats(s, id) {
  const u = s.units[id];
  const base = R.units[u.type];
  const out = {};
  for (const name of ['attack', 'defence', 'movement', 'range']) {
    const mod = terrainMod(s, u.hex, name) + (name === 'defence' && u.hex ? spottedMod(s, u) : 0);
    const total = name === 'movement'
      ? R.logic.startMovement(base[name], mod, s.options)
      : Math.max(0, base[name] + mod);
    // mod is the effect on *this* stat right now (e.g. standing on a road adds no starting movement).
    out[name] = { base: base[name], mod: total - base[name], total };
  }
  return out;
}
const stat = (s, id, name) => stats(s, id)[name].total;

const inRangeOf = (s, attackerId, k) => {
  const d = Hex.distance(s.units[attackerId].hex, k);
  return d <= stat(s, attackerId, 'range') && (d > 0 || s.options.allowSameHexAttack);
};

// The combined attack against a unit from where everyone stands right now:
// every enemy of it within range adds its attack (terrain included).
// A unit stepping onto the target counts from the hex it steps in from,
// which is simply where it stands at that moment.
// → { total, defence, beats, contributors: [{ id, attack }] }
function assault(s, targetId) {
  const t = s.units[targetId];
  const contributors = unitsOf(s, other(t.player))
    .filter((a) => inRangeOf(s, a.id, t.hex))
    .map((a) => ({ id: a.id, attack: stat(s, a.id, 'attack') }));
  const total = contributors.reduce((n, c) => n + c.attack, 0);
  const defence = stat(s, targetId, 'defence');
  return { total, defence, contributors, beats: contributors.length > 0 && R.logic.beats(total, defence) };
}

function hexesInRange(s, id) {
  const u = s.units[id];
  const range = stat(s, id, 'range');
  return Object.keys(s.hexes).filter((k) => inRangeOf(s, id, k));
}

// Could `unit` step into hex `to` right now? Entering a hex captures every
// enemy there that the combined attack beats (unless capture is false, or the
// unit can't capture); with merge, it merges with that unit of yours there.
// Whoever is left must be able to share the hex with it.
function entryCheck(s, unit, to, capture = true, merge = null) {
  const occupants = unitsAt(s, to).filter((o) => o.id !== unit.id);
  const enemies = occupants.filter((o) => o.player !== unit.player);
  const canCapture = capture && !R.logic.skillFlag(unit.type, 'cannotCapture');
  const captures = canCapture ? enemies.filter((o) => assault(s, o.id).beats) : [];
  const partner = merge ? occupants.find((o) => o.id === merge) : null;
  if (merge) need(partner && partner.player === unit.player, 'Merge with one of your units on that hex');
  if (merge) need(R.logic.canMerge(R.units[unit.type].parts, R.units[partner.type].parts), 'Those units share a base unit');
  const arriving = merge ? mergedType(unit, partner) : unit.type;
  const stays = occupants.filter((o) => !captures.includes(o) && o !== partner);
  const fits = R.logic.canShareHex(stays.map((o) => o.type), arriving, s.options);
  let why = 'That hex is full';
  const strong = enemies.find((o) => !captures.includes(o));
  if (!fits && strong) {
    const a = assault(s, strong.id);
    why = `Can't capture the ${typeName(s, strong.id)} there: your attack ${a.total} vs its defence ${a.defence}`;
  }
  return { fits, captures, why };
}

const mergedType = (a, b) => R.typeOf(R.units[a.type].parts.concat(R.units[b.type].parts));
const makeId = (p, type) => `p${p}-${type}`;

function capitalOf(s, p) {
  return Object.keys(s.hexes).find((k) => s.hexes[k].owner === p && terrainAt(s, k).capital);
}

// ---------------------------------------------------------------- helpers used by handlers

function log(s, text, p = s.current) {
  s.log.push({ p, text, turn: s.turn });
}

const startMove = (s, u) => ({ unitId: u.id, remaining: stat(s, u.id, 'movement'), path: [u.hex], visited: [] });

function needBattle(s) {
  need(s.phase === 'battle', s.phase === 'over' ? 'The game is over' : 'The battle has not started yet');
}

function ownUnit(s, id) {
  const u = s.units[id];
  need(u && !u.dead, 'No such unit');
  need(u.player === s.current, `That unit belongs to ${pname(u.player)}`);
  return u;
}

function advancePlacement(s, kind) {
  const left = (p) => s.supply[p][kind].length;
  if (left(0) + left(1) === 0) {
    s.current = R.firstPlayer;
    if (kind === 'terrain') {
      s.phase = 'units';
      log(s, `Terrain placed. ${pname(s.current)} places units first.`, null);
    } else {
      s.phase = 'battle';
      s.turn = 1;
      s.turnState = freshTurn();
      log(s, `Battle begins. ${pname(s.current)} moves first.`, null);
    }
    return;
  }
  if (left(other(s.current)) > 0) s.current = other(s.current);
}

// Remove an enemy unit, logging the attack that took it.
function capture(s, capturerId, targetId) {
  const t = s.units[targetId];
  const a = assault(s, targetId);
  const parts = a.contributors.map((c) => `${typeName(s, c.id)} ${c.attack}`).join(' + ');
  log(s, `${typeName(s, capturerId)} captured ${pname(t.player)} ${typeName(s, targetId)} (${parts} = ${a.total} vs ${a.defence})`);
  t.dead = true;
  t.hex = null;
}

function win(s, p, reason) {
  s.phase = 'over';
  s.winner = p;
  s.winReason = reason;
  log(s, `${pname(p)} wins: ${reason}.`, p);
}

function checkWin(s) {
  for (const p of [s.current, other(s.current)]) {
    const enemy = other(p);
    if (s.options.winByElimination && unitsOf(s, enemy).length === 0) {
      return win(s, p, `defeated every ${pname(enemy)} unit`);
    }
    const cap = s.options.winByCapital && capitalOf(s, enemy);
    if (cap) {
      const occ = unitsAt(s, cap);
      const mine = occ.filter((u) => u.player === p && !R.logic.skillFlag(u.type, 'cannotTakeCapital'));
      const enemyThere = occ.some((u) => u.player === enemy);
      if (mine.length && !(s.options.capitalNeedsNoEnemyPresent && enemyThere)) {
        return win(s, p, `took the ${pname(enemy)} capital`);
      }
    }
  }
}

// ---------------------------------------------------------------- action handlers

const H = {};

H.placeTerrain = (s, { terrain, to }) => {
  need(s.phase === 'terrain', 'Not the terrain phase');
  const sup = s.supply[s.current].terrain;
  need(sup.includes(terrain), `No ${terrain} tile left to place`);
  const hex = s.hexes[to];
  need(hex, 'Not a board hex');
  need(hex.zone === s.current, 'You can only place in your own zone');
  need(hex.terrain === 'plain', 'That hex already has terrain');
  hex.terrain = terrain;
  hex.owner = R.terrain[terrain].capital ? s.current : null; // only capitals belong to anyone
  sup.splice(sup.indexOf(terrain), 1);
  log(s, `placed ${R.terrain[terrain].name} at ${to}`);
  advancePlacement(s, 'terrain');
};

H.placeUnit = (s, { unitType, to }) => {
  need(s.phase === 'units', 'Not the unit phase');
  const sup = s.supply[s.current].units;
  need(sup.includes(unitType), `No ${unitType} left to place`);
  const hex = s.hexes[to];
  need(hex, 'Not a board hex');
  need(hex.zone === s.current, 'You can only place in your own zone');
  need(R.logic.canShareHex(unitsAt(s, to).map((u) => u.type), unitType, s.options), 'That hex is full');
  let id = makeId(s.current, unitType);
  for (let n = 2; s.units[id]; n++) id = `${makeId(s.current, unitType)}-${n}`;
  s.units[id] = { id, player: s.current, type: unitType, hex: to, dead: false };
  sup.splice(sup.indexOf(unitType), 1);
  log(s, `placed ${R.units[unitType].name} on ${hexName(s, to)}`);
  advancePlacement(s, 'units');
};

// Replace units `from` (all on one hex) with one new unit of the merged type.
function mergeUnits(s, from) {
  const [a, b] = from;
  const type = mergedType(a, b);
  const id = makeId(a.player, type);
  need(!s.units[id], 'There is already a unit with that id');
  s.units[id] = { id, player: a.player, type, hex: b.hex, dead: false };
  for (const u of from) delete s.units[u.id];
  return s.units[id];
}

// Move a unit one hex (shared by step and split). See H.step.
function moveOne(s, u, to, doCapture, merge) {
  const ts = s.turnState;
  need(ts.move.remaining > 0, `${typeName(s, u.id)} has no movement left`);
  need(s.hexes[to] && Hex.distance(u.hex, to) === 1, 'You can only step to an adjacent hex');
  const { fits, captures, why } = entryCheck(s, u, to, doCapture, merge);
  need(fits, why);

  for (const c of captures) capture(s, u.id, c.id);
  const firstVisit = !ts.move.visited.includes(to);
  u.hex = to;
  ts.move.path.push(to);
  ts.move.visited.push(to);
  ts.move.remaining = R.logic.afterEnter(ts.move.remaining - 1, terrainMod(s, to, 'movement'), firstVisit, s.options);
  if (captures.length && s.options.captureEndsMove) ts.move.remaining = 0;
  if (merge) {
    const partnerName = typeName(s, merge);
    const m = mergeUnits(s, [u, s.units[merge]]);
    ts.move.unitId = m.id;
    if (s.options.mergeEndsMove) ts.move.remaining = 0;
    log(s, `${R.units[u.type].name} merged with ${partnerName} on ${hexName(s, to)}: ${R.units[m.type].name}`);
  } else {
    log(s, `${typeName(s, u.id)} → ${hexName(s, to)} (${ts.move.remaining} left)`);
  }
  if (ts.move.remaining <= 0) ts.moveDone = true;
  checkWin(s);
}

const needFreeToMove = (s, id) => {
  const ts = s.turnState;
  need(!ts.moveDone, 'You have already moved this turn');
  need(!ts.move || ts.move.unitId === id, `Only your ${ts.move && typeName(s, ts.move.unitId)} can move this turn`);
};

// Step one hex. Enemies on that hex are captured if the combined attack
// beats them; capture: false walks in alongside them instead (if they fit).
// merge: the id of one of your units on that hex to merge with when you get there.
H.step = (s, { unitId: id, to, capture: doCapture = true, merge = null }) => {
  needBattle(s);
  const u = ownUnit(s, id);
  needFreeToMove(s, id);
  if (!s.turnState.move) s.turnState.move = startMove(s, u);
  moveOne(s, u, to, doCapture, merge);
};

// Split a merged unit: `parts` (some of its base units) step to `to` as a unit
// of their own, leaving the rest where they were. This is the first step of the
// move for the part that leaves, so it can carry on moving (and capture or merge)
// with its own movement.
H.split = (s, { unitId: id, parts, to, capture: doCapture = true, merge = null }) => {
  needBattle(s);
  const u = ownUnit(s, id);
  need(!s.turnState.moveDone && !s.turnState.move, 'Splitting has to be the start of your move');
  const all = R.units[u.type].parts;
  need(Array.isArray(parts) && parts.length > 0 && parts.every((p) => all.includes(p)), 'Pick some of this unit\'s parts to split off');
  const rest = all.filter((p) => !parts.includes(p));
  need(rest.length > 0, 'Choose fewer parts: some have to stay behind');
  const leaving = { id: makeId(u.player, R.typeOf(parts)), player: u.player, type: R.typeOf(parts), hex: u.hex, dead: false };
  const staying = { id: makeId(u.player, R.typeOf(rest)), player: u.player, type: R.typeOf(rest), hex: u.hex, dead: false };
  need(!s.units[leaving.id] && !s.units[staying.id], 'There is already a unit with that id');
  delete s.units[u.id];
  s.units[leaving.id] = leaving;
  s.units[staying.id] = staying;
  log(s, `split ${R.units[u.type].name} into ${R.units[leaving.type].name} and ${R.units[staying.type].name}`);
  s.turnState.move = startMove(s, leaving);
  moveOne(s, leaving, to, doCapture, merge);
};

// Merge two of your units that already share a hex (e.g. a Recon Drone sitting
// with another unit). No step is needed, so it works with 0 movement, but it is
// the move for the turn.
H.merge = (s, { unitId: id, targetId }) => {
  needBattle(s);
  const u = ownUnit(s, id);
  const t = s.units[targetId];
  need(t && !t.dead && t.player === s.current && t.id !== u.id, 'Pick another of your units to merge with');
  need(t.hex === u.hex, 'That unit is not on your hex. Move onto it instead');
  needFreeToMove(s, id);
  need(R.logic.canMerge(R.units[u.type].parts, R.units[t.type].parts), 'Those units share a base unit');
  const ts = s.turnState;
  if (!ts.move) ts.move = startMove(s, u);
  const m = mergeUnits(s, [u, t]);
  ts.move.unitId = m.id;
  if (s.options.mergeEndsMove) ts.move.remaining = 0;
  log(s, `${R.units[u.type].name} merged with ${R.units[t.type].name}: ${R.units[m.type].name}`);
  if (ts.move.remaining <= 0) ts.moveDone = true;
  checkWin(s);
};

// Capture an enemy that already shares this unit's hex (e.g. a covert sitting
// with it). No step is needed, so it works with 0 movement, but it is this
// unit's move for the turn; any movement left can still be spent afterwards.
H.capture = (s, { unitId, targetId }) => {
  needBattle(s);
  const u = ownUnit(s, unitId);
  const ts = s.turnState;
  const t = s.units[targetId];
  need(t && !t.dead && t.player !== s.current, 'Pick an enemy unit to capture');
  need(t.hex === u.hex, 'That unit is not on your hex. Move onto it instead');
  need(!R.logic.skillFlag(u.type, 'cannotCapture'), `A ${typeName(s, unitId)} can't capture`);
  needFreeToMove(s, unitId);
  const a = assault(s, targetId);
  need(a.beats, `Can't capture the ${typeName(s, targetId)}: your attack ${a.total} vs its defence ${a.defence}`);
  if (!ts.move) ts.move = startMove(s, u);
  capture(s, unitId, targetId);
  if (s.options.captureEndsMove) ts.move.remaining = 0;
  if (ts.move.remaining <= 0) ts.moveDone = true;
  checkWin(s);
};

H.endTurn = (s, { auto } = {}) => {
  needBattle(s);
  log(s, auto ? 'turn ended (nothing left to do)' : 'ended turn');
  s.turnState = freshTurn();
  s.current = other(s.current);
  s.turn += 1;
};

// ---------------------------------------------------------------- apply & legality

function apply(state, action) {
  const handler = H[action.type];
  if (!handler) throw new RuleError(`Unknown action: ${action.type}`);
  const s = clone(state);
  handler(s, action);
  return s;
}

// Legality checks don't need the log; skipping it keeps the clones small.
function tryApply(state, action) {
  try {
    return apply(Object.assign({}, state, { log: [] }), action);
  } catch (e) {
    if (e instanceof RuleError) return null;
    throw e;
  }
}

function whyIllegal(state, action) {
  try {
    apply(Object.assign({}, state, { log: [] }), action);
    return null;
  } catch (e) {
    if (e instanceof RuleError) return e.message;
    throw e;
  }
}

const isLegal = (state, action) => tryApply(state, action) !== null;

const placeAction = (kind, item, to) =>
  kind === 'terrain' ? { type: 'placeTerrain', terrain: item, to } : { type: 'placeUnit', unitType: item, to };

function legalPlacements(s) {
  const kind = s.phase === 'terrain' ? 'terrain' : s.phase === 'units' ? 'units' : null;
  if (!kind) return [];
  const out = [];
  for (const item of new Set(s.supply[s.current][kind])) {
    for (const k of Object.keys(s.hexes)) {
      const a = placeAction(kind, item, k);
      if (isLegal(s, a)) out.push(a);
    }
  }
  return out;
}

function legalSteps(s, unitId) {
  const u = s.units[unitId];
  if (!u || u.dead) return [];
  return Hex.neighbors(u.hex, R.boardRadius).filter((k) => isLegal(s, { type: 'step', unitId, to: k }));
}

// Enemies this unit could capture without stepping (they share its hex).
function captureTargets(s, unitId) {
  const u = s.units[unitId];
  if (!u || u.dead) return [];
  return unitsAt(s, u.hex)
    .filter((t) => isLegal(s, { type: 'capture', unitId, targetId: t.id }))
    .map((t) => t.id);
}

// A copy of the state as if it were the start of this unit's next turn.
function previewState(s, unitId) {
  const p = clone(Object.assign({}, s, { log: [] }));
  p.phase = 'battle';
  p.current = p.units[unitId].player;
  p.turnState = freshTurn();
  return p;
}

// Every hex the unit could end a step on during this move (or next turn's move,
// with preview), and every unit of yours it could merge with on the way.
// parts: only those base units move, splitting off from the rest (see H.split).
// → { hexes: [...], merges: [unitId, …] }
function moveReach(state, unitId, { preview = false, parts = null } = {}) {
  const start = preview ? previewState(state, unitId) : Object.assign({}, state, { log: [] });
  const u0 = start.units[unitId];
  const origin = u0.hex;
  const all = R.units[u0.type].parts;
  const splitting = parts && parts.length < all.length;
  const moverId = splitting ? makeId(u0.player, R.typeOf(parts)) : unitId;
  const restId = splitting ? makeId(u0.player, R.typeOf(all.filter((p) => !parts.includes(p)))) : null;
  const found = new Set();
  const merges = new Set();
  const seen = new Set();
  const first = (n, extra) => (splitting
    ? Object.assign({ type: 'split', unitId, parts, to: n }, extra)
    : Object.assign({ type: 'step', unitId, to: n }, extra));
  const walk = (s, isFirst) => {
    const ts = s.turnState;
    const id = isFirst ? unitId : moverId;
    const u = s.units[id];
    const sig = [
      u.hex, s.phase, ts.moveDone,
      ts.move ? ts.move.remaining : '',
      ts.move ? [...new Set(ts.move.visited)].sort().join(';') : '',
      aliveUnits(s).length,
    ].join('|');
    if (seen.has(sig)) return;
    seen.add(sig);
    for (const n of Hex.neighbors(u.hex, R.boardRadius)) {
      const act = (extra) => (isFirst ? first(n, extra) : Object.assign({ type: 'step', unitId: id, to: n }, extra));
      for (const capture of [true, false]) {
        const next = tryApply(s, act({ capture }));
        if (next) {
          found.add(n);
          walk(next, false);
        }
      }
      for (const o of unitsAt(s, n)) {
        if (o.player === u.player && o.id !== restId && tryApply(s, act({ merge: o.id }))) merges.add(o.id);
      }
    }
  };
  walk(start, true);
  found.delete(origin);
  return { hexes: [...found], merges: [...merges] };
}

const reachable = (state, unitId, opts) => moveReach(state, unitId, opts).hexes;

// Your units this unit could merge with without moving (they share its hex).
function mergeTargets(s, unitId) {
  const u = s.units[unitId];
  if (!u || u.dead) return [];
  return unitsAt(s, u.hex)
    .filter((t) => isLegal(s, { type: 'merge', unitId, targetId: t.id }))
    .map((t) => t.id);
}

// Every way to split this unit: [parts, …] for each proper subset of its base units.
function splitChoices(type) {
  const all = R.units[type].parts;
  const out = [];
  for (let mask = 1; mask < (1 << all.length) - 1; mask++) out.push(all.filter((p, i) => mask & (1 << i)));
  return out;
}

// Is there anything left for the current player to do this turn?
function hasAnyAction(s) {
  if (s.phase !== 'battle') return false;
  const ts = s.turnState;
  if (ts.moveDone) return false;
  const movers = ts.move ? [s.units[ts.move.unitId]] : unitsOf(s, s.current);
  const live = movers.filter((u) => u && !u.dead);
  if (live.some((u) => legalSteps(s, u.id).length || captureTargets(s, u.id).length || mergeTargets(s, u.id).length)) return true;
  if (live.some((u) => moveReach(s, u.id).merges.length)) return true;
  if (ts.move) return false;
  return live.some((u) => splitChoices(u.type).some((parts) =>
    Hex.neighbors(u.hex, R.boardRadius).some((to) => isLegal(s, { type: 'split', unitId: u.id, parts, to }))));
}

export {
  RuleError,
  newGame, scenario, apply, tryApply, whyIllegal, isLegal,
  placeAction, legalPlacements, legalSteps, captureTargets, reachable, moveReach, mergeTargets, splitChoices, hasAnyAction,
  aliveUnits, unitsOf, unitsAt, terrainAt, stats, stat, assault, hexesInRange, capitalOf,
};
