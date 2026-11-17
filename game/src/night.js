// The night cycle and the goal: 15 nights, each a countdown to dawn. A night ends when its timer
// runs out (dawn) or when every shadow it sent is banished (an early dawn, with a bonus). Boss
// nights hold the dawn back until the boss falls. The sunrise sweeps across the city and burns
// every shadow still standing. Dawn after night 15 wins; the Beacon going dark loses.
// Also: the three difficulties chosen on the title screen.
import { W } from './combat.js';
import { buildNight, nightBanner, updateSpawns } from './spawns.js';
import { rollOffer } from './upgrades.js';
import { addText, burst, flash } from './particles.js';

export const NIGHTS = 15;
export const GOAL_TEXT = 'WIN: see dawn after night 15  |  LOSE: the Beacon goes dark';

export const DIFFICULTY = [
  { id: 'calm', name: 'CALM', color: '#7dffc0', count: 0.72, dmg: 0.65, hp: 0.9, beacon: 1300, score: 0.75, desc: 'Fewer shadows, softer hits' },
  { id: 'watch', name: 'WATCH', color: '#ffd36b', count: 1, dmg: 1, hp: 1, beacon: 1000, score: 1, desc: 'The night as it was meant' },
  { id: 'storm', name: 'STORM', color: '#ff6a8a', count: 1.35, dmg: 1.35, hp: 1.15, beacon: 900, score: 1.6, desc: 'More, fiercer shadows · x1.6 score' },
];

const DUSK = 2.6;
const SUNRISE = 2.4;
const DAWN = 3.6;

/** Seconds from dusk to dawn: 45 s on night 1, up to 81 s on night 15. */
export const nightLength = (n) => Math.round(42 + n * 2.6);

/** Starts the dusk before night S.night: the darkness falls and the banner names the night. */
export function startNight(S) {
  S.phase = 'dusk';
  S.phaseT = 0;
  S.nightT = 0;
  S.nightLen = nightLength(S.night);
  S.banner = nightBanner(S.night, NIGHTS);
  S.sfx('dusk');
}

/** Seconds left until dawn (0 while a boss holds the dawn back). */
export function dawnLeft(S) {
  if (S.phase === 'dusk') return S.nightLen;
  if (S.phase !== 'night') return 0;
  return Math.max(0, S.nightLen - S.nightT);
}

/** How dark the city is (0 day to 1 deepest night), for the lighting overlay. */
export function darkness(S) {
  if (S.phase === 'dusk') return 0.35 + 0.65 * Math.min(1, S.phaseT / (DUSK * 0.8));
  if (S.phase === 'night') return 1;
  if (S.phase === 'dawn') return 1;
  return 0;
}

/** The sunrise line's x during dawn (everything left of it is already in daylight), else null. */
export function sunriseX(S) {
  if (S.phase !== 'dawn') return S.phase === 'upgrade' || S.result === 'victory' ? W + 400 : null;
  return -260 + Math.min(1, S.phaseT / SUNRISE) * (W + 520);
}

export function updateNight(S, dt) {
  S.phaseT += dt;
  if (S.banner && (S.banner.t += dt) > S.banner.dur) S.banner = null;
  if (S.ultFx && (S.ultFx.t += dt) > 1.6) S.ultFx = null;
  if (S.phase === 'dusk') {
    if (S.phaseT > DUSK) {
      S.phase = 'night';
      S.phaseT = 0;
      buildNight(S, S.night, S.nightLen);
      S.sfx('go');
    }
  } else if (S.phase === 'night') {
    updateSpawns(S, dt);
    const bossUp = S.boss && !S.boss.dead;
    S.nightT = bossUp ? Math.min(S.nightT + dt, S.nightLen) : S.nightT + dt;
    const banished = !S.queue.length && !S.enemies.some((e) => !e.dead);
    if (banished) beginDawn(S, true);
    else if (!bossUp && S.nightT >= S.nightLen) beginDawn(S, false);
  } else if (S.phase === 'dawn') {
    burnInSunrise(S);
    if (S.phaseT > DAWN) {
      if (S.night >= NIGHTS) S.result = 'victory';
      else {
        S.phase = 'upgrade';
        S.offer = rollOffer(S);
        S.sfx('offer');
      }
    }
  }
}

function beginDawn(S, early) {
  const n = S.night;
  const left = Math.max(0, S.nightLen - S.nightT);
  const bonus = Math.round((100 * n + (300 * S.beacon.hp) / S.beacon.max + (early ? left * 8 : 0)) * S.diff.score);
  S.score += bonus;
  S.phase = 'dawn';
  S.phaseT = 0;
  S.queue = [];
  S.foes = [];
  S.tele = [];
  S.hazards = [];
  S.nightsSurvived = n;
  S.banner = {
    title: n >= NIGHTS ? 'THE LAST DAWN!' : 'DAWN BREAKS',
    sub: `Night ${n} survived${early ? ' early' : ''}  ·  +${bonus.toLocaleString('en-US')} bonus`,
    t: 0, dur: 3.2, color: '#ffcf5a',
  };
  // The morning sweeps every loose Spark into the hero's pocket.
  for (const m of S.motes) S.spark += m.n;
  S.motes = [];
  flash(S, '#ffcf7a', 0.35);
  S.sfx('dawn');
}

/** The sunrise line burns every shadow it passes: banished, with half their score. */
function burnInSunrise(S) {
  const x = sunriseX(S);
  for (const e of S.enemies) {
    if (e.dead || e.boss || e.x > x) continue;
    e.dead = true;
    e.burned = true;
    burst(S, e.x, e.y, '#ffb347', 12, { speed: 200, vy: -60, life: 0.7, size: 4 });
    burst(S, e.x, e.y, '#1a1235', 6, { kind: 'smoke', add: false, speed: 50, vy: -50, life: 0.9, size: 9 });
    if (S.rng() < 0.5) addText(S, e.x, e.y - 20, 'BURNED', '#ffcf7a', 14);
  }
}
