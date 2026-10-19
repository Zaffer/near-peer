// Computer-player arena: plays AI against AI without a browser, to measure and tune it. Run with Bun.
//
//   bun tools/arena.js [games] [msPerMove] [a] [b] [jobs]
//
// a and b: a level from LEVELS in js/ai.js ("hard"), "random" for random legal moves, or JSON
// changes to the hard AI's weights (W in js/ai.js), e.g. '{"advance":1.2}'. Each pair of games
// swaps seats. Games run in `jobs` parallel processes (default: one per core, at most `games`).
// Prints each result, then wins for a and b, draws (stalemate, or no winner after MAX_TURNS) and
// the average search depth.
import * as E from '../js/engine.js';
import * as S from '../js/ai-sim.js';
import * as AI from '../js/ai.js';

const MAX_TURNS = 150;

function randomMove(s, rand) {
  if (s.phase !== 'battle') {
    const opts = E.legalPlacements(s);
    return [opts[Math.floor(rand() * opts.length)]];
  }
  const opts = S.turns(S.board(s), S.fromEngine(s));
  return opts[Math.floor(rand() * opts.length)].actions;
}

// One game. players: [blue, red] specs as above. → { winner, turns, reason, depths }
function play(players, ms, seed) {
  let s = E.newGame();
  let x = seed;
  const rand = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  const depths = [[], []];
  const history = [];
  while (s.phase !== 'over' && s.turn <= MAX_TURNS) {
    const who = players[s.current];
    const info = {};
    let actions;
    if (who === 'random') actions = randomMove(s, rand);
    else {
      const weights = who.startsWith('{') ? JSON.parse(who) : undefined;
      const level = weights ? 'hard' : who;
      actions = AI.choose(s, { level, timeMs: ms, seed: x++, history, weights, info });
    }
    if (info.depth) depths[s.current].push(info.depth);
    history.push(s);
    for (const act of actions) s = E.apply(s, act);
  }
  return { winner: s.phase === 'over' ? s.winner : null, turns: s.turn, reason: s.winReason || 'turn limit', depths };
}

const args = process.argv.slice(2);
if (args[0] === '--game') {
  // A worker process: play one game and print the result as JSON.
  const [, a, b, ms, seed] = args;
  console.log(JSON.stringify(play([a, b], Number(ms), Number(seed))));
} else {
  const games = Number(args[0] || 20);
  const ms = Number(args[1] || 200);
  const a = args[2] || 'hard';
  const b = args[3] || 'random';
  const jobs = Math.min(games, Number(args[4] || navigator.hardwareConcurrency || 4));
  const score = { a: 0, b: 0, draw: 0 };
  const depth = { a: [], b: [] };
  const reasons = {};
  let next = 0;
  const worker = async () => {
    while (next < games) {
      const g = next++;
      const players = g % 2 ? [b, a] : [a, b];
      const sides = g % 2 ? ['b', 'a'] : ['a', 'b'];
      const proc = Bun.spawn([process.execPath, import.meta.path, '--game', players[0], players[1], String(ms), String(1000 + g)], { stdout: 'pipe' });
      const r = JSON.parse(await new Response(proc.stdout).text());
      const who = r.winner === null ? 'draw' : sides[r.winner];
      score[who] += 1;
      reasons[r.reason] = (reasons[r.reason] || 0) + 1;
      sides.forEach((side, i) => depth[side].push(...r.depths[i]));
      console.log(`game ${g + 1}: Blue ${sides[0]} vs Red ${sides[1]} → ${who === 'draw' ? 'no winner' : `${who} (${['Blue', 'Red'][r.winner]})`} in ${r.turns} turns, ${r.reason}`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  const avg = (l) => (l.length ? (l.reduce((n, d) => n + d, 0) / l.length).toFixed(1) : '-');
  console.log(`\na = ${a}\nb = ${b}\na ${score.a} : ${score.b} b, ${score.draw} draws   (avg depth a ${avg(depth.a)}, b ${avg(depth.b)})`);
  console.log(reasons);
}
