// Temporary: Claude's side of a game against the page (?vs=claude). Run with Bun.
//
//   bun tools/claude.js show              the board, every unit, and my legal moves
//   bun tools/claude.js try '<actions>'   apply a JSON action (or a list) and show the result, without sending it
//   bun tools/claude.js play '<actions>'  send it as my move; in battle, end with {"type":"endTurn"}
//   bun tools/claude.js wait              return once it's my turn or the game is over
//
// Actions are the engine's: placeTerrain {terrain,to}, placeUnit {unitType,to},
// step {unitId,to,capture?,merge?}, split {unitId,parts,to,capture?,merge?},
// capture {unitId,targetId}, merge {unitId,targetId}, endTurn.
// merge on a step/split = the id of my unit on `to` to merge with there.
import * as E from '../js/engine.js';
import R from '../js/rules.js';

const API = process.env.BRIDGE || 'http://localhost:8000/api/game';
const ME = 1; // Red
const name = (p) => R.players[p].name;

// Same as online.js replay, which can't be imported here (it pulls in signals from a CDN).
function replay(batches) {
  let state = E.newGame();
  for (const b of batches) {
    if (b.by !== state.current) throw new E.RuleError(`${name(b.by)} moved out of turn`);
    for (const a of b.actions) state = E.apply(state, a);
  }
  return state;
}

async function load() {
  const record = await (await fetch(API)).json();
  return { record, state: replay(record.batches) };
}

const fmtStats = (s, id) => {
  const st = E.stats(s, id);
  return ['attack', 'defence', 'movement', 'range'].map((k) => `${k[0].toUpperCase()}${st[k].total}${st[k].mod ? `(${st[k].mod > 0 ? '+' : ''}${st[k].mod})` : ''}`).join(' ');
};

function show(s) {
  const out = [];
  out.push(`Turn ${s.turn} · phase ${s.phase} · to play: ${name(s.current)}${s.current === ME ? ' (me)' : ''}`);
  if (s.phase === 'over') out.push(s.winner === null ? `Stalemate, nobody wins — ${s.winReason}` : `Winner: ${name(s.winner)} — ${s.winReason}`);
  out.push(`Board radius ${R.boardRadius}, axial "q,r". Zones: Blue ${R.zones[0].length} hexes, Red ${R.zones[1].length} hexes.`);
  out.push(`Red zone: ${R.zones[1].join(' ')}`);
  out.push(`Blue zone: ${R.zones[0].join(' ')}`);

  const terrain = Object.entries(s.hexes).filter(([, h]) => h.terrain !== 'plain')
    .map(([k, h]) => `${k} ${h.terrain}${h.owner !== null ? `(${name(h.owner)})` : ''}`);
  out.push(`\nTerrain: ${terrain.join(', ') || 'none'}`);

  out.push('\nUnits:');
  for (const u of E.aliveUnits(s)) {
    const a = E.assault(s, u.id);
    const skills = (R.units[u.type].skills || []).join(',');
    out.push(`  ${name(u.player).padEnd(4)} ${u.id.padEnd(30)} ${R.units[u.type].name.padEnd(26)} at ${u.hex.padEnd(6)} on ${s.hexes[u.hex].terrain.padEnd(10)} ${fmtStats(s, u.id)}${skills ? ` [${skills}]` : ''}  threatened ${a.total}/${a.defence}${a.beats ? ' CAPTURABLE' : ''}`);
  }
  const dead = Object.values(s.units).filter((u) => u.dead).map((u) => u.id);
  if (dead.length) out.push(`  captured: ${dead.join(', ')}`);

  out.push(`\nSupply: Blue ${JSON.stringify(s.supply[0])}  Red ${JSON.stringify(s.supply[1])}`);

  if (s.current === ME && (s.phase === 'terrain' || s.phase === 'units')) {
    const opts = E.legalPlacements(s);
    const byItem = {};
    for (const a of opts) (byItem[a.terrain || a.unitType] ||= []).push(a.to);
    out.push('\nLegal placements:');
    for (const [item, hexes] of Object.entries(byItem)) out.push(`  ${item}: ${hexes.join(' ')}`);
  }
  if (s.current === ME && s.phase === 'battle') {
    const ts = s.turnState;
    out.push(`\nThis turn: ${ts.move ? `moving ${ts.move.unitId}, ${ts.move.remaining} left, path ${ts.move.path.join(' > ')}` : 'no move yet'}${ts.moveDone ? ' (move done)' : ''}`);
    out.push('My options (steps = adjacent now; reach = anywhere this move; merge = my units it could reach and merge with;');
    out.push('enemies on a hex are captured if beaten; a merged unit can also split: see "split" in the usage notes):');
    for (const u of E.unitsOf(s, ME)) {
      const steps = E.legalSteps(s, u.id);
      const { hexes: reach, merges } = E.moveReach(s, u.id);
      const caps = E.captureTargets(s, u.id);
      const here = E.mergeTargets(s, u.id);
      if (!steps.length && !caps.length && !merges.length && !here.length) continue;
      out.push(`  ${u.id}: steps ${steps.join(' ') || '-'} | reach ${reach.join(' ') || '-'}`
        + `${merges.length ? ` | merge ${merges.join(' ')}` : ''}${here.length ? ` | merge here ${here.join(' ')}` : ''}`
        + `${caps.length ? ` | capture here ${caps.join(' ')}` : ''}`);
    }
  }
  out.push(`\nRecent log:\n${s.log.slice(-10).map((l) => `  ${l.p === null ? '' : `${name(l.p)}: `}${l.text}`).join('\n')}`);
  return out.join('\n');
}

function run(s, actions) {
  for (const a of actions) s = E.apply(s, a);
  return s;
}

const parse = (txt) => [].concat(JSON.parse(txt));

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === 'show') {
    console.log(show((await load()).state));
  } else if (cmd === 'try' || cmd === 'play') {
    const { record, state } = await load();
    if (state.current !== ME) throw new Error(`It's ${name(state.current)}'s turn`);
    const actions = parse(arg);
    const next = run(state, actions);
    console.log(next.log.slice(state.log.length).map((l) => `  ${l.text}`).join('\n'));
    if (cmd === 'play') {
      const body = { rev: record.rev + 1, batches: record.batches.concat([{ by: ME, actions }]) };
      const res = await fetch(API, { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Bridge refused: ${(await res.json()).error}`);
      console.log(`Sent (rev ${body.rev}). Now: ${name(next.current)} to play, phase ${next.phase}.`);
    } else {
      console.log(`\n${show(next)}`);
    }
  } else if (cmd === 'wait') {
    for (;;) {
      try {
        const { state } = await load();
        if (state.current === ME || state.phase === 'over') {
          console.log(state.phase === 'over' ? 'Game over' : `My turn (turn ${state.turn}, ${state.phase})`);
          break;
        }
      } catch (e) { /* bridge not up yet */ }
      await Bun.sleep(1500);
    }
  } else {
    console.log('usage: bun tools/claude.js show | try <actions> | play <actions> | wait');
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
