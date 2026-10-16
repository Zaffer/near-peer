/*
 * Near Peer — the "Graphic" map style. Purely visual: the same hexes drawn
 * as one continuous landscape instead of separate tiles.
 *
 * - Terrain colours bleed softly into each other at the hex edges.
 * - A road tile is a generic little network with an exit on every side
 *   (a straight road, crossed by one that forks in two on each side), so it
 *   joins up whichever way its neighbours lie. Towns and capitals next to a road get
 *   a short street out to meet it.
 * - A river runs along the hex edges between Blue's and Red's starting zones,
 *   with a bridge wherever a road crosses it.
 * - Towns are clusters of roofs, capitals a dense city in the owner's colour,
 *   fortifications scattered trenches and gun pits, minefields neat rows of mines.
 *
 * Detail placement is random but seeded by the hex key, so a tile looks the
 * same on every redraw.
 */
(function (global) {
  'use strict';

  const Hex = global.NP_HEX;
  const NS = 'http://www.w3.org/2000/svg';
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const LINKS = { road: true, town: true, capital: true }; // what a road will join up with
  const ROOF = { sun: '#d4704a', shade: '#a64a2b', edge: '#5b2412' };
  const STONE = { sun: '#d9d2c5', shade: '#aaa193', edge: '#4f4a42' };
  const WATER = { bank: '#3f7fa8', water: '#8ec5e3', deep: '#74b3d6', shine: '#eef8fc' };

  function svg(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }

  // ---------------------------------------------------------------- small maths

  // Seeded random numbers in [0, 1), one stream per hex.
  function rng(seed) {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => {
      h = (h + 0x6d2b79f5) | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, t) => `#${rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
  const f = (n) => n.toFixed(1);
  const xy = (p) => `${f(p.x)},${f(p.y)}`;
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const along = (p, dir, d) => ({ x: p.x + dir.x * d, y: p.y + dir.y * d });
  const unit = (a, b) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  };
  const ptKey = (p) => `${Math.round(p.x)},${Math.round(p.y)}`;
  const angleGap = (a, b) => Math.abs(((a - b + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);

  // Points along a smooth curve through pts (Catmull-Rom), `steps` per span.
  function smoothPoints(pts, steps = 10) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const c = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
        out.push({ x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y) });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- draw

  // ctx: { size, pos(k) → {x,y}, look(hex) → {color, ink}, fill(hex) → ground colour, color(player) }
  function draw(parent, st, ctx) {
    const S = ctx.size;
    const hexes = st.hexes;
    const keys = Object.keys(hexes);
    const terrain = (k) => hexes[k] && hexes[k].terrain;
    const poly = (k, size) => {
      const { x, y } = ctx.pos(k);
      return Hex.corners(x, y, size).map(xy).join(' ');
    };
    // Centre of the edge between k and its neighbour in direction i (the neighbour may be off the board).
    const edgeMid = (k, i) => {
      const { q, r } = Hex.parse(k);
      return lerp(ctx.pos(k), ctx.pos(Hex.key(q + DIRS[i][0], r + DIRS[i][1])), 0.5);
    };
    const neighbour = (k, i) => {
      const { q, r } = Hex.parse(k);
      const n = Hex.key(q + DIRS[i][0], r + DIRS[i][1]);
      return hexes[n] ? n : null;
    };
    const joined = (a, b) => b && (terrain(a) === 'road' ? LINKS[terrain(b)] : terrain(b) === 'road' && LINKS[terrain(a)]);
    const crossesRiver = (a, b) => b && crossing(hexes, a, b) !== null;
    // Directions (0–5) toward a neighbouring road (for towns and capitals) or road/town/capital (for roads).
    const spokes = (k) => [0, 1, 2, 3, 4, 5].filter((i) => joined(k, neighbour(k, i)));
    // Angle from a hex's centre toward each of its road links.
    const spokeAngles = (k) => {
      const c = ctx.pos(k);
      return spokes(k).map((i) => { const e = edgeMid(k, i); return Math.atan2(e.y - c.y, e.x - c.x); });
    };

    const g = svg('g', { class: 'map' }, parent);
    const defs = svg('defs', {}, g);
    const clip = svg('clipPath', { id: 'map-clip' }, defs);
    keys.forEach((k) => svg('polygon', { points: poly(k, S + 0.5) }, clip));
    const blend = svg('filter', { id: 'map-blend', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
    svg('feGaussianBlur', { stdDeviation: S * 0.08 }, blend);
    // Per-hex clip, for details that run right up to the hex edge.
    const hexClip = (k) => {
      const id = `map-hex-${k.replace(',', '_').replace(/-/g, 'm')}`;
      svg('polygon', { points: poly(k, S - 1) }, svg('clipPath', { id }, defs));
      return `url(#${id})`;
    };

    // 1. Ground: a crisp copy under a blurred one, so colours blend at the
    //    edges without the board's outer edge going soft.
    const ground = svg('g', { 'clip-path': 'url(#map-clip)' }, g);
    const crisp = svg('g', {}, ground);
    const soft = svg('g', { filter: 'url(#map-blend)' }, ground);
    for (const k of keys) {
      for (const layer of [crisp, soft]) svg('polygon', { points: poly(k, S + 1), fill: ctx.fill(hexes[k]) }, layer);
    }

    // Spots where the unit and its stats sit, kept clear of clutter.
    const busy = (p, c) => Math.hypot(p.x - c.x, p.y - c.y) < S * 0.4 || (Math.abs(p.x - c.x) < S * 0.42 && p.y - c.y > 0 && p.y - c.y < S * 0.72);

    // 2. Ground detail: grass, trenches, mines.
    const detail = svg('g', {}, g);
    for (const k of keys) {
      const t = terrain(k);
      const c = ctx.pos(k);
      const { x, y } = c;
      const look = ctx.look(hexes[k]);
      const rand = rng(k);
      if (t === 'plain') {
        for (let i = 0; i < 6; i++) {
          const a = rand() * Math.PI * 2;
          const d = S * (0.42 + rand() * 0.36);
          const p = { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
          svg('path', {
            d: `M${f(p.x - 3)},${f(p.y - 3)} L${f(p.x - 1)},${f(p.y + 1)} M${f(p.x)},${f(p.y - 4)} L${f(p.x)},${f(p.y + 1)} M${f(p.x + 3)},${f(p.y - 3)} L${f(p.x + 1)},${f(p.y + 1)}`,
            stroke: look.ink, 'stroke-width': 1, 'stroke-linecap': 'round', opacity: 0.55, fill: 'none',
          }, detail);
        }
      } else if (t === 'fortification') {
        // A few short crenellated trench lines and the odd gun pit dotted around the
        // position, facing outward, placed differently on every fortification.
        const fg = svg('g', { 'clip-path': hexClip(k), fill: 'none', 'stroke-linejoin': 'miter' }, detail);
        const parapet = mix(look.color, '#ffffff', 0.45);
        const trench = mix(look.color, '#000000', 0.55);
        const slots = [];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + rand() * 0.3;
          const p = along(c, { x: Math.cos(a), y: Math.sin(a) }, S * (0.52 + rand() * 0.16));
          if (!busy(p, c)) slots.push({ a, p, order: rand() });
        }
        slots.sort((p, q) => p.order - q.order).slice(0, 5 + Math.floor(rand() * 2)).forEach(({ a, p }) => {
          const pg = svg('g', { transform: `translate(${xy(p)}) rotate(${f((a * 180) / Math.PI + 90 + (rand() - 0.5) * 30)})` }, fg);
          const draw2 = (tag, attrs) => {
            svg(tag, Object.assign({ stroke: parapet, 'stroke-width': 6.5 }, attrs), pg);
            svg(tag, Object.assign({ stroke: trench, 'stroke-width': 2.8 }, attrs), pg);
          };
          if (rand() < 0.25) {
            draw2('circle', { r: 4.5 });
            return;
          }
          const len = S * (0.45 + rand() * 0.2);
          const pts = [];
          for (let xx = -len / 2, i = 0; xx < len / 2; xx += 6, i++) {
            const yy = i % 2 ? -3.5 : 0; // teeth toward the outside
            pts.push({ x: xx, y: yy }, { x: Math.min(xx + 6, len / 2), y: yy });
          }
          draw2('polyline', { points: pts.map(xy).join(' ') });
        });
      } else if (t === 'minefield') {
        // Mines in neat staggered rows, like a laid field.
        const gap = S * 0.25;
        for (let row = -4; row <= 4; row++) {
          for (let col = -5; col <= 5; col++) {
            const p = { x: x + (col + (row % 2 ? 0.5 : 0)) * gap, y: y + row * gap * 0.87 };
            if (Math.hypot(p.x - x, p.y - y) > S * 0.78 || busy(p, c)) continue;
            svg('circle', { cx: f(p.x), cy: f(p.y), r: 2.6, fill: 'none', stroke: look.ink, 'stroke-width': 1, opacity: 0.85 }, detail);
            svg('circle', { cx: f(p.x), cy: f(p.y), r: 1, fill: look.ink, opacity: 0.85 }, detail);
          }
        }
      }
    }

    // 3. River along every edge where Blue's zone meets Red's.
    const riverEdges = [];
    for (const a of keys) {
      for (let i = 0; i < 3; i++) {
        const b = neighbour(a, i);
        if (!crossesRiver(a, b)) continue;
        const pa = ctx.pos(a);
        const pb = ctx.pos(b);
        const shared = Hex.corners(pa.x, pa.y, S).filter((cn) => Math.hypot(cn.x - pb.x, cn.y - pb.y) < S + 0.5);
        if (shared.length === 2) riverEdges.push(shared);
      }
    }
    for (const pts of chains(riverEdges)) drawRiver(pts, g, S);

    // 4. Roads, drawn as one network so joins between hexes are seamless:
    //    casing, then surface, then a centre line on the main roads.
    let d = '';
    let main = ''; // the straight road through each road tile, which gets a centre line
    for (const k of keys) {
      const t = terrain(k);
      if (!LINKS[t]) continue;
      const c = ctx.pos(k);
      if (t === 'road') {
        // A straight road through the middle (along the first link, or a seeded direction),
        // crossed by a road that forks in two on each side, so all six sides have an exit.
        const out = spokes(k);
        const dir = out.length ? out[0] : Math.floor(rng(k)() * 6);
        main += `M${xy(edgeMid(k, dir))} L${xy(edgeMid(k, (dir + 3) % 6))} `;
        [[1, 2], [4, 5]].forEach(([i1, i2]) => {
          const e1 = edgeMid(k, (dir + i1) % 6);
          const e2 = edgeMid(k, (dir + i2) % 6);
          const side = unit(c, lerp(e1, e2, 0.5));
          const fork = along(c, side, S * 0.42);
          d += `M${xy(c)} L${xy(fork)} `;
          for (const e of [e1, e2]) d += `M${xy(fork)} C${xy(along(fork, side, S * 0.18))} ${xy(along(e, unit(c, e), -S * 0.18))} ${xy(e)} `;
        });
      } else {
        // A short street from the edge into the town or city.
        for (const i of spokes(k)) {
          const e = edgeMid(k, i);
          d += `M${xy(e)} L${xy(lerp(e, c, 0.35))} `;
        }
      }
    }
    if (d || main) {
      const road = ctx.look({ terrain: 'road' });
      const roads = svg('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      d += main;
      svg('path', { d, stroke: mix(road.color, road.ink, 0.55), 'stroke-width': S * 0.17 }, roads);
      svg('path', { d, stroke: mix(road.color, '#ffffff', 0.45), 'stroke-width': S * 0.11 }, roads);
      if (main) svg('path', { d: main, stroke: road.ink, 'stroke-width': 1.1, 'stroke-dasharray': '4 5', opacity: 0.55 }, roads);
    }

    // 5. Bridges where a road crosses the river.
    for (const a of keys) {
      for (let i = 0; i < 3; i++) {
        const b = neighbour(a, i);
        if (!joined(a, b) || !crossesRiver(a, b)) continue;
        const m = edgeMid(a, i);
        const pa = ctx.pos(a);
        const pb = ctx.pos(b);
        const deg = (Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180) / Math.PI;
        const bridge = svg('g', { transform: `translate(${xy(m)}) rotate(${f(deg)})` }, g);
        svg('rect', { x: -12, y: -6, width: 24, height: 12, rx: 2, fill: '#c8ab78', stroke: '#5a4524', 'stroke-width': 1.2 }, bridge);
        svg('path', { d: 'M-12,-4.5 H12 M-12,4.5 H12', stroke: '#5a4524', 'stroke-width': 1.6 }, bridge);
      }
    }

    // 6. Towns and capitals on top of their streets.
    const building = (p, w, hgt, deg, look, parentG) => {
      const hg = svg('g', { transform: `translate(${xy(p)}) rotate(${f(deg)})` }, parentG);
      svg('rect', { x: f(-w / 2 + 1.2), y: f(-hgt / 2 + 1.2), width: f(w), height: f(hgt), fill: '#000', opacity: 0.18 }, hg);
      // Pitched roof seen from above: a sunny side and a shady side.
      svg('rect', { x: f(-w / 2), y: f(-hgt / 2), width: f(w), height: f(hgt / 2), fill: look.sun }, hg);
      svg('rect', { x: f(-w / 2), y: 0, width: f(w), height: f(hgt / 2), fill: look.shade }, hg);
      svg('rect', { x: f(-w / 2), y: f(-hgt / 2), width: f(w), height: f(hgt), fill: 'none', stroke: look.edge, 'stroke-width': 0.8 }, hg);
    };
    for (const k of keys) {
      const t = terrain(k);
      if (t !== 'town' && t !== 'capital') continue;
      const c = ctx.pos(k);
      const { x, y } = c;
      const rand = rng(k);
      const roadAngles = spokeAngles(k);
      const nearRoad = (p) => roadAngles.some((ra) => angleGap(Math.atan2(p.y - y, p.x - x), ra) < 0.32);
      const town = svg('g', {}, g);
      if (t === 'town') {
        // A loose ring of houses around the square in the middle.
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + rand() * 0.25;
          const dist = S * (0.5 + rand() * 0.2);
          const p = { x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist };
          if (rand() > 0.75 || nearRoad(p) || busy(p, c)) continue;
          building(p, 9 + rand() * 4, 6.5 + rand() * 1.5, (a * 180) / Math.PI + 90 + (rand() - 0.5) * 20, ROOF, town);
        }
        continue;
      }
      // Capital: a dense city of stone and tiled roofs on a street grid, filling
      // the hex around a central square, inside a border in the owner's colour.
      const owner = hexes[k].owner !== null ? ctx.color(hexes[k].owner) : null;
      const city = svg('g', { 'clip-path': hexClip(k) }, town);
      const grid = S * 0.2;
      for (let gy = -5; gy <= 5; gy++) {
        for (let gx = -5; gx <= 5; gx++) {
          const p = { x: x + gx * grid + (rand() - 0.5) * 2, y: y + gy * grid + (rand() - 0.5) * 2 };
          if (Math.hypot(p.x - x, p.y - y) > S * 0.9 || nearRoad(p) || busy(p, c) || rand() < 0.45) continue;
          const big = rand() < 0.15;
          const w = grid * (big ? 1.6 : 0.78);
          if (big) p.x += grid * 0.4;
          building(p, w, grid * 0.78, rand() < 0.5 ? 0 : 90, rand() < 0.55 ? ROOF : STONE, city);
        }
      }
      svg('circle', { cx: f(x), cy: f(y), r: f(S * 0.36), fill: STONE.sun, stroke: STONE.shade, 'stroke-width': 1.5 }, town);
      if (owner) {
        svg('polygon', { points: poly(k, S - 4), fill: 'none', stroke: owner, 'stroke-width': 4 }, town);
        const fx = x + S * 0.45;
        const fy = y - S * 0.55;
        svg('path', { d: `M${f(fx)},${f(fy)} V${f(fy - 16)}`, stroke: '#3a3a3a', 'stroke-width': 1.5 }, town);
        svg('path', { d: `M${f(fx)},${f(fy - 16)} l11,3.5 -11,3.5 z`, fill: owner, stroke: '#fff', 'stroke-width': 0.8 }, town);
      }
    }

    // 7. Faint hex grid on top, so steps and ranges are still easy to count.
    const gridLines = svg('g', { fill: 'none', stroke: '#000', 'stroke-opacity': 0.13, 'stroke-width': 1 }, g);
    keys.forEach((k) => svg('polygon', { points: poly(k, S) }, gridLines));
    return g;
  }

  // Join edges [[p, q], …] that share end points into continuous lines.
  function chains(edges) {
    const at = new Map();
    edges.forEach((e, i) => e.forEach((p) => {
      const k = ptKey(p);
      if (!at.has(k)) at.set(k, []);
      at.get(k).push(i);
    }));
    const used = new Set();
    const out = [];
    const walk = (start, i) => {
      const pts = [start];
      let cur = start;
      while (i != null && !used.has(i)) {
        used.add(i);
        const next = ptKey(edges[i][0]) === ptKey(cur) ? edges[i][1] : edges[i][0];
        pts.push(next);
        cur = next;
        i = at.get(ptKey(cur)).find((j) => !used.has(j));
      }
      return pts;
    };
    // Start from loose ends (where the river leaves the board) first.
    for (const [k, list] of at) {
      if (list.length === 1 && !used.has(list[0])) {
        const e = edges[list[0]];
        out.push(walk(ptKey(e[0]) === k ? e[0] : e[1], list[0]));
      }
    }
    edges.forEach((e, i) => { if (!used.has(i)) out.push(walk(e[0], i)); });
    return out;
  }

  // A river is a filled shape, not a stroked line: its width swells and narrows
  // as it meanders, with a deeper channel down the middle and a few ripples.
  function drawRiver(pts, parent, S) {
    // Meander: push each edge's middle out to alternate sides, and run the
    // ends a little past the board edge so the river flows off the map.
    const wavy = [];
    pts.forEach((p, i) => {
      wavy.push(p);
      const q = pts[i + 1];
      if (!q) return;
      const n = unit(p, q);
      const side = (i % 2 ? -1 : 1) * S * 0.12;
      wavy.push({ x: (p.x + q.x) / 2 - n.y * side, y: (p.y + q.y) / 2 + n.x * side });
    });
    if (wavy.length < 2) return;
    wavy.unshift(along(wavy[0], unit(wavy[1], wavy[0]), S * 0.3));
    wavy.push(along(wavy[wavy.length - 1], unit(wavy[wavy.length - 2], wavy[wavy.length - 1]), S * 0.3));

    const line = smoothPoints(wavy);
    let s = 0;
    const samples = line.map((p, i) => {
      if (i) s += Math.hypot(p.x - line[i - 1].x, p.y - line[i - 1].y);
      const a = line[Math.max(0, i - 1)];
      const b = line[Math.min(line.length - 1, i + 1)];
      const t = unit(a, b);
      return { p, n: { x: -t.y, y: t.x }, t, s };
    });
    const shape = (scale) => {
      const side = (sign) => samples.map(({ p, n, s: len }) => {
        const w = S * 0.11 * scale * (1 + 0.25 * Math.sin(len / 27) + 0.12 * Math.sin(len / 9.5));
        return along(p, n, sign * w);
      });
      const left = side(1);
      const right = side(-1).reverse();
      return `M${left.map(xy).join(' L')} L${right.map(xy).join(' L')} Z`;
    };

    const river = svg('g', { class: 'river' }, parent);
    svg('path', { d: shape(1), fill: WATER.water, stroke: WATER.bank, 'stroke-width': 2, 'stroke-linejoin': 'round' }, river);
    svg('path', { d: shape(0.45), fill: WATER.deep, opacity: 0.7 }, river);
    // Short curved ripples, alternating sides, following the flow.
    for (let i = 6, k = 0; i < samples.length - 6; i += 9, k++) {
      const { p, n, t } = samples[i];
      const o = along(p, n, (k % 2 ? -1 : 1) * S * 0.05);
      const a = along(o, t, -4);
      const b = along(o, t, 4);
      const m = along(o, n, (k % 2 ? -1 : 1) * 1.6);
      svg('path', { d: `M${xy(a)} Q${xy(m)} ${xy(b)}`, fill: 'none', stroke: WATER.shine, 'stroke-width': 1, 'stroke-linecap': 'round', opacity: 0.85 }, river);
    }
  }

  // How a step from hex a to hex b meets the river: 'bridge' where a road
  // crosses it, 'ford' anywhere else on it, null if it doesn't cross.
  function crossing(hexes, a, b) {
    const A = hexes[a];
    const B = hexes[b];
    if (!A || !B || A.zone === null || B.zone === null || A.zone === B.zone) return null;
    const road = (A.terrain === 'road' && LINKS[B.terrain]) || (B.terrain === 'road' && LINKS[A.terrain]);
    return road ? 'bridge' : 'ford';
  }

  global.NP_MAPVIEW = { draw, crossing };
})(typeof window !== 'undefined' ? window : globalThis);
