// The six heroes: who they are, their basic attack, their ultimate (and the lingering "zones" an
// ultimate leaves in the world), what a projectile does on hit, and how heroes and their shots
// are drawn.
import { BEACON, TAU, W, H, aoe, chainLightning, clamp, damageEnemy, dist, healBeacon } from './combat.js';
import { addText, arc, burst, flash, glow, hexA, ring, shake } from './particles.js';

export const HEROES = [
  {
    id: 'blaze', name: 'BLAZE', role: 'Fire Brawler', color: '#ff7a2e', light: '#ffd66b', dark: '#7c1d06',
    basic: 'Fireballs explode on impact and set shadows ablaze.',
    ult: 'INFERNO NOVA', ultDesc: 'A blazing shockwave scorches everything around you.',
    hp: 120, speed: 255, rate: 0.33, bars: [5, 3, 2],
  },
  {
    id: 'volt', name: 'VOLT', role: 'Storm Striker', color: '#ffe94a', light: '#fffbd8', dark: '#6e5200',
    basic: 'Rapid bolts that chain to two nearby shadows.',
    ult: 'THUNDERSTORM', ultDesc: 'Lightning rains on every shadow around you.',
    hp: 95, speed: 285, rate: 0.2, bars: [4, 5, 2],
  },
  {
    id: 'frost', name: 'FROST', role: 'Ice Warden', color: '#6fe6ff', light: '#e6fcff', dark: '#0b4870',
    basic: 'Piercing ice shards slow shadows down.',
    ult: 'ABSOLUTE ZERO', ultDesc: 'Freeze every shadow nearby. Frozen foes take +50% damage.',
    hp: 110, speed: 250, rate: 0.27, bars: [3, 3, 4],
  },
  {
    id: 'gale', name: 'GALE', role: 'Wind Dancer', color: '#6dffbe', light: '#e6fff4', dark: '#0b6646',
    basic: 'Wide wind blades cut through crowds and push them back.',
    ult: 'CYCLONE', ultDesc: 'A tornado follows your aim, sucking shadows in.',
    hp: 100, speed: 300, rate: 0.32, bars: [3, 5, 3],
  },
  {
    id: 'mind', name: 'MIND', role: 'Telekinetic', color: '#c77dff', light: '#f3dfff', dark: '#45137a',
    basic: 'Homing psychic orbs that hunt shadows down.',
    ult: 'MIND HURL', ultDesc: 'Lift the shadows at your aim and hurl them like missiles.',
    hp: 100, speed: 260, rate: 0.3, bars: [4, 3, 3],
  },
  {
    id: 'bloom', name: 'BLOOM', role: 'City Healer', color: '#7dff6e', light: '#f0ffe0', dark: '#1b6418', accent: '#ff7ad9',
    basic: 'Seed shots heal the Beacon with every hit.',
    ult: 'SANCTUARY', ultDesc: 'Restore the Beacon and grow a garden that hurts shadows.',
    hp: 115, speed: 265, rate: 0.25, bars: [2, 3, 5],
  },
];

const BASIC = {
  blaze: { kind: 'fire', speed: 640, r: 9, dmg: 16, life: 0.9, burn: 7, explodeR: 50 },
  volt: { kind: 'bolt', speed: 1050, r: 6, dmg: 9, life: 0.6, chain: 2 },
  frost: { kind: 'ice', speed: 780, r: 7, dmg: 13, life: 0.85, pierce: 1, slow: 0.45 },
  gale: { kind: 'wind', speed: 560, r: 20, dmg: 14, life: 0.62, pierce: 99, knock: 320 },
  mind: { kind: 'psy', speed: 540, r: 10, dmg: 14, life: 1.4, homing: 7 },
  bloom: { kind: 'seed', speed: 700, r: 8, dmg: 12, life: 0.9, heal: 1.6 },
};

export function heroAttack(S) {
  const p = S.player;
  const h = S.hero;
  const m = S.mods;
  const base = BASIC[h.id];
  const n = 1 + m.multishot;
  const each = n > 1 ? 0.85 : 1;
  for (let i = 0; i < n; i += 1) {
    const a = p.aim + (i - (n - 1) / 2) * 0.16;
    S.shots.push({
      ...base,
      x: p.x + Math.cos(a) * 18,
      y: p.y + Math.sin(a) * 18,
      vx: Math.cos(a) * base.speed,
      vy: Math.sin(a) * base.speed,
      a,
      dmg: base.dmg * m.dmgMul * each,
      pierce: (base.pierce ?? 0) + m.pierce,
      hit: [],
      t: 0,
      color: h.color,
      src: 'hero',
    });
  }
  p.fireT = 0.12;
  S.sfx(`shot_${h.id}`);
  burst(S, p.x + Math.cos(p.aim) * 20, p.y + Math.sin(p.aim) * 20, h.color, 3, { angle: p.aim, spread: 0.8, speed: 160, life: 0.18, size: 2.5 });
}

