/*
 * Near Peer — the computer player.
 *
 *   choose(state, { level, timeMs, seed }) → the engine actions for its next batch:
 *   one placement in the build phase, or a whole turn (ending in endTurn) in the battle.
 *
 * Battle: an alpha-beta search over whole turns, deeper each pass until the time
 * runs out, using the fast model in ai-sim.js. At the end of the search it keeps
 * following captures and wins (quiescence), so it doesn't stop looking just before
 * a unit is taken. Positions are scored by evaluate() with the weights in W.
 * Build: no rules of thumb, since nobody knows the best setup yet. Each placement is tried by
 * finishing the build at random many times and searching the battle that follows (monteCarloPlacement).
 *
 * The move it picks is replayed through the engine before it's returned, so the
 * AI can't play an illegal move even if the model and the rules ever disagree.
 * Pure (no DOM), so it runs in a Web Worker (ai-worker.js) and under Bun (tools/arena.js).
 */
import R from './rules.js';
import * as E from './engine.js';
import * as S from './ai-sim.js';

const { KIND, DIST, PLAYING, STALEMATE } = S;
const WIN = 100000;

// Evaluation weights. Material is in "points", roughly one per stat point.
// Positions are scored by material alone: a tuned set of game-specific terms (advance 2, pressure 1.5)
// played no better than material once the build phase was Monte Carlo (tools/arena.js, 2026-10-19),
// so they're off, which leaves the AI with no opinions about strategy. They stay here for tuning.
const W = {
  // What each base unit is worth: attack, defence and reach, plus 1 for being a piece at all.
  value: { attack: 1, defence: 0.8, movement: 1, range: 0.8, piece: 1 },
  advance: 0, // a unit that can take the capital, by how close it is to the enemy capital
  guard: 0, // per point of defence of the unit standing on your own capital
  pressure: 0, // attack you have in range of an enemy unit, as a share of its defence (capped at 1)
  hanging: 0, // share of a unit's value lost when the enemy can capture it and you can't save them all
  contempt: 0, // a stalemate's score for the side to move
  repeat: 0.4, // cost of going back to a position already played this game, each time (stops endless shuffling)
  // Build phase: every legal placement is tried by finishing the build at random many times and
  // searching each battle rolloutDepth turns deep, for buildMs per placement (see monteCarloPlacement).
  buildMs: 800,
  rolloutDepth: 1,
  // Battle search: 'alphabeta' (search(), with evaluate()) or 'mcts' (Monte Carlo tree search: random
  // games played out playoutTurns turns, then scored by evaluate(); playoutWins: take a win when
  // a random game offers one).
  search: 'alphabeta',
  playoutTurns: 6,
  playoutWins: true,
  explore: 0.7, // MCTS: how much it tries less-explored moves
};

// Value of each unit kind (by bitmask) under weights w: the sum of its base units' values.
const values = new WeakMap();
function valueTable(w) {
  if (!values.has(w)) {
    const v = w.value;
    const base = R.base.map((b) => {
      const u = R.units[b];
      return v.piece + v.attack * u.attack + v.defence * u.defence + v.movement * (u.movement - 1) + v.range * (u.range - 1);
    });
    values.set(w, KIND.map((k, m) => (m ? R.base.reduce((n, b, i) => n + (m & (1 << i) ? base[i] : 0), 0) : 0)));
  }
  return values.get(w);
}

// ---------------------------------------------------------------- evaluation

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// How far a unit could get this turn, generously (each road can add a step), for quick threat checks.
const reach = (b, u) => {
  const m = S.startMovement(b, u);
  return m > 0 ? m + b.roadCount : 0;
};

// Could the other side capture unit t on their next move? A capturer steps on from a
// neighbouring hex, so its attack counts on top of everyone already in range.
// Ignores blocking, so it's a guess (the search finds the truth).
function hangs(b, units, t) {
  const x = 1 - t.p;
  const def = S.defenceOf(b, units, t);
  const { total, n } = S.attackOn(b, units, x, t.h);
  for (const a of units) {
    if (a.p !== x || KIND[a.m].noCapture) continue;
    const d = DIST[a.h][t.h];
    if (d > reach(b, a)) continue;
    const inRange = n > 0 && d <= S.rangeOf(b, a);
    const att = inRange ? total : total + S.attackOf(b, a);
    if (R.logic.beats(att, def)) return true;
  }
  return false;
}

