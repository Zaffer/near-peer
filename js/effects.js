/*
 * Near Peer — board effects. Purely visual: short animations played after an
 * action is committed. Nothing here affects the rules.
 *
 * - A moving unit slides hex to hex, with a little hop on each step.
 * - Captures: every other unit adding to the attack fires a streak at the
 *   target, then the target pops in a burst of shards.
 * - Entering a minefield: a small blast and puff of smoke, and the unit shudders.
 * - Crossing the river where there's no bridge: a splash (Graphic map only).
 * - Taking the enemy capital (or winning any other way): rings and rays, then a banner.
 * - A new turn: a small banner naming who's up.
 * - The build phase: a unit drops into place; terrain lands with a puff of dust.
 *
 * ui.js calls play() straight after drawing the new state, with the unit
 * positions from before and after.
 */
import * as E from './engine.js';
import R from './rules.js';

const NS = 'http://www.w3.org/2000/svg';
const HOP = 240; // ms per hex stepped
const SPLASH = { ring: '#eef8fc', drop: '#bfe3f5' };
const BLAST = { fire: '#ffcf6b', core: '#fff3c4', smoke: '#6b6660', dirt: '#4a3b2a' };

function svg(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

const f = (n) => Math.round(n * 10) / 10;
const rand = (a, b) => a + Math.random() * (b - a);
// A group centred on p, so everything inside can be drawn and scaled around (0, 0).
const at = (p, parent) => svg('g', { transform: `translate(${f(p.x)},${f(p.y)})` }, parent);
const tr = (x, y, s = 1, deg = 0) => `translate(${f(x)}px,${f(y)}px) scale(${s}) rotate(${f(deg)}deg)`;
const run = (el, frames, { delay = 0, duration = 400, easing = 'ease-out', fill = 'both', composite } = {}) =>
  el.animate(frames, { delay, duration, easing, fill, composite });
// Take an effect off the board once it's over.
const expire = (el, ms) => setTimeout(() => el.remove(), ms + 60);

// ---------------------------------------------------------------- building blocks

// A filled circle that swells and fades.
function flash(g, delay, r, color, { duration = 360, from = 0.3, opacity = 0.9 } = {}) {
  const c = svg('circle', { r, fill: color }, g);
  run(c, [{ transform: tr(0, 0, from), opacity }, { transform: tr(0, 0, 1), opacity: 0 }], { delay, duration });
}

// A ring that spreads out and fades.
function ring(g, delay, r, color, { width = 3, duration = 520, ry } = {}) {
  const c = ry
    ? svg('ellipse', { rx: r, ry, fill: 'none', stroke: color, 'stroke-width': width }, g)
    : svg('circle', { r, fill: 'none', stroke: color, 'stroke-width': width }, g);
  run(c, [{ transform: tr(0, 0, 0.25), opacity: 1 }, { transform: tr(0, 0, 1), opacity: 0 }], { delay, duration });
}

// Bits thrown outward in an arc: up first (lift), then down (drop).
function spray(g, delay, n, { shape, color, dist = [14, 24], lift = 8, drop = 4, duration = 520, spin = 0, angle = [0, 360] }) {
  for (let i = 0; i < n; i++) {
    const a = ((angle[0] + ((i + rand(0.2, 0.8)) / n) * (angle[1] - angle[0])) * Math.PI) / 180;
    const d = rand(dist[0], dist[1]);
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;
    const bit = shape(g, color);
    const turn = spin * rand(-1, 1);
    run(bit, [
      { transform: tr(0, 0, 1, 0), opacity: 1 },
      { transform: tr(dx * 0.6, dy * 0.6 - lift, 1, turn * 0.6), opacity: 1, offset: 0.5 },
      { transform: tr(dx, dy + drop, 0.6, turn), opacity: 0 },
    ], { delay, duration, easing: 'linear' });
  }
}
const dot = (r) => (g, color) => svg('circle', { r, fill: color }, g);
const shard = (g, color) => svg('path', { d: 'M-3,-2.2 L3.5,0 L-3,2.2 Z', fill: color, stroke: '#fff', 'stroke-width': 0.8 }, g);

// A curved streak from an attacker to its target that draws on, then off.
function streak(layer, from, to, color, delay) {
  const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const ux = (to.x - from.x) / len;
  const uy = (to.y - from.y) / len;
  const a = { x: from.x + ux * (from.r + 2), y: from.y + uy * (from.r + 2) };
  const b = { x: to.x - ux * (to.r * 0.5), y: to.y - uy * (to.r * 0.5) };
  const c = { x: (a.x + b.x) / 2 - uy * len * 0.12, y: (a.y + b.y) / 2 + ux * len * 0.12 };
  const d = `M${f(a.x)},${f(a.y)} Q${f(c.x)},${f(c.y)} ${f(b.x)},${f(b.y)}`;
  const g = svg('g', { fill: 'none', 'stroke-linecap': 'round' }, layer);
  const L = Math.ceil(len * 1.1);
  for (const [stroke, width, opacity] of [['#fff', 6, 0.8], [color, 3, 1]]) {
    const p = svg('path', { d, stroke, 'stroke-width': width, opacity, 'stroke-dasharray': `${L} ${L}` }, g);
    run(p, [{ strokeDashoffset: L }, { strokeDashoffset: 0, offset: 0.55 }, { strokeDashoffset: -L }], { delay, duration: 360, easing: 'ease-in-out' });
  }
  expire(g, delay + 360);
}

// A copy of a captured unit, left where it stood until the hit lands, then popped.
function ghost(layer, ctx, u, p, impact) {
  const g = at(p, layer);
  const inner = svg('g', {}, g);
  ctx.token(u, 0, 0, p.r, inner);
  run(inner, [
    { transform: tr(0, 0, 1), opacity: 1 },
    { transform: tr(-2.5, 0, 1), opacity: 1, offset: 0.12 },
    { transform: tr(2.5, 0, 1), opacity: 1, offset: 0.24 },
    { transform: tr(0, 0, 1.18, 0), opacity: 1, offset: 0.4 },
    { transform: tr(0, 0, 0.2, 30), opacity: 0 },
  ], { delay: Math.max(0, impact - 90), duration: 420, easing: 'ease-in' });
  expire(g, impact + 340);
}

// ---------------------------------------------------------------- effects

function capture(layer, ctx, ev, impact) {
  const p = ev.xy;
  for (const c of ev.contributors) {
    const from = ctx.before[c.id];
    if (from) streak(layer, from, p, ctx.color(c.player), Math.max(0, impact - 260));
  }
  ghost(layer, ctx, ev.unit, p, impact);
  const g = at(p, layer);
  flash(g, impact, 24, '#fff', { opacity: 0.95 });
  ring(g, impact, 30, ctx.color(ev.by), { width: 3.5 });
  spray(g, impact, 9, { shape: shard, color: ctx.color(ev.unit.player), dist: [22, 34], lift: 6, drop: 8, spin: 220, duration: 560 });
  expire(g, impact + 560);
}

function mine(layer, ctx, p, t, moverEl) {
  const g = at(p, layer);
  flash(g, t, 28, BLAST.fire, { opacity: 1, duration: 320 });
  flash(g, t, 13, BLAST.core, { opacity: 1, duration: 240 });
  spray(g, t, 10, { shape: dot(2.2), color: BLAST.dirt, dist: [18, 30], lift: 14, drop: 10, duration: 600 });
  for (let i = 0; i < 3; i++) {
    const puff = svg('circle', { r: 9, fill: BLAST.smoke }, g);
    const dx = (i - 1) * 9;
    run(puff, [
      { transform: tr(dx * 0.4, 0, 0.4), opacity: 0.8 },
      { transform: tr(dx, -26 - i * 4, 1.7), opacity: 0 },
    ], { delay: t + 60 + i * 50, duration: 900 });
  }
  if (moverEl) {
    run(moverEl, [
      { transform: 'translate(0px,0px)' }, { transform: 'translate(-3px,1px)' }, { transform: 'translate(3px,-1px)' },
      { transform: 'translate(-2px,0px)' }, { transform: 'translate(0px,0px)' },
    ], { delay: t, duration: 280, easing: 'linear', fill: 'none', composite: 'add' });
  }
  expire(g, t + 1100);
}

function ford(layer, p, t) {
  const g = at(p, layer);
  ring(g, t, 14, SPLASH.ring, { width: 2, ry: 7, duration: 600 });
  ring(g, t + 120, 20, SPLASH.ring, { width: 1.5, ry: 10, duration: 650 });
  spray(g, t, 7, { shape: dot(1.7), color: SPLASH.drop, dist: [8, 14], lift: 12, drop: 6, duration: 520, angle: [200, 340] });
  expire(g, t + 800);
}

// Rings, rays and a hex-shaped flash in the winner's colour.
function triumph(layer, ctx, p, color, t) {
  const g = at(p, layer);
  const S = ctx.size;
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${f(S * Math.cos(a))},${f(S * Math.sin(a))}`;
  }).join(' ');
  const h = svg('polygon', { points: hex, fill: color }, g);
  run(h, [{ transform: tr(0, 0, 0.7), opacity: 0.7 }, { transform: tr(0, 0, 1.08), opacity: 0 }], { delay: t, duration: 700 });
  for (let i = 0; i < 3; i++) ring(g, t + i * 200, S * 1.5, color, { width: 5, duration: 900 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const ray = svg('line', { x1: f(Math.cos(a) * 16), y1: f(Math.sin(a) * 16), x2: f(Math.cos(a) * 30), y2: f(Math.sin(a) * 30),
      stroke: i % 2 ? '#fff' : color, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    run(ray, [{ transform: tr(0, 0, 0.6), opacity: 1 }, { transform: tr(0, 0, 2.2), opacity: 0 }], { delay: t + 80, duration: 700 });
  }
  expire(g, t + 1400);
}

// A rounded label that drops in, waits, and fades.
function banner(layer, p, text, color, t, { hold = 900, big = false } = {}) {
  const g = at(p, layer);
  const inner = svg('g', {}, g);
  const fs = big ? 20 : 13;
  const w = text.length * fs * 0.56 + (big ? 40 : 26);
  const hgt = big ? 40 : 24;
  svg('rect', { x: f(-w / 2), y: -hgt / 2, width: f(w), height: hgt, rx: hgt / 2, fill: color, stroke: '#fff', 'stroke-width': 2 }, inner);
  const label = svg('text', { y: f(fs * 0.36), 'text-anchor': 'middle', fill: '#fff', 'font-size': fs, 'font-weight': 800 }, inner);
  label.textContent = text;
  const total = 220 + hold + 300;
  run(inner, [
    { transform: tr(0, -10, 0.9), opacity: 0 },
    { transform: tr(0, 0, 1), opacity: 1, offset: 220 / total },
    { transform: tr(0, 0, 1), opacity: 1, offset: (220 + hold) / total },
    { transform: tr(0, 4, 1), opacity: 0 },
  ], { delay: t, duration: total, easing: 'ease-out' });
  expire(g, t + total);
}

// Slide a unit's counter along its route, from where it was to where it's drawn now.
function slide(el, pts, t) {
  const end = pts[pts.length - 1];
  const frame = (p, s) => ({ transform: `translate(${f(p.x)}px,${f(p.y)}px) scale(${s}) translate(${f(-end.x)}px,${f(-end.y)}px)` });
  const hops = pts.length - 1;
  const frames = [];
  for (let i = 0; i < hops; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    frames.push(Object.assign(frame(a, 1), { offset: i / hops, easing: 'ease-in' }));
    frames.push(Object.assign(frame({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, 1.12), { offset: (i + 0.5) / hops, easing: 'ease-out' }));
  }
  frames.push(Object.assign(frame(end, 1), { offset: 1 }));
  el.parentNode.appendChild(el); // above the other units while it travels
  run(el, frames, { delay: t, duration: hops * HOP, fill: 'backwards' });
}

// ---------------------------------------------------------------- what happened

// Work out what to show for a list of actions taken from `prev`. Each step is
// replayed so a capture is shown with the attackers in place at that moment.
function events(prev, next, actions, ctx) {
  const out = { routes: {}, captures: [], mines: [], fords: [], drops: [], builds: [] };
  let s = Object.assign({}, prev, { log: [] });
  let hop = 0;
  for (const a of actions) {
    const s2 = E.tryApply(s, a);
    if (!s2) break;
    if (a.type === 'placeUnit') {
      out.drops.push(Object.keys(s2.units).find((id) => !s.units[id]));
    } else if (a.type === 'placeTerrain') {
      out.builds.push(a.to);
    } else if (a.type === 'step' || a.type === 'capture') {
      const mover = s.units[a.unitId];
      const from = mover.hex;
      const to = a.type === 'step' ? a.to : from;
      if (a.type === 'step') {
        (out.routes[a.unitId] = out.routes[a.unitId] || [from]).push(to);
        if (ctx.crossing(s.hexes, from, to) === 'ford') out.fords.push({ hop, from, to });
        if (s2.hexes[to].terrain === 'minefield') out.mines.push({ hop, hex: to, id: a.unitId });
        hop += 1;
      }
      for (const id of Object.keys(s.units)) {
        if (s.units[id].dead || !s2.units[id].dead) continue;
        const contributors = E.assault(s, id).contributors
          .filter((c) => c.id !== a.unitId)
          .map((c) => ({ id: c.id, player: s.units[c.id].player }));
        out.captures.push({ hop, unit: s.units[id], hex: to, by: mover.player, contributors });
      }
    }
    s = s2;
  }
  out.hops = hop;
  if (next.phase === 'over' && prev.phase !== 'over') {
    const capital = /capital/.test(next.winReason) ? E.capitalOf(next, 1 - next.winner) : null;
    const last = out.captures[out.captures.length - 1];
    out.win = { player: next.winner, hex: capital || (last && last.hex), capital: !!capital };
  } else if (next.phase === 'battle' && prev.phase === 'battle' && next.current !== prev.current) {
    out.turn = next.current;
  }
  return out;
}

// ctx: { layer, size, before: {id → {x,y,r}}, after: {id → {x,y,r}}, pos(k), unitEl(id),
//        token(unit, x, y, r, parent), color(p), crossing(hexes, a, b) → 'ford' | 'bridge' | null }
function play(prev, next, actions, ctx) {
  if (!globalThis.Element || !Element.prototype.animate) return;
  if (globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const L = ctx.layer;
  const ev = events(prev, next, actions, ctx);
  const hopEnd = (i) => (i + 1) * HOP;

  for (const [id, route] of Object.entries(ev.routes)) {
    const el = ctx.unitEl(id);
    if (!el || !ctx.before[id] || !ctx.after[id]) continue;
    const pts = route.map((k, i) => (i === 0 ? ctx.before[id] : i === route.length - 1 ? ctx.after[id] : ctx.pos(k)));
    slide(el, pts, 0);
  }
  // Units that shuffled aside on a shared hex (or back to the middle).
  for (const id of Object.keys(ctx.after)) {
    const a = ctx.before[id];
    const b = ctx.after[id];
    if (ev.routes[id] || !a || (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5)) continue;
    const el = ctx.unitEl(id);
    if (el) slide(el, [a, b], ev.hops ? (ev.hops - 1) * HOP : 0);
  }

  for (const fd of ev.fords) {
    const a = ctx.pos(fd.from);
    const b = ctx.pos(fd.to);
    ford(L, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, fd.hop * HOP + HOP * 0.45);
  }
  for (const m of ev.mines) mine(L, ctx, ctx.pos(m.hex), hopEnd(m.hop), ctx.unitEl(m.id));
  for (const c of ev.captures) {
    const xy = ctx.before[c.unit.id] || Object.assign(ctx.pos(c.hex), { r: 18 });
    // A step-in capture lands as the mover arrives; an in-place one after a short beat.
    const impact = c.hop > 0 ? c.hop * HOP : 260;
    capture(L, ctx, Object.assign({}, c, { xy }), impact);
  }

  let end = ev.hops ? ev.hops * HOP : ev.captures.length ? 260 : 0;
  if (ev.captures.length) end += 300;
  for (const id of ev.drops) {
    const el = ctx.unitEl(id);
    const p = ctx.after[id];
    if (!el || !p) continue;
    const frame = (dy, s, o) => ({ transform: `translate(${f(p.x)}px,${f(p.y + dy)}px) scale(${s}) translate(${f(-p.x)}px,${f(-p.y)}px)`, opacity: o });
    run(el, [frame(-16, 1.5, 0), frame(0, 0.92, 1), frame(0, 1, 1)], { duration: 380, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'backwards' });
    const g = at({ x: p.x, y: p.y + p.r * 0.7 }, L);
    ring(g, 200, p.r * 1.4, '#fff', { width: 2, ry: p.r * 0.5, duration: 420 });
    expire(g, 650);
  }
  for (const k of ev.builds) {
    const g = at(ctx.pos(k), L);
    ring(g, 0, ctx.size * 0.95, '#fff', { width: 3, duration: 480 });
    spray(g, 40, 6, { shape: dot(3), color: 'rgba(120,100,70,.55)', dist: [18, 30], lift: 4, drop: 0, duration: 520 });
    expire(g, 600);
  }

  if (ev.win) {
    const name = R.players[ev.win.player].name;
    const color = ctx.color(ev.win.player);
    if (ev.win.hex) triumph(L, ctx, ctx.pos(ev.win.hex), color, end + 60);
    banner(L, { x: 0, y: 0 }, ev.win.capital ? `${name} takes the capital!` : `${name} wins!`, color, end + 420, { hold: 1600, big: true });
  } else if (ev.turn != null) {
    banner(L, { x: 0, y: -232 }, `${R.players[ev.turn].name} to play`, ctx.color(ev.turn), end + 80);
  }
}

export { play, HOP };
