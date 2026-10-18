/*
 * Near Peer — the "Graphic" unit style: illustrated tokens in the same flat,
 * outlined style as the map. Purely visual.
 *
 * Each picture is drawn in a 36×36 box centred on (0, 0) (the token's radius
 * is 18); the caller scales it to the token. Two layers: `g` is clipped to the
 * disc, `top` sits over the ring, for the one part that sticks out (a rifle
 * barrel, a gun, a sabre, an antenna, a rotor, a missile).
 * Uniforms and vehicles take the player's colour, so the team reads from the art
 * as well as from the ring around it. All 31 units have a picture: the five base
 * units, then the merged ones keyed by type id ("light+armour" and so on).
 */
const NS = 'http://www.w3.org/2000/svg';
const INK = '#1f2328';
const SKIN = '#eab48a';
const STEEL = '#4a4f57';
const STEEL_LIGHT = '#9aa1a9';
const TRACK = '#2b2e33';
const WOOD = '#8a5a32';
const GOLD = '#e8b923';
const COYOTE = '#b89c6a';
const COYOTE_DARK = '#8a7350';
const GLASS = '#bfe0f2';
const BLUR = '#dfe7ee'; // a spinning rotor
const PALE = '#e9edf1'; // missiles and rockets
const FLAME = '#ff9f1c';
const SMOKE = '#d6d9dd';

