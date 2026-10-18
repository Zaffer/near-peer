/*
 * Near Peer — the rules, in one place.
 *
 * Stats, terrain, zones, option switches and the few small rule functions all
 * live here, so the game can be tuned without touching the engine or the UI.
 * Options marked "later idea" are switches for variants we've discussed but
 * not adopted yet.
 *
 * Merging: any of your units can merge into one new unit. A unit's type
 * is the set of base units in it, written as their ids joined by "+" in BASE
 * order (e.g. "light+armour+range"), so all 31 types are built below from the
 * five base units and the names in NAMES. See UNITS.md for the design.
 */

// The five base units, in recipe order. Each player has one of each.
const BASE = ['light', 'armour', 'range', 'flying', 'hero'];

// Which units have a skill is in UNIT_SKILLS below.
const BASE_UNITS = {
  light:  { short: 'L', attack: 1, defence: 1, movement: 1, range: 1 },
  armour: { short: 'A', attack: 0, defence: 2, movement: 1, range: 1 },
  range:  { short: 'R', attack: 2, defence: 0, movement: 1, range: 2 },
  flying: { short: 'F', attack: 0, defence: 0, movement: 2, range: 1 },
  hero:   { short: 'H', attack: 2, defence: 2, movement: 1, range: 1 },
};

// Every unit's name, keyed by its recipe letters (BASE_UNITS short codes, in BASE order).
const NAMES = {
  L: 'Rifle Squad', A: 'Armoured Carrier', R: 'Mortar Team', F: 'Recon Drone', H: 'Commander',

  LA: 'Infantry Fighting Vehicle', LR: 'Machine Gunner', LF: 'Strike Drone', LH: 'Scout',
  AR: 'Howitzer', AF: 'Transport Helicopter', AH: 'Combat Engineer', RF: 'Long-Range Drone',
  RH: 'Sniper', FH: 'Attack Helicopter',

  LAR: 'Assault Trooper', LAF: 'Heliborne Troops', LAH: 'Electronic Warfare', LRF: 'Bomber Drone',
  LRH: 'Rocket Artillery', LFH: 'Paratrooper', ARF: 'Strategic Bomber', ARH: 'Air Defence',
  AFH: 'Gunship', RFH: 'Stealth Fighter',

  LARF: 'Drone Swarm', LARH: 'Main Battle Tank', LAFH: 'Special Forces',
  LRFH: 'Massive Bomb', ARFH: 'Ballistic Missile',

  LARFH: 'Nuke',
};

// Which units have a skill (defined in RULES.skills), keyed by recipe letters. Only that exact
// combination has it: a merged unit doesn't inherit its parts' skills.
const UNIT_SKILLS = {
  F: ['surveillance'], // Recon Drone, on its own
  LARFH: ['nuclearDeterrence'], // Nuke: all five
};

// A merged unit's stats from its parts: attack and defence add up; movement and
// range are the best of the parts (a placeholder until the real rule is decided).
function mergedStats(parts) {
  const defs = parts.map((p) => BASE_UNITS[p]);
  const sum = (k) => defs.reduce((n, d) => n + d[k], 0);
  const best = (k) => Math.max(...defs.map((d) => d[k]));
  return { attack: sum('attack'), defence: sum('defence'), movement: best('movement'), range: best('range') };
}

// The type id for a set of base units: their ids in BASE order, joined by "+".
const typeOf = (parts) => BASE.filter((b) => parts.includes(b)).join('+');

// Every set of base units, smallest first, each size in recipe order (L, A, R, F, H): LA, LR, LF, …
function allRecipes() {
  const sets = [];
  for (let mask = 1; mask < 1 << BASE.length; mask++) sets.push(BASE.filter((b, i) => mask & (1 << i)));
  const rank = (parts) => parts.map((p) => BASE.indexOf(p));
  return sets.sort((a, b) => a.length - b.length || String(rank(a)).localeCompare(String(rank(b))));
}

function buildUnits() {
  const units = {};
  for (const parts of allRecipes()) {
    const short = parts.map((p) => BASE_UNITS[p].short).join('');
    const own = parts.length === 1 ? BASE_UNITS[parts[0]] : {};
    units[typeOf(parts)] = Object.assign({ name: NAMES[short], short, parts, tier: parts.length },
      parts.length === 1 ? own : mergedStats(parts), UNIT_SKILLS[short] ? { skills: UNIT_SKILLS[short] } : {});
  }
  return units;
}

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

  base: BASE,
  // All 31 unit types, keyed by type id: { name, short, parts, tier, attack, defence, movement, range, skills? }.
  units: buildUnits(),
  typeOf,

  // Special skills. A hex normally holds one unit. hexCapacity: while a unit with
  // this skill is on a hex, the hex can hold that many units in total.
  // cannotCapture: never captures enemy units. cannotTakeCapital: standing on the
  // enemy capital doesn't win. enemyDefence: added to the defence of every enemy
  // unit on the same hex. mutualStalemate: if both sides have a unit with this skill
  // on the board, the game ends in a stalemate, with no winner.
  skills: {
    surveillance: {
      name: 'Surveillance',
      description: 'Can share a hex with one other unit, friend or enemy, and pass through occupied hexes. '
        + 'An enemy unit on its hex has −1 defence. Can\'t capture units or take the capital.',
      hexCapacity: 2,
      cannotCapture: true,
      cannotTakeCapital: true,
      enemyDefence: -1,
    },
    nuclearDeterrence: {
      name: 'Nuclear Deterrence',
      description: 'If the other side also has a unit with Nuclear Deterrence on the board, the game ends in a stalemate: nobody wins.',
      mutualStalemate: true,
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

  army: BASE.slice(),
  terrainSet: ['capital', 'town', 'road', 'fortification', 'minefield'],

  options: {
    captureEndsMove: false,             // later idea: defeating a unit ends the capturing unit's move
    roadBonusOncePerHexPerMove: true,   // stops a unit bouncing between two roads forever
    normalUnitsCanJoinOccupiedHex: true, // later idea: false = only Surveillance units may move onto another unit's hex
    allowSameHexAttack: true,           // a unit on the same hex as an enemy (distance 0) adds to attacks on it
    winByCapital: true,
    capitalNeedsNoEnemyPresent: true,   // an enemy unit sharing the capital (e.g. a Recon Drone) blocks the win
    winByElimination: true,
    mergeEndsMove: true,                // merging into another unit is the end of the move
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

    // Can these two sets of base units merge? Only if they share none.
    canMerge(partsA, partsB) {
      return !partsA.some((p) => partsB.includes(p));
    },

    // Does a unit type have a skill?
    hasSkill(type, skill) {
      return (RULES.units[type].skills || []).includes(skill);
    },

    // Does any of this unit type's skills have `flag` set (e.g. cannotCapture)?
    skillFlag(type, flag) {
      return (RULES.units[type].skills || []).some((sk) => RULES.skills[sk][flag]);
    },

    // The sum of a numeric skill flag over a unit type's skills (e.g. enemyDefence).
    skillSum(type, flag) {
      return (RULES.units[type].skills || []).reduce((n, sk) => n + (RULES.skills[sk][flag] || 0), 0);
    },

    // How many units a hex can hold given who is on it: 1, or more if one of
    // them has a skill with a bigger hexCapacity (e.g. Surveillance).
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
