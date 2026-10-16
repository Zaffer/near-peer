/*
 * Near Peer — terrain colours ("Pastel stone"). Purely visual: nothing here
 * affects the rules. Each terrain gets { color: tile fill, ink: symbol colour }.
 * The units are always blue and red, and capturable rings are magenta, so the
 * terrain steers clear of those.
 */
(function (global) {
  'use strict';

  global.NP_COLOURS = {
    plain:         { color: '#efe9dc', ink: '#b3aa98' },
    road:          { color: '#d3c6a0', ink: '#4a3f26' },
    town:          { color: '#e3a685', ink: '#4a2412' },
    capital:       { color: '#f0cb6a', ink: '#3d2c05' },
    fortification: { color: '#a7acb5', ink: '#22262c' },
    minefield:     { color: '#4d4842', ink: '#ece6dc' },
  };
})(typeof window !== 'undefined' ? window : globalThis);
