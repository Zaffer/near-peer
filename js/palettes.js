/*
 * Near Peer — terrain colour schemes. Pick one from the panel while playing.
 * Purely visual: nothing here affects the rules.
 *
 * Each terrain gets { color: tile fill, ink: symbol colour }. byPlacer:
 * [Blue's look, Red's look] colours a tile by who placed it.
 * The units are always blue and red, and capturable rings are magenta, so
 * the schemes steer clear of those.
 */
(function (global) {
  'use strict';

  const DARK = '#1f1f1f';
  const LIGHT = '#ececec';

  global.NP_PALETTES = {
    pastelStone: {
      name: 'Pastel stone',
      note: 'Stone & sand hues at pastel lightness: sand ground, khaki road, soft terracotta town, butter-gold capital, soft slate fortification.',
      terrain: {
        plain:         { color: '#efe9dc', ink: '#b3aa98' },
        road:          { color: '#d3c6a0', ink: '#4a3f26' },
        town:          { color: '#e3a685', ink: '#4a2412' },
        capital:       { color: '#f0cb6a', ink: '#3d2c05' },
        fortification: { color: '#a7acb5', ink: '#22262c' },
        minefield:     { color: '#4d4842', ink: '#ece6dc' },
      },
    },
    picks: {
      name: 'Your picks',
      note: 'White ground, green road, yellow town, gold capital, grey fortification, black mines.',
      terrain: {
        plain:         { color: '#ffffff', ink: '#9ca3af' },
        road:          { color: '#7cc46a', ink: '#14381a' },
        town:          { color: '#fde047', ink: '#4a3a06' },
        capital:       { color: '#d4a72c', ink: '#3d2c05' },
        fortification: { color: '#8f8f8f', ink: DARK },
        minefield:     { color: '#111111', ink: LIGHT },
      },
    },
    fieldMap: {
      name: 'Field map',
      note: 'Military topo map: parchment, tan roads, ochre town, gold capital, olive fortification.',
      terrain: {
        plain:         { color: '#efe8d4', ink: '#a39a82' },
        road:          { color: '#d9c08a', ink: '#4a3b17' },
        town:          { color: '#d98c5f', ink: '#3f1d0b' },
        capital:       { color: '#e8b923', ink: '#3d2c05' },
        fortification: { color: '#7c8a5c', ink: '#1d2410' },
        minefield:     { color: '#2f2d28', ink: '#d6d0c0' },
      },
    },
    stone: {
      name: 'Stone & sand',
      note: 'Warm neutrals, terracotta town, slate fortification. Calm, lets the units pop.',
      terrain: {
        plain:         { color: '#f3f0e8', ink: '#a8a29e' },
        road:          { color: '#cbbf9f', ink: '#3f3626' },
        town:          { color: '#c47a52', ink: '#2e160a' },
        capital:       { color: '#f2c14e', ink: '#3d2c05' },
        fortification: { color: '#7d828b', ink: '#16191d' },
        minefield:     { color: '#3a3a3a', ink: '#e6e6e6' },
      },
    },
    pastel: {
      name: 'Soft pastel',
      note: 'Light and friendly: sage road, peach town, butter capital, lavender-grey fortification.',
      terrain: {
        plain:         { color: '#fbf8f1', ink: '#b8b2a6' },
        road:          { color: '#cfe3c1', ink: '#2f4a23' },
        town:          { color: '#f6d1a0', ink: '#4a2c0a' },
        capital:       { color: '#f3cf6b', ink: '#3d2c05' },
        fortification: { color: '#b4b0c4', ink: '#252233' },
        minefield:     { color: '#4b4453', ink: '#ece8f2' },
      },
    },
    contrast: {
      name: 'High contrast',
      note: 'Every terrain clearly different at a glance, even across the table.',
      terrain: {
        plain:         { color: '#ffffff', ink: '#9ca3af' },
        road:          { color: '#9be564', ink: '#1c3a0c' },
        town:          { color: '#ff9f43', ink: '#3d1d02' },
        capital:       { color: '#ffd60a', ink: '#3d3002' },
        fortification: { color: '#6c757d', ink: '#f8f9fa' },
        minefield:     { color: '#000000', ink: '#f5f5f5' },
      },
    },
    byPlayer: {
      name: 'Bold, by player',
      note: 'Capitals and towns take the colour of whoever placed them: Blue pink and purple, Red orange and yellow.',
      terrain: {
        plain:         { color: '#ffffff', ink: '#9ca3af' },
        road:          { color: '#a3a3a3', ink: '#262626' },
        town: { color: '#a855f7', ink: '#2e1065',
          byPlacer: [{ color: '#a855f7', ink: '#2e1065' }, { color: '#facc15', ink: '#422006' }] },
        capital: { color: '#f472b6', ink: '#4a0d2c',
          byPlacer: [{ color: '#f472b6', ink: '#4a0d2c' }, { color: '#f97316', ink: '#431407' }] },
        fortification: { color: '#525252', ink: '#f5f5f5' },
        minefield:     { color: '#111111', ink: '#e5e5e5' },
      },
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
