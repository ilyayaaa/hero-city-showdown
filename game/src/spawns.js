// Which shadows each night sends, from which street and when. A night's horde is a queue of
// timed spawns built from a budget that grows every night (scaled by the difficulty), squeezed
// into the first three quarters of the night so a fast hero can banish them all before dawn.
import { edgePoint } from './combat.js';
import { BOSS_OF, BOSS_TITLE, spawnBoss } from './bosses.js';
import { spawnEnemy } from './enemies.js';
import { burst } from './particles.js';

const UNLOCK = { grunt: 1, snuffer: 2, runner: 2, spitter: 3, splitter: 4, tank: 6, flier: 7 };
const COST = { grunt: 1, snuffer: 2, runner: 1, spitter: 2, splitter: 2, tank: 5, flier: 1.5 };
const WEIGHT = { grunt: 5, snuffer: 2, runner: 3, spitter: 2, splitter: 2, tank: 1, flier: 2 };
const NEWS = {
  snuffer: 'New shadow: SNUFFERS put out lamps. Hold E in a dark lamp to relight it',
  spitter: 'New shadow: SPITTERS attack from range',
  splitter: 'New shadow: GLOOPS split in two when banished',
  tank: 'New shadow: BRUISERS are armored and stubborn',
  flier: 'New shadow: GARGOYLES fly over the rooftops',
};

export function nightBanner(n, nights) {
  const boss = BOSS_OF[n];
  if (boss) return { title: `NIGHT ${n}`, sub: `BOSS: ${BOSS_TITLE[boss]}. Dawn waits until it is banished`, t: 0, dur: 2.6, color: '#ff5a6e' };
  const fresh = Object.keys(UNLOCK).find((k) => UNLOCK[k] === n && NEWS[k]);
  const sub = fresh ? NEWS[fresh] : n === 1 ? 'Shadows only fear light. Fight them inside the lamp pools' : n === nights ? 'The last night. Hold on until the sun rises' : 'The shadows return';
  return { title: `NIGHT ${n}`, sub, t: 0, dur: 2.6, color: '#ffd36b' };
}

/** Queues night n's horde, timed to fit inside `length` seconds; a boss night brings its boss. */
export function buildNight(S, n, length) {
  const diff = S.diff;
  S.hpMul = (1 + (n - 1) * 0.1) * diff.hp;
  S.foeDmg = 0.55 + n * 0.045;
  const boss = BOSS_OF[n];
  let budget = (boss ? 6 + n * 2 : 10 + n * 5.5) * diff.count;
  const kinds = Object.keys(UNLOCK).filter((k) => UNLOCK[k] <= n);
  const total = kinds.reduce((s, k) => s + WEIGHT[k], 0);
  const gap = Math.max(0.32, 1.5 - n * 0.08) / diff.count;
  let t = boss ? 5 : 0.5;
  const q = [];
  while (budget > 0) {
    let roll = S.rng() * total;
    let kind = kinds[0];
    for (const k of kinds) {
      roll -= WEIGHT[k];
      if (roll <= 0) {
        kind = k;
        break;
      }
    }
    const group = kind === 'tank' || kind === 'snuffer' ? 1 : 1 + Math.floor(S.rng() * (kind === 'runner' ? 4 : 3));
    const side = Math.floor(S.rng() * 4);
    for (let g = 0; g < group; g += 1) {
      q.push({ t: t + g * 0.22, kind, side });
      budget -= COST[kind];
    }
    t += gap * group * (0.7 + S.rng() * 0.6) * (boss ? 2.2 : 1);
  }
  // Keep the whole horde inside the first 75% of the night.
  const last = q.length ? q[q.length - 1].t : 0;
  const fit = length * 0.75;
  if (last > fit) for (const s of q) s.t *= fit / last;
  S.queue = q;
  S.spawnT = 0;
  if (boss) spawnBoss(S, n);
}

export function updateSpawns(S, dt) {
  S.spawnT += dt;
  while (S.queue.length && S.queue[0].t <= S.spawnT) {
    const s = S.queue.shift();
    const pt = edgePoint(S, s.side);
    spawnEnemy(S, s.kind, pt.x, pt.y, S.hpMul);
    burst(S, Math.max(8, Math.min(1272, pt.x)), Math.max(8, Math.min(712, pt.y)), '#6b4cff', 5, { speed: 120, life: 0.4, size: 3 });
  }
}
