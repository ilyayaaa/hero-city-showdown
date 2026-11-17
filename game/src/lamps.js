// The signature rule of the blackout: light. Eight street lamps ring the Beacon, each casting a
// pool of light; the Beacon casts its own, shrinking as its HP falls; ultimates fire a short
// flare. Shadows inside any light are revealed (full damage, slowed); outside they are shrouded.
// Snuffers drain lamps dark; the hero relights a lamp by holding E inside it, paying Spark.
// Lit lamps ward the Beacon. This file is rules only: lighting.js draws it all.
import { BEACON, TAU, damageEnemy, dist } from './combat.js';
import { addText, arc, burst, ring } from './particles.js';

export const LAMP_COUNT = 8;
export const LAMP_RADIUS = 125;
/** Each lit lamp takes this share off every hit the Beacon suffers. */
export const WARD_PER_LAMP = 0.06;
export const RELIGHT_COST = 5;
export const RELIGHT_TIME = 1;
const RELIGHT_REACH = 54;

/** The lamp posts: an oval ring around the Beacon, starting at the top and going clockwise. */
export const LAMP_SPOTS = Array.from({ length: LAMP_COUNT }, (_, i) => {
  const a = (i / LAMP_COUNT) * TAU - Math.PI / 2;
  return { x: Math.round(BEACON.x + Math.cos(a) * 300), y: Math.round(BEACON.y + Math.sin(a) * 222) };
});

export function createLamps() {
  return LAMP_SPOTS.map((p, i) => ({ id: i, x: p.x, y: p.y, power: 1, zapT: 0.5 + i * 0.13, flick: 0, snuffedAt: -9 }));
}

export const isLampLit = (l) => l.power > 0;

/** A lamp's light radius now: wider with the lamp upgrades, smaller while a Snuffer drains it. */
export function lampRadius(S, l) {
  if (l.power <= 0) return 0;
  return LAMP_RADIUS * S.mods.lampRadiusMul * (0.45 + 0.55 * l.power);
}

/** The Beacon's own light: 220 at full HP down to 90 when it is about to go dark. */
export function beaconRadius(S) {
  const k = Math.max(0, S.beacon.hp / S.beacon.max);
  return (90 + 130 * k) * Math.sqrt(S.mods.lampRadiusMul);
}

/** Every light source as {x, y, r, kind}: lamps, the Beacon, flares and the hero's lantern. */
export function lightSources(S) {
  const out = [];
  for (const l of S.lamps) if (l.power > 0) out.push({ x: l.x, y: l.y, r: lampRadius(S, l), kind: 'lamp', power: l.power });
  out.push({ x: BEACON.x, y: BEACON.y, r: beaconRadius(S), kind: 'beacon', power: 1 });
  for (const f of S.flares) out.push({ x: f.x, y: f.y, r: f.r * Math.min(1, f.t * 6, (f.dur - f.t) * 2), kind: 'flare', power: 1, color: f.color });
  const p = S.player;
  if (S.mods.lantern && p.down <= 0) out.push({ x: p.x, y: p.y, r: 70 + 22 * S.mods.lantern, kind: 'lantern', power: 1 });
  return out;
}

/** True when (x, y), padded by pad, stands inside any light. */
export function inLight(S, x, y, pad = 0) {
  for (const s of lightSources(S)) if (dist(x, y, s.x, s.y) < s.r + pad) return true;
  return false;
}

/** Marks every shadow lit or shrouded for this step (read by damageEnemy and the movement code). */
export function revealShadows(S) {
  const lights = lightSources(S);
  for (const e of S.enemies) {
    if (e.dead) continue;
    const was = e.lit;
    e.lit = lights.some((s) => dist(e.x, e.y, s.x, s.y) < s.r + e.r * 0.5);
    if (e.lit && !was && !e.boss && e.t > 0.3) burst(S, e.x, e.y, '#ffd98a', 3, { speed: 90, life: 0.35, size: 2.5, kind: 'spark' });
  }
}

/** A short burst of light that follows the hero (fired by every ultimate). */
export function addFlare(S, x, y, r, dur, color) {
  S.flares.push({ x, y, r, dur, t: 0, color, follow: true });
}

