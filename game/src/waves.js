// The 15 waves: which monsters each one sends, from which street, how fast, how tough, and which
// waves bring a boss. A wave is a queue of timed spawns built from a budget that grows each wave.
import { edgePoint } from './combat.js';
import { BOSS_OF, BOSS_TITLE, spawnBoss } from './bosses.js';
import { spawnEnemy } from './enemies.js';
import { burst } from './particles.js';

export const MAX_WAVE = 15;
const UNLOCK = { grunt: 1, runner: 2, spitter: 3, splitter: 4, tank: 6, flier: 7 };
const COST = { grunt: 1, runner: 1, spitter: 2, splitter: 2, tank: 5, flier: 1.5 };
const WEIGHT = { grunt: 5, runner: 3, spitter: 2, splitter: 2, tank: 1, flier: 2 };
const NEWS = {
  runner: 'New threat: SKITTERS are fast but fragile',
  spitter: 'New threat: SPITTERS attack from range',
  splitter: 'New threat: GLOOPS split in two when popped',
  tank: 'New threat: BRUISERS are armored and stubborn',
  flier: 'New threat: GARGOYLES fly over the rooftops',
};

export function waveBanner(n) {
  const boss = BOSS_OF[n];
  if (boss) return { title: `WAVE ${n}`, sub: `BOSS: ${BOSS_TITLE[boss]}`, t: 0, dur: 2.4, color: '#ff5a6e' };
  const fresh = Object.keys(UNLOCK).find((k) => UNLOCK[k] === n && NEWS[k]);
  return { title: `WAVE ${n}`, sub: fresh ? NEWS[fresh] : n === 1 ? 'Defend the City Core!' : 'Here they come!', t: 0, dur: 2.2, color: '#ffe45c' };
}

export function buildWave(S, n) {
  S.hpMul = 1 + (n - 1) * 0.1;
  S.foeDmg = 0.55 + n * 0.045;
  const boss = BOSS_OF[n];
  let budget = boss ? 6 + n * 2 : 10 + n * 5.5;
  const kinds = Object.keys(UNLOCK).filter((k) => UNLOCK[k] <= n);
  const total = kinds.reduce((s, k) => s + WEIGHT[k], 0);
  const gap = Math.max(0.32, 1.5 - n * 0.08);
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
    const group = kind === 'tank' ? 1 : 1 + Math.floor(S.rng() * (kind === 'runner' ? 4 : 3));
    const side = Math.floor(S.rng() * 4);
    for (let g = 0; g < group; g += 1) {
      q.push({ t: t + g * 0.22, kind, side });
      budget -= COST[kind];
    }
    t += gap * group * (0.7 + S.rng() * 0.6) * (boss ? 2.2 : 1);
  }
  S.queue = q;
  S.waveT = 0;
  if (boss) spawnBoss(S, n);
}

export function updateSpawns(S, dt) {
  S.waveT += dt;
  while (S.queue.length && S.queue[0].t <= S.waveT) {
    const s = S.queue.shift();
    const pt = edgePoint(S, s.side);
    spawnEnemy(S, s.kind, pt.x, pt.y, S.hpMul);
    burst(S, Math.max(8, Math.min(1272, pt.x)), Math.max(8, Math.min(712, pt.y)), '#ff3b8a', 5, { speed: 120, life: 0.4, size: 3 });
  }
}