export function onShotHit(S, s, e) {
  const sp = Math.hypot(s.vx, s.vy) || 1;
  const k = s.knock ?? 45;
  damageEnemy(S, e, s.dmg, { canCrit: s.src === 'hero', color: s.color, kx: (s.vx / sp) * k, ky: (s.vy / sp) * k });
  if (s.burn) {
    e.burnT = 2.4;
    e.burnDps = s.burn * S.mods.dmgMul;
  }
  if (s.slow) {
    e.slowT = 1.8;
    e.slowAmt = Math.max(e.slowAmt, s.slow);
    burst(S, e.x, e.y, '#bff4ff', 5, { kind: 'shard', speed: 160, life: 0.4, size: 3 });
  }
  if (s.explodeR) {
    aoe(S, s.x, s.y, s.explodeR, s.dmg * 0.55, { skip: e, color: s.color });
    ring(S, s.x, s.y, '#ffb347', 6, s.explodeR, 0.3, 5);
    burst(S, s.x, s.y, '#ff9a3c', 10, { speed: 200, life: 0.35, size: 4 });
  }
  if (s.chain) chainLightning(S, e, s.chain, s.dmg * 0.6, s.color);
  if (s.heal) {
    healBeacon(S, s.heal);
    burst(S, e.x, e.y - 8, '#8dff7a', 1, { kind: 'plus', speed: 30, vy: -50, life: 0.7, size: 5, drag: 1 });
  }
  if (s.src !== 'hero') return;
  if (S.mods.chain) chainLightning(S, e, S.mods.chain, s.dmg * 0.5, '#9fe8ff');
  if (S.mods.explode) {
    aoe(S, e.x, e.y, 58, s.dmg * 0.4 * S.mods.explode, { skip: e, quiet: true });
    ring(S, e.x, e.y, '#ffcf6b', 4, 58, 0.25, 3);
  }
}

// ---------------------------------------------------------------- ultimates

export function heroUltimate(S) {
  const p = S.player;
  const h = S.hero;
  const pw = S.mods.ultPower;
  p.ult = 0;
  S.stats.ults += 1;
  S.sfx(`ult_${h.id}`);
  shake(S, 13);
  flash(S, h.color, 0.32);
  S.ultFx = { name: h.ult, color: h.color, t: 0 };
  ring(S, p.x, p.y, h.color, 10, 120, 0.5, 8);
  switch (h.id) {
    case 'blaze': {
      S.zones.push({ type: 'nova', x: p.x, y: p.y, t: 0, dur: 0.75, r: 0, maxR: 300 * pw, hit: new Set(), dmg: 95 * pw, pw });
      for (let i = 0; i < 20; i += 1) {
        const a = (i / 20) * TAU;
        S.shots.push({ ...BASIC.blaze, x: p.x, y: p.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, a, dmg: 22 * pw * S.mods.dmgMul, pierce: 0, hit: [], t: 0, color: h.color, src: 'ult', life: 1.1 });
      }
      break;
    }
    case 'volt':
      S.zones.push({ type: 'storm', x: p.x, y: p.y, t: 0, dur: 3.8 * Math.sqrt(pw), tick: 0, pw });
      break;
    case 'frost':
      S.zones.push({ type: 'frost', x: p.x, y: p.y, t: 0, dur: 0.9, r: 0, maxR: 560 * pw, hit: new Set(), pw });
      break;
    case 'gale': {
      const d = Math.min(160, dist(p.x, p.y, p.aimX, p.aimY));
      S.zones.push({ type: 'tornado', x: p.x + Math.cos(p.aim) * d, y: p.y + Math.sin(p.aim) * d, t: 0, dur: 5.5, r: 100 * pw, tick: 0, pw });
      break;
    }
    case 'mind': {
      const cx = clamp(p.aimX, 40, W - 40);
      const cy = clamp(p.aimY, 40, H - 40);
      const victims = S.enemies
        .filter((e) => !e.dead && !e.boss && !e.thrown && dist(e.x, e.y, cx, cy) < 240 * pw)
        .sort((a, b) => dist(a.x, a.y, cx, cy) - dist(b.x, b.y, cx, cy))
        .slice(0, Math.round(10 * pw));
      for (const v of victims) {
        v.grabbed = true;
        v.lift = 0;
      }
      for (const e of S.enemies) {
        if (e.boss && !e.dead && dist(e.x, e.y, cx, cy) < 260 * pw) damageEnemy(S, e, 160 * pw, { noCharge: true, color: h.color });
      }
      ring(S, cx, cy, h.color, 240 * pw, 20, 0.5, 6);
      S.zones.push({ type: 'psy', x: cx, y: cy, t: 0, dur: 0.9, victims, pw });
      break;
    }
    case 'bloom': {
      healBeacon(S, S.beacon.max * 0.3 * pw);
      p.hp = p.maxHp;
      S.zones.push({ type: 'garden', x: BEACON.x, y: BEACON.y, t: 0, dur: 7, r: 270 * pw, tick: 0, pw });
      burst(S, BEACON.x, BEACON.y, '#8dff7a', 30, { kind: 'plus', speed: 260, life: 1.1, size: 7, drag: 2 });
      burst(S, BEACON.x, BEACON.y, '#ff8ade', 30, { kind: 'petal', speed: 320, life: 1.2, size: 6, drag: 2 });
      addText(S, BEACON.x, BEACON.y - 70, `+${Math.round(S.beacon.max * 0.3 * pw)}`, '#8dff7a', 28, true);
      break;
    }
    default:
  }
}

