/*
 * Near Peer — the rules, in one place.
 *
 * Stats, terrain, zones, option switches and the few small rule functions all
 * live here, so the game can be tuned without touching the engine or the UI.
 * Options marked "later idea" are switches for variants we've discussed but
 * not adopted yet.
 */
const RULES = {
  boardRadius: 2, // 3 hexes per side = 19 hexes (Catan layout)

  players: [
    // color: units and markers · tint: their zone during the build
    { name: 'Blue', color: '#2563eb', tint: '#d5e2fb' },
    { name: 'Red', color: '#dc2626', tint: '#f9d6d6' },
  ],
  firstPlayer: 0, // Blue places first and moves first

  // Starting zones as axial "q,r" keys. r runs from -2 (top row) to 2 (bottom row).
  // Blue sits at the bottom: back row (3) + next row (4) + the right two of
  // the middle row. Red mirrors that at the top and also gets the centre hex.
  zones: [
    ['-2,2', '-1,2', '0,2', '-2,1', '-1,1', '0,1', '1,1', '1,0', '2,0'],
    ['0,-2', '1,-2', '2,-2', '-1,-1', '0,-1', '1,-1', '2,-1', '-2,0', '-1,0', '0,0'],
  ],

  // skills: special abilities, defined in `skills` below.
  units: {
    light:  { name: 'Light',  short: 'L', attack: 2, defence: 2, movement: 2, range: 1 },
    armour: { name: 'Armour', short: 'A', attack: 1, defence: 3, movement: 1, range: 1 },
    ranged: { name: 'Ranged', short: 'R', attack: 3, defence: 1, movement: 1, range: 2 },
    covert: { name: 'Covert', short: 'C', attack: 1, defence: 1, movement: 1, range: 1, skills: ['insurgency'] },
    hero:   { name: 'Hero',   short: 'H', attack: 3, defence: 3, movement: 1, range: 1 },
  },

  // Special skills. A hex normally holds one unit. hexCapacity: while a unit with
  // this skill is on a hex, the hex can hold that many units in total.
  // takesOccupiedCapital: standing on the enemy capital wins even if an enemy unit is there.
  skills: {
    insurgency: {
      name: 'Insurgency',
      description: 'Dual occupancy: can share a hex with one other unit, friend or enemy, and pass through occupied hexes. '
        + 'Takes the enemy capital even when an enemy unit is on it.',
      hexCapacity: 2,
      takesOccupiedCapital: true,
    },
  },

  // mods apply to any unit standing on the hex, whoever placed the tile. Only a
  // capital belongs to a player (that's what you win by taking).
  // Colours live in colours.js.
  terrain: {
    plain:     { name: 'Plain',     mods: {} },
    capital:   { name: 'Capital',   mods: { attack: 1, defence: 1 }, capital: true },
    town:      { name: 'Town',      mods: { attack: 1 } },
    road:      { name: 'Road',      mods: { movement: 1 } },
    fortification: { name: 'Fortification', mods: { defence: 1 } },
    minefield: { name: 'Minefield', mods: { movement: -1 } },
  },

  army: ['light', 'armour', 'ranged', 'covert', 'hero'],
  terrainSet: ['capital', 'town', 'road', 'fortification', 'minefield'],

  options: {
    captureEndsMove: false,             // later idea: defeating a unit ends the capturing unit's move
    roadBonusOncePerHexPerMove: true,   // stops a unit bouncing between two roads forever
    normalUnitsCanJoinOccupiedHex: true, // later idea: false = only Insurgency units may move onto another unit's hex
    allowSameHexAttack: true,           // a unit on the same hex as an enemy (distance 0) adds to attacks on it
    winByCapital: true,
    capitalNeedsNoEnemyPresent: true,   // an enemy covert sharing the capital blocks the win (unless you take it with Insurgency)
    winByElimination: true,
  },

  // ---- The small rule functions. Change behaviour here. ----
  logic: {
    // Does the combined attack of every unit in range capture the target?
    beats(attack, defence) {
      return attack >= defence;
    },

    // Movement available at the start of a move, given the terrain the unit starts on.
    // Only penalties count here (a minefield start is −1). Bonuses like a road only
    // pay out when you land on the tile (see afterEnter).
    startMovement(base, terrainMod) {
      return Math.max(0, base + Math.min(0, terrainMod));
    },

    // Steps remaining after entering a hex. `remaining` has already paid the 1-step cost.
    // Negative terrain (minefield) takes movement away immediately.
    // Positive terrain (road) guarantees at least that many more steps.
    afterEnter(remaining, terrainMod, firstVisit, options) {
      if (terrainMod < 0) return Math.max(0, remaining + terrainMod);
      if (terrainMod > 0 && (firstVisit || !options.roadBonusOncePerHexPerMove)) {
        return Math.max(remaining, terrainMod);
      }
      return remaining;
    },

    // Does a unit type have a skill?
    hasSkill(type, skill) {
      return (RULES.units[type].skills || []).includes(skill);
    },

    // Does any of this unit type's skills have `flag` set (e.g. takesOccupiedCapital)?
    skillFlag(type, flag) {
      return (RULES.units[type].skills || []).some((sk) => RULES.skills[sk][flag]);
    },

    // How many units a hex can hold given who is on it: 1, or more if one of
    // them has a skill with a bigger hexCapacity (e.g. Insurgency).
    hexCapacity(types) {
      let cap = 1;
      for (const t of types) {
        for (const sk of RULES.units[t].skills || []) cap = Math.max(cap, RULES.skills[sk].hexCapacity || 1);
      }
      return cap;
    },

    // Can a unit of `enteringType` join a hex already holding `occupantTypes`?
    canShareHex(occupantTypes, enteringType, options) {
      const all = occupantTypes.concat(enteringType);
      if (all.length > RULES.logic.hexCapacity(all)) return false;
      if (!options.normalUnitsCanJoinOccupiedHex && occupantTypes.length > 0
        && RULES.logic.hexCapacity([enteringType]) <= 1) return false;
      return true;
    },
  },
};

export default RULES;
