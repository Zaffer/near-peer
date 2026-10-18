/*
 * Near Peer — the "Graphic" unit style: illustrated tokens in the same flat,
 * outlined style as the map. Purely visual.
 *
 * Each picture is drawn in a 36×36 box centred on (0, 0) (the token's radius
 * is 18); the caller scales it to the token. Two layers: `g` is clipped to the
 * disc, `top` sits over the ring, for the one part that sticks out (a rifle
 * barrel, a gun, a sabre, an antenna, a mortar tube).
 * Uniforms take the player's colour, so the team reads from the art as well as
 * from the ring around it.
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

const ART = {
  // Infantry: modern helmet, plate carrier, assault rifle whose barrel pokes out of the token.
  light(g, c, top) {
    bust(g, c, { jacket: c.main });
    shape('rect', { x: -7.5, y: 8, width: 15, height: 12, rx: 2, fill: COYOTE }, g);
    helmet(g, c.dark);
    shape('path', { d: 'M-5,-9.6 Q0,-11.6 5,-9.6', fill: 'none', stroke: c.light, 'stroke-width': 1, opacity: 0.7 }, g);
    rifle(top, 'translate(2 8.5) rotate(-38)', COYOTE_DARK);
  },

  // Armoured carrier, side on: eight wheels, a tall angled hull with a rear door, and a small turret whose short cannon pokes out of the token.
  armour(g, c, top) {
    shadow(g, 14);
    shape('path', { d: 'M-16,8 L-16,-1 L-11,-5 L13,-5 L17,1 L17,8 Z', fill: c.main }, g);
    shape('path', { d: 'M-16,3.5 H17 V8 H-16 Z', fill: c.dark }, g);
    shape('path', { d: 'M-11,-5 L-9,-1.5 L12,-1.5', fill: 'none', stroke: c.dark, 'stroke-width': 0.8 }, g);
    shape('rect', { x: -14.6, y: -1, width: 3.6, height: 4.4, rx: 0.6, fill: c.light, 'stroke-width': 0.7 }, g); // rear door
    for (const x of [3, 7, 11]) shape('rect', { x, y: -4, width: 2.4, height: 1.6, fill: '#bfe0f2', 'stroke-width': 0.5 }, g);
    for (const x of [-11.5, -5.5, 3.5, 9.5]) {
      shape('circle', { cx: x, cy: 9.6, r: 3.3, fill: TRACK }, g);
      svg('circle', { cx: x, cy: 9.6, r: 1.2, fill: STEEL_LIGHT }, g);
    }
    shape('path', { d: 'M-6,-5 L-5,-9.5 L2.5,-9.5 L4,-5 Z', fill: c.light }, g);
    shape('rect', { x: -3.6, y: -12, width: 3, height: 2.5, rx: 0.5, fill: STEEL, 'stroke-width': 0.6 }, g);
    shape('rect', { x: 3.6, y: -8.3, width: 11, height: 1.5, fill: STEEL, 'stroke-width': 0.6 }, top);
    shape('rect', { x: 13.6, y: -8.8, width: 2.6, height: 2.5, rx: 0.4, fill: STEEL, 'stroke-width': 0.6 }, top);
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
    shape('path', { d: 'M3,-6.5 L6,-17', fill: 'none', 'stroke-width': 1 }, top); // antenna
    svg('circle', { cx: 6, cy: -17, r: 1, fill: INK }, top);
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