function svg(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}
const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => `#${rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
const line = { stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
const shape = (tag, attrs, g) => svg(tag, Object.assign({}, line, attrs), g);
const shadow = (g, y = 13) => svg('ellipse', { cx: 0, cy: y, rx: 15, ry: 2.2, fill: '#000', opacity: 0.16 }, g);

// Head and shoulders shared by the people.
function bust(g, c, { jacket }) {
  shape('path', { d: 'M-16,19 C-16,8 -9,5 0,5 C9,5 16,8 16,19 Z', fill: jacket }, g);
  shape('path', { d: 'M-4,5.5 L0,10 L4,5.5', fill: 'none', stroke: c.dark }, g);
  shape('rect', { x: -2.6, y: 1, width: 5.2, height: 5, fill: SKIN, stroke: 'none' }, g); // neck
  shape('circle', { cx: 0, cy: -2.5, r: 6.3, fill: SKIN }, g);
  svg('circle', { cx: -2.2, cy: -1.8, r: 0.85, fill: INK }, g);
  svg('circle', { cx: 2.2, cy: -1.8, r: 0.85, fill: INK }, g);
}

// Modern high-cut helmet: rails on the sides, night-vision mount on the front.
function helmet(g, fill) {
  shape('path', { d: 'M-8,0 L-8,-4 C-8,-13 8,-13 8,-4 L8,0 L6.2,0 L5.6,-4.4 L-5.6,-4.4 L-6.2,0 Z', fill }, g);
  shape('rect', { x: -8.8, y: -6.5, width: 1.6, height: 4, rx: 0.5, fill: STEEL, 'stroke-width': 0.6 }, g);
  shape('rect', { x: 7.2, y: -6.5, width: 1.6, height: 4, rx: 0.5, fill: STEEL, 'stroke-width': 0.6 }, g);
  shape('rect', { x: -2, y: -9.6, width: 4, height: 2.8, rx: 0.6, fill: STEEL, 'stroke-width': 0.7 }, g);
}

// M4-style rifle, drawn flat along +x then placed by `transform`. The barrel runs out to x = 21.
function rifle(parent, transform, glove) {
  const r = svg('g', { transform }, parent);
  const gun = { fill: '#363a40', 'stroke-width': 0.7 };
  shape('path', Object.assign({ d: 'M-16,-1.6 L-10,-2.1 L-10,2.2 L-16,3.4 Z' }, gun), r);
  shape('rect', Object.assign({ x: -10.5, y: -1, width: 4.5, height: 2 }, gun), r);
  shape('path', Object.assign({ d: 'M-4.8,1.8 L-2.6,1.8 L-3.4,6 L-5.8,5.6 Z' }, gun), r);
  shape('path', Object.assign({ d: 'M-0.6,1.8 L2.6,1.8 L3.8,7.4 L0.8,7.8 Z' }, gun), r);
  shape('rect', Object.assign({ x: 11.5, y: -0.7, width: 9.5, height: 1.4 }, gun), r);
  shape('rect', Object.assign({ x: 19.5, y: -1.2, width: 2.6, height: 2.4, rx: 0.4 }, gun), r); // muzzle device
  shape('rect', Object.assign({ x: -6.5, y: -2.2, width: 10, height: 4.2, rx: 0.6 }, gun), r);
  shape('rect', Object.assign({ x: 3.5, y: -1.8, width: 8, height: 3.4, rx: 0.5 }, gun), r);
  shape('rect', { x: -4.5, y: -4.8, width: 5, height: 2.6, rx: 1, fill: TRACK, 'stroke-width': 0.7 }, r); // optic
  shape('circle', { cx: 7, cy: 1.8, r: 2.1, fill: glove, 'stroke-width': 0.7 }, r);
  shape('circle', { cx: -4.2, cy: 4.2, r: 2.1, fill: glove, 'stroke-width': 0.7 }, r);
}

// Whip antenna from a radio on the left shoulder, sticking out of the top.
function antenna(top) {
  shape('rect', { x: -14, y: 4, width: 4, height: 5.5, rx: 0.8, fill: TRACK, 'stroke-width': 0.7 }, top);
  shape('path', { d: 'M-12.6,4 Q-15,-8 -19.5,-19', fill: 'none', 'stroke-width': 1.1 }, top);
  svg('circle', { cx: -19.5, cy: -19, r: 1.1, fill: INK }, top);
}

// Plate carrier with a team-colour patch.
function carrier(g, c, fill) {
  shape('rect', { x: -7.5, y: 8, width: 15, height: 12, rx: 2, fill }, g);
  shape('rect', { x: 1.6, y: 10, width: 4, height: 2.6, fill: c.main, 'stroke-width': 0.6 }, g);
}

// Wide-brimmed bush hat.
function boonie(g, fill) {
  shape('path', { d: 'M-6.6,-5.6 C-6.8,-13.2 6.8,-13.2 6.6,-5.6 Z', fill }, g);
  shape('rect', { x: -6.4, y: -9.4, width: 12.8, height: 1.7, fill: COYOTE_DARK, 'stroke-width': 0.6 }, g);
  shape('ellipse', { cx: 0, cy: -5.6, rx: 10.5, ry: 2.2, fill }, g);
}

const wheel = (g, x, y, r = 3.4) => {
  shape('circle', { cx: x, cy: y, r, fill: TRACK }, g);
  svg('circle', { cx: x, cy: y, r: r * 0.38, fill: STEEL_LIGHT }, g);
};

// Armoured carrier hull, side on: four big wheels, a tall angled hull with a rear door and windows.
function carrierHull(g, c) {
  shadow(g, 14);
  shape('path', { d: 'M-16,8 L-16,-1 L-11,-5 L13,-5 L17,1 L17,8 Z', fill: c.main }, g);
  shape('path', { d: 'M-16,3.5 H17 V8 H-16 Z', fill: c.dark }, g);
  shape('path', { d: 'M-11,-5 L-9,-1.5 L12,-1.5', fill: 'none', stroke: c.dark, 'stroke-width': 0.8 }, g);
  shape('rect', { x: -14.6, y: -1, width: 3.6, height: 4.4, rx: 0.6, fill: c.light, 'stroke-width': 0.7 }, g); // rear door
  for (const x of [3, 7, 11]) shape('rect', { x, y: -4, width: 2.4, height: 1.6, fill: GLASS, 'stroke-width': 0.5 }, g);
  for (const x of [-11.5, -5.5, 3.5, 9.5]) {
    shape('circle', { cx: x, cy: 9.6, r: 3.3, fill: TRACK }, g);
    svg('circle', { cx: x, cy: 9.6, r: 1.2, fill: STEEL_LIGHT }, g);
  }
}

// A small cloud seen from above, s times its usual size.
function cloud(g, x, y, s) {
  shape('path', { d: `M${x - 6 * s},${y} a${3 * s},${3 * s} 0 0 1 ${4 * s},${-2.8 * s} a${4 * s},${4 * s} 0 0 1 ${6.5 * s},${0.6 * s} a${2.6 * s},${2.6 * s} 0 0 1 ${1.5 * s},${2.2 * s} Z`, fill: '#fff', 'stroke-width': 0.7, opacity: 0.9 }, g);
}

// Tracks and road wheels seen side on, from x0 to x1.
function tracks(g, x0 = -15.5, x1 = 15.5, n = 6) {
  shape('rect', { x: x0, y: 5, width: x1 - x0, height: 7.5, rx: 3.7, fill: TRACK }, g);
  for (let i = 0; i < n; i++) {
    shape('circle', { cx: x0 + 4.5 + (i * (x1 - x0 - 9)) / (n - 1), cy: 9.6, r: 2, fill: STEEL_LIGHT, 'stroke-width': 0.7 }, g);
  }
}

// Military truck, side on, cab at the front (right): the flat bed is free for what it carries.
function truck(g, c, wheels = [-11, -4.5, 10.5]) {
  shadow(g, 14);
  shape('rect', { x: -15.5, y: 4, width: 31, height: 3.6, fill: c.dark }, g);
  shape('path', { d: 'M6,4 L6,-5 L11.5,-5 L16,0 L16,4 Z', fill: c.main }, g);
  shape('path', { d: 'M8,-3.6 L11,-3.6 L14,0 L8,0 Z', fill: GLASS, 'stroke-width': 0.7 }, g);
  for (const x of wheels) wheel(g, x, 9.3, 3.6);
}

// Main battle tank, side on: low angular turret, side skirts, and a long gun (drawn into `gunLayer`).
function tank(g, c, gunLayer) {
  shadow(g, 13.5);
  tracks(g);
  shape('path', { d: 'M-16.5,2 L-15,-1.5 L12,-1.5 L17,2 Z', fill: c.main }, g);
  shape('path', { d: 'M-16,2 H16.5 L15,7 H-15.5 Z', fill: c.dark }, g);
  shape('path', { d: 'M-8,2.4 V6.6 M0,2.4 V6.6 M8,2.4 V6.6', fill: 'none', stroke: c.main, 'stroke-width': 0.7 }, g);
  shape('rect', { x: -14, y: -5.4, width: 3.6, height: 3.4, fill: c.dark, 'stroke-width': 0.7 }, g);
  shape('polygon', { points: '-11,-1.5 -10,-6.8 1.5,-7.6 9,-5.2 9.8,-1.5', fill: c.light }, g);
  shape('rect', { x: -0.6, y: -5.2, width: 5.4, height: 1.6, rx: 0.4, fill: c.dark, 'stroke-width': 0.6 }, g); // smoke grenade launchers, under the machine gun
  for (let i = 0; i < 3; i++) {
    shape('rect', { x: 0 + i * 1.5, y: -7.2, width: 1.2, height: 2.8, rx: 0.4, fill: STEEL, 'stroke-width': 0.5, transform: `rotate(35 ${0.6 + i * 1.5} -4.6)` }, g);
  }
  shape('rect', { x: -5, y: -10.2, width: 4.2, height: 2.8, rx: 0.6, fill: STEEL, 'stroke-width': 0.7 }, g);
  shape('rect', { x: -1, y: -9.4, width: 6, height: 0.9, fill: TRACK, 'stroke-width': 0.4 }, g);
  shape('rect', { x: 9.4, y: -5.4, width: 15, height: 1.8, fill: STEEL, 'stroke-width': 0.7 }, gunLayer);
  shape('rect', { x: 14, y: -5.9, width: 3, height: 2.8, rx: 0.6, fill: STEEL, 'stroke-width': 0.7 }, gunLayer);
  shape('rect', { x: 23.5, y: -5.9, width: 2, height: 2.8, rx: 0.4, fill: STEEL, 'stroke-width': 0.7 }, gunLayer);
}

// A spinning main rotor seen side on (a blurred disc and one blade) on a mast standing at (x, y).
function rotor(parent, x, y, span) {
  shape('rect', { x: x - 1, y, width: 2, height: 2.6, fill: STEEL, 'stroke-width': 0.6 }, parent);
  svg('ellipse', { cx: x, cy: y, rx: span, ry: 1.7, fill: BLUR, opacity: 0.6 }, parent);
  shape('ellipse', { cx: x, cy: y, rx: span, ry: 1.7, fill: 'none', 'stroke-width': 0.5, opacity: 0.5 }, parent);
  shape('path', { d: `M${x - span + 1.5},${y + 0.4} L${x + span - 1.5},${y - 0.4}`, fill: 'none', stroke: STEEL, 'stroke-width': 1.3 }, parent);
  shape('circle', { cx: x, cy: y, r: 1.3, fill: STEEL, 'stroke-width': 0.6 }, parent);
}

function tailRotor(parent, x, y, r = 3.4) {
  svg('circle', { cx: x, cy: y, r, fill: BLUR, opacity: 0.6 }, parent);
  shape('circle', { cx: x, cy: y, r, fill: 'none', 'stroke-width': 0.5, opacity: 0.5 }, parent);
  shape('path', { d: `M${x - 0.8},${y - r + 0.5} L${x + 0.8},${y + r - 0.5}`, fill: 'none', stroke: STEEL, 'stroke-width': 1 }, parent);
}

// Utility helicopter, side on: boxy cabin with the side door open (troops inside if `troops`), rotor into `rotorLayer`.
function utilityHelicopter(g, c, rotorLayer, troops) {
  shape('path', { d: 'M-4,-3.5 L-15,-4 L-15,-1 L-4,2.5 Z', fill: c.dark }, g); // tail boom
  shape('path', { d: 'M-15.6,-1 L-17,-10 L-14,-10 L-12,-3.6 Z', fill: c.main }, g); // fin
  tailRotor(g, -15, -7.5);
  shape('path', { d: 'M-8,-5 L8,-5 Q14.5,-4.5 16,1 L16,4.5 Q15,8 11,8 L-8,8 Z', fill: c.main }, g);
  shape('path', { d: 'M-8,4 H16 Q15,8 11,8 H-8 Z', fill: c.dark, 'stroke-width': 0.8 }, g); // belly
  shape('path', { d: 'M9.5,-3.6 Q14,-3.3 15,0.8 L9.5,0.8 Z', fill: GLASS, 'stroke-width': 0.7 }, g);
  shape('rect', { x: -2.5, y: -3, width: 7.5, height: 7.4, fill: TRACK, 'stroke-width': 0.8 }, g); // open door
  if (troops) {
    for (const x of [-0.2, 3]) {
      svg('circle', { cx: x, cy: 0.6, r: 1.3, fill: SKIN }, g);
      svg('path', { d: `M${x - 1.6},0.4 Q${x},-2.6 ${x + 1.6},0.4 Z`, fill: c.dark }, g);
    }
  }
  shape('rect', { x: -6.6, y: -2.6, width: 2.6, height: 2.4, rx: 0.5, fill: GLASS, 'stroke-width': 0.6 }, g);
  shape('path', { d: 'M-5,-5 L-3,-8.2 L7,-8.2 L9,-5 Z', fill: c.light }, g); // engines
  for (const x of [-5, 11]) {
    shape('line', { x1: x, y1: 8, x2: x, y2: 10.5, stroke: STEEL, 'stroke-width': 1 }, g);
    shape('circle', { cx: x, cy: 11.2, r: 1.9, fill: TRACK, 'stroke-width': 0.7 }, g);
  }
  rotor(rotorLayer, 2, -10.8, 20);
}

// Small quadcopter seen from above, at (x, y), scaled by s.
function miniDrone(parent, x, y, s, c) {
  const d = svg('g', { transform: `translate(${x} ${y}) scale(${s})` }, parent);
  for (const [ax, ay] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
    shape('line', { x1: 0, y1: 0, x2: ax, y2: ay, stroke: STEEL, 'stroke-width': 2.4 }, d);
  }
  for (const [ax, ay] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
    svg('circle', { cx: ax, cy: ay, r: 4.4, fill: BLUR, opacity: 0.6 }, d);
    shape('circle', { cx: ax, cy: ay, r: 4.4, fill: 'none', 'stroke-width': 0.7, opacity: 0.6 }, d);
    shape('circle', { cx: ax, cy: ay, r: 1.2, fill: STEEL, 'stroke-width': 0.7 }, d);
  }
  shape('rect', { x: -3.2, y: -4, width: 6.4, height: 8, rx: 2.2, fill: c.main }, d);
  svg('rect', { x: -2, y: -3, width: 4, height: 1.8, rx: 0.8, fill: c.light }, d);
}

// Both layers wrapped in the same transform, for a picture that needs shrinking or moving as a whole.
const fit = (g, top, transform) => [g, top].map((layer) => svg('g', { transform }, layer));

// Points of a star or starburst around (cx, cy).
function star(cx, cy, outer, inner, n, turn = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = turn + (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 ? inner : outer;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

// A ring segment from r0 to r1 between angles a0 and a1 (degrees, clockwise from +x).
function sector(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => `${(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(2)},${(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(2)}`;
  return `M${p(r1, a0)} A${r1},${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 0 0 ${p(r0, a0)} Z`;
}

// Radio waves: arcs around (x, y), facing `dir` degrees.
function waves(parent, x, y, dir, color) {
  for (const r of [3.5, 6.5, 9.5]) {
    const d = sector(x, y, r, r, dir - 35, dir + 35).replace(/ L.*$/, '');
    shape('path', { d, fill: 'none', 'stroke-width': 2.6 }, parent);
    svg('path', { d, fill: 'none', stroke: color, 'stroke-width': 1.2, 'stroke-linecap': 'round' }, parent);
  }
}

const ART = {
  // Infantry: modern helmet, plate carrier, assault rifle whose barrel pokes out of the token.
  light(g, c, top) {
    bust(g, c, { jacket: c.main });
    shape('rect', { x: -7.5, y: 8, width: 15, height: 12, rx: 2, fill: COYOTE }, g);
    helmet(g, c.dark);
    shape('path', { d: 'M-5,-9.6 Q0,-11.6 5,-9.6', fill: 'none', stroke: c.light, 'stroke-width': 1, opacity: 0.7 }, g);
    rifle(top, 'translate(2 8.5) rotate(-38)', COYOTE_DARK);
  },

  // Armoured carrier, side on: four big wheels and a tall angled hull with a flat roof, a rear door and windows. No gun: it carries troops.
  armour(g, c) {
    carrierHull(g, c);
  },

  // General: peaked cap, gold braid, epaulettes, medals, and a sabre raised out of the token.
  hero(g, c, top) {
    bust(g, c, { jacket: c.main });
    shape('path', { d: 'M-16,19 C-16,12 -13,8.5 -9,7.2 L-6,9 Z', fill: c.dark, 'stroke-width': 0.8 }, g);
    shape('ellipse', { cx: -11, cy: 8.4, rx: 4.2, ry: 1.8, fill: GOLD, transform: 'rotate(-18 -11 8.4)' }, g);
    shape('ellipse', { cx: 11, cy: 8.4, rx: 4.2, ry: 1.8, fill: GOLD, transform: 'rotate(18 11 8.4)' }, g);
    [['#c0392b', -10.5], ['#2e86c1', -7.4], ['#27ae60', -4.3]].forEach(([col, x]) => shape('rect', { x, y: 11.5, width: 2.8, height: 2, fill: col, 'stroke-width': 0.6 }, g));
    shape('circle', { cx: -6, cy: 16, r: 1.6, fill: GOLD, 'stroke-width': 0.6 }, g);
    shape('path', { d: 'M-3.2,1.4 Q0,0 3.2,1.4 Q0,2.4 -3.2,1.4 Z', fill: '#6b4a2b', 'stroke-width': 0.5 }, g);
    shape('path', { d: 'M-7,-5.5 L-10.5,-10 C-6,-14 6,-14 10.5,-10 L7,-5.5 Z', fill: c.main }, g);
    shape('rect', { x: -7.6, y: -7.6, width: 15.2, height: 2.6, fill: GOLD, 'stroke-width': 0.8 }, g);
    shape('path', { d: 'M-8.2,-5.2 Q0,-2.2 8.2,-5.2 Q0,-4 -8.2,-5.2 Z', fill: INK }, g);
    shape('circle', { cx: 0, cy: -9.8, r: 1.7, fill: GOLD, 'stroke-width': 0.6 }, g);
    shape('path', { d: 'M9.2,11 Q16,-3 15,-22 L16.7,-21.6 Q18.2,-3 10.8,11.4 Z', fill: '#e3e8ee', 'stroke-width': 0.7 }, top);
    shape('rect', { x: 9.6, y: 16.5, width: 1.8, height: 4, fill: '#4a2f1a', 'stroke-width': 0.5, transform: 'rotate(-160 10 15)' }, top);
    shape('path', { d: 'M6.8,11.6 Q10,10 13.4,11.8 Q13.6,15.5 10.8,16.2', fill: 'none', stroke: GOLD, 'stroke-width': 1.6 }, top);
    shape('circle', { cx: 10.2, cy: 14, r: 2.4, fill: '#f2f2f2', 'stroke-width': 0.7 }, top);
  },
  // Recon drone from above: four arms, spinning rotors, the body in team colour and a camera underneath.
  flying(g, c, top) {
    svg('ellipse', { cx: 1.5, cy: 3, rx: 10, ry: 9, fill: '#000', opacity: 0.12 }, g);
    for (const [x, y] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
      shape('line', { x1: 0, y1: 0, x2: x, y2: y, stroke: STEEL, 'stroke-width': 3 }, g);
      shape('line', { x1: 0, y1: 0, x2: x, y2: y, stroke: STEEL_LIGHT, 'stroke-width': 1.2 }, g);
    }
    for (const [x, y] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
      svg('circle', { cx: x, cy: y, r: 6.8, fill: '#dfe7ee', opacity: 0.55 }, g);
      shape('circle', { cx: x, cy: y, r: 6.8, fill: 'none', 'stroke-width': 0.6, opacity: 0.6 }, g);
      shape('path', { d: `M${x - 6},${y + 1.5} L${x + 6},${y - 1.5}`, fill: 'none', stroke: INK, 'stroke-width': 1.3, opacity: 0.55 }, g);
      shape('circle', { cx: x, cy: y, r: 1.6, fill: STEEL }, g);
    }
    shape('rect', { x: -5.5, y: -6.5, width: 11, height: 13, rx: 3.5, fill: c.main }, g);
    shape('rect', { x: -3.6, y: -5, width: 7.2, height: 3, rx: 1.2, fill: c.light, 'stroke-width': 0.6 }, g);
    shape('circle', { cx: 0, cy: 2.6, r: 2.7, fill: TRACK }, g);
    svg('circle', { cx: 0.8, cy: 1.9, r: 0.9, fill: '#7fd4ff' }, g);
    svg('circle', { cx: -3.6, cy: 5.2, r: 0.7, fill: '#7dff6a' }, g);
    shape('path', { d: 'M3,-6.5 L7.4,-21.5', fill: 'none', 'stroke-width': 1 }, top); // antenna
    svg('circle', { cx: 7.4, cy: -21.5, r: 1, fill: INK }, top);
  },
  // Mortar team: a mortar tube on its bipod and baseplate behind sandbags, its muzzle out of the token, a team-coloured ammo crate.
  range(g, c, top) {
    shadow(g, 14);
    shape('ellipse', { cx: -2, cy: 9.5, rx: 8, ry: 2.6, fill: STEEL }, g); // baseplate
    shape('path', { d: 'M3,-1 L9.5,11 M3,-1 L1,11', fill: 'none', stroke: STEEL, 'stroke-width': 1.6 }, g); // bipod
    shape('path', { d: 'M2,-0.4 L6.6,1.8', fill: 'none', stroke: STEEL_LIGHT, 'stroke-width': 1.2 }, g);
    const tube = svg('g', { transform: 'translate(-3 9) rotate(-62)' }, top);
    shape('rect', { x: 0, y: -2.2, width: 27, height: 4.4, rx: 1, fill: '#3d4248', 'stroke-width': 0.8 }, tube);
    shape('rect', { x: 25, y: -2.7, width: 3, height: 5.4, rx: 0.6, fill: STEEL, 'stroke-width': 0.7 }, tube);
    for (const x of [-15, -9, 9, 15]) shape('rect', { x: x - 3, y: 11, width: 6, height: 4.5, rx: 2.2, fill: COYOTE, 'stroke-width': 0.8 }, g);
    for (const x of [-12, 12]) shape('rect', { x: x - 3, y: 7, width: 6, height: 4.5, rx: 2.2, fill: COYOTE_DARK, 'stroke-width': 0.8 }, g);
    shape('rect', { x: -16, y: -1, width: 8.5, height: 7, rx: 0.8, fill: c.dark }, g); // ammo crate
    shape('rect', { x: -14.6, y: 1.4, width: 5.7, height: 2, fill: c.light, stroke: 'none' }, g);
    for (const x of [-5.5, -3]) {
      shape('path', { d: `M${x},6 L${x},0.5 Q${x + 0.9},-1.8 ${x + 1.8},0.5 L${x + 1.8},6 Z`, fill: '#6b7a45', 'stroke-width': 0.6 }, g);
    }
  },

  // ---- Pairs ----

  // Infantry fighting vehicle: the carrier's wheeled hull with a turret, a soldier in the hatch and an autocannon out of the token.
  'light+armour'(g, c, top) {
    carrierHull(g, c);
    shape('path', { d: 'M-5,-5 L-4,-9.5 L4,-9.5 L6,-5 Z', fill: c.light }, g);
    shape('rect', { x: 0.8, y: -11.7, width: 4.4, height: 2.2, rx: 0.5, fill: c.dark, 'stroke-width': 0.7 }, g); // missile box
    svg('circle', { cx: -2, cy: -10.9, r: 1.9, fill: SKIN }, g);
    shape('path', { d: 'M-4.3,-10.9 Q-2,-14.9 0.3,-10.9 Z', fill: c.dark, 'stroke-width': 0.7 }, g);
    shape('rect', { x: 5.5, y: -8.2, width: 14, height: 1.2, fill: STEEL, 'stroke-width': 0.6 }, top);
    shape('rect', { x: 18.5, y: -8.7, width: 2.6, height: 2.2, rx: 0.4, fill: STEEL, 'stroke-width': 0.6 }, top);
  },

  // Machine gunner: helmeted gunner behind sandbags, a belt-fed gun on its bipod reaching out of the token, the ammunition belt hanging from the feed tray.
  'light+range'(g, c, top) {
    bust(g, c, { jacket: c.main });
    shape('rect', { x: -7.5, y: 8, width: 15, height: 12, rx: 2, fill: COYOTE }, g);
    helmet(g, c.dark);
    shape('path', { d: 'M-5,-9.6 Q0,-11.6 5,-9.6', fill: 'none', stroke: c.light, 'stroke-width': 1, opacity: 0.7 }, g);
    for (const x of [-14, -7, 0, 7, 14]) shape('rect', { x: x - 3.7, y: 13, width: 7.4, height: 5, rx: 2.4, fill: COYOTE, 'stroke-width': 0.8 }, g);
    const mg = svg('g', { transform: 'translate(-5 7) rotate(-10)' }, top);
    const gun = { fill: '#363a40', 'stroke-width': 0.7 };
    shape('path', { d: 'M16,1.6 L13.5,9 M16,1.6 L19,9', fill: 'none', stroke: '#363a40', 'stroke-width': 1.2 }, mg); // bipod
    for (let i = 0; i < 7; i++) { // the belt: cartridges pointing forward, hanging from the feed tray
      const x = 0.6 + i * 0.35, y = 1.6 + i * 1.75;
      shape('rect', { x, y, width: 3.4, height: 1.5, rx: 0.4, fill: GOLD, 'stroke-width': 0.45 }, mg);
      shape('path', { d: `M${x + 3.4},${y} L${x + 5.2},${y + 0.75} L${x + 3.4},${y + 1.5} Z`, fill: '#b5651d', 'stroke-width': 0.45 }, mg);
    }
    shape('path', Object.assign({ d: 'M-12,-1.6 L-5,-2.2 L-5,2.4 L-12,3.6 Z' }, gun), mg);
    shape('path', Object.assign({ d: 'M-4.6,2 L-2.6,2 L-3.3,6.5 L-5.6,6 Z' }, gun), mg);
    shape('rect', Object.assign({ x: 17.5, y: -0.7, width: 8, height: 1.4 }, gun), mg);
    shape('rect', Object.assign({ x: 25, y: -1.3, width: 3, height: 2.6, rx: 0.5 }, gun), mg);
    shape('rect', Object.assign({ x: 7.5, y: -1.7, width: 10.5, height: 3.4, rx: 0.6 }, gun), mg);
    for (const x of [10, 12.6, 15.2]) svg('circle', { cx: x, cy: 0, r: 0.6, fill: '#15181b' }, mg);
    shape('rect', Object.assign({ x: -5.5, y: -2.6, width: 13.5, height: 4.8, rx: 0.6 }, gun), mg);
    shape('rect', { x: -0.6, y: -4.2, width: 6.4, height: 1.8, rx: 0.5, fill: TRACK, 'stroke-width': 0.6 }, mg); // feed cover
    shape('path', { d: 'M5,-2.6 Q7.5,-5.6 10.5,-2.6', fill: 'none', 'stroke-width': 1 }, mg);
    shape('circle', { cx: -3.8, cy: 4.6, r: 2.1, fill: COYOTE_DARK, 'stroke-width': 0.7 }, mg);
    shape('circle', { cx: -9.5, cy: 0.4, r: 2.1, fill: COYOTE_DARK, 'stroke-width': 0.7 }, mg);
  },

  // Strike drone: a first-person-view kamikaze drone diving in, an anti-tank warhead strapped on reaching out of the token.
  'light+flying'(g, c, top) {
    svg('ellipse', { cx: 2.5, cy: 5, rx: 11, ry: 8.5, fill: '#000', opacity: 0.12 }, g);
    for (const [x, y] of [[-14, 4], [-11, 10], [-6, 13]]) svg('path', { d: `M${x},${y} l-4,3.4`, stroke: INK, 'stroke-width': 0.9, opacity: 0.4, 'stroke-linecap': 'round' }, g);
    const d = svg('g', { transform: 'translate(-1 1) rotate(-40)' }, g);
    for (const [x, y] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) {
      shape('line', { x1: 0, y1: 0, x2: x, y2: y, stroke: TRACK, 'stroke-width': 3 }, d);
      shape('line', { x1: 0, y1: 0, x2: x, y2: y, stroke: '#4a4f57', 'stroke-width': 1 }, d);
    }
    for (const [x, y] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) {
      svg('circle', { cx: x, cy: y, r: 5.6, fill: BLUR, opacity: 0.6 }, d);
      shape('circle', { cx: x, cy: y, r: 5.6, fill: 'none', 'stroke-width': 0.6, opacity: 0.6 }, d);
      shape('path', { d: `M${x - 4.8},${y + 1.6} L${x + 4.8},${y - 1.6}`, fill: 'none', stroke: INK, 'stroke-width': 1.2, opacity: 0.5 }, d);
      shape('circle', { cx: x, cy: y, r: 1.5, fill: STEEL }, d);
    }
    shape('path', { d: 'M-6,-1 L-10,-3.4 M-6,1 L-10,3.4', fill: 'none', 'stroke-width': 0.9 }, d); // video antennas
    shape('rect', { x: -6, y: -3.4, width: 11, height: 6.8, rx: 1.8, fill: c.main }, d);
    shape('rect', { x: -4.4, y: -2.2, width: 6, height: 4.4, rx: 0.8, fill: c.dark, 'stroke-width': 0.7 }, d); // battery
    svg('path', { d: 'M-2.6,-3.4 V3.4 M0.4,-3.4 V3.4', stroke: COYOTE, 'stroke-width': 0.9 }, d); // straps
    shape('rect', { x: 4.4, y: -1.5, width: 2, height: 3, rx: 0.6, fill: TRACK, 'stroke-width': 0.6 }, d); // camera
    svg('circle', { cx: 6, cy: 0, r: 0.6, fill: '#7fd4ff' }, d);
    const w = svg('g', { transform: 'translate(-1 1) rotate(-40)' }, top);
    shape('path', { d: 'M6.4,-1.4 L10,-1.4 L11,-2.8 L14.6,-2.8 Q18.6,-1.6 19.2,0 Q18.6,1.6 14.6,2.8 L11,2.8 L10,1.4 L6.4,1.4 Z', fill: '#5f6b4a', 'stroke-width': 0.8 }, w);
    shape('rect', { x: 11.6, y: -2.8, width: 1, height: 5.6, fill: GOLD, 'stroke-width': 0.5 }, w);
    shape('rect', { x: 19, y: -0.5, width: 1.6, height: 1, fill: STEEL, 'stroke-width': 0.5 }, w); // fuse
  },

  // Scout: full ghillie suit and face paint, a radio on his chest with its antenna out of the token, glassing the enemy
  // through big binoculars held in both hands.
  'light+hero'(g, c, top) {
    const ghillie = mix('#5d6b3a', c.main, 0.18);
    bust(g, c, { jacket: ghillie });
    shape('path', { d: 'M-16.6,19 L-16,13 L-14.2,11.4 L-15.2,9.2 L-12,8.6 L-11.6,6.2 L-8.6,6.6 L-6.8,4 L-4.4,6 L-2,4.6 L0,6.2 L2,4.6 L4.4,6 L6.8,4 L8.6,6.6 L11.6,6.2 L12,8.6 L15.2,9.2 L14.2,11.4 L16,13 L16.6,19 Z', fill: ghillie, 'stroke-width': 0.8 }, g); // the suit, shoulders to waist
    for (const [x, y, a] of [[-12, 13, -30], [-8, 10, 20], [-4, 15, -10], [1, 11, 35], [5, 16, -25], [9, 11.5, 10], [-10, 17.5, 15], [12, 16, -20], [-1, 18, 25]]) {
      svg('path', { d: `M${x},${y} l1.8,-1.4 M${x + 0.6},${y + 1.4} l2,-0.4`, stroke: '#3f4a27', 'stroke-width': 0.8, 'stroke-linecap': 'round', transform: `rotate(${a} ${x} ${y})` }, g);
      svg('path', { d: `M${x - 1.6},${y + 0.6} l1.4,-1.6`, stroke: '#8a9a5b', 'stroke-width': 0.8, 'stroke-linecap': 'round' }, g);
    }
    shape('rect', { x: -13.2, y: 11, width: 3.6, height: 2.6, rx: 0.4, fill: c.main, 'stroke-width': 0.6 }, g); // team patch
    for (const [x1, y1, x2, y2] of [[-5.2, 1, -2.4, 2.2], [2.4, 2.2, 5.2, 1], [-1.4, 3.4, 1.4, 3.4]]) {
      svg('path', { d: `M${x1},${y1} L${x2},${y2}`, stroke: '#3f4a27', 'stroke-width': 1.3, opacity: 0.8, 'stroke-linecap': 'round' }, g); // face paint
    }
    shape('path', { d: 'M-8.5,4 L-9.6,0 L-8,-2 L-9.8,-5 L-7.5,-7 L-8.6,-10 L-5,-10.6 L-4,-13.2 L-1,-11.6 L1,-13.8 L3,-11.6 L5.6,-12.6 L6,-10 L9,-9.6 L7.8,-7 L9.8,-4.6 L8,-2 L9.6,0 L8.5,4 L6,3 L6.6,-3 Q0,-8.6 -6.6,-3 L-6,3 Z', fill: ghillie }, g);
    for (const [x, y] of [[-6, -9], [2, -11], [7, -6], [-8, -3]]) svg('path', { d: `M${x},${y} l1.6,-1.2 M${x + 0.6},${y + 1.4} l1.8,-0.4`, stroke: '#3f4a27', 'stroke-width': 0.7, 'stroke-linecap': 'round' }, g);
    for (const x of [-7.4, 0.8]) {
      shape('rect', { x, y: -6.4, width: 6.6, height: 5.8, rx: 1.6, fill: '#3a3f46' }, g);
      shape('circle', { cx: x + 3.3, cy: -3.5, r: 2.2, fill: '#15181b', 'stroke-width': 0.6 }, g);
      svg('circle', { cx: x + 4, cy: -4.2, r: 0.7, fill: '#7fd4ff' }, g);
    }
    shape('rect', { x: -1, y: -5, width: 2, height: 2, fill: '#3a3f46', 'stroke-width': 0.5 }, g);
    for (const x of [-9.2, 6.6]) shape('rect', { x, y: -6, width: 2.6, height: 5.2, rx: 1.2, fill: COYOTE_DARK, 'stroke-width': 0.7 }, g); // hands
    shape('rect', { x: 6.4, y: 8.4, width: 5.6, height: 7.4, rx: 1, fill: TRACK }, g); // radio
    shape('rect', { x: 7.4, y: 9.6, width: 3.6, height: 2.4, rx: 0.4, fill: '#7dff6a', opacity: 0.85, 'stroke-width': 0.5 }, g);
    for (const x of [7.8, 9.2, 10.6]) svg('circle', { cx: x, cy: 13.8, r: 0.5, fill: STEEL_LIGHT }, g);
    shape('path', { d: 'M11,8.4 Q14,-4 19,-18', fill: 'none', 'stroke-width': 1.1 }, top);
    svg('circle', { cx: 19, cy: -18, r: 1.1, fill: INK }, top);
  },

  // Howitzer: a truck carrying a big gun on its bed, with a spade dug in at the back and a long barrel with a heavy muzzle brake out of the token.
  'armour+range'(g, c, top) {
    truck(g, c);
    shape('path', { d: 'M-14,6 L-17,13.4 L-15,14 L-12,6.6 Z', fill: STEEL, 'stroke-width': 0.7 }, g); // spade
    shape('polygon', { points: '-11,4 -9.5,-1 -1.5,-1 0,4', fill: c.dark }, g); // mount
    shape('path', { d: 'M-8.6,-0.6 L-7.4,-7.8 L-0.6,-9.6 L0.6,-0.6 Z', fill: c.main }, g); // shield
    shape('path', { d: 'M-6.8,-2 L-1,-3.6', fill: 'none', stroke: c.light, 'stroke-width': 1 }, g);
    const gun = svg('g', { transform: 'translate(-4.5 -4.5) rotate(-30)' }, top);
    shape('rect', { x: 4, y: -1.2, width: 20, height: 2.4, fill: STEEL, 'stroke-width': 0.7 }, gun);
    shape('rect', { x: 23, y: -2.5, width: 5, height: 5, rx: 0.8, fill: STEEL, 'stroke-width': 0.7 }, gun); // muzzle brake
    svg('path', { d: 'M24.6,-2.5 V2.5 M26.4,-2.5 V2.5', stroke: INK, 'stroke-width': 0.6 }, gun);
    shape('rect', { x: -7, y: -3, width: 12, height: 6, rx: 1.2, fill: c.light }, gun); // cradle
    shape('rect', { x: -5.5, y: -4.6, width: 9, height: 1.8, rx: 0.8, fill: c.dark, 'stroke-width': 0.7 }, gun); // recoil cylinders
  },

  // Transport helicopter: a boxy utility helicopter with the side door open and troops inside, rotor out of the token.
  'armour+flying'(g, c, top) {
    shadow(g, 15);
    const [h, hTop] = fit(g, top, 'translate(-0.5 1.5) scale(0.86)');
    utilityHelicopter(h, c, hTop, true);
  },

  // Combat engineer: an armoured engineering vehicle with a hazard-striped dozer blade and a digging arm reaching out of the token.
  'armour+hero'(g, c, top) {
    shadow(g, 13.5);
    tracks(g, -15.5, 11.5, 5);
    shape('path', { d: 'M-16,5 L-16,-3 L-13,-5 L5,-5 L11.5,0.5 L11.5,5 Z', fill: c.main }, g);
    shape('path', { d: 'M-16,1.5 H11.5 V6.5 H-16 Z', fill: c.dark }, g);
    shape('path', { d: 'M-12,-5 L-11,-10 L-4,-10 L-3,-5 Z', fill: c.light }, g);
    shape('rect', { x: -10.4, y: -9, width: 5.6, height: 2.4, rx: 0.4, fill: GLASS, 'stroke-width': 0.6 }, g);
    shape('path', { d: 'M9.5,3 L14,5', fill: 'none', stroke: STEEL, 'stroke-width': 1.8 }, g);
    const blade = 'M15.4,-2.6 Q12,5 15.2,13.2 L18.4,13 Q15.2,5 18.6,-2.2 Z'; // curved face forward
    shape('path', { d: blade, fill: GOLD }, top);
    for (const [x, y] of [[14.6, 0.6], [14.1, 4.6], [14.4, 8.6]]) svg('path', { d: `M${x},${y} l2.4,1.8`, stroke: INK, 'stroke-width': 1.2 }, top);
    shape('path', { d: blade, fill: 'none' }, top);
    shape('path', { d: 'M-2,-5 L4.6,-17 L7.8,-15.8 L1.8,-4.6 Z', fill: GOLD }, top); // boom
    shape('path', { d: 'M5.4,-17.4 L14.8,-12.4 L13.4,-10.2 L5,-14.6 Z', fill: GOLD }, top); // stick
    shape('path', { d: 'M0.6,-7.5 L4.6,-14.2', fill: 'none', stroke: STEEL_LIGHT, 'stroke-width': 1.4 }, top);
    shape('circle', { cx: 6.2, cy: -15.8, r: 1.2, fill: STEEL, 'stroke-width': 0.6 }, top);
    shape('path', { d: 'M13,-12.8 L17.4,-9.6 L15.8,-5.8 L12,-8 Z', fill: STEEL }, top); // bucket
  },

  // Long-range drone: a delta-wing one-way attack drone from above, flying out with a pusher propeller and a trail behind it.
  'range+flying'(g, c) {
    const d = svg('g', { transform: 'rotate(40)' }, g);
    svg('path', { d: 'M0,12 L0,26', stroke: '#fff', 'stroke-width': 3.4, opacity: 0.65, 'stroke-linecap': 'round' }, d);
    const wing = 'M0,-14 L13,8 L12,10.5 L0,7.5 L-12,10.5 L-13,8 Z';
    svg('path', { d: wing, fill: '#000', opacity: 0.14, transform: 'translate(2.5 2)' }, d);
    shape('path', { d: wing, fill: c.main }, d);
    shape('path', { d: 'M-8.6,4.2 L8.6,4.2', fill: 'none', stroke: c.light, 'stroke-width': 1.6 }, d);
    for (const s of [-1, 1]) shape('path', { d: `M${s * 12.2},3.8 L${s * 13.8},3.8 L${s * 13.2},10.6 L${s * 11.8},10.6 Z`, fill: c.dark, 'stroke-width': 0.7 }, d);
    shape('path', { d: 'M-1.8,-11 Q0,-16 1.8,-11 L1.8,9 L-1.8,9 Z', fill: STEEL_LIGHT }, d);
    shape('path', { d: 'M-1.8,-11 Q0,-16 1.8,-11 Z', fill: c.dark, 'stroke-width': 0.8 }, d);
    svg('ellipse', { cx: 0, cy: 10.4, rx: 4.8, ry: 1.1, fill: BLUR, opacity: 0.7 }, d);
    shape('path', { d: 'M-4.4,10.6 L4.4,10.2', fill: 'none', stroke: STEEL, 'stroke-width': 1 }, d);
  },

  // Sniper: cap, headset, shooting glasses and scarf, a heavy scoped rifle with a big muzzle brake raised out of the token.
  'range+hero'(g, c, top) {
    bust(g, c, { jacket: c.main });
    shape('rect', { x: -7.5, y: 8, width: 15, height: 12, rx: 2, fill: COYOTE_DARK }, g); // chest rig
    shape('path', { d: 'M-6,4 Q0,9 6,4 L6.6,7.4 Q0,11.6 -6.6,7.4 Z', fill: COYOTE, 'stroke-width': 0.8 }, g); // scarf
    shape('path', { d: 'M-6.9,-4.2 C-7.1,-12.6 7.1,-12.6 6.9,-4.2 Z', fill: c.dark }, g); // cap
    shape('path', { d: 'M-7.4,-4.6 Q0,-7 7.4,-4.6 Q0,-2.6 -7.4,-4.6 Z', fill: c.dark }, g); // peak
    shape('path', { d: 'M-7.4,-3 C-7.8,-14 7.8,-14 7.4,-3', fill: 'none', stroke: TRACK, 'stroke-width': 1.4 }, g); // headset band
    for (const x of [-9.4, 6.6]) shape('rect', { x, y: -5, width: 2.8, height: 5.4, rx: 1.2, fill: TRACK, 'stroke-width': 0.7 }, g);
    shape('path', { d: 'M-8,-0.4 Q-6.6,3.8 -2.6,3', fill: 'none', stroke: TRACK, 'stroke-width': 0.9 }, g); // mic
    shape('path', { d: 'M-6.4,-3.4 L6.4,-3.4 L6,-0.8 Q3,0.4 0.7,-1 Q0,-1.6 -0.7,-1 Q-3,0.4 -6,-0.8 Z', fill: '#2b2e33', 'stroke-width': 0.8 }, g); // glasses
    svg('path', { d: 'M-5,-2.6 L-2.6,-2.6 M2.6,-2.6 L5,-2.6', stroke: '#7fd4ff', 'stroke-width': 0.7, 'stroke-linecap': 'round' }, g);
    const r = svg('g', { transform: 'translate(-4 13) rotate(-24)' }, top);
    const gun = { fill: '#363a40', 'stroke-width': 0.7 };
    const OLIVE = '#56653d';
    shape('path', { d: 'M-15,-1.6 L-6,-2.4 L-6,2.6 L-8.6,2.6 Q-10,1 -11.4,2.6 L-15,4.2 Z', fill: OLIVE, 'stroke-width': 0.7 }, r); // thumbhole stock
    shape('rect', Object.assign({ x: 6, y: -1, width: 21, height: 2 }, gun), r);
    shape('rect', Object.assign({ x: 26, y: -2, width: 4.8, height: 4, rx: 0.6 }, gun), r); // muzzle brake
    svg('path', { d: 'M27.6,-2 V2 M29.2,-2 V2', stroke: INK, 'stroke-width': 0.6 }, r);
    shape('rect', { x: -6.5, y: -2.4, width: 13, height: 4.6, rx: 0.8, fill: OLIVE, 'stroke-width': 0.7 }, r);
    shape('rect', { x: -1.5, y: -2.8, width: 1.8, height: 1, fill: TRACK, 'stroke-width': 0.4 }, r);
    shape('rect', { x: 3.5, y: -2.8, width: 1.8, height: 1, fill: TRACK, 'stroke-width': 0.4 }, r);
    shape('rect', { x: -4, y: -5.6, width: 12, height: 2.9, rx: 1.4, fill: TRACK, 'stroke-width': 0.7 }, r); // scope
    shape('rect', { x: 7, y: -6, width: 2.4, height: 3.7, rx: 0.8, fill: TRACK, 'stroke-width': 0.6 }, r);
    shape('circle', { cx: 0, cy: 2.4, r: 2.1, fill: COYOTE_DARK, 'stroke-width': 0.7 }, r);
    shape('circle', { cx: 8, cy: 1.4, r: 2.1, fill: COYOTE_DARK, 'stroke-width': 0.7 }, r);
  },

  // Attack helicopter: slim, tandem cockpits stepped one behind the other, a rocket pod on the stub wing, a chin gun.
  'flying+hero'(g, c, layer) {
    shadow(g, 15);
    const [g0, top] = fit(g, layer, 'translate(-0.5 1) scale(0.88)');
    g = g0;
    shape('path', { d: 'M-3,-3 L-15,-3.4 L-15,-0.8 L-3,2 Z', fill: c.dark }, g);
    shape('path', { d: 'M-15.6,-0.8 L-16.8,-9 L-14,-9 L-12.6,-3.2 Z', fill: c.main }, g);
    tailRotor(g, -14.8, -6.6, 3.2);
    shape('path', { d: 'M-6,-2.8 L-4,-5.5 L3,-5.5 L9,-2.6 Q15,-0.5 16,2.6 L13,4.6 L-6,3.8 Z', fill: c.main }, g);
    shape('path', { d: 'M-5,-5.5 L-3.5,-8 L1,-8 L1.5,-5.5 Z', fill: c.light }, g);
    shape('path', { d: 'M1,-5.5 Q2,-9.6 5.8,-9 L7.6,-3.4 L3,-5.5 Z', fill: GLASS, 'stroke-width': 0.8 }, g);
    shape('path', { d: 'M7.6,-3.4 Q8.6,-6.8 11.6,-5.6 L13.8,-1 Q11,-2.2 9,-2.6 Z', fill: GLASS, 'stroke-width': 0.8 }, g);
    shape('path', { d: 'M-4,0.6 L5,0.6 L4,2.6 L-4,2.6 Z', fill: c.dark, 'stroke-width': 0.8 }, g);
    shape('rect', { x: -3.4, y: 2.6, width: 7.4, height: 3.2, rx: 1.6, fill: STEEL, 'stroke-width': 0.7 }, g);
    svg('circle', { cx: 3.4, cy: 4.2, r: 0.8, fill: TRACK }, g);
    shape('path', { d: 'M-2,4 L-3,9.5 M8,4.4 L9,9.5', fill: 'none', stroke: STEEL, 'stroke-width': 1 }, g);
    shape('path', { d: 'M-6,9.5 L12,9.5 Q14,9.5 14.5,8.2', fill: 'none', stroke: STEEL, 'stroke-width': 1.3 }, g);
    shape('path', { d: 'M13,5.2 L17.5,6.6', fill: 'none', stroke: STEEL, 'stroke-width': 1.1 }, g);
    shape('circle', { cx: 12.4, cy: 4.8, r: 1.7, fill: STEEL, 'stroke-width': 0.7 }, g);
    rotor(top, -1, -10.6, 20);
  },

  // ---- Triples ----

  // Assault trooper: heavy plate carrier, shoulder armour, a visored helmet, grenades on the vest and a rifle out of the token.
  'light+armour+range'(g, c, top) {
    bust(g, c, { jacket: c.main });
    shape('rect', { x: -8.5, y: 7.5, width: 17, height: 13, rx: 2, fill: COYOTE }, g);
    for (const x of [1.4, 5.4]) {
      shape('rect', { x: x - 0.8, y: 11.4, width: 1.6, height: 1.4, fill: STEEL, 'stroke-width': 0.5 }, g);
      shape('ellipse', { cx: x, cy: 14.8, rx: 1.9, ry: 2.3, fill: '#5f6b4a', 'stroke-width': 0.7 }, g);
      svg('path', { d: `M${x - 1.5},14.8 H${x + 1.5}`, stroke: INK, 'stroke-width': 0.5, opacity: 0.6 }, g);
    }
    shape('polygon', { points: star(-3.4, 10, 2.2, 0.9, 5), fill: GOLD, 'stroke-width': 0.6 }, g);
    for (const s of [-1, 1]) shape('ellipse', { cx: s * 11.5, cy: 8.6, rx: 5, ry: 3.2, fill: c.dark, transform: `rotate(${s * 22} ${s * 11.5} 8.6)` }, g);
    helmet(g, c.dark);
    shape('path', { d: 'M-7,-4.6 L7,-4.6 L6.4,1.4 Q0,3.8 -6.4,1.4 Z', fill: '#9ec4dc', opacity: 0.75 }, g);
    svg('path', { d: 'M-5,-3.4 L-2,-3.4', stroke: '#fff', 'stroke-width': 1, opacity: 0.8, 'stroke-linecap': 'round' }, g);
    rifle(top, 'translate(1 9.5) rotate(-38)', COYOTE_DARK);
  },

  // Heliborne troops: a soldier on the ground, the helicopter that brought them lifting off behind.
  'light+armour+flying'(g, c, top) {
    const heli = svg('g', { transform: 'translate(5 -6.5) scale(0.5)' }, g);
    utilityHelicopter(heli, c, heli, false);
    const man = svg('g', { transform: 'translate(-4 4) scale(0.88)' }, g);
    bust(man, c, { jacket: c.main });
    shape('rect', { x: -7.5, y: 8, width: 15, height: 12, rx: 2, fill: COYOTE }, man);
    helmet(man, c.dark);
    shape('path', { d: 'M-5,-9.6 Q0,-11.6 5,-9.6', fill: 'none', stroke: c.light, 'stroke-width': 1, opacity: 0.7 }, man);
    rifle(top, 'translate(-2.5 12) rotate(-38) scale(0.88)', COYOTE_DARK);
  },

  // Electronic warfare: a truck with an equipment shelter, antenna masts and jamming waves spreading out of the token.
  'light+armour+hero'(g, c, top) {
    truck(g, c);
    shape('rect', { x: -15, y: -6.5, width: 19.5, height: 10.5, rx: 1, fill: c.light }, g);
    shape('rect', { x: -4, y: -4.6, width: 4, height: 7.6, rx: 0.4, fill: c.main, 'stroke-width': 0.7 }, g);
    shape('path', { d: 'M-13,-4 H-7 M-13,-2.4 H-7 M-13,-0.8 H-7', fill: 'none', stroke: c.dark, 'stroke-width': 0.7 }, g);
    shape('rect', { x: -12, y: -17.5, width: 1.6, height: 11, fill: STEEL, 'stroke-width': 0.6 }, top);
    shape('rect', { x: -14.6, y: -21, width: 6.8, height: 4.2, rx: 0.6, fill: '#d9dde2', 'stroke-width': 0.8 }, top);
    svg('path', { d: 'M-12.3,-21 V-16.8 M-10.1,-21 V-16.8', stroke: STEEL_LIGHT, 'stroke-width': 0.6 }, top);
    shape('rect', { x: 0.2, y: -14.5, width: 1.6, height: 8, fill: STEEL, 'stroke-width': 0.6 }, top);
    shape('path', { d: 'M-2.6,-14.5 H4.6 M-1.8,-16.8 V-12.2 M1,-17.4 V-11.6 M3.8,-16.6 V-12.4', fill: 'none', stroke: STEEL, 'stroke-width': 0.9 }, top);
    waves(top, 1, -14.5, -40, c.light);
    waves(top, -11.2, -19, -140, c.light);
  },

  // Bomber drone: a heavy six-rotor drone, front on, just after letting go of its bomb. Its rotors reach out over the ring.
  'light+range+flying'(g, c, top) {
    const bomb = svg('g', { transform: 'translate(0 7.5)' }, g);
    shape('path', { d: 'M-2.6,-3.4 L-4.2,-6.4 L4.2,-6.4 L2.6,-3.4 Z', fill: c.dark, 'stroke-width': 0.7 }, bomb);
    shape('path', { d: 'M-2.6,-3.6 L2.6,-3.6 L2.6,2.6 Q2.6,6.2 0,7.2 Q-2.6,6.2 -2.6,2.6 Z', fill: '#5f6b4a', 'stroke-width': 0.8 }, bomb);
    svg('rect', { x: -2.6, y: 0, width: 5.2, height: 1.2, fill: GOLD }, bomb);
    svg('path', { d: 'M-5.5,-3 V2 M5.5,-2 V3', stroke: INK, 'stroke-width': 0.8, opacity: 0.5, 'stroke-linecap': 'round' }, bomb);
    const rotors = [[-4.5, -16, 5], [4.5, -16, 5], [-11, -13, 5.6], [11, -13, 5.6], [-17.5, -8.5, 6], [17.5, -8.5, 6]];
    for (const [x, y] of rotors) shape('line', { x1: 0, y1: -6, x2: x, y2: y + 1.6, stroke: STEEL, 'stroke-width': 2.4 }, top);
    for (const [x, y, rx] of rotors) {
      shape('rect', { x: x - 1, y, width: 2, height: 2.4, fill: STEEL, 'stroke-width': 0.6 }, top);
      svg('ellipse', { cx: x, cy: y, rx, ry: 1.3, fill: BLUR, opacity: 0.75 }, top);
      shape('ellipse', { cx: x, cy: y, rx, ry: 1.3, fill: 'none', 'stroke-width': 0.5, opacity: 0.6 }, top);
    }
    shape('path', { d: 'M-4,-3 L-8,3.5 M4,-3 L8,3.5 M-10,3.5 L-6,3.5 M6,3.5 L10,3.5', fill: 'none', stroke: STEEL, 'stroke-width': 1.2 }, top);
    shape('rect', { x: -6.5, y: -10, width: 13, height: 7.4, rx: 2.6, fill: c.main }, top);
    shape('path', { d: 'M-5,-10 Q0,-12.6 5,-10 Z', fill: c.light, 'stroke-width': 0.8 }, top);
    shape('rect', { x: -2.4, y: -2.8, width: 4.8, height: 1.6, fill: STEEL, 'stroke-width': 0.6 }, top);
  },

  // Rocket artillery: a truck with its rocket pod raised, one rocket leaving in a burst of flame, smoke behind.
  'light+range+hero'(g, c, top) {
    truck(g, c);
    for (const [x, y, r] of [[-15.5, -5.5, 4.4], [-11.5, -10.5, 3.8], [-18.5, -12, 3.6], [-14.5, -16.5, 3], [-20.5, -6, 2.6]]) {
      shape('circle', { cx: x, cy: y, r, fill: SMOKE, 'stroke-width': 0.6 }, top); // back-blast, out over the ring
    }
    shape('polygon', { points: '-11,4 -9,-1.5 -1,-1.5 1,4', fill: c.dark }, g);
    const pod = svg('g', { transform: 'translate(-6 -2.5) rotate(-26)' }, top);
    shape('path', { d: 'M14,-1.6 L10.5,0 L14,1.6 Z', fill: FLAME, 'stroke-width': 0.6 }, pod);
    shape('rect', { x: 14, y: -1.1, width: 8, height: 2.2, fill: PALE, 'stroke-width': 0.6 }, pod);
    shape('path', { d: 'M22,-1.1 Q25,0 22,1.1 Z', fill: c.main, 'stroke-width': 0.6 }, pod);
    shape('rect', { x: -9, y: -4.2, width: 20, height: 8, rx: 0.8, fill: c.light }, pod);
    shape('path', { d: 'M-9,-1.5 H11 M-9,1.3 H11', fill: 'none', stroke: c.dark, 'stroke-width': 0.7 }, pod);
    shape('rect', { x: 10, y: -4.2, width: 1.8, height: 8, fill: c.dark, 'stroke-width': 0.7 }, pod);
  },

  // Paratrooper: rifle across the chest, hanging under a team-colour canopy that opens out over the ring.
  'light+flying+hero'(g, c, top) {
    const man = svg('g', { transform: 'translate(0 -0.5)' }, g);
    shape('path', { d: 'M-2,7.5 L-3.4,4 M2,7.5 L3.4,4', fill: 'none', stroke: c.dark, 'stroke-width': 1.6 }, man); // arms up on the risers
    shape('path', { d: 'M-1.4,13 L-2.4,17 M1.4,13 L2.2,17', fill: 'none', stroke: c.dark, 'stroke-width': 2 }, man);
    shape('rect', { x: -2.8, y: 7, width: 5.6, height: 6.6, rx: 1.4, fill: c.main }, man);
    shape('rect', { x: -2, y: 10.4, width: 4, height: 2.6, rx: 0.6, fill: COYOTE, 'stroke-width': 0.6 }, man); // reserve
    const gun = svg('g', { transform: 'translate(0 9.6) rotate(-35)' }, man);
    for (const [x, y, w, h] of [[-5.6, -0.8, 3, 1.7], [-2.6, -0.8, 5.2, 1.6], [2.6, -0.4, 4.6, 0.8], [-0.6, 0.8, 1.2, 1.8]]) {
      shape('rect', { x, y, width: w, height: h, fill: '#363a40', 'stroke-width': 0.4 }, gun);
    }
    shape('circle', { cx: 0, cy: 4.6, r: 2.2, fill: SKIN, 'stroke-width': 0.8 }, man);
    shape('path', { d: 'M-2.5,4.6 Q-2.5,1.6 0,1.6 Q2.5,1.6 2.5,4.6 Z', fill: c.dark, 'stroke-width': 0.8 }, man);
    for (const [x, to] of [[-17, -3.4], [-8.5, -3.4], [8.5, 3.4], [17, 3.4]]) shape('line', { x1: x, y1: -6, x2: to, y2: 3.2, 'stroke-width': 0.55, opacity: 0.85 }, top);
    const canopy = 'M-17,-6 Q-16.4,-21.5 0,-22 Q16.4,-21.5 17,-6 Q12.8,-8.8 8.5,-6 Q4.25,-8.8 0,-6 Q-4.25,-8.8 -8.5,-6 Q-12.8,-8.8 -17,-6 Z';
    shape('path', { d: canopy, fill: c.main }, top);
    svg('path', { d: 'M-8.5,-6 Q-7.9,-18.6 0,-22 Q-3.6,-16.8 0,-6 Q-4.25,-8.8 -8.5,-6 Z M8.5,-6 Q9.7,-18 0,-22 Q16.4,-21.5 17,-6 Q12.8,-8.8 8.5,-6 Z', fill: c.light }, top);
    shape('path', { d: canopy, fill: 'none' }, top);
  },

  // Strategic bomber from above: long swept wings and four engines, its nose and wings reaching out over the ring.
  'armour+range+flying'(g, c, top) {
    const plane = 'M1.6,-5 L17,6 L17,8.5 L2,3 L2,8.5 L7.5,13.4 L7.5,15.4 L1.4,13.6 L0,15 L-1.4,13.6 L-7.5,15.4 L-7.5,13.4 L-2,8.5 L-2,3 L-17,8.5 L-17,6 L-1.6,-5 Z';
    svg('path', { d: plane, fill: '#000', opacity: 0.14, transform: 'translate(2 3) rotate(-35) scale(0.95)' }, g);
    const b = svg('g', { transform: 'rotate(-35) scale(0.95)' }, top);
    shape('path', { d: plane, fill: c.main }, b);
    for (const s of [-1, 1]) {
      shape('path', { d: `M${s * 2},2.2 L${s * 16},7.2`, fill: 'none', stroke: c.light, 'stroke-width': 1.2 }, b);
      for (const [x, y] of [[6.2, 1], [11, 4.4]]) shape('rect', { x: s * x - 1.1, y: y - 3, width: 2.2, height: 5.4, rx: 1, fill: STEEL, 'stroke-width': 0.7 }, b);
    }
    shape('path', { d: 'M-2,-15 Q0,-21 2,-15 L2.1,12 Q0,14.4 -2.1,12 Z', fill: c.light }, b);
    shape('path', { d: 'M-1.3,-16.4 Q0,-18.8 1.3,-16.4 L1.2,-15 L-1.2,-15 Z', fill: TRACK, 'stroke-width': 0.5 }, b);
  },

  // Air defence: a launcher truck with its missile pack standing straight up, warheads showing, and a radar panel on the cab.
  'armour+range+hero'(g, c, top) {
    truck(g, c);
    shape('polygon', { points: '-15,4 -14,1 -3,1 -2,4', fill: c.dark }, g);
    shape('rect', { x: 10, y: -8.6, width: 1.6, height: 3.8, fill: STEEL, 'stroke-width': 0.6 }, g);
    const tubes = [[-14.2, -13], [-10.6, -13], [-7, -13]];
    for (const [x, y] of tubes) shape('rect', { x, y, width: 3.6, height: 1.5 - y, fill: c.light }, top);
    for (const [x, y] of tubes) shape('path', { d: `M${x + 0.6},${y} Q${x + 1.8},${y - 5} ${x + 3},${y} Z`, fill: c.main, 'stroke-width': 0.8 }, top);
    const radar = svg('g', { transform: 'translate(11 -11.5) rotate(-18)' }, top);
    shape('rect', { x: -5, y: -3, width: 10, height: 6, rx: 0.6, fill: '#d9dde2' }, radar);
    svg('path', { d: 'M-2.5,-3 V3 M0,-3 V3 M2.5,-3 V3 M-5,0 H5', stroke: STEEL_LIGHT, 'stroke-width': 0.6 }, radar);
  },

  // Gunship: a heavy armoured helicopter with stepped bubble cockpits, troop windows, rocket pods and a chin gun.
  'armour+flying+hero'(g, c, layer) {
    shadow(g, 15);
    const [g0, top] = fit(g, layer, 'translate(-0.8 1) scale(0.88)');
    g = g0;
    shape('path', { d: 'M-4,-4 L-15,-4 L-15,-0.6 L-4,3 Z', fill: c.dark }, g);
    shape('path', { d: 'M-15.6,-0.6 L-17,-9.5 L-14,-9.5 L-12.4,-4 Z', fill: c.main }, g);
    tailRotor(g, -15, -7, 3.4);
    shape('path', { d: 'M-8,-5 L6,-5.5 Q11,-5 13,-1 L16,2 L15,6 L11,8 L-8,8 Z', fill: c.main }, g);
    shape('path', { d: 'M-8,3 H15.6 L15,6 L11,8 H-8 Z', fill: c.dark, 'stroke-width': 0.8 }, g);
    shape('path', { d: 'M-2,-5.2 V3 M4.5,-5.4 V3', fill: 'none', stroke: c.dark, 'stroke-width': 0.7 }, g);
    for (const x of [-6.4, -0.4]) shape('rect', { x, y: -3, width: 2.6, height: 2.2, rx: 0.4, fill: GLASS, 'stroke-width': 0.6 }, g);
    shape('path', { d: 'M-6,-5 L-4.5,-8.6 L4,-8.6 L5,-5.3 Z', fill: c.light }, g);
    shape('circle', { cx: 3.6, cy: -6.9, r: 1.2, fill: TRACK, 'stroke-width': 0.6 }, g);
    shape('path', { d: 'M5.6,-5.4 Q7,-9.4 10.6,-8.4 L12.2,-2.4 Q9,-5 5.6,-5.4 Z', fill: GLASS, 'stroke-width': 0.8 }, g);
    shape('path', { d: 'M12.2,-2 Q13.4,-5 15.8,-3.4 L17,1.4 L14.4,0.4 Z', fill: GLASS, 'stroke-width': 0.8 }, g);
    shape('path', { d: 'M-5,1 L7,1 L9.6,4.4 L-5,3.4 Z', fill: c.dark, 'stroke-width': 0.8 }, g);
    for (const x of [-4.6, 1.6]) {
      shape('rect', { x, y: 3.6, width: 5.2, height: 3.2, rx: 1.5, fill: STEEL, 'stroke-width': 0.7 }, g);
      svg('circle', { cx: x + 4.4, cy: 5.2, r: 0.7, fill: TRACK }, g);
    }
    shape('path', { d: 'M14.6,6.8 L18,7.8', fill: 'none', stroke: STEEL, 'stroke-width': 1.2 }, g);
    shape('circle', { cx: 14, cy: 6.4, r: 1.8, fill: STEEL, 'stroke-width': 0.7 }, g);
    for (const x of [-5, 10]) {
      shape('line', { x1: x, y1: 8, x2: x, y2: 9.8, stroke: STEEL, 'stroke-width': 1 }, g);
      shape('circle', { cx: x, cy: 10.6, r: 1.8, fill: TRACK, 'stroke-width': 0.7 }, g);
    }
    rotor(top, -1, -11.2, 21);
  },

  // Stealth fighter from above: angular, faceted, canted tail fins and a gold-tinted canopy, nose out of the token.
  'range+flying+hero'(g, c, top) {
    const f = svg('g', { transform: 'translate(0.8 1) rotate(18) scale(1.08)' }, top); // over the ring, so the nose reaches out
    const outline = 'M0,-17 L2.6,-10 L3.6,-4 L14.5,4.5 L14.5,7.5 L5.5,7 L5,9.5 L9,13 L9,15 L2.5,13.6 L0,14.6 L-2.5,13.6 L-9,15 L-9,13 L-5,9.5 L-5.5,7 L-14.5,7.5 L-14.5,4.5 L-3.6,-4 L-2.6,-10 Z';
    svg('path', { d: outline, fill: '#000', opacity: 0.14, transform: 'translate(2.8 4) rotate(18) scale(1.08)' }, g);
    shape('path', { d: outline, fill: c.dark }, f);
    shape('path', { d: 'M0,-17 L2.6,-10 L3.6,-4 L5,9.5 L2.5,13.6 L0,14.6 L-2.5,13.6 L-5,9.5 L-3.6,-4 L-2.6,-10 Z', fill: c.main, 'stroke-width': 0.8 }, f);
    shape('path', { d: 'M4,-2 L12.5,5 M-4,-2 L-12.5,5 M0,-3 V12', fill: 'none', stroke: c.light, 'stroke-width': 0.8 }, f);
    for (const s of [-1, 1]) shape('path', { d: `M${s * 3.6},6 L${s * 7.6},8.6 L${s * 8},12 L${s * 4.2},11 Z`, fill: c.light, 'stroke-width': 0.7 }, f);
    for (const s of [-1, 1]) shape('path', { d: `M${s * 2.4},-4.6 L${s * 4},-3 L${s * 3.6},-1 L${s * 2.2},-2 Z`, fill: TRACK, 'stroke-width': 0.5 }, f);
    shape('path', { d: 'M0,-13 Q1.7,-9.5 1.3,-5.6 L0,-4.2 L-1.3,-5.6 Q-1.7,-9.5 0,-13 Z', fill: '#d4a72c', 'stroke-width': 0.7 }, f);
    svg('path', { d: 'M-0.5,-10.5 Q0,-11.6 0.4,-10.8', stroke: '#fff3c4', 'stroke-width': 0.8, fill: 'none' }, f);
  },

  // ---- Special units ----

  // Drone swarm: a cloud of small drones, a few flying out of the token.
  'light+armour+range+flying'(g, c, top) {
    const inside = [[-9, -10, 0.36], [2, -12.5, 0.32], [11.5, -6.5, 0.38], [-13, 1, 0.34], [-1, -3, 0.5], [10, 4.5, 0.46], [-7, 8.5, 0.44], [3.5, 12.5, 0.38], [-13, -6, 0.26], [6, -10, 0.24]];
    for (const [x, y, s] of inside.sort((a, b) => a[2] - b[2])) miniDrone(g, x, y, s, c);
    for (const [x, y, s] of [[16, -13.5, 0.36], [-16, -12.5, 0.3]]) miniDrone(top, x, y, s, c);
  },

  // Main battle tank: smoke launchers on the side of the turret, under the machine gun.
  'light+armour+range+hero'(g, c, top) {
    tank(g, c, top);
  },

  // Special forces: balaclava, helmet, four-tube night vision down and glowing, a knife in hand and a radio antenna out of the token.
  'light+armour+flying+hero'(g, c, top) {
    bust(g, c, { jacket: c.main });
    carrier(g, c, '#2f3338');
    shape('circle', { cx: 0, cy: -2.5, r: 6.3, fill: '#24272b' }, g); // balaclava
    shape('rect', { x: -2.6, y: 1, width: 5.2, height: 5, fill: '#24272b', stroke: 'none' }, g);
    helmet(g, c.dark);
    shape('rect', { x: -1.2, y: -7.4, width: 2.4, height: 3, fill: STEEL, 'stroke-width': 0.6 }, g);
    shape('rect', { x: -6, y: -4.8, width: 12, height: 4.4, rx: 1.2, fill: STEEL }, g);
    for (const x of [-4.2, -1.4, 1.4, 4.2]) {
      shape('circle', { cx: x, cy: -2, r: 1.35, fill: '#15181b', 'stroke-width': 0.5 }, g);
      svg('circle', { cx: x, cy: -2, r: 0.75, fill: '#7dff6a' }, g);
    }
    antenna(top);
    const knife = svg('g', { transform: 'translate(12.5 12) rotate(20)' }, top);
    shape('path', { d: 'M-1.1,-1.6 L-1.1,-9 Q-0.4,-12.4 1.4,-13.6 L1.1,-1.6 Z', fill: '#e3e8ee', 'stroke-width': 0.7 }, knife);
    svg('path', { d: 'M0.2,-2.4 L0.2,-10', stroke: STEEL_LIGHT, 'stroke-width': 0.6 }, knife);
    shape('rect', { x: -2.2, y: -2, width: 4.4, height: 1.2, rx: 0.4, fill: STEEL, 'stroke-width': 0.6 }, knife); // guard
    shape('rect', { x: -1, y: -0.8, width: 2, height: 5.6, rx: 0.6, fill: TRACK, 'stroke-width': 0.6 }, knife);
    shape('circle', { cx: 0, cy: 2, r: 2.4, fill: '#2f3338', 'stroke-width': 0.7 }, knife); // gloved hand
  },

  // Massive bomb: a huge finned bomb falling nose first through the clouds, its tail fins out of the token.
  'light+range+flying+hero'(g, c, top) {
    cloud(g, -9, 12, 1.1);
    cloud(g, 10, 15, 0.9);
    cloud(g, 8, -8, 0.7);
    for (const [x, y] of [[-9.5, -5], [-12, 1.5], [9.5, 1], [7, 7]]) svg('path', { d: `M${x},${y} l2.2,-6`, stroke: INK, 'stroke-width': 0.9, opacity: 0.4, 'stroke-linecap': 'round' }, g);
    const body = mix(STEEL, c.main, 0.3);
    const bomb = svg('g', { transform: 'translate(1 0) rotate(20)' }, g);
    shape('path', { d: 'M-5.5,-11 L5.5,-11 Q7.5,-2 6.5,5 Q5,12.5 0,14 Q-5,12.5 -6.5,5 Q-7.5,-2 -5.5,-11 Z', fill: body }, bomb);
    shape('rect', { x: -6.8, y: -5, width: 13.6, height: 2.4, fill: c.light, 'stroke-width': 0.7 }, bomb);
    shape('path', { d: 'M-6.4,6.6 Q0,7.6 6.4,6.6 L6.2,8.2 Q0,9.2 -6.2,8.2 Z', fill: GOLD, 'stroke-width': 0.6 }, bomb);
    svg('path', { d: 'M-3.6,-9 Q-5,-1 -3.4,8', stroke: '#fff', 'stroke-width': 1.2, opacity: 0.35, fill: 'none', 'stroke-linecap': 'round' }, bomb);
    const tail = svg('g', { transform: 'translate(1 0) rotate(20)' }, top);
    shape('path', { d: 'M-4.6,-10.8 L4.6,-10.8 L3.4,-15.6 L-3.4,-15.6 Z', fill: STEEL }, tail);
    shape('path', { d: 'M-3.6,-11 L-9,-19 L-7.6,-21 L-2.4,-15.4 Z M3.6,-11 L9,-19 L7.6,-21 L2.4,-15.4 Z', fill: c.dark }, tail);
    shape('rect', { x: -1, y: -22, width: 2, height: 9, rx: 0.4, fill: c.dark }, tail);
  },

  // Ballistic missile: a long launcher truck with its missile raised on the erector, nose out of the token.
  'armour+range+flying+hero'(g, c, top) {
    truck(g, c, [-12.5, -7, -1.5, 10.5]);
    shape('path', { d: 'M-1.5,4 L0.6,4 L-4.6,-6.6 L-6.6,-5.8 Z', fill: c.dark, 'stroke-width': 0.8 }, g);
    const m = svg('g', { transform: 'translate(-11 2.5) rotate(-78)' }, top);
    shape('rect', { x: 0, y: 2.4, width: 21, height: 1.8, fill: c.dark, 'stroke-width': 0.7 }, m); // erector
    shape('rect', { x: -1.8, y: -1.6, width: 1.8, height: 3.2, fill: STEEL, 'stroke-width': 0.6 }, m);
    shape('path', { d: 'M0.5,-2.4 L-1,-5 L4,-2.4 Z M0.5,2.4 L-1,5 L4,2.4 Z', fill: c.dark, 'stroke-width': 0.7 }, m);
    shape('rect', { x: 0, y: -2.4, width: 20, height: 4.8, fill: PALE }, m);
    shape('path', { d: 'M20,-2.4 Q26,-2 28.5,0 Q26,2 20,2.4 Z', fill: c.main }, m);
    shape('rect', { x: 13, y: -2.4, width: 2, height: 4.8, fill: c.main, 'stroke-width': 0.6 }, m);
    shape('path', { d: 'M5,-2.4 V2.4', fill: 'none', 'stroke-width': 0.6 }, m);
  },

  // ---- The Nuke ----

  // The Nuke: a missile's last stage in space with its nose cover gone, its cluster of warheads still on board,
  // high over the Earth, with the radiation sign.
  'light+armour+range+flying+hero'(g, c, top) {
    svg('circle', { r: 18, fill: '#0e1530' }, g);
    for (const [x, y, r] of [[-12, -3, 0.5], [-4, -13, 0.4], [7, -12, 0.6], [13, -4, 0.45], [-14, 4, 0.4], [-9, -10, 0.35], [14, -10, 0.35], [-7, 3, 0.3], [11, 4, 0.4]]) {
      svg('circle', { cx: x, cy: y, r, fill: '#fff', opacity: 0.85 }, g);
    }
    svg('circle', { cx: 0, cy: 39, r: 32.5, fill: '#7fd4ff', opacity: 0.35 }, g);
    shape('circle', { cx: 0, cy: 39, r: 30, fill: '#2a6fb0' }, g);
    svg('path', { d: 'M-14,13 Q-9,8 -3,10.6 Q1,12.4 5.4,10 Q9,12.6 7,18 L-15,18 Z', fill: '#3f8f5a', opacity: 0.9 }, g);
    const m = svg('g', { transform: 'translate(4 -4.4) rotate(-40) scale(1.15)' }, g);
    shape('path', { d: 'M-17,-3.8 L-14,-2.8 L-14,2.8 L-17,3.8 Z', fill: STEEL, 'stroke-width': 0.7 }, m); // engine
    shape('rect', { x: -14, y: -6, width: 12, height: 12, rx: 1, fill: PALE }, m);
    shape('rect', { x: -11, y: -6, width: 2.4, height: 12, fill: c.main, 'stroke-width': 0.7 }, m);
    shape('rect', { x: -2.2, y: -6.6, width: 2, height: 13.2, rx: 0.5, fill: STEEL, 'stroke-width': 0.7 }, m); // warhead deck
    const cone = (y, x0, fill) => {
      shape('path', { d: `M${x0},${y - 1.6} L${x0 + 7.2},${y} L${x0},${y + 1.6} Q${x0 - 0.6},${y} ${x0},${y - 1.6} Z`, fill, 'stroke-width': 0.7 }, m);
      shape('path', { d: `M${x0 + 7.2},${y} L${x0 + 4.8},${y - 0.55} L${x0 + 4.8},${y + 0.55} Z`, fill: c.main, 'stroke-width': 0.4 }, m);
    };
    for (const y of [-2.4, 2.4]) cone(y, 0.6, '#c9ced6'); // back row
    for (const y of [-4.8, 0, 4.8]) cone(y, -0.2, PALE);
    shape('circle', { cx: 11, cy: 11, r: 6.4, fill: '#ffd400', 'stroke-width': 1.2 }, top);
    for (const a of [-30, 90, 210]) svg('path', { d: sector(11, 11, 1.6, 5.2, a - 30, a + 30), fill: INK }, top); // blades up-right, down, up-left
    svg('circle', { cx: 11, cy: 11, r: 1, fill: INK }, top);
  },
};

// Shade set for one player's colour.
const shades = (color) => ({ main: color, dark: mix(color, '#000000', 0.42), light: mix(color, '#ffffff', 0.35) });

// Draws `type` for a player: g is clipped to the disc, top sits over the ring
// (both already translated and scaled to the 36×36 box). Returns false if there's no picture.
function draw(type, g, top, color) {
  const fn = ART[type];
  if (!fn) return false;
  fn(g, shades(color), top);
  return true;
}

const has = (type) => !!ART[type];

export { draw, has };
