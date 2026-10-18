/*
 * Near Peer — browser UI.
 * Reads state from the engine and sends it actions; it never decides what is
 * legal on its own.
 *
 * What the page shows lives in signals (signals.js), and each part of the page
 * is drawn by an effect that redraws it when a signal it read changes (see
 * mount). So input handlers only set signals; nothing calls render by hand.
 */
import R from './rules.js';
import * as Hex from './hex.js';
import * as E from './engine.js';
import COLOURS from './colours.js';
import ICONS from './icons.js';
import * as MapView from './mapview.js';
import * as UnitArt from './unitart.js';
import * as FX from './effects.js';
import * as Online from './online.js';
import { signal, computed, effect, batch, untracked } from './signals.js';

const SIZE = 54;
const NS = 'http://www.w3.org/2000/svg';
const DANGER = '#c026d3'; // "this can be captured" — kept apart from the players' red and blue
const TEXTURE = { minefield: 'hatch' };
const store = {
  get(k) { try { return localStorage.getItem(`near-peer:${k}`); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(`near-peer:${k}`, v); } catch (e) { /* private window etc. */ } },
};

// The game on this computer. It has the same shape as an online game (online.js
// join), so the rest of the page doesn't mind which one it's showing.
function localGame() {
  const g = { state: signal(E.newGame()), history: signal([]), lastChange: null };
  const set = (next, history, actions) => batch(() => {
    g.lastChange = { prev: g.state(), next, actions };
    g.state(next);
    g.history(history);
  });
  // quiet: don't animate (a whole build phase placed at random).
  g.play = (actions, next, { quiet = false } = {}) => set(next, g.history().concat([g.state()]), quiet ? null : actions);
  g.canUndo = () => g.history().length > 0;
  g.undo = () => {
    const h = g.history();
    if (h.length) set(h[h.length - 1], h.slice(0, -1), null);
  };
  g.reset = () => set(E.newGame(), [], null);
  g.isMyTurn = () => true;
  return g;
}

const ui = {
  game: signal(localGame()), // this computer's game, or the online one while playing someone over the network
  selection: signal(null), // { id, phase, current, turn }: a unit (own or enemy, for inspection) and when it was picked
  hover: signal(null), // hex key
  picked: signal(null), // terrain/unit type picked during the build phase
  pointer: signal(null), // cursor position in board coordinates, for the aim arrow
  drag: signal(null), // { id, pointerId, x, y, active } while dragging a unit
  autoPlace: signal(false), // online: place my build pieces at random
  settings: {
    autoEnd: signal(true),
    threats: signal(false),
    coords: signal(false),
    // How the board and units are drawn: 'symbols' (flat, schematic) or 'graphic' (illustrated).
    mapStyle: signal(store.get('map-style') === 'symbols' ? 'symbols' : 'graphic'),
    unitStyle: signal(store.get('unit-style') === 'symbols' ? 'symbols' : 'graphic'),
  },
};
ui.state = computed(() => ui.game().state());
ui.history = computed(() => ui.game().history());
ui.online = computed(() => (ui.game().roomId ? ui.game() : null));
// The selected unit's id, while it's alive and the same player's turn it was picked in.
ui.selected = computed(() => {
  const sel = ui.selection();
  const st = ui.state();
  const same = sel && sel.phase === st.phase && sel.current === st.current && sel.turn === st.turn;
  return same && liveUnit(sel.id) ? sel.id : null;
});
// The piece to place: the one picked, while the player still has one, else their first.
ui.choice = computed(() => {
  const st = ui.state();
  const kind = buildKind(st);
  if (!kind) return null;
  const sup = st.supply[st.current][kind];
  return sup.includes(ui.picked()) ? ui.picked() : sup[0] || null;
});
ui.unitXY = computed(() => layoutUnits(ui.state())); // unit id → { x, y, r } on the board
ui.plans = computed(() => (ui.state(), new Map())); // "unitId>hex" → planned route, for the current state

// Not drawn from, so plain values.
let sharedHover = null; // online: the hex we last told the others our pointer is over
let suppressClick = false;
let rulesOpen = false;
let layers = null; // the board's <g> layers, made once in mount()
let animated = null; // the last change whose effects were played

const select = (id) => {
  const st = ui.state();
  ui.selection(id ? { id, phase: st.phase, current: st.current, turn: st.turn } : null);
};

// ---------------------------------------------------------------- helpers

const $ = (id) => document.getElementById(id);

function svg(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

function svgText(str, x, y, cls, parent) {
  const t = svg('text', { x, y, class: cls }, parent);
  t.textContent = str;
  return t;
}

// Draw an icon from icons.js centred on (cx, cy). Returns null if the type has no icon.
function drawIcon(kind, type, cx, cy, size, color, parent, { opacity, width = 2 } = {}) {
  const d = (ICONS[kind] || {})[type];
  if (!d) return null;
  const g = svg('g', { transform: `translate(${cx - size / 2},${cy - size / 2}) scale(${size / 24})`, opacity }, parent);
  svg('path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  return g;
}

// The same icon as a standalone inline <svg> for the side panel.
function iconEl(kind, type, color = 'currentColor', size = 16) {
  const el = svg('svg', { viewBox: '0 0 24 24', width: size, height: size, class: 'icon' });
  return drawIcon(kind, type, 12, 12, 24, color, el) ? el : null;
}

function h(tag, props, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid instanceof Node ? kid : String(kid));
  }
  return n;
}

const P = (p) => R.players[p];
// Red plays from the top of the board, so online the board is turned round for them:
// their side is at the bottom, as Blue's is. Everything is drawn through pos(), so text stays upright.
const pos = (k) => {
  const p = Hex.toPixel(k, SIZE);
  return ui.online() && ui.online().seat() === 1 ? { x: -p.x, y: -p.y } : p;
};
const points = (k, size) => {
  const { x, y } = pos(k);
  return Hex.corners(x, y, size).map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
};
const signed = (v) => (v > 0 ? `+${v}` : `${v}`);
const STAT_ORDER = ['attack', 'defence', 'movement', 'range'];
const STAT_NAME = { attack: 'Attack', defence: 'Defence', movement: 'Movement', range: 'Range' };
// [[stat, value], …] → "⚔2 🛡3 …" for the side panel. Mods show their sign and put the icon after.
const statsEl = (pairs, { mods = false } = {}) => h('span', { class: 'statline' }, pairs.map(([k, v]) =>
  h('span', { class: 'stat', title: STAT_NAME[k] },
    mods ? signed(v) : null, iconEl('stats', k, 'currentColor', 13), mods ? null : v)));
const modsEl = (mods) => statsEl(Object.entries(mods), { mods: true });
const unitStatsEl = (vals) => statsEl(STAT_ORDER.map((k) => [k, vals[k]]));
// A skill as icon + name, with its description on hover.
const skillTag = (sk) => h('span', { class: 'skill-tag', title: R.skills[sk].description },
  iconEl('skills', sk, 'currentColor', 13), R.skills[sk].name);
