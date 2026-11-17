// The title's backdrop (the dark plaza with shadows lurking) and the screenshot scenes behind
// ?shot=cover|boss|title|dawn (also select, upgrade, defeat). Each plays the real rules forward
// from a fresh world, steered by a simple autopilot (aim at the nearest shadow, circle the
// Beacon, step out of red telegraphs), so the frame is what a real night looks like and the same
// seed always gives the same frame.
import { BEACON, dist, edgePoint, segDist } from './combat.js';
import { createWorld, newIntent, stepWorld } from './world.js';
import { applyUpgrade } from './upgrades.js';
import { spawnEnemy } from './enemies.js';
import { revealShadows } from './lamps.js';
import { NIGHTS, startNight } from './night.js';

const STEP = 1 / 60;

/** The title screen's city: deep night, two lamps dark, a few shadows creeping in from the streets. */
export function menuWorld() {
  const S = createWorld(7, 0);
  S.phase = 'night';
  S.backdrop = true;
  S.banner = null;
  S.lamps[2].power = 0;
  S.lamps[5].power = 0;
  for (const [kind, side] of [['grunt', 0], ['snuffer', 1], ['runner', 2], ['grunt', 3], ['spitter', 3], ['tank', 2]]) {
    const pt = edgePoint(S, side);
    const e = spawnEnemy(S, kind, pt.x, pt.y);
    e.x += (BEACON.x - e.x) * 0.22;
    e.y += (BEACON.y - e.y) * 0.22;
  }
  revealShadows(S);
  S.time = 3.3;
  return S;
}

function autopilot(S, I, orbit) {
  const p = S.player;
  let target = null;
  let best = Infinity;
  for (const e of S.enemies) {
    if (e.dead || e.grabbed) continue;
    const d = dist(e.x, e.y, p.x, p.y) - (e.boss ? 200 : 0) - (e.lit ? 120 : 0);
    if (d < best) {
      best = d;
      target = e;
    }
  }
  I.fire = !!target;
  if (target) {
    I.ax = target.x;
    I.ay = target.y;
  }
  const a = S.time * 0.45;
  let mx = BEACON.x + Math.cos(a) * orbit - p.x;
  let my = BEACON.y + Math.sin(a) * orbit * 0.75 - p.y;
  if (target && !target.boss && dist(target.x, target.y, p.x, p.y) < 80) {
    mx += (p.x - target.x) * 4;
    my += (p.y - target.y) * 4;
  }
  for (const tl of S.tele) {
    if (tl.shape === 'circle' && dist(p.x, p.y, tl.x, tl.y) < tl.r + 24) {
      mx += (p.x - tl.x) * 6;
      my += (p.y - tl.y) * 6;
    } else if (tl.shape === 'line' && segDist(p.x, p.y, tl.x1, tl.y1, tl.x2, tl.y2) < tl.w / 2 + 24) {
      const dx = tl.x2 - tl.x1;
      const dy = tl.y2 - tl.y1;
      const side = (p.x - tl.x1) * dy - (p.y - tl.y1) * dx > 0 ? 1 : -1;
      mx += dy * side;
      my -= dx * side;
    }
  }
  const l = Math.hypot(mx, my);
  I.mx = l > 12 ? mx / l : 0;
  I.my = l > 12 ? my / l : 0;
}

function run(S, I, seconds, orbit, until) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    autopilot(S, I, orbit);
    stepWorld(S, STEP, I);
    // Staged scenes keep the hero and the Beacon standing so the moment can be shown.
    S.player.hp = Math.max(S.player.hp, S.player.maxHp * 0.6);
    S.beacon.hp = Math.max(S.beacon.hp, S.beacon.max * 0.62);
    if (until && until(S)) return true;
  }
  return false;
}

/** A run that reached night n: its blessings, score, kills and Spark behind it. */
function startAt(S, night, picks) {
  for (const id of picks) applyUpgrade(S, id);
  S.night = night;
  S.lamps[6].power = 1;
  startNight(S);
  S.score = Math.round((night - 1) ** 1.5 * 420);
  S.kills = (night - 1) * 24;
  S.spark = 3 + night;
  S.stats.relit = night - 1;
  S.nightsSurvived = night - 1;
}

