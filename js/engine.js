/*
 * Near Peer — game engine.
 *
 * Pure functions: apply(state, action) returns a new state or throws a RuleError.
 * Every legality check lives in the action handlers (H.*). Queries such as
 * legalSteps, captureTargets and reachable work by *trying* actions, so the UI
 * can never disagree with the rules.
 *
 * There is no attack action. Attack is passive: stepping onto an enemy captures
 * it when the combined attack of every one of your units in range of it is at
 * least its defence (see assault).
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

// { attack: { base, mod, total }, defence: …, movement: …, range: … }
function stats(s, id) {
  const u = s.units[id];
  const base = R.units[u.type];
  const out = {};
  for (const name of ['attack', 'defence', 'movement', 'range']) {
    const mod = terrainMod(s, u.hex, name);
    const total = name === 'movement'
      ? R.logic.startMovement(base[name], mod, s.options)
      : Math.max(0, base[name] + mod);
    // mod is the terrain's effect on *this* stat right now (e.g. standing on a road adds no starting movement).
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
// enemy there that the combined attack beats (unless capture is false);
// whoever is left must be able to share the hex with it.
function entryCheck(s, unit, to, capture = true) {
  const occupants = unitsAt(s, to).filter((o) => o.id !== unit.id);
  const enemies = occupants.filter((o) => o.player !== unit.player);
  const captures = capture ? enemies.filter((o) => assault(s, o.id).beats) : [];
  const stays = occupants.filter((o) => !captures.includes(o));
  const fits = R.logic.canShareHex(stays.map((o) => o.type), unit.type, s.options);
  let why = 'That hex is full';
  const strong = enemies.find((o) => !captures.includes(o));
  if (!fits && strong) {
    const a = assault(s, strong.id);
    why = `Can't capture the ${typeName(s, strong.id)} there: your attack ${a.total} vs its defence ${a.defence}`;
  }
  return { fits, captures, why };
}

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
      const mine = occ.filter((u) => u.player === p);
      const enemyThere = occ.some((u) => u.player === enemy);
      const takesAnyway = mine.some((u) => R.logic.skillFlag(u.type, 'takesOccupiedCapital'));
      if (mine.length && (takesAnyway || !(s.options.capitalNeedsNoEnemyPresent && enemyThere))) {
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
  let id = `p${s.current}-${unitType}`;
  for (let n = 2; s.units[id]; n++) id = `p${s.current}-${unitType}-${n}`;
  s.units[id] = { id, player: s.current, type: unitType, hex: to, dead: false };
  sup.splice(sup.indexOf(unitType), 1);
  log(s, `placed ${R.units[unitType].name} on ${hexName(s, to)}`);
  advancePlacement(s, 'units');
};

// Step one hex. Enemies on that hex are captured if the combined attack
// beats them; capture: false walks in alongside them instead (if they fit).
H.step = (s, { unitId, to, capture: doCapture = true }) => {
  needBattle(s);
  const u = ownUnit(s, unitId);
  const ts = s.turnState;
  need(!ts.moveDone, 'You have already moved this turn');
  need(!ts.move || ts.move.unitId === unitId, `Only your ${ts.move && typeName(s, ts.move.unitId)} can move this turn`);
  if (!ts.move) ts.move = startMove(s, u);
  need(ts.move.remaining > 0, `${typeName(s, unitId)} has no movement left`);
  need(s.hexes[to] && Hex.distance(u.hex, to) === 1, 'You can only step to an adjacent hex');
  const { fits, captures, why } = entryCheck(s, u, to, doCapture);
  need(fits, why);

  for (const c of captures) capture(s, unitId, c.id);
  const firstVisit = !ts.move.visited.includes(to);
  u.hex = to;
  ts.move.path.push(to);
  ts.move.visited.push(to);
  ts.move.remaining = R.logic.afterEnter(ts.move.remaining - 1, terrainMod(s, to, 'movement'), firstVisit, s.options);
  if (captures.length && s.options.captureEndsMove) ts.move.remaining = 0;
  log(s, `${typeName(s, unitId)} → ${hexName(s, to)} (${ts.move.remaining} left)`);
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
  need(!ts.moveDone, 'You have already moved this turn');
  need(!ts.move || ts.move.unitId === unitId, `Only your ${ts.move && typeName(s, ts.move.unitId)} can move this turn`);
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

// Every hex the unit could end a step on during this move (or next turn's move, with preview).
function reachable(state, unitId, { preview = false } = {}) {
  const start = preview ? previewState(state, unitId) : Object.assign({}, state, { log: [] });
  const origin = start.units[unitId].hex;
  const found = new Set();
  const seen = new Set();
  const walk = (s) => {
    const ts = s.turnState;
    const u = s.units[unitId];
    const sig = [
      u.hex, s.phase, ts.moveDone,
      ts.move ? ts.move.remaining : '',
      ts.move ? [...new Set(ts.move.visited)].sort().join(';') : '',
      aliveUnits(s).length,
    ].join('|');
    if (seen.has(sig)) return;
    seen.add(sig);
    for (const n of Hex.neighbors(u.hex, R.boardRadius)) {
      for (const capture of [true, false]) {
        const next = tryApply(s, { type: 'step', unitId, to: n, capture });
        if (next) {
          found.add(n);
          walk(next);
        }
      }
    }
  };
  walk(start);
  found.delete(origin);
  return [...found];
}

// Is there anything left for the current player to do this turn?
function hasAnyAction(s) {
  if (s.phase !== 'battle') return false;
  const ts = s.turnState;
  if (ts.moveDone) return false;
  const movers = ts.move ? [s.units[ts.move.unitId]] : unitsOf(s, s.current);
  return movers.some((u) => !u.dead && (legalSteps(s, u.id).length || captureTargets(s, u.id).length));
}

export {
  RuleError,
  newGame, scenario, apply, tryApply, whyIllegal, isLegal,
  placeAction, legalPlacements, legalSteps, captureTargets, reachable, hasAnyAction,
  aliveUnits, unitsOf, unitsAt, terrainAt, stats, stat, assault, hexesInRange, capitalOf,
};
