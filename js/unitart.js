/*
 * Near Peer — the "Graphic" unit style: illustrated tokens in the same flat,
 * outlined style as the map. Purely visual.
 *
 * Each picture is drawn in a 36×36 box centred on (0, 0) (the token's radius
 * is 18); the caller scales it to the token and clips it to the disc.
 * Uniforms take the player's colour, so the team reads from the art as well as
 * from the ring around it.
 */
(function (global) {
  'use strict';

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

  // Head and shoulders shared by the infantry and the general.
  function bust(g, c, { jacket }) {
    shape('path', { d: 'M-16,19 C-16,8 -9,5 0,5 C9,5 16,8 16,19 Z', fill: jacket }, g);
    shape('path', { d: 'M-4,5.5 L0,10 L4,5.5', fill: 'none', stroke: c.dark }, g);
    shape('rect', { x: -2.6, y: 1, width: 5.2, height: 5, fill: SKIN, stroke: 'none' }, g); // neck
    shape('circle', { cx: 0, cy: -2.5, r: 6.3, fill: SKIN }, g);
    svg('circle', { cx: -2.2, cy: -1.8, r: 0.85, fill: INK }, g);
    svg('circle', { cx: 2.2, cy: -1.8, r: 0.85, fill: INK }, g);
  }

  const ART = {
    // Infantry: modern helmet with a night-vision mount, plate carrier, assault rifle across the chest.
    light(g, c) {
      bust(g, c, { jacket: c.main });
      shape('rect', { x: -7.5, y: 8, width: 15, height: 12, rx: 2, fill: COYOTE }, g); // plate carrier
      // Rifle (M4-style), drawn flat then tilted: stock, receiver, optic, handguard, barrel, magazine, grip.
      const rifle = svg('g', { transform: 'translate(1 9.5) rotate(-40)' }, g);
      const gun = { fill: '#363a40', 'stroke-width': 0.7 };
      shape('path', Object.assign({ d: 'M-16,-1.6 L-10,-2.1 L-10,2.2 L-16,3.4 Z' }, gun), rifle);
      shape('rect', Object.assign({ x: -10.5, y: -1, width: 4.5, height: 2 }, gun), rifle);
      shape('path', Object.assign({ d: 'M-4.8,1.8 L-2.6,1.8 L-3.4,6 L-5.8,5.6 Z' }, gun), rifle);
      shape('path', Object.assign({ d: 'M-0.6,1.8 L2.6,1.8 L3.8,7.4 L0.8,7.8 Z' }, gun), rifle);
      shape('rect', Object.assign({ x: -6.5, y: -2.2, width: 10, height: 4.2, rx: 0.6 }, gun), rifle);
      shape('rect', Object.assign({ x: 3.5, y: -1.8, width: 8, height: 3.4, rx: 0.5 }, gun), rifle);
      shape('rect', Object.assign({ x: 11.5, y: -0.7, width: 5, height: 1.4 }, gun), rifle);
      shape('rect', { x: -4.5, y: -4.8, width: 5, height: 2.6, rx: 1, fill: TRACK, 'stroke-width': 0.7 }, rifle); // optic
      shape('circle', { cx: 7, cy: 1.8, r: 2.1, fill: COYOTE_DARK, 'stroke-width': 0.7 }, rifle); // gloved hands
      shape('circle', { cx: -4.2, cy: 4.2, r: 2.1, fill: COYOTE_DARK, 'stroke-width': 0.7 }, rifle);
      // Helmet: high cut over the ears, rails on the sides, NVG mount on the front.
      shape('path', { d: 'M-8,0 L-8,-4 C-8,-13 8,-13 8,-4 L8,0 L6.2,0 L5.6,-4.4 L-5.6,-4.4 L-6.2,0 Z', fill: c.dark }, g);
      shape('rect', { x: -8.8, y: -6.5, width: 1.6, height: 4, rx: 0.5, fill: STEEL, 'stroke-width': 0.6 }, g);
      shape('rect', { x: 7.2, y: -6.5, width: 1.6, height: 4, rx: 0.5, fill: STEEL, 'stroke-width': 0.6 }, g);
      shape('rect', { x: -2, y: -9.6, width: 4, height: 2.8, rx: 0.6, fill: STEEL, 'stroke-width': 0.7 }, g);
      shape('path', { d: 'M-5,-9.6 Q0,-11.6 5,-9.6', fill: 'none', stroke: c.light, 'stroke-width': 1, opacity: 0.7 }, g);
    },

    // Main battle tank, side on: low angular turret, side skirts, long gun.
    armour(g, c) {
      shadow(g, 13.5);
      shape('rect', { x: -15.5, y: 5, width: 31, height: 7.5, rx: 3.7, fill: TRACK }, g);
      for (const x of [-11, -6.6, -2.2, 2.2, 6.6, 11]) shape('circle', { cx: x, cy: 9.6, r: 2, fill: STEEL_LIGHT, 'stroke-width': 0.7 }, g);
      shape('path', { d: 'M-16.5,2 L-15,-1.5 L12,-1.5 L17,2 Z', fill: c.main }, g);
      shape('path', { d: 'M-16,2 H16.5 L15,7 H-15.5 Z', fill: c.dark }, g); // side skirt
      shape('path', { d: 'M-8,2.4 V6.6 M0,2.4 V6.6 M8,2.4 V6.6', fill: 'none', stroke: c.main, 'stroke-width': 0.7 }, g);
      shape('rect', { x: 8, y: -5.6, width: 11, height: 1.8, fill: STEEL, 'stroke-width': 0.7 }, g); // gun
      shape('rect', { x: 11.5, y: -6.1, width: 3, height: 2.8, rx: 0.6, fill: STEEL, 'stroke-width': 0.7 }, g); // fume extractor
      shape('rect', { x: -14, y: -5.4, width: 3.6, height: 3.4, fill: c.dark, 'stroke-width': 0.7 }, g); // bustle rack
      shape('polygon', { points: '-11,-1.5 -10,-6.8 1.5,-7.6 9,-5.2 9.8,-1.5', fill: c.light }, g);
      shape('rect', { x: -5, y: -10.2, width: 4.2, height: 2.8, rx: 0.6, fill: STEEL, 'stroke-width': 0.7 }, g); // commander's sight
      shape('rect', { x: -1, y: -9.4, width: 6, height: 0.9, fill: TRACK, 'stroke-width': 0.4 }, g);
    },

    // Rocket artillery (HIMARS-style): a six-wheel truck with its launcher pod raised.
    ranged(g, c) {
      shadow(g, 14);
      shape('rect', { x: -15.5, y: 4, width: 31, height: 3.6, fill: c.dark }, g); // chassis
      const pod = svg('g', { transform: 'rotate(-24 -11 3)' }, g);
      shape('rect', { x: -9, y: 0, width: 2.2, height: 4, fill: STEEL, 'stroke-width': 0.6 }, pod); // lift arm
      shape('rect', { x: -15, y: -4.5, width: 19, height: 6.5, rx: 0.8, fill: c.light }, pod);
      shape('path', { d: 'M-15,-2.3 H4 M-15,-0.1 H4', fill: 'none', stroke: c.dark, 'stroke-width': 0.6 }, pod);
      for (const y of [-3.4, -1.2, 1]) shape('path', { d: `M4,${y} l2.4,0.6 -2.4,0.6`, fill: '#e8e8e8', 'stroke-width': 0.5 }, pod); // rocket noses
      shape('path', { d: 'M6,4 L6,-5 L11.5,-5 L16,0 L16,4 Z', fill: c.main }, g); // cab
      shape('path', { d: 'M8,-3.6 L11,-3.6 L14,0 L8,0 Z', fill: '#bfe0f2', 'stroke-width': 0.7 }, g);
      for (const x of [-11, -4.5, 10.5]) {
        shape('circle', { cx: x, cy: 9.3, r: 3.6, fill: TRACK }, g);
        svg('circle', { cx: x, cy: 9.3, r: 1.3, fill: STEEL_LIGHT }, g);
      }
    },

    // Spy: fedora, dark glasses, trench coat with the collar up, shirt and tie.
    covert(g, c) {
      bust(g, c, { jacket: c.main });
      shape('path', { d: 'M-4,5.5 L0,12.5 L4,5.5 Z', fill: '#fff', 'stroke-width': 0.8 }, g);
      shape('path', { d: 'M-0.9,6.5 L0.9,6.5 L1.4,12 L0,13.6 L-1.4,12 Z', fill: INK, 'stroke-width': 0.5 }, g);
      shape('path', { d: 'M-4.2,4.6 L-9.5,2.4 L-8,10 L-1.8,13.5 Z', fill: c.light }, g); // upturned collar
      shape('path', { d: 'M4.2,4.6 L9.5,2.4 L8,10 L1.8,13.5 Z', fill: c.light }, g);
      shape('path', { d: 'M-5.8,13 V19 M5.8,13 V19', fill: 'none', stroke: c.dark, 'stroke-width': 0.8 }, g); // coat buttons line
      // Sunglasses and a smirk.
      shape('rect', { x: -5.8, y: -3.4, width: 4.8, height: 2.7, rx: 1.2, fill: INK, 'stroke-width': 0.5 }, g);
      shape('rect', { x: 1, y: -3.4, width: 4.8, height: 2.7, rx: 1.2, fill: INK, 'stroke-width': 0.5 }, g);
      shape('path', { d: 'M-1,-2.4 H1', stroke: INK, 'stroke-width': 0.8 }, g);
      shape('path', { d: 'M-1.6,1.4 Q0.5,2.4 2.4,0.8', fill: 'none', stroke: '#7a4b2e', 'stroke-width': 0.8 }, g);
      // Fedora: brim, pinched crown, band in the team colour.
      shape('ellipse', { cx: 0, cy: -5.8, rx: 11, ry: 2.3, fill: '#2b2e33' }, g);
      shape('path', { d: 'M-6.6,-6 C-7,-12 -3,-13.6 0,-12 C3,-13.6 7,-12 6.6,-6 Z', fill: '#2b2e33' }, g);
      shape('rect', { x: -6.7, y: -8, width: 13.4, height: 2, fill: c.main, 'stroke-width': 0.6 }, g);
    },

    // General: peaked cap, gold braid, epaulettes, medals, sabre raised.
    hero(g, c) {
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
      // Sabre held up at the right: curved blade, gold guard, gloved hand.
      shape('path', { d: 'M9.2,11 Q13.6,0 11.2,-11.6 L12.6,-11.4 Q15.4,0 10.8,11.4 Z', fill: '#e3e8ee', 'stroke-width': 0.7 }, g);
      shape('rect', { x: 9.6, y: 16.5, width: 1.8, height: 4, fill: '#4a2f1a', 'stroke-width': 0.5, transform: 'rotate(-160 10 15)' }, g);
      shape('path', { d: 'M6.8,11.6 Q10,10 13.4,11.8 Q13.6,15.5 10.8,16.2', fill: 'none', stroke: GOLD, 'stroke-width': 1.6 }, g);
      shape('circle', { cx: 10.2, cy: 14, r: 2.4, fill: '#f2f2f2', 'stroke-width': 0.7 }, g);
    },
  };

  // Shade set for one player's colour.
  const shades = (color) => ({ main: color, dark: mix(color, '#000000', 0.42), light: mix(color, '#ffffff', 0.35) });

  // Draws `type` for a player into g (already translated and scaled to the
  // 36×36 box). Returns false if there's no picture for the type.
  function draw(type, g, color) {
    const fn = ART[type];
    if (!fn) return false;
    fn(g, shades(color));
    return true;
  }

  global.NP_UNIT_ART = { draw, has: (type) => !!ART[type] };
})(typeof window !== 'undefined' ? window : globalThis);