export function stageShot(name, seed, heroOverride = null) {
  const menu = menuWorld();
  const base = { menu, sel: 0, difficulty: 1, hover: -1, best: 0, newBest: false, t: 3.3 };
  if (name === 'title' || name === 'menu') return { ...base, screen: 'title', best: 48210 };
  const I = newIntent();
  if (name === 'dawn' || name === 'defeat') {
    const won = name === 'dawn';
    const S = createWorld(seed, heroOverride ?? (won ? 1 : 3));
    startAt(S, won ? NIGHTS : 9, ['rate', 'pierce', 'widelight', 'zaplamp', 'chain', 'sear']);
    run(S, I, 12, 150);
    S.result = won ? 'victory' : 'defeat';
    if (won) {
      S.phase = 'upgrade';
      S.enemies = [];
      S.nightsSurvived = NIGHTS;
      S.score = 61840;
      S.kills = 412;
      S.bossKills = 3;
      S.maxCombo = 57;
      S.stats.relit = 23;
    } else S.beacon.hp = 0;
    // t is picked so the blinking restart prompt and NEW BEST are both showing.
    return { ...base, screen: 'over', S, sel: S.heroIndex, best: S.score, newBest: true, t: 0.3 };
  }
  if (name === 'cover') {
    // Play the night once and find its most crowded moment (a crowd around the hero, dark lamps,
    // shrouded shadows), then replay the same seed to that moment and unleash the ultimate.
    const fresh = () => {
      const w = createWorld(seed, heroOverride ?? 0);
      startAt(w, 12, ['zaplamp', 'widelight', 'sear']);
      w.diff = { ...w.diff, count: 1.4 };
      return w;
    };
    const moment = (s) => {
      if (s.phase !== 'night' || s.nightT < 8) return -1;
      const p = s.player;
      const dark = Math.min(3, s.lamps.filter((l) => l.power <= 0).length);
      let ring = 0;
      let shrouded = 0;
      for (const e of s.enemies) {
        const d = dist(e.x, e.y, p.x, p.y);
        if (d < 50) return -1;
        if (d < 420) ring += 1;
        if (!e.lit) shrouded += 1;
      }
      return Math.min(ring, 22) + dark * 5 + Math.min(shrouded, 10);
    };
    let S = fresh();
    let bestStep = 0;
    let bestScore = -1;
    for (let i = 0; i < 70 / STEP && S.phase !== 'upgrade'; i += 1) {
      run(S, I, STEP, 170);
      const m = moment(S);
      if (m > bestScore) {
        bestScore = m;
        bestStep = i;
      }
    }
    S = fresh();
    Object.assign(I, newIntent());
    for (let i = 0; i <= bestStep; i += 1) run(S, I, STEP, 170);
    S.player.ult = 100;
    I.ult = true;
    run(S, I, { blaze: 0.22, volt: 0.9, frost: 0.5, gale: 1.6, mind: 0.6, bloom: 1.6 }[S.hero.id], 170);
    S.banner = null;
    return { ...base, screen: 'play', S, sel: S.heroIndex };
  }
  if (name === 'boss') {
    const S = createWorld(seed, heroOverride ?? 2);
    startAt(S, 10, ['pierce', 'rate', 'turret', 'crit', 'widelight']);
    run(S, I, 2.8, 150);
    run(S, I, 90, 150, (s) => s.boss && s.boss.phase === 2 && s.boss.inv <= 0 && s.tele.length >= 2);
    S.banner = null;
    return { ...base, screen: 'play', S, sel: S.heroIndex };
  }
  if (name === 'upgrade') {
    const S = createWorld(seed, 4);
    startAt(S, 6, ['rate', 'turret', 'lifesteal', 'widelight']);
    run(S, I, 2.8, 130);
    if (!run(S, I, 120, 130, (s) => s.phase === 'upgrade')) {
      S.enemies = [];
      S.queue = [];
      run(S, I, 8, 130, (s) => s.phase === 'upgrade');
    }
    return { ...base, screen: 'play', S, sel: 4, hover: 1 };
  }
  return { ...base, screen: 'select' };
}
