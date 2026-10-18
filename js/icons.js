/*
 * Near Peer — icons. One stroked SVG path per unit/terrain type, drawn on a
 * 24×24 grid. Keys match the type ids in rules.js; a type without an icon
 * falls back to its letter.
 */
export default {
  units: {
    // double chevron: speed
    light: 'M6 12l6-6 6 6 M6 19l6-6 6 6',
    // NATO armour symbol: an oval, like a tank's track loop
    armour: 'M7 7h10a5 5 0 0 1 0 10H7A5 5 0 0 1 7 7z',
    // crosshair
    ranged: 'M19 12a7 7 0 1 1-14 0a7 7 0 1 1 14 0 M12 2v6 M12 16v6 M2 12h6 M16 12h6',
    // eye
    covert: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z M14.5 12a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0',
    // crown
    hero: 'M4 17L3 7l5 4 4-6 4 6 5-4-1 10z M4 21h16',
  },
  skills: {
    // two people sharing one space
    insurgency: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0a4 4 0 1 1 8 0 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  },
  stats: {
    // sword
    attack: 'M14.5 17.5L3 6V3h3l11.5 11.5 M13 19l6-6 M16 16l4 4 M19 21l2-2',
    // shield
    defence: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z',
    // boot
    movement: 'M7 3h5v8l6 2.5a3 3 0 0 1 2 2.8V20H6z M6 16.5h14',
    // a point with arcs radiating out
    range: 'M6.5 17.5a1.5 1.5 0 1 1-3 0a1.5 1.5 0 1 1 3 0 M5 11a7 7 0 0 1 7 7 M5 4a14 14 0 0 1 14 14',
  },
  terrain: {
    // flag
    capital: 'M6 21V3 M6 4h12l-3 4 3 4H6',
    // house
    town: 'M3 11l9-7 9 7 M5 9.5V20h14V9.5 M10 20v-6h4v6',
    // road with centre line
    road: 'M7 21L10 3 M17 21L14 3 M12 4.5v2 M12 10.5v2.5 M12 17v3',
    // sandbag pile
    fortification: 'M4 16h2a2 2 0 0 1 0 4h-2a2 2 0 0 1 0-4z M11 16h2a2 2 0 0 1 0 4h-2a2 2 0 0 1 0-4z M18 16h2a2 2 0 0 1 0 4h-2a2 2 0 0 1 0-4z M7.5 12h2a2 2 0 0 1 0 4h-2a2 2 0 0 1 0-4z M14.5 12h2a2 2 0 0 1 0 4h-2a2 2 0 0 1 0-4z M11 8h2a2 2 0 0 1 0 4h-2a2 2 0 0 1 0-4z',
    // naval-style mine
    minefield: 'M17 12a5 5 0 1 1-10 0a5 5 0 1 1 10 0 M12 2v5 M12 17v5 M2 12h5 M17 12h5 M5 5l3.5 3.5 M15.5 15.5L19 19 M5 19l3.5-3.5 M15.5 8.5L19 5',
  },
};