export function updateZones(S, dt) {
  const p = S.player;
  for (const z of S.zones) {
    z.t += dt;
    const k = Math.min(1, z.t / z.dur);
    switch (z.type) {
      case 'nova': {
        z.r = z.maxR * (1 - (1 - k) * (1 - k));
        for (const e of S.enemies) {
          if (e.dead || z.hit.has(e.id) || dist(e.x, e.y, z.x, z.y) > z.r + e.r) continue;
          z.hit.add(e.id);
          const d = dist(e.x, e.y, z.x, z.y) || 1;
          damageEnemy(S, e, z.dmg, { noCharge: true, color: '#ffb347', kx: ((e.x - z.x) / d) * 520, ky: ((e.y - z.y) / d) * 520 });
          e.burnT = 3;
          e.burnDps = 14 * z.pw;
        }
        for (let i = 0; i < 4; i += 1) {
          const a = S.rng() * TAU;
          burst(S, z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r, S.rng() < 0.5 ? '#ff7a2e' : '#ffd66b', 1, { angle: a, spread: 0.3, speed: 260, life: 0.28, size: 6, drag: 2 });
        }
        break;
      }
      case 'storm': {
        z.x = p.x;
        z.y = p.y;
        z.tick -= dt;
        if (z.tick > 0) break;
        z.tick = 0.07;
        const near = S.enemies.filter((e) => !e.dead && dist(e.x, e.y, p.x, p.y) < 600);
        let x;
        let y;
        if (near.length) {
          const e = near[Math.floor(S.rng() * near.length)];
          x = e.x;
          y = e.y;
          damageEnemy(S, e, 42 * z.pw, { noCharge: true, color: '#ffe94a' });
          aoe(S, x, y, 46, 14 * z.pw, { noCharge: true, skip: e, quiet: true });
          e.slowT = 0.5;
          e.slowAmt = Math.max(e.slowAmt, 0.5);
        } else {
          x = p.x + (S.rng() - 0.5) * 600;
          y = p.y + (S.rng() - 0.5) * 400;
        }
        S.bolts.push({ x, y, t: 0, seed: S.rng() * 1000 });
        burst(S, x, y, '#fff7a0', 8, { kind: 'spark', speed: 300, life: 0.3, size: 3 });
        ring(S, x, y, '#ffe94a', 4, 50, 0.25, 4);
        S.sfx('zap');
        shake(S, 3);
        break;
      }
      case 'frost': {
        z.r = z.maxR * (1 - (1 - k) * (1 - k) * (1 - k));
        for (const e of S.enemies) {
          if (e.dead || z.hit.has(e.id) || dist(e.x, e.y, z.x, z.y) > z.r + e.r) continue;
          z.hit.add(e.id);
          damageEnemy(S, e, 45 * z.pw, { noCharge: true, color: '#bff4ff' });
          if (e.boss) {
            e.slowT = 3;
            e.slowAmt = 0.6;
          } else {
            e.frozenT = 3.2 * Math.sqrt(z.pw);
          }
          burst(S, e.x, e.y, '#dff9ff', 6, { kind: 'shard', speed: 180, life: 0.6, size: 4 });
        }
        break;
      }
      case 'tornado': {
        const dx = p.aimX - z.x;
        const dy = p.aimY - z.y;
        const d = Math.hypot(dx, dy);
        if (d > 4) {
          z.x += (dx / d) * Math.min(d, 175 * dt);
          z.y += (dy / d) * Math.min(d, 175 * dt);
        }
        const pull = z.r * 2.3;
        for (const e of S.enemies) {
          if (e.dead || e.boss || e.grabbed) continue;
          const ed = dist(e.x, e.y, z.x, z.y);
          if (ed > pull || ed < 1) continue;
          const f = (1 - ed / pull) * 340 + 60;
          const nx = (z.x - e.x) / ed;
          const ny = (z.y - e.y) / ed;
          e.x += (nx * f - ny * f * 0.8) * dt;
          e.y += (ny * f + nx * f * 0.8) * dt;
        }
        z.tick -= dt;
        if (z.tick <= 0) {
          z.tick = 0.25;
          aoe(S, z.x, z.y, z.r, 20 * z.pw, { noCharge: true, color: '#b6ffe0' });
          S.sfx('wind');
        }
        for (let i = 0; i < 3; i += 1) {
          const a = S.rng() * TAU;
          const rr = z.r * (0.3 + S.rng() * 0.9);
          burst(S, z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, '#c9ffe6', 1, { angle: a + 1.6, spread: 0.2, speed: 260, life: 0.45, size: 2.5, kind: 'spark' });
        }
        break;
      }
      case 'psy': {
        const n = z.victims.length;
        const lift = Math.min(1, z.t / 0.3);
        z.victims.forEach((v, i) => {
          if (v.dead) return;
          const a = z.t * 5 + (i / Math.max(1, n)) * TAU;
          const rr = 34 + n * 4;
          v.x += (z.x + Math.cos(a) * rr - v.x) * Math.min(1, dt * 9);
          v.y += (z.y + Math.sin(a) * rr * 0.6 - v.y) * Math.min(1, dt * 9);
          v.lift = lift;
        });
        if (z.t >= z.dur) {
          const a0 = Math.atan2(z.y - p.y, z.x - p.x);
          const dirA = dist(z.x, z.y, p.x, p.y) < 30 ? p.aim : a0;
          z.victims.forEach((v, i) => {
            if (v.dead) return;
            const a = dirA + (i - (n - 1) / 2) * 0.09;
            v.grabbed = false;
            v.thrown = 0.55;
            v.tvx = Math.cos(a) * 950;
            v.tvy = Math.sin(a) * 950;
            v.throwDmg = 110 * z.pw;
            v.thrownHit = [];
          });
          if (n) S.sfx('throw');
        }
        break;
      }
      case 'garden': {
        z.tick -= dt;
        if (z.tick > 0) break;
        z.tick = 0.25;
        for (const e of S.enemies) {
          if (e.dead || dist(e.x, e.y, z.x, z.y) > z.r + e.r) continue;
          damageEnemy(S, e, 10 * z.pw, { noCharge: true, color: '#8dff7a', quiet: S.rng() < 0.6 });
          e.slowT = 0.4;
          e.slowAmt = Math.max(e.slowAmt, 0.35);
        }
        healBeacon(S, 5 * z.pw);
        if (p.down <= 0 && dist(p.x, p.y, z.x, z.y) < z.r) p.hp = Math.min(p.maxHp, p.hp + 3);
        for (let i = 0; i < 3; i += 1) {
          const a = S.rng() * TAU;
          const rr = Math.sqrt(S.rng()) * z.r;
          burst(S, z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, i === 0 ? '#ff8ade' : '#8dff7a', 1, { kind: i === 0 ? 'petal' : 'plus', speed: 20, vy: -40, life: 0.9, size: 5, drag: 1 });
        }
        break;
      }
      default:
    }
  }
  S.zones = S.zones.filter((z) => z.t < z.dur);
  for (const b of S.bolts) b.t += dt;
  S.bolts = S.bolts.filter((b) => b.t < 0.3);
}

