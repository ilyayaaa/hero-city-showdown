// Shared rules every system leans on: the arena layout (screen, City Core, building blocks),
// damage to monsters, to the hero and to the City Core, area hits, chain lightning and
// nearest-target queries.
import { addText, arc, burst, shake } from './particles.js';

export const W = 1280;
export const H = 720;
export const TAU = Math.PI * 2;
/** The City Core at the heart of the plaza: monsters want it, the hero defends it. */
export const PLAZA = { x: 640, y: 384, r: 44 };
/** Building blocks in the four corners: walls for the hero and ground monsters. */
export const BUILDINGS = [
  { x: 0, y: 0, w: 300, h: 200 },
  { x: 980, y: 0, w: 300, h: 200 },
  { x: 0, y: 566, w: 300, h: 154 },
  { x: 980, y: 566, w: 300, h: 154 },
];
/** Ultimate meter gained per point of damage dealt (the meter is full at 100). */
export const ULT_PER_DAMAGE = 0.1;

/** A point just off screen in one of the four street openings between the building blocks. */
export function edgePoint(S, side = Math.floor(S.rng() * 4)) {
  const u = S.rng();
  if (side === 0) return { x: 340 + u * 600, y: -30 };
  if (side === 1) return { x: 340 + u * 600, y: H + 30 };
  if (side === 2) return { x: -30, y: 235 + u * 300 };
  return { x: W + 30, y: 235 + u * 300 };
}

export const clamp =(v, a, b) => (v < a ? a : v > b ? b : v);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/** Distance from point p to the segment a-b. */
export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Push a circle (o.x, o.y, radius r) out of every building; true when it touched one. */
export function pushOutOfBuildings(o, r) {
  let touched = false;
  for (const b of BUILDINGS) {
    const cx = clamp(o.x, b.x, b.x + b.w);
    const cy = clamp(o.y, b.y, b.y + b.h);
    const dx = o.x - cx;
    const dy = o.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    touched = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      o.x = cx + (dx / d) * r;
      o.y = cy + (dy / d) * r;
    } else {
      const left = o.x - b.x;
      const right = b.x + b.w - o.x;
      const top = o.y - b.y;
      const bottom = b.y + b.h - o.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) o.x = b.x - r;
      else if (m === right) o.x = b.x + b.w + r;
      else if (m === top) o.y = b.y - r;
      else o.y = b.y + b.h + r;
    }
  }
  return touched;
}

/**
 * Deal damage to a monster. Options: canCrit, noCharge (ultimates do not refill the meter),
 * quiet (no number or sound), color (hit sparks), kx/ky (knockback impulse).
 */
export function damageEnemy(S, e, amount, o = {}) {
  if (e.dead || e.inv > 0 || amount <= 0) return 0;
  let d = amount;
  let crit = false;
  if (o.canCrit && S.mods.crit > 0 && S.rng() < S.mods.crit) {
    d *= 2.5;
    crit = true;
  }
  if (e.frozenT > 0) d *= 1.5;
  e.hp -= d;
  e.flash = 0.1;
  const p = S.player;
  if (!o.noCharge) p.ult = Math.min(100, p.ult + d * ULT_PER_DAMAGE * S.mods.ultGain);
  if (S.mods.lifesteal > 0 && p.down <= 0) p.hp = Math.min(p.maxHp, p.hp + d * S.mods.lifesteal);
  if ((o.kx || o.ky) && !e.boss) {
    e.kx += o.kx / e.mass;
    e.ky += o.ky / e.mass;
  }
  // Ultimates hit dozens of monsters at once: only some of those hits get a number, so it stays readable.
  const showNumber = !o.noCharge || crit || S.rng() < 0.3;
  if (!o.quiet && showNumber) {
    addText(S,e.x + (S.rng() - 0.5) * 16, e.y - e.r - 6, Math.round(d), crit ? '#ffe45c' : '#ffffff', crit ? 22 : 15, crit);
  }
  if (!o.quiet) {
    S.sfx('hit');
    if (o.color) burst(S, e.x, e.y, o.color, crit ? 9 : 4, { speed: 200, life: 0.3, size: 2.5, kind: 'spark' });
  }
  S.stats.damage += d;
  if (e.hp <= 0) {
    e.hp = 0;
    e.dead = true;
  }
  return d;
}

/** Damage every monster within r of (x, y); knock pushes them outward. Returns how many were hit. */
export function aoe(S, x, y, r, dmg, o = {}) {
  let n = 0;
  for (const e of S.enemies) {
    if (e.dead || e === o.skip) continue;
    const d = dist(x, y, e.x, e.y);
    if (d > r + e.r) continue;
    const k = o.knock ?? 0;
    const nx = d > 0.01 ? (e.x - x) / d : 0;
    const ny = d > 0.01 ? (e.y - y) / d : 0;
    damageEnemy(S, e, dmg, { ...o, kx: nx * k, ky: ny * k });
    n += 1;
  }
  return n;
}

export function nearestEnemy(S, x, y, maxD, skip) {
  let best = null;
  let bd = maxD;
  for (const e of S.enemies) {
    if (e.dead || e.grabbed || (skip && skip.has(e.id))) continue;
    const d = dist(x, y, e.x, e.y) - e.r;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** Lightning jumps from `from` to up to n further monsters, each within 150 of the last. */
export function chainLightning(S, from, n, dmg, color) {
  const seen = new Set([from.id]);
  let cur = from;
  for (let i = 0; i < n; i += 1) {
    const next = nearestEnemy(S, cur.x, cur.y, 150, seen);
    if (!next) break;
    seen.add(next.id);
    arc(S, cur.x, cur.y, next.x, next.y, color, 3);
    damageEnemy(S, next, dmg, { color, noCharge: false });
    cur = next;
  }
}

export function hurtPlayer(S, d) {
  const p = S.player;
  if (p.down > 0 || p.inv > 0 || p.dashT > 0 || S.phase === 'upgrade') return false;
  p.hp -= d;
  p.inv = 0.45;
  p.hurtT = 0.3;
  shake(S, 7);
  S.sfx('hurt');
  burst(S, p.x, p.y, '#ff4060', 10, { speed: 220, life: 0.4, size: 3 });
  addText(S, p.x, p.y - 26, `-${Math.round(d)}`, '#ff5a6e', 17);
  if (p.hp <= 0) {
    p.hp = 0;
    p.down = 4;
    S.combo = 0;
    S.sfx('down');
    shake(S, 16);
    burst(S, p.x, p.y, S.hero.color, 40, { speed: 340, life: 0.8, size: 4 });
    addText(S, p.x, p.y - 40, 'KNOCKED OUT!', '#ff5a6e', 22, true);
  }
  return true;
}

export function hurtPlaza(S, d) {
  if (S.result) return;
  const z = S.plaza;
  z.hp = Math.max(0, z.hp - d);
  z.hitT = 0.25;
  S.stats.coreDamage += d;
  if (S.time - z.lastSfx > 0.25) {
    z.lastSfx = S.time;
    S.sfx('core');
    shake(S, 4);
  }
  if (z.hp <= 0) S.result = 'defeat';
}

export function healPlaza(S, amount) {
  const z = S.plaza;
  if (z.hp >= z.max || amount <= 0) return;
  z.hp = Math.min(z.max, z.hp + amount);
  z.healT = 0.4;
}
