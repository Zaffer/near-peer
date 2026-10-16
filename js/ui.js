/*
 * Near Peer — browser UI.
 * Reads state from the engine and sends it actions; it never decides what is
 * legal on its own.
 */
(function () {
  'use strict';

  const R = window.NP_RULES;
  const Hex = window.NP_HEX;
  const E = window.NP_ENGINE;
  const SIZE = 54;
  const NS = 'http://www.w3.org/2000/svg';
  const DANGER = '#c026d3'; // "this can be captured" — kept apart from the players' red and blue
  const TEXTURE = { minefield: 'hatch' };
  const COLOURS = window.NP_COLOURS;
  const store = {
    get(k) { try { return localStorage.getItem(`near-peer:${k}`); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(`near-peer:${k}`, v); } catch (e) { /* private window etc. */ } },
  };

  const ui = {
    state: null,
    history: [],
    selected: null, // unit id (own or enemy, for inspection)
    hover: null, // hex key
    choice: null, // terrain/unit type picked during the build phase
    unitXY: {},
    rulesOpen: false,
    settings: { autoEnd: true, threats: false, coords: false,
      // How the board and units are drawn: 'symbols' (flat, schematic) or 'graphic' (illustrated).
      mapStyle: store.get('map-style') === 'symbols' ? 'symbols' : 'graphic',
      unitStyle: store.get('unit-style') === 'symbols' ? 'symbols' : 'graphic' },
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
    const d = (window.NP_ICONS && window.NP_ICONS[kind] || {})[type];
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
  const pos = (k) => Hex.toPixel(k, SIZE);
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
    const u = id && ui.state.units[id];
    return u && !u.dead ? u : null;
  };
  // Fill and symbol colour of a hex.
  const tileLook = (hex) => COLOURS[hex.terrain];
  const chip = (p) => h('span', { class: 'chip', style: `background:${P(p).color}` });
  // An enemy of the player to move that their combined attack beats right now.
  const capturable = (st, u) => st.phase === 'battle' && u.player !== st.current && E.assault(st, u.id).beats;
  const unitName = (st, id) => R.units[st.units[id].type].name;

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------------------------------------------------------------- state changes

  function newGame() {
    ui.state = E.newGame();
    ui.history = [];
    ui.selected = null;
    ui.choice = null;
    syncChoice();
    render();
  }

  function commit(action) {
    const prev = ui.state;
    let next;
    try {
      next = E.apply(prev, action);
      if (ui.settings.autoEnd && next.phase === 'battle' && action.type !== 'endTurn' && !E.hasAnyAction(next)) {
        next = E.apply(next, { type: 'endTurn', auto: true });
      }
    } catch (e) {
      toast(e.message);
      return false;
    }
    ui.history.push(prev);
    ui.state = next;
    if (next.current !== prev.current || next.phase !== prev.phase) ui.selected = null;
    if (!liveUnit(ui.selected)) ui.selected = null;
    syncChoice();
    render();
    return true;
  }

  function undo() {
    if (!ui.history.length) return;
    ui.state = ui.history.pop();
    if (!liveUnit(ui.selected)) ui.selected = null;
    syncChoice();
    render();
  }

  // Randomly finish the current build phase (terrain or units) for both players.
  function randomFill() {
    let st = ui.state;
    const phase = st.phase;
    while (st.phase === phase) {
      const opts = E.legalPlacements(st);
      if (!opts.length) break;
      st = E.apply(st, opts[Math.floor(Math.random() * opts.length)]);
    }
    ui.history.push(ui.state);
    ui.state = st;
    ui.selected = null;
    syncChoice();
    render();
  }

  function syncChoice() {
    const kind = buildKind(ui.state);
    if (!kind) {
      ui.choice = null;
      return;
    }
    const sup = ui.state.supply[ui.state.current][kind];
    if (!sup.includes(ui.choice)) ui.choice = sup[0] || null;
  }

  // ---------------------------------------------------------------- input

  function onHexClick(k, ev) {
    hideMenu();
    const st = ui.state;
    const kind = buildKind(st);
    if (kind) {
      if (!ui.choice) return;
      const a = E.placeAction(kind, ui.choice, k);
      const why = E.whyIllegal(st, a);
      if (why) toast(why);
      else commit(a);
      return;
    }

    const here = E.unitsAt(st, k);
    const sel = liveUnit(ui.selected);
    const mine = sel && st.phase === 'battle' && sel.player === st.current ? sel : null;
    const items = [];
    if (mine) {
      if (k === mine.hex) {
        for (const id of E.captureTargets(st, mine.id)) {
          items.push({ label: `Capture ${unitName(st, id)} here (uses your move)`, run: () => commit({ type: 'capture', unitId: mine.id, targetId: id }) });
        }
      }
      const step = { type: 'step', unitId: mine.id, to: k };
      const next = E.tryApply(st, step);
      if (next) {
        const caps = here.filter((u) => u.player !== mine.player && next.units[u.id].dead);
        items.push({
          label: caps.length ? `Move here and capture ${caps.map((c) => R.units[c.type].name).join(' + ')}` : 'Move here',
          run: () => commit(step),
        });
        const beside = Object.assign({}, step, { capture: false });
        if (caps.length && E.isLegal(st, beside)) {
          items.push({ label: `Move in beside ${caps.map((c) => R.units[c.type].name).join(' + ')} (no capture)`, run: () => commit(beside) });
        }
      }
    }

    const selectable = here
      .filter((u) => u.id !== ui.selected)
      .sort((a, b) => (b.player === st.current) - (a.player === st.current));
    const ownSelectable = selectable.some((u) => u.player === st.current);

    if (!items.length) {
      ui.selected = selectable.length ? selectable[0].id : null;
      render();
      return;
    }
    if (items.length === 1 && !ownSelectable) {
      items[0].run();
      return;
    }
    for (const u of selectable) {
      items.push({ label: `Select ${unitLabel(u)}`, subtle: true, run: () => { ui.selected = u.id; render(); } });
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
      ui.selected = null;
      render();
    } else if (e.key === 'z' || e.key === 'u') {
      e.preventDefault();
      undo();
    } else if (e.key === 'e' && ui.state.phase === 'battle') {
      commit({ type: 'endTurn' });
    }
  });

  // ---------------------------------------------------------------- rendering

  function render() {
    renderBoard();
    renderPanel();
    renderHoverInfo();
  }

  function renderBoard() {
    const st = ui.state;
    const root = $('board');
    root.replaceChildren();
    root.setAttribute('viewBox', '-245 -250 490 500');

    const defs = svg('defs', {}, root);
    const marker = (id, color) => {
      const m = svg('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 4.5, markerHeight: 4.5, orient: 'auto-start-reverse' }, defs);
      svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }, m);
    };
    marker('arrow-hit', DANGER);
    marker('arrow-miss', '#6b7280');
    const hatch = svg('pattern', { id: 'hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    svg('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#fff', 'stroke-opacity': 0.14, 'stroke-width': 3 }, hatch);
    const shadow = svg('filter', { id: 'lift', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    svg('feDropShadow', { dx: 0, dy: 1.5, stdDeviation: 1.5, 'flood-color': '#000', 'flood-opacity': 0.45 }, shadow);
    svg('circle', { r: 16.4 }, svg('clipPath', { id: 'unit-clip' }, defs)); // inside a unit picture's ring

    const tiles = svg('g', {}, root);
    svg('g', { id: 'ov-under', 'pointer-events': 'none' }, root);
    const unitsLayer = svg('g', { 'pointer-events': 'none' }, root);
    svg('g', { id: 'ov-over', 'pointer-events': 'none' }, root);
    const hits = svg('g', {}, root);

    const inBuild = !!buildKind(st);
    // Zones only matter while building, so only then do empty zone hexes take the player's tint.
    const groundFill = (hex) => (inBuild && hex.terrain === 'plain' && hex.zone !== null ? P(hex.zone).tint : tileLook(hex).color);
    const mapView = ui.settings.mapStyle === 'graphic';
    if (mapView) {
      window.NP_MAPVIEW.draw(tiles, st, { size: SIZE, pos, look: tileLook, fill: groundFill, color: (p) => P(p).color });
    }
    for (const k of Object.keys(st.hexes)) {
      const hex = st.hexes[k];
      const t = R.terrain[hex.terrain];
      const { x, y } = pos(k);
      const look = tileLook(hex);
      if (!mapView) drawTile(k, hex, t, x, y, look, groundFill(hex), tiles);
      if (ui.settings.coords) svgText(k, x, y + SIZE * 0.78, 'coord', tiles);

      const hit = svg('polygon', { points: points(k, SIZE), class: 'hit' }, hits);
      hit.addEventListener('click', (ev) => onHexClick(k, ev));
      hit.addEventListener('mouseenter', () => { ui.hover = k; renderOverlay(); renderHoverInfo(); });
      hit.addEventListener('mouseleave', () => {
        if (ui.hover === k) { ui.hover = null; renderOverlay(); renderHoverInfo(); }
      });
    }

    ui.unitXY = {};
    for (const k of Object.keys(st.hexes)) {
      const skilled = (u) => (R.units[u.type].skills || []).length;
      const occ = E.unitsAt(st, k).sort((a, b) => skilled(a) - skilled(b));
      if (!occ.length) continue;
      const { x, y } = pos(k);
      const r = occ.length > 1 ? 15 : 18;
      occ.forEach((u, i) => {
        const ux = occ.length > 1 ? x + (i ? 19 : -19) : x;
        const uy = y;
        ui.unitXY[u.id] = { x: ux, y: uy, r };
        drawUnit(u, ux, uy, r, unitsLayer);
      });
    }

    renderOverlay();
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

  function drawUnit(u, cx, cy, r, parent) {
    const st = ui.state;
    const def = R.units[u.type];
    const sts = E.stats(st, u.id);
    const g = svg('g', {}, parent);
    if (capturable(st, u)) svg('circle', { cx, cy, r: r + 6, class: 'capt-ring' }, g);
    if (ui.selected === u.id) {
      svg('circle', { cx, cy, r: r + 4, class: 'sel-ring-outer' }, g);
      svg('circle', { cx, cy, r: r + 4, class: 'sel-ring' }, g);
    }
    const dashed = R.logic.hasSkill(u.type, 'insurgency');
    if (ui.settings.unitStyle === 'graphic' && window.NP_UNIT_ART && window.NP_UNIT_ART.has(u.type)) {
      // Graphic units: an illustrated token (unitart.js, drawn at radius 18) inside a ring in the player's colour.
      const tg = svg('g', { transform: `translate(${cx},${cy}) scale(${r / 18})` }, g);
      svg('circle', { r: 18, fill: P(u.player).tint, filter: 'url(#lift)' }, tg);
      const art = svg('g', { 'clip-path': 'url(#unit-clip)' }, tg);
      svg('circle', { r: 17, fill: 'none', stroke: P(u.player).color, 'stroke-width': 2.4, 'stroke-dasharray': dashed ? '4 2.4' : null }, tg);
      window.NP_UNIT_ART.draw(u.type, art, svg('g', {}, tg), P(u.player).color); // second layer: the part that sticks out
    } else {
      svg('circle', {
        cx, cy, r, fill: P(u.player).color, stroke: '#fff', 'stroke-width': 2, filter: 'url(#lift)',
        'stroke-dasharray': dashed ? '4 3' : null,
      }, g);
      if (!drawIcon('units', u.type, cx, cy, r * 1.15, '#fff', g, { width: 2.6 })) svgText(def.short, cx, cy + 5, 'ulabel', g);
    }

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

  function renderOverlay() {
    const st = ui.state;
    const under = $('ov-under');
    const over = $('ov-over');
    if (!under) return;
    under.replaceChildren();
    over.replaceChildren();

    const kind = buildKind(st);
    if (kind && ui.choice) {
      for (const k of Object.keys(st.hexes)) {
        if (E.isLegal(st, E.placeAction(kind, ui.choice, k))) {
          svg('polygon', { points: points(k, SIZE - 5), class: 'place-target', stroke: P(st.current).color }, under);
        }
      }
    }

    if (st.phase === 'battle' || st.phase === 'over') {
      const sel = liveUnit(ui.selected);
      const hovered = ui.hover ? E.unitsAt(st, ui.hover) : [];
      const hov = hovered.find((u) => u.id !== ui.selected);
      if (hov) drawUnitOverlay(hov, false, under);
      if (sel) drawUnitOverlay(sel, true, under);
      drawMovePath(over);
      // Attack arrows onto the hovered units (or the selected one), plus every capturable enemy if switched on.
      const targets = new Set((hovered.length ? hovered : sel ? [sel] : []).map((u) => u.id));
      if (ui.settings.threats) E.unitsOf(st, 1 - st.current).filter((u) => capturable(st, u)).forEach((u) => targets.add(u.id));
      drawAssaults([...targets], over);
    }

    if (ui.hover) svg('polygon', { points: points(ui.hover, SIZE - 2), class: 'hover-ring' }, over);
  }

  // Movement reach (light wash, outlined in the unit's colour), next legal steps
  // (green dashed) and attack range (dark dotted).
  function drawUnitOverlay(u, primary, under) {
    const st = ui.state;
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
    const st = ui.state;
    const toward = (a, b, d) => {
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: a.x + ((b.x - a.x) / len) * d, y: a.y + ((b.y - a.y) / len) * d };
    };
    for (const tId of targetIds) {
      const t = ui.unitXY[tId];
      const a = E.assault(st, tId);
      if (!t || !a.contributors.length) continue;
      const cls = a.beats ? 'hit' : 'miss';
      const g = svg('g', {}, parent);
      const arrows = a.contributors
        .map((c) => ({ c, from: ui.unitXY[c.id] }))
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
    const mv = ui.state.turnState.move;
    if (!mv || mv.path.length < 2) return;
    const pts = mv.path.map((k) => { const { x, y } = pos(k); return `${x},${y}`; }).join(' ');
    svg('polyline', { points: pts, class: 'move-path' }, parent);
  }

  function renderHoverInfo() {
    const box = $('hover-info');
    const st = ui.state;
    const k = ui.hover;
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
    const st = ui.state;
    const sections = [
      h('header', { class: 'title' }, h('h1', {}, 'Near Peer')),
      statusCard(st),
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
        st.phase === 'battle' ? h('span', { class: 'muted' }, ` · turn ${st.turn}`) : null));
  }

  function winCard(st) {
    return h('section', { class: 'card win', style: `border-color:${P(st.winner).color}` },
      h('div', { class: 'win-title' }, chip(st.winner), `${P(st.winner).name} wins!`),
      h('div', {}, `${P(st.winner).name} ${st.winReason}.`),
      h('button', { class: 'primary', onclick: newGame }, 'New game'));
  }

  function buildCard(st) {
    const kind = buildKind(st);
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
          class: `pick${item === ui.choice ? ' on' : ''}`,
          style: item === ui.choice ? `border-color:${P(st.current).color}` : null,
          onclick: () => { ui.choice = item; render(); },
        }, h('span', { class: 'pick-name' }, iconEl(kind === 'terrain' ? 'terrain' : 'units', item, kind === 'terrain' ? '#3b3325' : P(st.current).color),
          defs[item].name,
          kind === 'units' ? (defs[item].skills || []).map((sk) =>
            h('span', { class: 'pick-skill', title: `${R.skills[sk].name}: ${R.skills[sk].description}` }, iconEl('skills', sk, 'currentColor', 13))) : null),
          h('span', { class: 'pick-desc' }, desc(item))))),
      h('p', { class: 'hint' }, 'Pick a piece, then click a highlighted hex in your zone. ',
        `${P(1 - st.current).name} has ${opp} left.`),
      h('button', { onclick: randomFill }, 'Random-place the rest of this phase'));
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
        h('button', { class: 'primary', onclick: () => commit({ type: 'endTurn' }) }, ts.move || ts.moveDone ? 'End turn (E)' : 'Pass (E)')),
      h('p', { class: 'hint' }, 'Move one unit. Stepping onto an enemy captures it if the attack of all your units in range of it adds up to its defence. ',
        'A dashed ring marks enemies you can capture. Hover any unit to see the attack against it.'));
  }

  function selectedCard(st) {
    const u = liveUnit(ui.selected);
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

    const mine = st.phase === 'battle' && u.player === st.current;
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
      h('select', { onchange: (e) => { ui.settings[key] = e.target.value; store.set(storeKey, e.target.value); render(); } },
        [['symbols', 'Symbols'], ['graphic', 'Graphic']].map(([id, name]) => h('option', { value: id, selected: id === ui.settings[key] }, name))));
  }

  function controlsCard() {
    const toggle = (key, label) => h('label', { class: 'toggle' },
      h('input', { type: 'checkbox', checked: ui.settings[key], onchange: (e) => { ui.settings[key] = e.target.checked; render(); } }),
      label);
    return h('section', { class: 'card' },
      h('div', { class: 'row' },
        h('button', { disabled: !ui.history.length, onclick: undo }, 'Undo (Z)'),
        h('button', { onclick: () => { if (ui.history.length === 0 || confirm('Start a new game?')) newGame(); } }, 'New game')),
      h('div', { class: 'toggles' },
        toggle('autoEnd', 'Auto-end turn when nothing is left to do'),
        toggle('threats', 'Show attack arrows on every enemy you can capture'),
        toggle('coords', 'Show hex coordinates')),
      h('div', { class: 'settings' }, styleSelect('Map', 'mapStyle', 'map-style'), styleSelect('Units', 'unitStyle', 'unit-style')));
  }

  function armiesCard(st) {
    const col = (p) => h('div', { class: 'army' },
      h('h3', {}, chip(p), P(p).name),
      R.army.map((type) => {
        const u = Object.values(st.units).find((x) => x.player === p && x.type === type);
        const status = !u ? 'not placed' : u.dead ? 'defeated' : E.terrainAt(st, u.hex).name;
        return h('div', {
          class: `army-row${u && u.dead ? ' dead' : ''}${u && ui.selected === u.id ? ' on' : ''}`,
          onclick: () => { if (u && !u.dead) { ui.selected = u.id; render(); } },
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
    const d = h('details', { class: 'card', open: ui.rulesOpen },
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
    d.addEventListener('toggle', () => { ui.rulesOpen = d.open; });
    return d;
  }

  // Handy from the browser console, e.g. NearPeer.ui.state or NearPeer.commit({ type: 'endTurn' }).
  window.NearPeer = { ui, commit, undo, render, newGame, randomFill };

  newGame();
  // index.html?quick skips straight to the battle with a random setup.
  if (new URLSearchParams(location.search).has('quick')) {
    randomFill();
    randomFill();
  }
})();