// ---------------------------------------------------------------- drawing

/** A hero seen from above, facing `aim`. o: scale, moving, fire (0..1), alpha. */
export function drawHero(ctx, h, x, y, aim, t, o = {}) {
  const s = o.scale ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(0, 13, 19, 8, 0, 0, TAU);
  ctx.fill();
  glow(ctx, 0, -2, 54, h.color, 0.4 + (o.fire ?? 0) * 0.4);
  const bob = Math.sin(t * (o.moving ? 15 : 3)) * (o.moving ? 1.6 : 0.7);
  ctx.translate(0, -3 + bob);
  ctx.rotate(aim);
  const wave = Math.sin(t * 9) * 3;
  // cape
  ctx.fillStyle = h.dark;
  ctx.strokeStyle = h.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-1, -12);
  ctx.quadraticCurveTo(-14, -15 + wave, -25, -11 + wave * 1.3);
  ctx.quadraticCurveTo(-29, 0 - wave, -25, 11 - wave * 1.3);
  ctx.quadraticCurveTo(-16, 15 - wave, -1, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // arms
  ctx.lineCap = 'round';
  ctx.strokeStyle = h.color;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(1, 12);
  ctx.lineTo(15, 7);
  ctx.moveTo(1, -12);
  ctx.lineTo(15, -7);
  ctx.stroke();
  ctx.fillStyle = h.light;
  for (const sy of [-6.5, 6.5]) {
    ctx.beginPath();
    ctx.arc(16.5, sy, 3.6, 0, TAU);
    ctx.fill();
  }
  glow(ctx, 19, 0, 14 + (o.fire ?? 0) * 14, h.color, 0.7);
  // torso
  const g = ctx.createLinearGradient(0, -15, 0, 15);
  g.addColorStop(0, h.light);
  g.addColorStop(0.35, h.color);
  g.addColorStop(1, h.dark);
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(12,6,30,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 15.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // head / helmet
  ctx.fillStyle = '#1d1636';
  ctx.beginPath();
  ctx.arc(1, 0, 8.6, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = h.light;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(1, 0, 6, -0.95, 0.95);
  ctx.stroke();
  drawSignature(ctx, h, t);
  ctx.restore();
}

/** A front-view hero portrait for menus and the HUD: head centred at (x, y), body below. */
export function drawPortrait(ctx, h, x, y, s, t, o = {}) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 2) * 1.5);
  ctx.scale(s, s);
  glow(ctx, 0, 30, 110, h.color, 0.32 + (o.power ?? 0) * 0.4);
  const w = Math.sin(t * 3) * 4;
  // cape
  const cg = ctx.createLinearGradient(0, 20, 0, 100);
  cg.addColorStop(0, h.dark);
  cg.addColorStop(1, hexA(h.dark, 0.6));
  ctx.fillStyle = cg;
  ctx.strokeStyle = h.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-26, 22);
  ctx.quadraticCurveTo(-48 - w, 66, -44 + w, 100);
  ctx.lineTo(-14, 94 + w);
  ctx.lineTo(14, 100 - w);
  ctx.lineTo(44 - w, 94);
  ctx.quadraticCurveTo(48 + w, 66, 26, 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // arms
  ctx.lineCap = 'round';
  for (const sx of [-1, 1]) {
    ctx.strokeStyle = h.dark;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(sx * 27, 30);
    ctx.lineTo(sx * 40, 68);
    ctx.stroke();
    ctx.strokeStyle = h.color;
    ctx.lineWidth = 8;
    ctx.stroke();
    glow(ctx, sx * 41, 72, 26 + (o.power ?? 0) * 18, h.color, 0.9);
    ctx.fillStyle = h.light;
    ctx.beginPath();
    ctx.arc(sx * 41, 72, 6.5, 0, TAU);
    ctx.fill();
  }
  // torso
  const tg = ctx.createLinearGradient(-30, 20, 30, 86);
  tg.addColorStop(0, h.light);
  tg.addColorStop(0.35, h.color);
  tg.addColorStop(1, h.dark);
  ctx.fillStyle = tg;
  ctx.strokeStyle = 'rgba(14,6,30,0.9)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-31, 30);
  ctx.quadraticCurveTo(-28, 19, 0, 17);
  ctx.quadraticCurveTo(28, 19, 31, 30);
  ctx.lineTo(22, 86);
  ctx.quadraticCurveTo(0, 92, -22, 86);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1d1636';
  ctx.fillRect(-23, 72, 46, 7);
  ctx.fillStyle = h.light;
  ctx.fillRect(-5, 71, 10, 9);
  // emblem
  ctx.fillStyle = '#1d1636';
  ctx.strokeStyle = h.light;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 33);
  ctx.lineTo(13, 46);
  ctx.lineTo(0, 59);
  ctx.lineTo(-13, 46);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  emblem(ctx, h, 0, 46);
  // neck and head
  ctx.fillStyle = '#d9a483';
  ctx.fillRect(-6, 12, 12, 10);
  const hg = ctx.createRadialGradient(-6, -8, 3, 0, 0, 22);
  hg.addColorStop(0, '#ffe0c8');
  hg.addColorStop(1, '#e0a988');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 20, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(14,6,30,0.85)';
  ctx.stroke();
  // mask and eyes
  ctx.fillStyle = h.id === 'blaze' ? '#2a0e0a' : h.dark;
  ctx.beginPath();
  ctx.moveTo(-22, -6);
  ctx.quadraticCurveTo(0, -12, 22, -6);
  ctx.lineTo(18, 5);
  ctx.quadraticCurveTo(0, 1, -18, 5);
  ctx.closePath();
  ctx.fill();
  for (const sx of [-1, 1]) {
    glow(ctx, sx * 8, -1, 12, h.color, 0.9);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(sx * 8, -1, 5, 2.4, sx * -0.15, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#8a4a3a';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 8, 5, 0.3, Math.PI - 0.3);
  ctx.stroke();
  hair(ctx, h, t);
  ctx.restore();
}

function emblem(ctx, h, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = h.light;
  ctx.strokeStyle = h.light;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  switch (h.id) {
    case 'blaze':
      ctx.moveTo(0, -8);
      ctx.quadraticCurveTo(7, 0, 4, 6);
      ctx.quadraticCurveTo(0, 9, -4, 6);
      ctx.quadraticCurveTo(-6, 0, 0, -8);
      ctx.fill();
      break;
    case 'volt':
      ctx.moveTo(2, -9);
      ctx.lineTo(-5, 1);
      ctx.lineTo(0, 1);
      ctx.lineTo(-2, 9);
      ctx.lineTo(5, -1);
      ctx.lineTo(0, -1);
      ctx.closePath();
      ctx.fill();
      break;
    case 'frost':
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI;
        ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7);
        ctx.lineTo(-Math.cos(a) * 7, -Math.sin(a) * 7);
      }
      ctx.stroke();
      break;
    case 'gale':
      ctx.arc(0, 0, 6, 0, 4.5);
      ctx.moveTo(2.5, 0);
      ctx.arc(0, 0, 2.5, 0, 4);
      ctx.stroke();
      break;
    case 'mind':
      ctx.ellipse(0, 0, 7, 4, 0, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, TAU);
      ctx.fill();
      break;
    default:
      ctx.fillRect(-2, -7, 4, 14);
      ctx.fillRect(-7, -2, 14, 4);
  }
  ctx.restore();
}