// A unit's skills with descriptions, for the selected-unit card.
const skillsEl = (def) => (def.skills || []).length ? h('div', { class: 'skills' }, def.skills.map((sk) =>
  h('div', { class: 'skill' }, skillTag(sk), h('span', { class: 'muted' }, ` ${R.skills[sk].description}`)))) : null;
const statLabel = (k, size = 14) => h('span', { class: 'with-icon', title: STAT_NAME[k] }, iconEl('stats', k, 'currentColor', size));
const unitLabel = (u) => `${P(u.player).name} ${R.units[u.type].name}`;
const buildKind = (st) => (st.phase === 'terrain' ? 'terrain' : st.phase === 'units' ? 'units' : null);
const liveUnit = (id) => {
  const u = id && ui.state().units[id];
  return u && !u.dead ? u : null;
};
// Fill and symbol colour of a hex.
const tileLook = (hex) => COLOURS[hex.terrain];
const chip = (p) => h('span', { class: 'chip', style: `background:${P(p).color}` });
// An enemy of the player to move that their combined attack beats right now.
const capturable = (st, u) => st.phase === 'battle' && u.player !== st.current && E.assault(st, u.id).beats;
const unitName = (st, id) => R.units[st.units[id].type].name;
// Offline, whoever is to play may act. Online, only when it's your seat's turn.
const myTurn = (st) => ui.game().isMyTurn(st);

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------------------------------------------------------------- state changes

function newGame() {
  ui.game().reset();
}

// One action, or a list of them (a route of steps) that undo treats as one.
// Online, the list sent to the other player includes any automatic end of turn,
// so their "auto-end" setting can't make the games differ.
function commit(action) {
  const actions = [].concat(action);
  const prev = ui.state();
  if (!myTurn(prev)) {
    toast(waitText());
    return false;
  }
  let next = prev;
  try {
    for (const a of actions) next = E.apply(next, a);
    if (ui.settings.autoEnd() && next.phase === 'battle' && actions[0].type !== 'endTurn' && !E.hasAnyAction(next)) {
      const end = { type: 'endTurn', auto: true };
      next = E.apply(next, end);
      actions.push(end);
    }
  } catch (e) {
    toast(e.message);
    return false;
  }
  ui.game().play(actions, next);
  return true;
}

function undo() {
  if (ui.game().canUndo()) ui.game().undo();
}

// Randomly finish the current build phase (terrain or units) for both players. Offline only.
function randomFill() {
  let st = ui.state();
  const phase = st.phase;
  const actions = [];
  while (st.phase === phase) {
    const opts = E.legalPlacements(st);
    if (!opts.length) break;
    actions.push(opts[Math.floor(Math.random() * opts.length)]);
    st = E.apply(st, actions[actions.length - 1]);
  }
  ui.game().play(actions, st, { quiet: true });
}

// ---------------------------------------------------------------- online

// Start (create = true) or rejoin an online game. The room id goes in the address,
// so the address is the link to send the other player.
function goOnline(roomId, create) {
  if (ui.online()) ui.online().leave();
  const url = new URL(location.href);
  url.searchParams.delete('quick');
  url.searchParams.set('room', roomId);
  window.history.replaceState(null, '', url);
  sharedHover = null;
  batch(() => {
    ui.game(Online.join(roomId, { create }));
    ui.selection(null);
    ui.autoPlace(false);
  });
}

function goOffline() {
  ui.online().leave();
  const url = new URL(location.href);
  url.searchParams.delete('room');
  window.history.replaceState(null, '', url);
  ui.game(localGame());
}

// Why you can't act right now (online).
function waitText() {
  const o = ui.online();
  const st = ui.state();
  if (o.seat() === null) return 'You are watching this game';
  if (!o.opponent()) return `Waiting for ${P(1 - o.seat()).name} to join`;
  if (st.phase === 'over') return 'The game is over';
  return `Waiting for ${P(st.current).name} to play`;
}

// Online stand-in for "Random-place the rest": while switched on, one of your
// pieces is placed at random each time it's your turn to build. Runs as an
// effect, so it goes again after each move; a new state cancels the wait.
function autoPlace() {
  const st = ui.state();
  if (!ui.online() || !buildKind(st)) {
    if (untracked(ui.autoPlace)) ui.autoPlace(false);
    return undefined;
  }
  if (!ui.autoPlace() || !myTurn(st)) return undefined;
  const timer = setTimeout(() => {
    const opts = E.legalPlacements(st);
    if (opts.length) commit(opts[Math.floor(Math.random() * opts.length)]);
  }, 250);
  return () => clearTimeout(timer);
}

// Online: tell the others which hex your pointer is over (null when it leaves the board).
function shareHover(k) {
  if (!ui.online() || k === sharedHover) return;
  sharedHover = k;
  ui.online().hover(k);
}

function copyLink(link) {
  const done = () => toast('Link copied');
  if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => toast('Select the link and copy it'));
  else toast('Select the link and copy it');
}

// ---------------------------------------------------------------- moving

const movesLeft = (s) => (s.turnState.move ? s.turnState.move.remaining : 0);

