// The screenshot scenes behind ?shot=cover|boss|upgrade|title. Each plays the real rules forward
// from a fresh world, steered by a simple autopilot (aim at the nearest monster, circle the
// City Core, step out of red telegraphs), so the frame is what a real fight looks like and the
// same seed always gives the same frame.
import { PLAZA, dist, segDist } from './combat.js';
import { createWorld, newIntent, stepWorld } from './world.js';
import { applyUpgrade } from './upgrades.js';
import { waveBanner } from './waves.js';

const STEP = 1 / 60;

function autopilot(S, I, orbit) {
  const p = S.player;
  let target = null;
  let best = Infinity;
  for (const e of S.enemies) {
    if (e.dead || e.grabbed) continue;
    const d = dist(e.x, e.y, p.x, p.y) - (e.boss ? 200 : 0);
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
  let mx = PLAZA.x + Math.cos(a) * orbit - p.x;
  let my = PLAZA.y + Math.sin(a) * orbit * 0.75 - p.y;
  if (target && !target.boss && best < 80) {
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
    // Staged scenes keep the hero and the Core standing so the moment can be shown.
    S.player.hp = Math.max(S.player.hp, S.player.maxHp * 0.6);
    S.plaza.hp = Math.max(S.plaza.hp, S.plaza.max * 0.62);
    if (until && until(S)) return true;
  }
  return false;
}

function startAt(S, wave, picks) {
  for (const id of picks) applyUpgrade(S, id);
  S.wave = wave;
  S.banner = waveBanner(wave);
  // A run that reached this wave has a score and kills behind it.
  S.score = Math.round((wave - 1) ** 1.5 * 420);
  S.kills = (wave - 1) * 24;
}

export function stageShot(name, seed, heroOverride = null) {
  const menu = createWorld(7, 0);
  const base = { menu, sel: 0, hover: -1, best: 0, newBest: false, t: 3.3 };
  menu.time = 3.3;
  if (name === 'menu') return { ...base, screen: 'title' };
  if (name !== 'cover' && name !== 'boss' && name !== 'upgrade' && name !== 'end') return { ...base, screen: 'select' };
  const I = newIntent();
  if (name === 'end') {
    const S = createWorld(seed, 3);
    startAt(S, 8, ['rate', 'pierce']);
    run(S, I, 20, 140);
    S.result = 'defeat';
    return { ...base, screen: 'over', S, sel: 3, best: S.score, newBest: true };
  }
  if (name === 'cover') {
    const S = createWorld(seed, heroOverride ?? 0);
    startAt(S, 13, ['turret', 'drone', 'multishot']);
    run(S, I, 2.4, 170);
    // Fight until a crowd surrounds the hero (but not on top of them), then unleash the ultimate.
    run(S, I, 60, 170, (s) => {
      const p = s.player;
      let ring = 0;
      for (const e of s.enemies) {
        const d = dist(e.x, e.y, p.x, p.y);
        if (d < 70) return false;
        if (d < 360) ring += 1;
      }
      return s.time > 10 && ring >= 18 && dist(p.x, p.y, PLAZA.x, PLAZA.y) > 120;
    });
    S.player.ult = 100;
    I.ult = true;
    run(S, I, { blaze: 0.22, volt: 1.0, frost: 0.5, gale: 1.6, mind: 0.6, bloom: 1.6 }[S.hero.id], 170);
    S.banner = null;
    return { ...base, screen: 'play', S, sel: 0 };
  }
  if (name === 'boss') {
    const S = createWorld(seed, 2);
    startAt(S, 5, ['pierce', 'rate', 'turret', 'crit']);
    run(S, I, 2.4, 150);
    run(S, I, 90, 150, (s) => s.boss && s.boss.phase === 2 && s.boss.inv <= 0 && s.tele.filter((tl) => tl.shape === 'line' && tl.t / tl.dur > 0.5).length >= 2);
    S.banner = null;
    return { ...base, screen: 'play', S, sel: 2 };
  }
  const S = createWorld(seed, 4);
  startAt(S, 6, ['rate', 'turret', 'lifesteal', 'multishot']);
  run(S, I, 2.4, 130);
  if (!run(S, I, 150, 130, (s) => s.phase === 'upgrade')) {
    S.enemies = [];
    S.queue = [];
    run(S, I, 5, 130, (s) => s.phase === 'upgrade');
  }
  return { ...base, screen: 'play', S, sel: 4, hover: 1 };
}