function hair(ctx, h, t) {
  ctx.lineJoin = 'round';
  switch (h.id) {
    case 'blaze': {
      glow(ctx, 0, -26, 40, '#ff7a2e', 0.8);
      for (let i = -2; i <= 2; i += 1) {
        const f = Math.sin(t * 9 + i * 1.7) * 4;
        const g = ctx.createLinearGradient(0, -48, 0, -10);
        g.addColorStop(0, '#fff2a0');
        g.addColorStop(0.5, '#ff9a2e');
        g.addColorStop(1, '#d1320c');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(i * 7 - 7, -10);
        ctx.quadraticCurveTo(i * 9 + f, -30 - Math.abs(i) * -3, i * 6 + f * 1.5, -46 + Math.abs(i) * 7);
        ctx.quadraticCurveTo(i * 7 + 6, -26, i * 7 + 7, -10);
        ctx.fill();
      }
      break;
    }
    case 'volt':
      ctx.fillStyle = '#ffe94a';
      ctx.strokeStyle = '#6e5200';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-20, -4);
      ctx.lineTo(-26, -20);
      ctx.lineTo(-14, -18);
      ctx.lineTo(-16, -36);
      ctx.lineTo(-4, -24);
      ctx.lineTo(2, -44);
      ctx.lineTo(8, -24);
      ctx.lineTo(20, -36);
      ctx.lineTo(16, -16);
      ctx.lineTo(27, -18);
      ctx.lineTo(20, -4);
      ctx.quadraticCurveTo(0, -14, -20, -4);
      ctx.fill();
      ctx.stroke();
      if (Math.sin(t * 13) > 0) {
        ctx.strokeStyle = '#fffbd8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(24, -30);
        ctx.lineTo(30, -36);
        ctx.lineTo(28, -40);
        ctx.lineTo(36, -46);
        ctx.stroke();
      }
      break;
    case 'frost':
      ctx.fillStyle = '#eaf9ff';
      ctx.beginPath();
      ctx.moveTo(-20, 2);
      ctx.quadraticCurveTo(-24, -24, 0, -22);
      ctx.quadraticCurveTo(24, -24, 20, 2);
      ctx.quadraticCurveTo(10, -14, -20, 2);
      ctx.fill();
      for (const [cx, hgt] of [[-11, 14], [0, 24], [11, 14]]) {
        ctx.fillStyle = '#bff4ff';
        ctx.strokeStyle = '#2aa9d6';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 5, -18);
        ctx.lineTo(cx, -18 - hgt);
        ctx.lineTo(cx + 5, -18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      glow(ctx, 0, -38, 20, '#6fe6ff', 0.8);
      break;
    case 'gale': {
      ctx.fillStyle = '#4fe0a6';
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.quadraticCurveTo(-22, -26, 4, -24);
      ctx.quadraticCurveTo(26, -22, 40 + Math.sin(t * 6) * 4, -30);
      ctx.quadraticCurveTo(30, -12, 20, -4);
      ctx.quadraticCurveTo(0, -16, -20, 0);
      ctx.fill();
      ctx.strokeStyle = '#6dffbe';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-12, 18);
      ctx.quadraticCurveTo(20, 22, 44, 14 + Math.sin(t * 7) * 6);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(230,255,244,0.7)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 2; i += 1) {
        const a = t * 4 + i * Math.PI;
        ctx.beginPath();
        ctx.ellipse(0, -4, 32, 12, 0, a, a + 1.4);
        ctx.stroke();
      }
      break;
    }
    case 'mind':
      ctx.fillStyle = '#5a1fa0';
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.quadraticCurveTo(-22, -26, 0, -24);
      ctx.quadraticCurveTo(22, -26, 20, 0);
      ctx.quadraticCurveTo(14, -14, 0, -12);
      ctx.quadraticCurveTo(-14, -14, -20, 0);
      ctx.fill();
      glow(ctx, 0, -14, 22, '#c77dff', 1);
      ctx.fillStyle = '#f3dfff';
      ctx.beginPath();
      ctx.moveTo(0, -19);
      ctx.lineTo(4, -14);
      ctx.lineTo(0, -9);
      ctx.lineTo(-4, -14);
      ctx.fill();
      for (let i = 0; i < 3; i += 1) {
        const a = t * 1.8 + (i / 3) * TAU;
        const ox = Math.cos(a) * 34;
        const oy = -10 + Math.sin(a) * 10;
        glow(ctx, ox, oy, 14, '#c77dff', 0.9);
        ctx.fillStyle = '#f3dfff';
        ctx.beginPath();
        ctx.arc(ox, oy, 3.5, 0, TAU);
        ctx.fill();
      }
      break;
    default: {
      for (let i = 0; i < 7; i += 1) {
        const a = Math.PI + (i / 6) * Math.PI;
        ctx.save();
        ctx.translate(Math.cos(a) * 17, Math.sin(a) * 15 - 4);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = i % 2 ? '#3fbf4a' : '#7dff6e';
        ctx.beginPath();
        ctx.ellipse(0, -6, 6, 11, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#ff7ad9';
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * TAU + t * 0.5;
        ctx.beginPath();
        ctx.arc(14 + Math.cos(a) * 5, -18 + Math.sin(a) * 5, 4, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ffe96b';
      ctx.beginPath();
      ctx.arc(14, -18, 2.5, 0, TAU);
      ctx.fill();
    }
  }
}

function drawSignature(ctx, h, t) {
  switch (h.id) {
    case 'blaze': {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i += 1) {
        const f = Math.sin(t * 18 + i * 2.1) * 3;
        const yy = (i - 1) * 4.5;
        ctx.fillStyle = i === 1 ? '#ffd66b' : '#ff6a1e';
        ctx.beginPath();
        ctx.moveTo(-2, yy - 3.5);
        ctx.quadraticCurveTo(-12, yy + f * 0.4, -20 - f, yy + f * 0.6);
        ctx.quadraticCurveTo(-12, yy + 4, -2, yy + 3.5);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'volt': {
      ctx.fillStyle = '#ffe94a';
      ctx.strokeStyle = '#6e5200';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(1, -4);
      ctx.lineTo(-3, -1);
      ctx.lineTo(-8, -6);
      ctx.lineTo(-7, -1);
      ctx.lineTo(-16, -3);
      ctx.lineTo(-9, 2);
      ctx.lineTo(-4, 1);
      ctx.lineTo(1, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (Math.sin(t * 23) > 0.3) {
        ctx.strokeStyle = '#fffbd8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-10, 9);
        ctx.lineTo(-16, 13);
        ctx.lineTo(-14, 17);
        ctx.stroke();
      }
      break;
    }
    case 'frost': {
      ctx.fillStyle = '#dff9ff';
      ctx.strokeStyle = '#2aa9d6';
      ctx.lineWidth = 1;
      for (const [cx, cy, a] of [[-3, -6, -2.2], [-6, 0, Math.PI], [-3, 6, 2.2]]) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(0, -2.6);
        ctx.lineTo(-2, 0);
        ctx.lineTo(0, 2.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'gale': {
      ctx.strokeStyle = hexA('#b6ffe0', 0.8);
      ctx.lineWidth = 2;
      for (let i = 0; i < 2; i += 1) {
        const a = t * 6 + i * Math.PI;
        ctx.beginPath();
        ctx.arc(0, 0, 21, a, a + 1.6);
        ctx.stroke();
      }
      ctx.strokeStyle = '#6dffbe';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-5, 4);
      ctx.quadraticCurveTo(-16, 8 + Math.sin(t * 10) * 4, -26, 4 + Math.sin(t * 10 + 1) * 5);
      ctx.stroke();
      break;
    }
    case 'mind': {
      ctx.strokeStyle = hexA('#e7b8ff', 0.85);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(1, 0, 12, 12, 0, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#f3dfff';
      for (let i = 0; i < 2; i += 1) {
        const a = t * 3.5 + i * Math.PI;
        ctx.beginPath();
        ctx.arc(1 + Math.cos(a) * 15, Math.sin(a) * 15, 2.6, 0, TAU);
        ctx.fill();
        glow(ctx, 1 + Math.cos(a) * 15, Math.sin(a) * 15, 9, '#c77dff', 0.9);
      }
      break;
    }
    case 'bloom': {
      ctx.fillStyle = '#4fd85a';
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * TAU + 0.78;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(10, 0, 5, 2.4, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#ff7ad9';
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * TAU + t;
        ctx.beginPath();
        ctx.arc(-2 + Math.cos(a) * 3, Math.sin(a) * 3, 2.3, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ffe96b';
      ctx.beginPath();
      ctx.arc(-2, 0, 1.6, 0, TAU);
      ctx.fill();
      break;
    }
    default:
  }
}

export function drawShot(ctx, s, t) {
  ctx.save();
  ctx.translate(s.x, s.y);
  switch (s.kind) {
    case 'fire':
      glow(ctx, 0, 0, 30, '#ff7a2e', 0.9);
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, TAU);
      ctx.fill();
      break;
    case 'bolt': {
      ctx.rotate(s.a);
      glow(ctx, 0, 0, 22, '#ffe94a', 0.9);
      ctx.strokeStyle = '#fffbd8';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      const j = Math.sin(t * 60 + s.x) * 3;
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(-16, j);
      ctx.lineTo(-8, -j);
      ctx.lineTo(0, j * 0.5);
      ctx.lineTo(8, 0);
      ctx.stroke();
      break;
    }
    case 'ice':
      ctx.rotate(s.a);
      glow(ctx, -4, 0, 22, '#6fe6ff', 0.8);
      ctx.fillStyle = '#e6fcff';
      ctx.strokeStyle = '#6fe6ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-4, -4.5);
      ctx.lineTo(-14, 0);
      ctx.lineTo(-4, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'wind': {
      ctx.rotate(s.a);
      const a = 1 - s.t / s.life;
      ctx.globalAlpha = 0.35 + a * 0.65;
      glow(ctx, 0, 0, 34, '#6dffbe', 0.6);
      ctx.strokeStyle = '#e6fff4';
      ctx.lineCap = 'round';
      for (const [rr, w] of [[22, 4], [15, 2.5]]) {
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.arc(-rr + 8, 0, rr, -1.1, 1.1);
        ctx.stroke();
      }
      break;
    }
    case 'psy':
      glow(ctx, 0, 0, 30, '#c77dff', 0.9);
      ctx.fillStyle = '#f3dfff';
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#d9a4ff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 10, t * 12, t * 12 + 4.2);
      ctx.stroke();
      break;
    case 'seed':
      ctx.rotate(s.a + s.t * 14);
      glow(ctx, 0, 0, 24, '#7dff6e', 0.85);
      ctx.fillStyle = '#eaffd8';
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 3.6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ff7ad9';
      ctx.beginPath();
      ctx.ellipse(-4, 0, 3, 1.6, 0.6, 0, TAU);
      ctx.fill();
      break;
    default:
      ctx.rotate(s.a);
      glow(ctx, 0, 0, 16, '#8ff3ff', 0.8);
      ctx.fillStyle = '#e8fdff';
      ctx.fillRect(-9, -1.5, 14, 3);
  }
  ctx.restore();
}

/** Ultimate effects: `under` is drawn on the ground below shadows, the rest above them. */
export function drawZones(ctx, S, under) {
  for (const z of S.zones) {
    const k = z.t / z.dur;
    const fade = Math.min(1, (z.dur - z.t) * 3);
    ctx.save();
    if (under) {
      if (z.type === 'garden') {
        ctx.globalAlpha = Math.min(1, z.t * 3) * fade;
        const g = ctx.createRadialGradient(z.x, z.y, z.r * 0.2, z.x, z.y, z.r);
        g.addColorStop(0, 'rgba(125,255,110,0.05)');
        g.addColorStop(0.85, 'rgba(125,255,110,0.16)');
        g.addColorStop(1, 'rgba(125,255,110,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,255,140,0.55)';
        ctx.setLineDash([10, 12]);
        ctx.lineDashOffset = -S.time * 30;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 0; i < 18; i += 1) {
          const a = (i / 18) * TAU + 0.3;
          const rr = z.r * (0.45 + ((i * 37) % 10) / 20);
          drawFlower(ctx, z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, Math.min(1, z.t * 2 - i * 0.04), i % 3 === 0 ? '#ffe96b' : '#ff7ad9');
        }
      } else if (z.type === 'frost') {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = 'rgba(190,240,255,0.16)';
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, TAU);
        ctx.fill();
      } else if (z.type === 'tornado') {
        ctx.globalAlpha = fade * 0.5;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(z.x, z.y + 10, z.r, z.r * 0.5, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      continue;
    }
    switch (z.type) {
      case 'nova': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - k * 0.7;
        const g = ctx.createRadialGradient(z.x, z.y, z.r * 0.55, z.x, z.y, z.r);
        g.addColorStop(0, 'rgba(255,120,40,0)');
        g.addColorStop(0.75, 'rgba(255,120,40,0.35)');
        g.addColorStop(0.94, 'rgba(255,220,120,0.85)');
        g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#fff1b8';
        ctx.lineWidth = 6 * (1 - k) + 1.5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,140,60,0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r * 0.82, 0, TAU);
        ctx.stroke();
        glow(ctx, z.x, z.y, z.r * 0.7, '#ff9a3c', (1 - k) * 0.7);
        break;
      }
      case 'frost': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#bff4ff';
        ctx.lineWidth = 10 * (1 - k) + 2;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, TAU);
        ctx.stroke();
        for (let i = 0; i < 24; i += 1) {
          const a = (i / 24) * TAU;
          ctx.save();
          ctx.translate(z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r);
          ctx.rotate(a);
          ctx.fillStyle = '#e6fcff';
          ctx.beginPath();
          ctx.moveTo(18, 0);
          ctx.lineTo(0, -6);
          ctx.lineTo(-10, 0);
          ctx.lineTo(0, 6);
          ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 'tornado': {
        ctx.globalAlpha = fade;
        glow(ctx, z.x, z.y - 40, z.r * 1.8, '#6dffbe', 0.45 * fade);
        const layers = 10;
        for (let i = 0; i < layers; i += 1) {
          const lay = i / (layers - 1);
          const rr = z.r * (0.25 + lay * 0.95);
          const yy = z.y - lay * 120;
          const sw = Math.sin(z.t * 3 + i * 0.6) * 16 * lay;
          ctx.fillStyle = `rgba(150,255,210,${0.07 + lay * 0.05})`;
          ctx.beginPath();
          ctx.ellipse(z.x + sw, yy, rr, rr * 0.3, 0, 0, TAU);
          ctx.fill();
          const st = z.t * (12 - i * 0.6) + i;
          for (const [w, c] of [[5, 'rgba(109,255,190,0.7)'], [2, 'rgba(240,255,250,0.95)']]) {
            ctx.strokeStyle = c;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.ellipse(z.x + sw, yy, rr, rr * 0.3, 0, st, st + 3.6);
            ctx.stroke();
          }
        }
        break;
      }
      case 'psy': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#c77dff';
        ctx.lineWidth = 3;
        const n = z.victims.length;
        for (const v of z.victims) {
          if (v.dead) continue;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.moveTo(S.player.x, S.player.y);
          ctx.quadraticCurveTo((S.player.x + v.x) / 2, (S.player.y + v.y) / 2 - 60, v.x, v.y - 18);
          ctx.stroke();
          glow(ctx, v.x, v.y - 18, v.r * 2.6, '#c77dff', 0.8);
        }
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(z.x, z.y, 40 + n * 4, z.t * 8, z.t * 8 + 4.5);
        ctx.stroke();
        glow(ctx, z.x, z.y, 120, '#c77dff', 0.5);
        break;
      }
      default:
    }
    ctx.restore();
  }
  // lightning strikes from the sky
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  for (const b of S.bolts) {
    const a = 1 - b.t / 0.3;
    for (const [w, c, al] of [[12, '#ffe94a', 0.35], [3.5, '#ffffff', 1]]) {
      ctx.globalAlpha = a * al;
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      let x = b.x + Math.sin(b.seed) * 90;
      ctx.moveTo(x, b.y - 420);
      for (let i = 1; i <= 8; i += 1) {
        x = b.x + Math.sin(b.seed) * 90 * (1 - i / 8) + Math.sin(b.seed * 3 + i * 7.3) * 16 * (i < 8 ? 1 : 0);
        ctx.lineTo(x, b.y - 420 + (420 * i) / 8);
      }
      ctx.stroke();
    }
    glow(ctx, b.x, b.y, 70, '#ffe94a', a);
  }
  ctx.restore();
}

function drawFlower(ctx, x, y, grow, color) {
  if (grow <= 0) return;
  const s = Math.min(1, grow) * 6;
  ctx.fillStyle = '#3fbf4a';
  ctx.beginPath();
  ctx.ellipse(x - s * 0.8, y + s * 0.6, s * 0.8, s * 0.35, -0.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * TAU;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.45, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#fff6b0';
  ctx.beginPath();
  ctx.arc(x, y, s * 0.3, 0, TAU);
  ctx.fill();
}