// Could the player to move win or capture something this turn? (Guess; decides whether to search on.)
function tactical(b, s) {
  const me = s.cur;
  const cap = b.capital[1 - me];
  for (const u of s.units) {
    if (u.p !== me) {
      if (hangs(b, s.units, u)) return true;
    } else if (cap >= 0 && !KIND[u.m].noCapital && DIST[u.h][cap] <= reach(b, u)) return true;
  }
  return false;
}

function terminal(s, ply, w = W) {
  if (s.winner === STALEMATE) return w.contempt;
  return s.winner === s.cur ? WIN - ply : -(WIN - ply);
}

// The position's score for the player to move, with weights w.
function evaluate(b, s, w = W) {
  const VALUE = valueTable(w);
  const me = s.cur;
  let score = 0;
  const hanging = [[], []];
  for (const u of s.units) {
    const k = KIND[u.m];
    let v = VALUE[u.m];
    const enemyCap = b.capital[1 - u.p];
    if (w.advance && enemyCap >= 0 && !k.noCapital) {
      const turns = Math.max(0, DIST[u.h][enemyCap] - 1) / Math.max(1, k.movement);
      v += w.advance / (1 + turns);
    }
    if (w.guard && u.h === b.capital[u.p]) v += w.guard * S.defenceOf(b, s.units, u);
    // Pressure on the enemies of u's side: the attack u's side brings on this unit.
    if (w.pressure) {
      const { total } = S.attackOn(b, s.units, 1 - u.p, u.h);
      v -= w.pressure * Math.min(1, total / Math.max(1, S.defenceOf(b, s.units, u)));
    }
    if (w.hanging && hangs(b, s.units, u)) hanging[u.p].push(VALUE[u.m]);
    score += u.p === me ? v : -v;
  }
  // The player to move can save one of their hanging units (or capture first), but not the rest.
  // The opponent's hanging units are left to the quiescence search.
  const mine = hanging[me].sort((x, y) => y - x);
  for (let i = 1; i < mine.length; i++) score -= w.hanging * mine[i];
  return score;
}

// ---------------------------------------------------------------- search

const STOP = Symbol('stop');
const QDEPTH = 4;
const enemies = (s, p) => s.units.reduce((n, u) => n + (u.p !== p ? 1 : 0), 0);

// Mate scores are stored relative to the position, so they stay right at any depth.
const toTT = (v, ply) => (v > WIN - 1000 ? v + ply : v < -(WIN - 1000) ? v - ply : v);
const fromTT = (v, ply) => (v > WIN - 1000 ? v - ply : v < -(WIN - 1000) ? v + ply : v);