// Steps that take a unit to hex `to` this move: fewest steps, then the most
// movement left. Only the last step may land on an enemy, so the route never
// fights on the way. Null if it can't get there.
function findRoute(st, unitId, to, capture = true) {
  let frontier = [{ s: Object.assign({}, st, { log: [] }), steps: [] }];
  const seen = new Set();
  while (frontier.length) {
    let best = null;
    const next = [];
    for (const { s, steps } of frontier) {
      const u = s.units[unitId];
      for (const n of Hex.neighbors(u.hex, R.boardRadius)) {
        const last = n === to;
        if (!last && E.unitsAt(s, n).some((o) => o.player !== u.player)) continue;
        const a = last ? { type: 'step', unitId, to: n, capture } : { type: 'step', unitId, to: n };
        const s2 = E.tryApply(s, a);
        if (!s2) continue;
        if (last) {
          if (!best || movesLeft(s2) > movesLeft(best.s)) best = { s: s2, steps: [...steps, a] };
          continue;
        }
        const ts = s2.turnState;
        const sig = `${n}|${movesLeft(s2)}|${ts.moveDone}|${[...new Set(ts.move.visited)].sort().join(';')}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        next.push({ s: s2, steps: [...steps, a] });
      }
    }
    if (best) return best;
    frontier = next;
  }
  return null;
}

// Can this unit start or carry on the move this turn?
function canAct(st, u) {
  const ts = st.turnState;
  return !!u && st.phase === 'battle' && u.player === st.current && myTurn(st) && !ts.moveDone && (!ts.move || ts.move.unitId === u.id);
}

// Route to a hex in the current state plus what it captures, cached until the state changes.
function plan(unitId, k) {
  const st = ui.state();
  const plans = ui.plans();
  const key = `${unitId}>${k}`;
  if (!plans.has(key)) {
    const r = findRoute(st, unitId, k);
    plans.set(key, r && {
      steps: r.steps,
      caps: E.unitsAt(st, k).filter((o) => o.player !== st.units[unitId].player && r.s.units[o.id].dead),
    });
  }
  return plans.get(key);
}

// Menu items for moving unit `mine` to hex k (by any route), including "move in beside".
function moveItems(st, mine, k) {
  const items = [];
  const p = plan(mine.id, k);
  if (!p) return items;
  const names = p.caps.map((c) => R.units[c.type].name).join(' + ');
  items.push({ label: p.caps.length ? `Move here and capture ${names}` : 'Move here', run: () => commit(p.steps) });
  const beside = p.caps.length && findRoute(st, mine.id, k, false);
  if (beside) items.push({ label: `Move in beside ${names} (no capture)`, run: () => commit(beside.steps) });
  return items;
}

// ---------------------------------------------------------------- input

function onHexClick(k, ev) {
  if (suppressClick) return;
  hideMenu();
  const st = ui.state();
  const kind = buildKind(st);
  if (kind) {
    if (!myTurn(st)) {
      toast(waitText());
      return;
    }
    if (!ui.choice()) return;
    const a = E.placeAction(kind, ui.choice(), k);
    const why = E.whyIllegal(st, a);
    if (why) toast(why);
    else commit(a);
    return;
  }

  const here = E.unitsAt(st, k);
  const sel = liveUnit(ui.selected());
  const mine = sel && st.phase === 'battle' && sel.player === st.current && myTurn(st) ? sel : null;
  const items = [];
  if (mine) {
    if (k === mine.hex) {
      for (const id of E.captureTargets(st, mine.id)) {
        items.push({ label: `Capture ${unitName(st, id)} here (uses your move)`, run: () => commit({ type: 'capture', unitId: mine.id, targetId: id }) });
      }
    }
    if (k !== mine.hex) items.push(...moveItems(st, mine, k));
  }

  const selectable = here
    .filter((u) => u.id !== ui.selected())
    .sort((a, b) => (b.player === st.current) - (a.player === st.current));
  const ownSelectable = selectable.some((u) => u.player === st.current);

  if (!items.length) {
    select(selectable.length ? selectable[0].id : null);
    return;
  }
  if (items.length === 1 && !ownSelectable) {
    items[0].run();
    return;
  }
  for (const u of selectable) {
    items.push({ label: `Select ${unitLabel(u)}`, subtle: true, run: () => select(u.id) });
  }
  showMenu(items, ev.clientX, ev.clientY);
}

function showMenu(items, x, y) {
  const menu = $('menu');
  menu.replaceChildren(...items.map((it) =>
    h('button', { class: it.subtle ? 'subtle' : '', onclick: () => { hideMenu(); it.run(); } }, it.label)));
  menu.hidden = false;
  const w = menu.offsetWidth;
  const hgt = menu.offsetHeight;
  menu.style.left = `${Math.min(x + 8, window.innerWidth - w - 8)}px`;
  menu.style.top = `${Math.min(y + 8, window.innerHeight - hgt - 8)}px`;
}

function hideMenu() {
  $('menu').hidden = true;
}

document.addEventListener('mousedown', (e) => {
  if (!$('menu').contains(e.target)) hideMenu();
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select') || e.ctrlKey && e.key !== 'z' || e.metaKey && e.key !== 'z') return;
  if (e.key === 'Escape') {
    hideMenu();
    select(null);
  } else if (e.key === 'z' || e.key === 'u') {
    e.preventDefault();
    undo();
  } else if (e.key === 'e' && ui.state().phase === 'battle') {
    commit({ type: 'endTurn' });
  }
});

// ---------------------------------------------------------------- rendering

// Make the board's fixed parts once, then draw each part of the page in its own
// effect. An effect reruns when a signal it read changes, so moving the pointer
// redraws the aim arrow, hovering a hex redraws the overlay and the hover bar, and
// a move redraws the lot.
function mount() {
  const root = $('board');
  root.setAttribute('viewBox', '-245 -250 490 500');
  drawDefs(svg('defs', {}, root));
  const layer = (attrs) => svg('g', attrs, root);
  const inert = { 'pointer-events': 'none' };
  // The effects and aim layers are never cleared by a redraw, so an effect isn't cut short by the next click.
  layers = {
    tiles: layer({}),
    under: layer(inert), // overlay below the units
    mods: layer(inert),
    units: layer(inert),
    over: layer(inert), // overlay above the units
    fx: layer({ class: 'fx', ...inert }),
    aim: layer({ class: 'aim', ...inert }),
    hits: layer({}),
  };
  effect(renderBoard);
  effect(renderOverlay);
  effect(drawAim);
  effect(renderHoverInfo);
  effect(renderPanel);
  effect(autoPlace);
  // A menu offers moves in the state it was opened in, so it goes when the state changes.
  effect(() => { ui.state(); hideMenu(); });
}

function drawDefs(defs) {
  const marker = (id, color) => {
    const m = svg('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 4.5, markerHeight: 4.5, orient: 'auto-start-reverse' }, defs);
    svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }, m);
  };
  marker('arrow-hit', DANGER);
  marker('arrow-miss', '#6b7280');
  R.players.forEach((pl, i) => marker(`arrow-p${i}`, pl.color));
  const hatch = svg('pattern', { id: 'hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  svg('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#fff', 'stroke-opacity': 0.14, 'stroke-width': 3 }, hatch);
  const shadow = svg('filter', { id: 'lift', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  svg('feDropShadow', { dx: 0, dy: 1.5, stdDeviation: 1.5, 'flood-color': '#000', 'flood-opacity': 0.45 }, shadow);
  svg('circle', { r: 16.4 }, svg('clipPath', { id: 'unit-clip' }, defs)); // inside a unit picture's ring
}

function renderBoard() {
  const st = ui.state();
  const { tiles, mods, units, hits } = layers;
  for (const g of [tiles, mods, units, hits]) g.replaceChildren();

  const inBuild = !!buildKind(st);
  // Zones only matter while building, so only then do empty zone hexes take the player's tint.
  const groundFill = (hex) => (inBuild && hex.terrain === 'plain' && hex.zone !== null ? P(hex.zone).tint : tileLook(hex).color);
  const mapView = ui.settings.mapStyle() === 'graphic';
  if (mapView) {
    MapView.draw(tiles, st, { size: SIZE, pos, look: tileLook, fill: groundFill, color: (p) => P(p).color });
  }
  for (const k of Object.keys(st.hexes)) {
    const hex = st.hexes[k];
    const t = R.terrain[hex.terrain];
    const { x, y } = pos(k);
    const look = tileLook(hex);
    if (!mapView) drawTile(k, hex, t, x, y, look, groundFill(hex), tiles);
    if (Object.keys(t.mods).length) drawTerrainMods(t.mods, x, y - SIZE * 0.61, mods);
    if (ui.settings.coords()) svgText(k, x, y + SIZE * 0.78, 'coord', tiles);

    // "grab": a unit here can be dragged (and the browser won't scroll the page instead).
    const grab = E.unitsAt(st, k).some((u) => canAct(st, u));
    const hit = svg('polygon', { points: points(k, SIZE), class: grab ? 'hit grab' : 'hit' }, hits);
    hit.addEventListener('click', (ev) => onHexClick(k, ev));
    hit.addEventListener('mouseenter', () => ui.hover(k));
    hit.addEventListener('mouseleave', () => { if (ui.hover() === k) ui.hover(null); });
  }

  for (const [id, { x, y, r }] of Object.entries(ui.unitXY())) drawUnit(st.units[id], x, y, r, units);

  // Animate the change that led here, once: a move made on this side or the other.
  const change = ui.game().lastChange;
  if (change && change.actions && change.next === st && change !== animated) {
    animated = change;
    untracked(() => playEffects(change));
  }
}

// Where each unit sits: the middle of its hex, or side by side when two share it.
function layoutUnits(st) {
  const xy = {};
  const skilled = (u) => (R.units[u.type].skills || []).length;
  for (const k of Object.keys(st.hexes)) {
    const occ = E.unitsAt(st, k).sort((a, b) => skilled(a) - skilled(b));
    if (!occ.length) continue;
    const { x, y } = pos(k);
    const r = occ.length > 1 ? 15 : 18;
    occ.forEach((u, i) => { xy[u.id] = { x: occ.length > 1 ? x + (i ? 19 : -19) : x, y, r }; });
  }
  return xy;
}

function playEffects({ prev, next, actions }) {
  FX.play(prev, next, actions, {
    layer: layers.fx, size: SIZE, before: layoutUnits(prev), after: ui.unitXY(), pos,
    unitEl: (id) => layers.units.querySelector(`[data-unit="${id}"]`),
    token: drawToken,
    color: (p) => P(p).color,
    // The river is only drawn on the Graphic map, so only splash there.
    crossing: (hexes, a, b) => (ui.settings.mapStyle() === 'graphic' ? MapView.crossing(hexes, a, b) : null),
  });
}

// Symbols map: one flat hexagon per tile with a big terrain symbol.
function drawTile(k, hex, t, x, y, look, fill, tiles) {
  svg('polygon', { points: points(k, SIZE - 1), fill, class: 'tile' }, tiles);
  if (TEXTURE[hex.terrain]) svg('polygon', { points: points(k, SIZE - 1), fill: `url(#${TEXTURE[hex.terrain]})` }, tiles);
  const capitalOwner = t.capital && hex.owner !== null ? hex.owner : null;
  if (capitalOwner !== null) {
    svg('polygon', { points: points(k, SIZE - 5), fill: 'none', stroke: P(capitalOwner).color, 'stroke-width': 4 }, tiles);
  }
  // Just a big symbol; names and modifiers are in the hover bar and rules reference.
  if (hex.terrain !== 'plain') drawIcon('terrain', hex.terrain, x, y, SIZE * 1.4, look.ink, tiles, { opacity: 0.45, width: 1.3 });
}

// "+1⚔ +1🛡" on a small pill near the top of a tile: what the terrain does to a unit standing on it.
function drawTerrainMods(mods, cx, cy, parent) {
  const items = Object.entries(mods);
  const ITEM = 21;
  const w = items.length * ITEM + 4;
  const g = svg('g', {}, parent);
  svg('rect', { x: cx - w / 2, y: cy - 7, width: w, height: 14, rx: 7, class: 'tmods-bg' }, g);
  items.forEach(([k, v], i) => {
    const ix = cx - w / 2 + 2 + i * ITEM;
    svgText(signed(v), ix + 7, cy + 3.5, `tmods-text ${v > 0 ? 'buff' : 'debuff'}`, g);
    drawIcon('stats', k, ix + 16, cy, 9.5, '#222', g, { width: 2.6 });
  });
}

function drawUnit(u, cx, cy, r, parent) {
  const st = ui.state();
  const sts = E.stats(st, u.id);
  const g = svg('g', { 'data-unit': u.id }, parent);
  if (capturable(st, u)) svg('circle', { cx, cy, r: r + 6, class: 'capt-ring' }, g);
  if (ui.selected() === u.id) {
    svg('circle', { cx, cy, r: r + 4, class: 'sel-ring-outer' }, g);
    svg('circle', { cx, cy, r: r + 4, class: 'sel-ring' }, g);
  }
  drawToken(u, cx, cy, r, g);

  // ⚔ atk  🛡 def under the counter; green/red when terrain changes the number.
  const sy = cy + r + 11;
  const statBadge = (name, iconX, textX) => {
    drawIcon('stats', name, cx + iconX, sy - 3.5, 10, '#fff', g, { width: 8 });
    drawIcon('stats', name, cx + iconX, sy - 3.5, 10, '#222', g, { width: 3 });
    const t = svgText(String(sts[name].total), cx + textX, sy, 'ustats', g);
    if (sts[name].mod) t.classList.add(sts[name].mod > 0 ? 'buff' : 'debuff');
  };
  statBadge('attack', -13, -4.5);
  statBadge('defence', 5.5, 13.5);

  const mv = st.turnState.move;
  if (st.phase === 'battle' && mv && mv.unitId === u.id && !st.turnState.moveDone) {
    svg('circle', { cx: cx + r * 0.8, cy: cy - r * 0.8, r: 7, class: 'mv-badge' }, g);
    svgText(String(mv.remaining), cx + r * 0.8, cy - r * 0.8 + 3.5, 'mv-badge-text', g);
  }
}

// Just the counter itself (no rings or stats). Effects use it too, for a unit being captured.
function drawToken(u, cx, cy, r, g) {
  const dashed = R.logic.hasSkill(u.type, 'insurgency');
  if (ui.settings.unitStyle() === 'graphic' && UnitArt.has(u.type)) {
    // Graphic units: an illustrated token (unitart.js, drawn at radius 18) inside a ring in the player's colour.
    const tg = svg('g', { transform: `translate(${cx},${cy}) scale(${r / 18})` }, g);
    svg('circle', { r: 18, fill: P(u.player).tint, filter: 'url(#lift)' }, tg);
    const art = svg('g', { 'clip-path': 'url(#unit-clip)' }, tg);
    svg('circle', { r: 17, fill: 'none', stroke: P(u.player).color, 'stroke-width': 2.4, 'stroke-dasharray': dashed ? '4 2.4' : null }, tg);
    UnitArt.draw(u.type, art, svg('g', {}, tg), P(u.player).color); // second layer: the part that sticks out
  } else {
    svg('circle', {
      cx, cy, r, fill: P(u.player).color, stroke: '#fff', 'stroke-width': 2, filter: 'url(#lift)',
      'stroke-dasharray': dashed ? '4 3' : null,
    }, g);
    if (!drawIcon('units', u.type, cx, cy, r * 1.15, '#fff', g, { width: 2.6 })) svgText(R.units[u.type].short, cx, cy + 5, 'ulabel', g);
  }
}

function renderOverlay() {
  const st = ui.state();
  const { under, over } = layers;
  under.replaceChildren();
  over.replaceChildren();
  const choice = ui.choice();
  const hover = ui.hover();
  const selected = ui.selected();

  const kind = buildKind(st);
  if (kind && choice && myTurn(st)) {
    for (const k of Object.keys(st.hexes)) {
      if (E.isLegal(st, E.placeAction(kind, choice, k))) {
        svg('polygon', { points: points(k, SIZE - 5), class: 'place-target', stroke: P(st.current).color }, under);
      }
    }
  }

  if (st.phase === 'battle' || st.phase === 'over') {
    const sel = liveUnit(selected);
    const hovered = hover ? E.unitsAt(st, hover) : [];
    const hov = hovered.find((u) => u.id !== selected);
    if (hov) drawUnitOverlay(hov, false, under);
    if (sel) drawUnitOverlay(sel, true, under);
    drawMovePath(over);
    // Attack arrows onto the hovered units (or the selected one), plus every capturable enemy if switched on.
    const targets = new Set((hovered.length ? hovered : sel ? [sel] : []).map((u) => u.id));
    if (ui.settings.threats()) E.unitsOf(st, 1 - st.current).filter((u) => capturable(st, u)).forEach((u) => targets.add(u.id));
    drawAssaults([...targets], over);
  }

  if (hover) svg('polygon', { points: points(hover, SIZE - 2), class: 'hover-ring' }, over);
  // Online: the hex each other player's pointer is over, in their colour.
  const o = ui.online();
  if (o) {
    for (const [seat, k] of Object.entries(o.hovers())) {
      if (Number(seat) === o.seat() || !st.hexes[k]) continue;
      const color = P(Number(seat)).color;
      svg('polygon', { points: points(k, SIZE - 3), class: 'peer-hover', stroke: color, fill: color }, over);
    }
  }
}

// Movement reach (light wash, outlined in the unit's colour), next legal steps
// (green dashed) and attack range (dark dotted).
function drawUnitOverlay(u, primary, under) {
  const st = ui.state();
  const ts = st.turnState;
  const active = st.phase === 'battle' && u.player === st.current;
  const canMove = active && !ts.moveDone && (!ts.move || ts.move.unitId === u.id);
  const color = P(u.player).color;

  const reach = canMove ? E.reachable(st, u.id) : active ? [] : E.reachable(st, u.id, { preview: true });
  for (const k of reach) {
    svg('polygon', {
      points: points(k, SIZE - 4), stroke: color,
      class: canMove && primary ? 'reach' : 'reach preview',
    }, under);
  }
  if (canMove && primary) {
    for (const k of E.legalSteps(st, u.id)) svg('polygon', { points: points(k, SIZE - 9), class: 'step' }, under);
  }
  if (active && primary && E.captureTargets(st, u.id).length) {
    svg('polygon', { points: points(u.hex, SIZE - 9), class: 'step' }, under);
  }

  for (const k of E.hexesInRange(st, u.id)) {
    svg('polygon', { points: points(k, SIZE * 0.8), class: primary ? 'range' : 'range preview' }, under);
  }

}

// Curved arrows from every unit adding to the attack on each target, each
// carrying that unit's attack (the target's defence is already under it).
// Arrows into one target from about the same direction bend alternate ways
// (+1, −1, +2, −2 …) so they never lie on top of each other.
function drawAssaults(targetIds, parent) {
  const st = ui.state();
  const xy = ui.unitXY();
  const toward = (a, b, d) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: a.x + ((b.x - a.x) / len) * d, y: a.y + ((b.y - a.y) / len) * d };
  };
  for (const tId of targetIds) {
    const t = xy[tId];
    const a = E.assault(st, tId);
    if (!t || !a.contributors.length) continue;
    const cls = a.beats ? 'hit' : 'miss';
    const g = svg('g', {}, parent);
    const arrows = a.contributors
      .map((c) => ({ c, from: xy[c.id] }))
      .filter((x) => x.from)
      .map((x) => Object.assign(x, { angle: Math.atan2(x.from.y - t.y, x.from.x - t.x) }))
      .sort((p, q) => p.angle - q.angle);
    let group = [];
    const flush = () => {
      group.forEach((x, i) => { x.bend = (i % 2 ? -1 : 1) * (1 + Math.floor(i / 2)); });
      group = [];
    };
    for (const x of arrows) {
      if (group.length && x.angle - group[group.length - 1].angle > 0.45) flush();
      group.push(x);
    }
    flush();

    const labels = [];
    for (const x of arrows) {
      const p0 = x.from;
      const len = Math.hypot(t.x - p0.x, t.y - p0.y) || 1;
      const k = x.bend * 0.3 * len; // control-point offset; the curve's apex sits half as far out
      const c = { x: (p0.x + t.x) / 2 - ((t.y - p0.y) / len) * k, y: (p0.y + t.y) / 2 + ((t.x - p0.x) / len) * k };
      const s0 = toward(p0, c, p0.r + 2);
      const e0 = toward(t, c, t.r + 5);
      svg('path', { d: `M${s0.x},${s0.y} Q${c.x},${c.y} ${e0.x},${e0.y}`, class: `atk-line ${cls}`, 'marker-end': `url(#arrow-${cls})` }, g);
      labels.push({ at: { x: 0.25 * s0.x + 0.5 * c.x + 0.25 * e0.x, y: 0.25 * s0.y + 0.5 * c.y + 0.25 * e0.y }, c: x.c });
    }
    // Labels after the arrows so no line crosses a number.
    for (const l of labels) {
      svg('circle', { cx: l.at.x, cy: l.at.y, r: 7.5, fill: P(st.units[l.c.id].player).color, class: 'atk-bubble' }, g);
      svgText(String(l.c.attack), l.at.x, l.at.y + 3.5, 'atk-bubble-text', g);
    }
  }
}

function drawMovePath(parent) {
  const mv = ui.state().turnState.move;
  if (!mv || mv.path.length < 2) return;
  const pts = mv.path.map((k) => { const { x, y } = pos(k); return `${x},${y}`; }).join(' ');
  svg('polyline', { points: pts, class: 'move-path' }, parent);
}

// ---------------------------------------------------------------- aim arrow and dragging

// Board coordinates of a pointer event.
function boardPoint(ev) {
  const m = $('board').getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

// The hex under a board point, if any.
function hexAt(p) {
  if (!p) return null;
  let best = null;
  let bd = Infinity;
  for (const k of Object.keys(ui.state().hexes)) {
    const c = pos(k);
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bd) { bd = d; best = k; }
  }
  return bd <= SIZE ? best : null;
}

// The unit the aim arrow starts from: the one being dragged, else the selected unit if it can still move.
function aimUnit() {
  const d = ui.drag();
  const u = liveUnit(d && d.active ? d.id : ui.selected());
  return canAct(ui.state(), u) ? u : null;
}

// An arrow from the unit to the pointer: in the player's colour if the unit can get there,
// magenta if it would capture, grey if it can't. Dots mark the hexes on the way.
// The pointer is read only while there's a unit to aim, so otherwise moving it redraws nothing.
function drawAim() {
  const layer = layers.aim;
  layer.replaceChildren();
  const u = aimUnit();
  const from = u && ui.unitXY()[u.id];
  if (!from) return;
  const p = ui.pointer();
  if (!p) return;
  const len = Math.hypot(p.x - from.x, p.y - from.y);
  if (len < from.r + 10) return;
  const k = hexAt(p);
  const route = k && k !== u.hex ? plan(u.id, k) : null;
  const kind = !route ? 'miss' : route.caps.length ? 'hit' : `p${u.player}`;
  const color = !route ? '#6b7280' : route.caps.length ? DANGER : P(u.player).color;
  if (route) {
    for (const a of route.steps.slice(0, -1)) {
      const c = pos(a.to);
      svg('circle', { cx: c.x, cy: c.y, r: 4.5, fill: color, class: 'aim-dot' }, layer);
    }
  }
  const s = { x: from.x + ((p.x - from.x) / len) * (from.r + 4), y: from.y + ((p.y - from.y) / len) * (from.r + 4) };
  const d = `M${s.x.toFixed(1)},${s.y.toFixed(1)} L${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  svg('path', { d, class: 'aim-casing' }, layer);
  svg('path', { d, class: route ? 'aim-line' : 'aim-line miss', stroke: color, 'marker-end': `url(#arrow-${kind})` }, layer);
}

// Dropping a dragged unit on a hex: the same choices as clicking it.
function dropOn(id, k, ev) {
  const st = ui.state();
  const u = liveUnit(id);
  if (!u || !k || k === u.hex) return;
  const items = moveItems(st, u, k);
  if (!items.length) toast(`The ${unitName(st, id)} can't get there this turn`);
  else if (items.length === 1) items[0].run();
  else showMenu(items, ev.clientX, ev.clientY);
}

// Mouse, pen and touch alike: press on one of your units and drag to where it should go.
// A press without much movement is an ordinary click.
function setupPointer() {
  const root = $('board');
  root.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const p = boardPoint(ev);
    const st = ui.state();
    const k = hexAt(p);
    const mine = k ? E.unitsAt(st, k).filter((u) => canAct(st, u)) : [];
    const u = mine.find((x) => x.id === ui.selected()) || mine[0];
    batch(() => {
      ui.pointer(p);
      ui.drag(u ? { id: u.id, pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, active: false } : null);
    });
  });
  root.addEventListener('pointermove', (ev) => batch(() => {
    ui.pointer(boardPoint(ev));
    shareHover(hexAt(ui.pointer()));
    const d = ui.drag();
    if (d && d.pointerId === ev.pointerId && !d.active && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 8) {
      ui.drag(Object.assign({}, d, { active: true }));
      try { root.setPointerCapture(ev.pointerId); } catch (e) { /* pointer already gone */ }
      hideMenu();
      select(d.id);
    }
  }));
  root.addEventListener('pointerup', (ev) => batch(() => {
    const d = ui.drag();
    ui.drag(null);
    if (ev.pointerType !== 'mouse') { // no cursor to follow on a touch screen
      ui.pointer(null);
      shareHover(null);
    }
    if (d && d.active) {
      suppressClick = true; // the click that follows a drag isn't a click
      setTimeout(() => { suppressClick = false; }, 0);
      dropOn(d.id, hexAt(boardPoint(ev)), ev);
    }
  }));
  root.addEventListener('pointercancel', () => batch(() => {
    ui.drag(null);
    ui.pointer(null);
    shareHover(null);
  }));
  root.addEventListener('pointerleave', () => {
    if (ui.drag()) return;
    ui.pointer(null);
    shareHover(null);
  });
}

function renderHoverInfo() {
  const box = $('hover-info');
  const st = ui.state();
  const k = ui.hover();
  if (!k) {
    box.replaceChildren(h('span', { class: 'muted' }, 'Hover a hex for details. Hover any unit to see its reach and the attack against it.'));
    return;
  }
  const hex = st.hexes[k];
  const t = R.terrain[hex.terrain];
  const parts = [
    h('strong', { class: 'with-icon' }, iconEl('terrain', hex.terrain), t.name),
    hex.owner !== null ? h('span', {}, ' · ', chip(hex.owner), `${P(hex.owner).name}'s ${t.name.toLowerCase()}`) : null,
    Object.keys(t.mods).length ? h('span', { class: 'mods' }, ' · ', modsEl(t.mods)) : null,
    hex.zone !== null && buildKind(st) ? h('span', { class: 'muted' }, ` · ${P(hex.zone).name} zone`) : null,
  ];
  for (const u of E.unitsAt(st, k)) {
    const s = E.stats(st, u.id);
    parts.push(h('span', { class: 'hover-unit' }, ' · ', iconEl('units', u.type, P(u.player).color, 14),
      `${R.units[u.type].name} `, unitStatsEl(Object.fromEntries(STAT_ORDER.map((n) => [n, s[n].total]))),
      capturable(st, u) ? h('b', { class: 'capt-text' }, ' CAPTURABLE') : null));
  }
  box.replaceChildren(...parts.filter(Boolean));
}

// ---------------------------------------------------------------- side panel

function renderPanel() {
  const st = ui.state();
  const sections = [
    h('header', { class: 'title' }, h('h1', {}, 'Near Peer')),
    statusCard(st),
    onlineCard(st),
    st.phase === 'over' ? winCard(st) : null,
    buildKind(st) ? buildCard(st) : null,
    st.phase === 'battle' ? actionsCard(st) : null,
    st.phase === 'battle' || st.phase === 'over' ? selectedCard(st) : null,
    controlsCard(),
    armiesCard(st),
    logCard(st),
    rulesCard(st),
  ];
  $('panel').replaceChildren(...sections.filter(Boolean));
}

function statusCard(st) {
  const phaseName = { terrain: 'Build · terrain', units: 'Build · units', battle: 'Battle', over: 'Game over' }[st.phase];
  return h('section', { class: 'card status', style: `border-left-color:${st.phase === 'over' ? '#999' : P(st.current).color}` },
    h('div', { class: 'phase' }, phaseName),
    st.phase === 'over' ? null : h('div', { class: 'turn' }, chip(st.current), h('strong', {}, P(st.current).name), ' to play',
      ui.online() && ui.online().seat() === st.current ? ' (you)' : null,
      st.phase === 'battle' ? h('span', { class: 'muted' }, ` · turn ${st.turn}`) : null));
}

function winCard(st) {
  return h('section', { class: 'card win', style: `border-color:${P(st.winner).color}` },
    h('div', { class: 'win-title' }, chip(st.winner), `${P(st.winner).name} wins!`),
    h('div', {}, `${P(st.winner).name} ${st.winReason}.`),
    ui.online() && ui.online().seat() === null ? null : h('button', { class: 'primary', onclick: newGame }, 'New game'));
}

function buildCard(st) {
  const kind = buildKind(st);
  if (!myTurn(st)) {
    return h('section', { class: 'card' },
      h('h2', {}, kind === 'terrain' ? 'Place terrain' : 'Place units'),
      h('p', { class: 'hint' }, `${waitText()}.`), autoPlaceButton());
  }
  const sup = st.supply[st.current][kind];
  const defs = kind === 'terrain' ? R.terrain : R.units;
  const opp = st.supply[1 - st.current][kind].length;
  const desc = (item) => kind === 'terrain'
    ? modsEl(defs[item].mods)
    : unitStatsEl(defs[item]);
  return h('section', { class: 'card' },
    h('h2', {}, kind === 'terrain' ? 'Place terrain' : 'Place units'),
    h('div', { class: 'picks' }, [...new Set(sup)].map((item) =>
      h('button', {
        class: `pick${item === ui.choice() ? ' on' : ''}`,
        style: item === ui.choice() ? `border-color:${P(st.current).color}` : null,
        onclick: () => ui.picked(item),
      }, h('span', { class: 'pick-name' }, iconEl(kind === 'terrain' ? 'terrain' : 'units', item, kind === 'terrain' ? 'currentColor' : P(st.current).color),
        defs[item].name,
        kind === 'units' ? (defs[item].skills || []).map((sk) =>
          h('span', { class: 'pick-skill', title: `${R.skills[sk].name}: ${R.skills[sk].description}` }, iconEl('skills', sk, 'currentColor', 13))) : null),
        h('span', { class: 'pick-desc' }, desc(item))))),
    h('p', { class: 'hint' }, 'Pick a piece, then click a highlighted hex in your zone. ',
      `${P(1 - st.current).name} has ${opp} left.`),
    ui.online() ? autoPlaceButton() : h('button', { onclick: randomFill }, 'Random-place the rest of this phase'));
}

function autoPlaceButton() {
  if (!ui.online() || ui.online().seat() === null) return null;
  return h('button', { onclick: () => ui.autoPlace(!ui.autoPlace()) },
    ui.autoPlace() ? 'Stop placing at random' : 'Place my pieces at random');
}

function actionsCard(st) {
  const ts = st.turnState;
  let move = 'ready';
  if (ts.moveDone) move = 'done';
  else if (ts.move) move = `${R.units[st.units[ts.move.unitId].type].name}: ${ts.move.remaining} left`;
  return h('section', { class: 'card' },
    h('h2', {}, 'This turn'),
    h('div', { class: 'pills' }, h('span', { class: `pill${ts.moveDone ? ' done' : ''}` }, `Move: ${move}`)),
    h('div', { class: 'row' },
      h('button', { class: 'primary', disabled: !myTurn(st), onclick: () => commit({ type: 'endTurn' }) }, ts.move || ts.moveDone ? 'End turn (E)' : 'Pass (E)')),
    myTurn(st) ? null : h('p', { class: 'hint' }, `${waitText()}.`),
    h('p', { class: 'hint' }, 'Move one unit. Stepping onto an enemy captures it if the attack of all your units in range of it adds up to its defence. ',
      'A dashed ring marks enemies you can capture. Hover any unit to see the attack against it.'));
}

function selectedCard(st) {
  const u = liveUnit(ui.selected());
  if (!u) return h('section', { class: 'card muted' }, 'Click a unit to see its stats and the attack against it.');
  const def = R.units[u.type];
  const sts = E.stats(st, u.id);
  const terr = E.terrainAt(st, u.hex);
  const ts = st.turnState;
  const moving = ts.move && ts.move.unitId === u.id && !ts.moveDone;
  const row = (name, label) => h('tr', {},
    h('td', {}, label),
    h('td', {}, sts[name].base),
    h('td', { class: sts[name].mod > 0 ? 'buff' : sts[name].mod < 0 ? 'debuff' : 'muted' }, sts[name].mod ? signed(sts[name].mod) : '–'),
    h('td', {}, h('strong', {}, sts[name].total),
      name === 'movement' && moving ? h('span', { class: 'muted' }, ` (${ts.move.remaining} left)`) : null));

  const mine = st.phase === 'battle' && u.player === st.current && myTurn(st);
  const captures = mine ? E.captureTargets(st, u.id) : [];
  const captureBox = captures.length ? h('div', { class: 'targets' },
    h('h3', {}, 'Capturable on this hex'),
    captures.map((id) => h('div', { class: 'target' },
      h('span', {}, `${unitName(st, id)} `, h('b', { class: 'capt-text' }, `${E.assault(st, id).total} vs ${E.assault(st, id).defence}`)),
      h('button', { class: 'primary', onclick: () => commit({ type: 'capture', unitId: u.id, targetId: id }) }, 'Capture (uses move)')))) : null;

  const a = E.assault(st, u.id);
  const foe = 1 - u.player;
  const verdict = a.beats
    ? h('b', { class: 'capt-text' }, foe === st.current ? 'capturable: step onto it' : `${P(foe).name} could capture it`)
    : h('span', { class: 'muted' }, 'safe');
  const threat = h('div', { class: 'targets' },
    h('h3', {}, foe === st.current ? 'Your attack on it' : `${P(foe).name} attack on it`),
    a.contributors.length
      ? h('div', {}, a.contributors.flatMap((c, i) => [i ? ' + ' : '', `${unitName(st, c.id)} ${c.attack}`]),
        ` = ${a.total} vs ${a.defence} defence · `, verdict)
      : h('div', { class: 'muted' }, 'No enemy in range.'));

  return h('section', { class: 'card' },
    h('h2', {}, h('span', { class: 'mini', style: `background:${P(u.player).color}` }, iconEl('units', u.type, '#fff', 12)), unitLabel(u),
      capturable(st, u) ? h('span', { class: 'tag capt' }, 'capturable') : null),
    h('div', { class: 'muted with-icon' }, iconEl('terrain', u.hex && st.hexes[u.hex].terrain), `On ${terr.name}`, Object.keys(terr.mods).length ? modsEl(terr.mods) : null),
    skillsEl(def),
    h('table', { class: 'stats' },
      h('tr', {}, h('th', {}, ''), h('th', {}, 'base'), h('th', {}, 'terrain'), h('th', {}, 'now')),
      row('attack', h('span', { class: 'with-icon' }, iconEl('stats', 'attack', 'currentColor', 14), 'Attack')),
      row('defence', h('span', { class: 'with-icon' }, iconEl('stats', 'defence', 'currentColor', 14), 'Defence')),
      row('movement', h('span', { class: 'with-icon' }, iconEl('stats', 'movement', 'currentColor', 14), 'Movement')),
      row('range', h('span', { class: 'with-icon' }, iconEl('stats', 'range', 'currentColor', 14), 'Range'))),
    captureBox,
    threat);
}

// A Symbols / Graphic picker for one of the drawing styles, remembered in the browser.
function styleSelect(label, key, storeKey) {
  return h('label', { class: 'setting' }, `${label} `,
    h('select', { onchange: (e) => { ui.settings[key](e.target.value); store.set(storeKey, e.target.value); } },
      [['symbols', 'Symbols'], ['graphic', 'Graphic']].map(([id, name]) => h('option', { value: id, selected: id === ui.settings[key]() }, name))));
}

// Auto (follow the system) / Light / Dark, remembered in the browser. index.html applies the
// remembered choice before the page draws, so a dark page doesn't flash light first.
function themeSelect() {
  const now = document.documentElement.dataset.theme || 'auto';
  return h('label', { class: 'setting' }, 'Theme ',
    h('select', {
      onchange: (e) => {
        const v = e.target.value;
        if (v === 'auto') delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = v;
        store.set('theme', v);
      },
    }, [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([id, name]) => h('option', { value: id, selected: id === now }, name))));
}

function controlsCard() {
  const toggle = (key, label) => h('label', { class: 'toggle' },
    h('input', { type: 'checkbox', checked: ui.settings[key](), onchange: (e) => ui.settings[key](e.target.checked) }),
    label);
  return h('section', { class: 'card' },
    h('div', { class: 'row' },
      h('button', { disabled: !ui.game().canUndo(), onclick: undo }, 'Undo (Z)'),
      h('button', {
        disabled: ui.online() && ui.online().seat() === null,
        onclick: () => { if (ui.history().length === 0 || confirm(ui.online() ? 'Start a new game for both players?' : 'Start a new game?')) newGame(); },
      }, 'New game')),
    h('div', { class: 'toggles' },
      toggle('autoEnd', 'Auto-end turn when nothing is left to do'),
      toggle('threats', 'Show attack arrows on every enemy you can capture'),
      toggle('coords', 'Show hex coordinates')),
    h('div', { class: 'settings' }, styleSelect('Map', 'mapStyle', 'map-style'), styleSelect('Units', 'unitStyle', 'unit-style'), themeSelect()));
}

function onlineCard() {
  const o = ui.online();
  if (!o) {
    return h('section', { class: 'card' },
      h('h2', {}, 'Play online'),
      h('p', { class: 'hint' }, 'Play a friend in their own browser. You connect directly, peer to peer: there is no game server.'),
      h('button', {
        class: 'primary',
        onclick: () => { if (ui.history().length === 0 || confirm('Leave this game and start a new one online?')) goOnline(Online.newRoomId(), true); },
      }, 'Create a game and get a link'));
  }
  const link = location.href;
  const seat = o.seat();
  const status = o.status();
  const opp = seat === null ? null : 1 - seat;
  let who = null;
  if (status === 'connecting') who = 'Connecting…';
  else if (status === 'ready' && seat === null) who = Object.keys(o.peers()).length ? 'Both seats are taken, so you are watching.' : 'Looking for the other players…';
  else if (status === 'ready' && o.opponent()) who = h('span', {}, chip(opp), `${P(opp).name} is connected.`);
  else if (status === 'ready') who = `Waiting for ${P(opp).name}. Send them this link:`;
  return h('section', { class: 'card' },
    h('h2', {}, 'Online', h('span', { class: 'muted' }, ` · room ${o.roomId}`), peopleTag(o)),
    seat === null ? null : h('div', {}, 'You are ', chip(seat), h('strong', {}, P(seat).name), '.'),
    who ? h('div', {}, who) : null,
    h('div', { class: 'row link-row' },
      h('input', { class: 'link', readonly: true, value: link, onfocus: (e) => e.target.select() }),
      h('button', { onclick: () => copyLink(link) }, 'Copy')),
    ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ? h('p', { class: 'hint' },
      'This page is served from this computer, so the link only works here. Open it in a second tab to try it. '
      + 'To play a friend, put the folder online (GitHub Pages works).') : null,
    o.error() ? h('p', { class: 'hint bad' }, o.error()) : null,
    h('div', { class: 'row' }, h('button', { onclick: () => { if (confirm('Leave the online game?')) goOffline(); } }, 'Leave')));
}

// "2 playing · 1 watching": everyone connected to this game, you included.
function peopleTag(o) {
  if (o.status() !== 'ready') return null;
  const { playing, watching } = o.counts();
  return h('span', { class: 'people', title: 'People connected to this game, you included' },
    `${playing} playing · ${watching} watching`);
}

function armiesCard(st) {
  const col = (p) => h('div', { class: 'army' },
    h('h3', {}, chip(p), P(p).name),
    R.army.map((type) => {
      const u = Object.values(st.units).find((x) => x.player === p && x.type === type);
      const status = !u ? 'not placed' : u.dead ? 'defeated' : E.terrainAt(st, u.hex).name;
      return h('div', {
        class: `army-row${u && u.dead ? ' dead' : ''}${u && ui.selected() === u.id ? ' on' : ''}`,
        onclick: () => { if (u && !u.dead) select(u.id); },
      }, h('span', { class: 'mini', style: `background:${P(p).color}` }, iconEl('units', type, '#fff', 12) || R.units[type].short),
      R.units[type].name, h('span', { class: 'muted' }, ` · ${status}`));
    }));
  return h('section', { class: 'card armies' }, col(0), col(1));
}

function logCard(st) {
  return h('section', { class: 'card' },
    h('h2', {}, 'Log'),
    h('div', { class: 'log' }, st.log.slice(-80).reverse().map((e) =>
      h('div', { class: 'log-row' }, e.p === null ? null : chip(e.p),
        e.p === null ? h('em', {}, e.text) : `${P(e.p).name} ${e.text}`))));
}

function rulesCard(st) {
  const d = h('details', { class: 'card', open: rulesOpen },
    h('summary', {}, 'Rules reference (from rules.js)'),
    h('table', { class: 'ref' },
      h('tr', {}, h('th', {}, 'Unit'), STAT_ORDER.map((k) => h('th', {}, statLabel(k, 13))), h('th', {}, 'Skill')),
      Object.entries(R.units).map(([id, u]) => h('tr', {},
        h('td', { class: 'with-icon' }, iconEl('units', id), u.name),
        [u.attack, u.defence, u.movement, u.range].map((x) => h('td', {}, x)),
        h('td', {}, (u.skills || []).map((sk) => skillTag(sk)))))),
    h('table', { class: 'ref' },
      h('tr', {}, h('th', {}, 'Terrain'), h('th', {}, 'Effect')),
      Object.entries(R.terrain).filter(([, t]) => Object.keys(t.mods).length).map(([id, t]) =>
        h('tr', {}, h('td', { class: 'with-icon' }, iconEl('terrain', id), t.name), h('td', {}, modsEl(t.mods))))),
    h('ul', { class: 'opts' }, Object.entries(st.options).map(([k, v]) =>
      h('li', {}, h('code', {}, v ? 'on ' : 'off'), ' ', R.optionNotes[k] || k))));
  d.addEventListener('toggle', () => { rulesOpen = d.open; });
  return d;
}

// Handy from the browser console, e.g. NearPeer.ui.state() or NearPeer.commit({ type: 'endTurn' }).
window.NearPeer = { ui, commit, undo, newGame, randomFill, goOnline };

setupPointer();
// index.html?room=… joins (or rejoins) that online game.
// index.html?quick skips straight to the battle with a random setup.
const room = (new URLSearchParams(location.search).get('room') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
if (room) goOnline(room, false);
else if (new URLSearchParams(location.search).has('quick')) {
  randomFill();
  randomFill();
}
mount();