/** A Snuffer (or a boss) drains `amount` of a lamp's power; at zero the lamp goes dark. */
export function drainLamp(S, l, amount) {
  if (l.power <= 0) return;
  l.power = Math.max(0, l.power - amount);
  l.flick = 0.2;
  if (S.rng() < 0.4) burst(S, l.x, l.y - 34, '#2a1d4f', 1, { kind: 'smoke', add: false, speed: 30, vy: -40, life: 0.8, size: 7 });
  if (l.power > 0) return;
  l.snuffedAt = S.time;
  S.stats.snuffed += 1;
  S.sfx('snuff');
  burst(S, l.x, l.y - 34, '#1a1235', 14, { kind: 'smoke', add: false, speed: 80, vy: -30, life: 1.1, size: 10 });
  ring(S, l.x, l.y, '#6b4cff', 10, 90, 0.5, 4);
  addText(S, l.x, l.y - 58, 'LAMP SNUFFED!', '#a88bff', 17, true);
}

/** The n lit lamps nearest (x, y) go dark at once (boss phase roars). */
export function snuffNearest(S, x, y, n) {
  const lit = S.lamps.filter((l) => l.power > 0).sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y));
  for (const l of lit.slice(0, n)) drainLamp(S, l, 1);
}

/** The lamp the hero could relight from where they stand, or null. */
export function lampInReach(S) {
  const p = S.player;
  if (p.down > 0) return null;
  let best = null;
  let bd = RELIGHT_REACH;
  for (const l of S.lamps) {
    const d = dist(l.x, l.y, p.x, p.y);
    if (l.power < 1 && d < bd) {
      bd = d;
      best = l;
    }
  }
  return best;
}

/** Spark a relight costs: the full price for a dark lamp, less for a half-drained one. */
export function relightCost(S, l) {
  const full = Math.max(1, Math.round(RELIGHT_COST * S.mods.relightCostMul));
  return l.power <= 0 ? full : Math.max(1, Math.ceil(full * (1 - l.power)));
}

export function updateLamps(S, dt, I) {
  const m = S.mods;
  for (const l of S.lamps) {
    l.flick = Math.max(0, l.flick - dt);
    if (l.power <= 0 || !m.lampZap) continue;
    l.zapT -= dt;
    if (l.zapT > 0) continue;
    const r = lampRadius(S, l);
    let target = null;
    let bd = r;
    for (const e of S.enemies) {
      const d = dist(e.x, e.y, l.x, l.y);
      if (!e.dead && !e.grabbed && d < bd) {
        bd = d;
        target = e;
      }
    }
    if (!target) continue;
    l.zapT = 1.25 / m.lampZap;
    arc(S, l.x, l.y - 36, target.x, target.y, '#ffd36b', 3, 0.22);
    damageEnemy(S, target, 22 + 8 * m.lampZap, { noCharge: true, color: '#ffd36b' });
    S.sfx('zap');
  }
  for (const f of S.flares) {
    f.t += dt;
    if (f.follow && S.player.down <= 0) {
      f.x = S.player.x;
      f.y = S.player.y;
    }
  }
  S.flares = S.flares.filter((f) => f.t < f.dur);
  const lit = S.lamps.filter((l) => l.power > 0).length;
  S.wardMul = 1 - lit * WARD_PER_LAMP;
  updateRelight(S, dt, I);
}

function updateRelight(S, dt, I) {
  const l = lampInReach(S);
  S.relightLamp = l;
  if (!l || !I.relight || S.phase !== 'night') {
    S.relightK = Math.max(0, S.relightK - dt * 3);
    return;
  }
  const cost = relightCost(S, l);
  if (S.spark < cost) {
    if (S.time - (S.lastNeedT ?? -9) > 1.2) {
      S.lastNeedT = S.time;
      addText(S, l.x, l.y - 60, `NEED ${cost} SPARK`, '#ff9aa8', 16, true);
      S.sfx('deny');
    }
    return;
  }
  S.relightK += dt / (RELIGHT_TIME * S.mods.relightTimeMul);
  if (S.rng() < dt * 30) {
    const a = S.rng() * TAU;
    burst(S, l.x + Math.cos(a) * 40, l.y + Math.sin(a) * 26, '#ffd36b', 1, { angle: a + Math.PI, spread: 0.2, speed: 90, life: 0.4, size: 3, kind: 'spark' });
  }
  S.sfx('kindle');
  if (S.relightK < 1) return;
  S.relightK = 0;
  S.spark -= cost;
  l.power = 1;
  l.flick = 0.4;
  S.stats.relit += 1;
  S.score += 50;
  S.sfx('relight');
  ring(S, l.x, l.y, '#ffd36b', 10, lampRadius(S, l), 0.55, 6);
  burst(S, l.x, l.y - 34, '#fff1b8', 22, { speed: 260, life: 0.6, size: 3.5, kind: 'spark' });
  addText(S, l.x, l.y - 62, 'LAMP RELIT +50', '#ffe08a', 18, true);
}