// → { depth, nodes, moves: [{ s, key, actions, score }] best first }.
// seen: how often each position (by key) has come up this game; moves back into one cost w.repeat each time.
function search(b, root, { timeMs = 1000, maxDepth = 30, rand = Math.random, w = W, seen = new Map() } = {}) {
  const deadline = now() + timeMs;
  const tt = new Map(); // position key → { depth, value, flag, best }
  const cache = new Map(); // position key → its turns, best-looking first (for positions searched 2+ deep)
  let nodes = 0;
  const quick = (s) => (s.winner !== PLAYING ? terminal(s, 0, w) : evaluate(b, s, w));
  const sorted = (s, list) => {
    for (const t of list) t.order = t.s.winner === s.cur ? WIN : -quick(t.s);
    return list.sort((x, y) => y.order - x.order);
  };

  // A position's turns, best-looking first: the best one last time it was searched, wins,
  // then by the score of the position they lead to.
  const children = (s, key, depth, bestKey) => {
    let list = cache.get(key);
    if (!list) {
      list = sorted(s, S.turns(b, s, false));
      if (depth >= 2) cache.set(key, list);
    }
    // A copy, not a reorder: the same position can come up again deeper down while this list is in use.
    const i = bestKey ? list.findIndex((t) => t.key === bestKey) : -1;
    return i > 0 ? [list[i]].concat(list.slice(0, i), list.slice(i + 1)) : list;
  };

  function quiesce(s, alpha, beta, ply, qd) {
    if (s.winner !== PLAYING) return terminal(s, ply, w);
    if ((++nodes & 1023) === 0 && now() > deadline) throw STOP;
    const stand = evaluate(b, s, w);
    if (stand >= beta || qd === 0 || !tactical(b, s)) return stand;
    if (stand > alpha) alpha = stand;
    const before = enemies(s, s.cur);
    const kids = sorted(s, S.turns(b, s, false).filter((t) => t.s.winner !== PLAYING || enemies(t.s, s.cur) < before));
    for (const t of kids) {
      const v = -quiesce(t.s, -beta, -alpha, ply + 1, qd - 1);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function negamax(s, key, depth, alpha, beta, ply) {
    if (s.winner !== PLAYING) return terminal(s, ply, w);
    if (depth <= 0) return quiesce(s, alpha, beta, ply, QDEPTH);
    if ((++nodes & 1023) === 0 && now() > deadline) throw STOP;
    const hit = tt.get(key);
    if (hit && hit.depth >= depth) {
      const v = fromTT(hit.value, ply);
      if (hit.flag === 0) return v;
      if (hit.flag > 0 && v >= beta) return v;
      if (hit.flag < 0 && v <= alpha) return v;
    }
    const a0 = alpha;
    let best = -Infinity;
    let bestKey = null;
    for (const t of children(s, key, depth, hit && hit.best)) {
      const v = -negamax(t.s, t.key, depth - 1, -beta, -alpha, ply + 1);
      if (v > best) {
        best = v;
        bestKey = t.key;
      }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    tt.set(key, { depth, value: toTT(best, ply), flag: best <= a0 ? -1 : best >= beta ? 1 : 0, best: bestKey });
    return best;
  }

  // Iterative deepening at the root. A little noise first, so equal moves vary from game to game.
  let moves = S.turns(b, root);
  for (const t of moves) {
    t.repeat = (seen.get(t.key) || 0) * w.repeat;
    t.score = -quick(t.s) - t.repeat + rand() * 1e-3;
  }
  moves.sort((x, y) => y.score - x.score);
  let done = { depth: 0, moves: moves.slice() };
  for (let depth = 1; depth <= maxDepth; depth++) {
    let alpha = -Infinity;
    let best = null;
    try {
      for (const t of moves) {
        // Full window for the first move, then a null window to show the rest are no better.
        let v;
        if (alpha === -Infinity) v = -negamax(t.s, t.key, depth - 1, -Infinity, Infinity, 1) - t.repeat;
        else {
          const bar = alpha + t.repeat;
          v = -negamax(t.s, t.key, depth - 1, -bar - 1e-6, -bar, 1) - t.repeat;
          if (v > alpha) v = -negamax(t.s, t.key, depth - 1, -Infinity, -bar, 1) - t.repeat;
        }
        t.score = v;
        if (v > alpha) {
          alpha = v;
          best = t;
        }
      }
    } catch (e) {
      if (e !== STOP) throw e;
      // Out of time: keep the last pass that finished, but a move this pass already showed is
      // better than that pass's best goes first.
      if (best && best !== done.moves[0]) done = { depth: done.depth, moves: [best].concat(done.moves.filter((t) => t !== best)) };
      break;
    }
    moves = moves.slice().sort((x, y) => y.score - x.score);
    done = { depth, moves: moves.slice() };
    if (Math.abs(moves[0].score) > WIN - 1000) break; // a forced win or loss: no need to look further
  }
  return { depth: done.depth, nodes, moves: done.moves };
}

// Monte Carlo tree search: no look-ahead rules, just many random games from here. Each pass walks down
// the tree picking the move that has won most (plus a bonus for moves tried less), adds a node, plays
// a random game on from it and counts the result back up the path.
// → the same shape as search(): moves best (most tried) first.
function mcts(b, root, { timeMs = 1000, rand = Math.random, w = W } = {}) {
  const deadline = now() + timeMs;
  const node = (s, actions) => ({ s, actions, kids: null, n: 0, blue: 0 }); // blue: total result for Blue
  const shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const result = (s) => (s.winner === STALEMATE ? 0.5 : s.winner === 0 ? 1 : 0);
  const playout = (s) => {
    for (let i = 0; i < w.playoutTurns && s.winner === PLAYING; i++) {
      const list = S.turns(b, s, false);
      const win = w.playoutWins && list.find((t) => t.s.winner === s.cur);
      s = (win || list[Math.floor(rand() * list.length)]).s;
    }
    if (s.winner !== PLAYING) return result(s);
    const p = 1 / (1 + Math.exp(-evaluate(b, s, w) / 3));
    return s.cur === 0 ? p : 1 - p;
  };
  const top = node(root, null);
  top.kids = shuffle(S.turns(b, root).map((t) => node(t.s, t.actions)));
  let passes = 0;
  while (passes < top.kids.length || now() < deadline) {
    passes++;
    const path = [top];
    let at = top;
    while (at.kids && at.s.winner === PLAYING) {
      const me = at.s.cur;
      const ln = Math.log(at.n + 1);
      let best = null;
      let bestU = -Infinity;
      for (const k of at.kids) {
        if (k.n === 0) {
          best = k;
          break;
        }
        const mean = me === 0 ? k.blue / k.n : 1 - k.blue / k.n;
        const u = mean + w.explore * Math.sqrt(ln / k.n);
        if (u > bestU) {
          bestU = u;
          best = k;
        }
      }
      at = best;
      path.push(at);
      if (at.n === 0) break;
    }
    if (at.n > 0 && at.s.winner === PLAYING && !at.kids) {
      at.kids = shuffle(S.turns(b, at.s, false).map((t) => node(t.s, null)));
      at = at.kids[0];
      path.push(at);
    }
    const r = at.s.winner !== PLAYING ? result(at.s) : playout(at.s);
    for (const x of path) {
      x.n++;
      x.blue += r;
    }
  }
  const me = root.cur;
  const moves = top.kids.slice().sort((x, y) => y.n - x.n)
    .map((k) => ({ s: k.s, actions: k.actions, score: k.n ? (me === 0 ? k.blue / k.n : 1 - k.blue / k.n) : 0 }));
  return { depth: 0, nodes: passes, moves };
}

// ---------------------------------------------------------------- build phase

// Finish the build at random from es: every piece still in hand goes on a random free hex of its
// owner's zone. Order doesn't change where things end up, so it skips the turn-taking.
// → the battle as the model sees it: { b, s }
function randomFinish(es, rand) {
  const hexes = {};
  for (const k of S.KEYS) hexes[k] = { terrain: es.hexes[k].terrain, owner: es.hexes[k].owner };
  const units = Object.values(es.units).filter((u) => !u.dead).map((u) => ({ player: u.player, type: u.type, hex: u.hex, id: u.id }));
  const any = (list) => list[Math.floor(rand() * list.length)];
  for (const p of [0, 1]) {
    for (const t of es.supply[p].terrain) {
      const k = any(R.zones[p].filter((z) => hexes[z].terrain === 'plain'));
      hexes[k] = { terrain: t, owner: R.terrain[t].capital ? p : null };
    }
  }
  for (const p of [0, 1]) {
    for (const type of es.supply[p].units) {
      const typesAt = (k) => units.filter((u) => u.hex === k).map((u) => u.type);
      const k = any(R.zones[p].filter((z) => R.logic.canShareHex(typesAt(z), type, es.options)));
      units.push({ player: p, type, hex: k, id: `p${p}-${type}` });
    }
  }
  const b = S.board({ hexes, options: es.options });
  const s = { cur: R.firstPlayer, winner: PLAYING, units: units.map((u) => ({ p: u.player, m: S.MASK[u.type], h: S.INDEX[u.hex], id: u.id })) };
  return { b, s };
}

// How good a finished build looks for player p, from 0 (lost) to 1 (won): a short battle search,
// squashed so one lucky forced win doesn't outweigh many ordinary games.
function rollout(es, p, rand, w) {
  const { b, s } = randomFinish(es, rand);
  const v = search(b, s, { timeMs: Infinity, maxDepth: w.rolloutDepth, w, rand }).moves[0].score;
  return 1 / (1 + Math.exp(-(s.cur === p ? v : -v) / 3));
}

// A build-phase placement with no opinions about where things should go: flat Monte Carlo with
// successive halving. The time is split into rounds. In each, the placements still in the running
// take turns being tried with a random finish until the round's time is up, then the worse half drop out.
function monteCarloPlacement(es, rand, w, ms) {
  const p = es.current;
  const start = now();
  let pool = E.legalPlacements(es).map((action) => ({ action, next: E.apply(es, action), total: 0, n: 0 }));
  const mean = (c) => c.total / c.n;
  const rounds = Math.ceil(Math.log2(pool.length));
  for (let r = 1; r <= rounds; r++) {
    const end = start + (ms * r) / rounds;
    do {
      for (const c of pool) {
        c.total += rollout(c.next, p, rand, w);
        c.n++;
      }
    } while (now() < end);
    pool.sort((x, y) => mean(y) - mean(x));
    pool = pool.slice(0, Math.ceil(pool.length / 2));
  }
  return pool[0].action;
}

// ---------------------------------------------------------------- choose

// A seeded random number generator (for repeatable games in tests), else Math.random.
function random(seed) {
  if (seed === undefined) return Math.random;
  let x = (seed * 2654435761) >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

// Does this list of actions play legally from es? → the state after, or null.
function replay(es, actions) {
  try {
    return actions.reduce((s, a) => E.apply(s, a), es);
  } catch (e) {
    if (e instanceof E.RuleError) return null;
    throw e;
  }
}

// The levels you can play against, easiest first. name: shown in the Menu. timeMs: thinking time per
// turn. maxDepth: how many turns ahead it may look. mistakes: the chance that a move is picked at
// random instead (a blunder now and then). weights: changes to W for this level.
const LEVELS = {
  easy: { name: 'Easy', timeMs: 300, maxDepth: 2, mistakes: 0.3, weights: { buildMs: 200 } },
  hard: { name: 'Hard', timeMs: 1000 },
};

// The AI's next batch of actions for the player to move.
// history: the game's earlier states, so it can avoid going round in circles.
// weights: changes to W (for tools/arena.js). info (optional) gets the search stats.
function choose(es, { level = 'hard', timeMs, seed, history = [], weights, info } = {}) {
  const rand = random(seed);
  const cfg = LEVELS[level] || LEVELS.hard;
  const w = cfg.weights || weights ? Object.assign({}, W, cfg.weights, weights) : W;
  const blunder = cfg.mistakes && rand() < cfg.mistakes;
  if (es.phase === 'terrain' || es.phase === 'units') {
    const legal = E.legalPlacements(es);
    if (blunder) return [legal[Math.floor(rand() * legal.length)]];
    return [monteCarloPlacement(es, rand, w, w.buildMs)];
  }
  if (es.phase !== 'battle') return [];
  if (es.turnState.move || es.turnState.moveDone) return [{ type: 'endTurn' }];
  if (blunder) {
    const any = S.turns(S.board(es), S.fromEngine(es));
    return any[Math.floor(rand() * any.length)].actions;
  }
  const seen = new Map();
  for (const h of history) {
    if (h.phase !== 'battle' || h.turnState.move) continue;
    const k = S.keyOf(S.fromEngine(h));
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  const result = w.search === 'mcts'
    ? mcts(S.board(es), S.fromEngine(es), { timeMs: timeMs ?? cfg.timeMs, rand, w })
    : search(S.board(es), S.fromEngine(es), { timeMs: timeMs ?? cfg.timeMs, maxDepth: cfg.maxDepth, rand, w, seen });
  if (info) Object.assign(info, { depth: result.depth, nodes: result.nodes, score: result.moves[0] && result.moves[0].score });
  for (const t of result.moves) {
    if (replay(es, t.actions)) return t.actions;
    console.warn('AI: the model and the engine disagree about', JSON.stringify(t.actions));
  }
  return [{ type: 'endTurn' }];
}

export { choose, evaluate, search, mcts, W, LEVELS };
