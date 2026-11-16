// The monsters: their kinds and stats, how they hunt the hero or march on the City Core, status
// effects (burn, slow, freeze, telekinetic throws), what happens when they die, and how each
// kind is drawn.
import { H, PLAZA, TAU, W, aoe, damageEnemy, dist, hurtPlaza, hurtPlayer, pushOutOfBuildings } from './combat.js';
import { arc, burst, glow, ring, shake } from './particles.js';

/** aggro: how close the hero must be before this kind turns on them (0: always the City Core). */
export const KINDS = {
  grunt: { name: 'Smogling', hp: 34, speed: 78, r: 15, dmg: 8, atk: 0.9, score: 10, mass: 1, aggro: 150, color: '#a35cff' },
  runner: { name: 'Skitter', hp: 18, speed: 178, r: 11, dmg: 5, atk: 0.6, score: 12, mass: 0.6, aggro: 110, color: '#ff3b5c' },
  tank: { name: 'Bruiser', hp: 260, speed: 42, r: 27, dmg: 22, atk: 1.4, score: 45, mass: 5, aggro: 0, color: '#ff8a3c' },
  spitter: { name: 'Spitter', hp: 42, speed: 64, r: 15, dmg: 9, atk: 2.2, score: 20, mass: 1, aggro: 280, range: 260, color: '#9dff4a' },
  splitter: { name: 'Gloop', hp: 70, speed: 58, r: 19, dmg: 10, atk: 1.0, score: 18, mass: 1.5, aggro: 140, color: '#ff4fd8' },
  mini: { name: 'Gloopling', hp: 16, speed: 125, r: 10, dmg: 4, atk: 0.7, score: 5, mass: 0.5, aggro: 120, color: '#ff4fd8' },
  flier: { name: 'Gargoyle', hp: 26, speed: 120, r: 14, dmg: 7, atk: 0.9, score: 15, mass: 0.7, aggro: 0, fly: true, color: '#4dffe0' },
  kraken: { name: 'Tidecrusher Kraken', hp: 2200, speed: 0, r: 66, dmg: 0, atk: 2, score: 1500, mass: 99, aggro: 0, color: '#3fe0d0' },
  phoenix: { name: 'Cinder Phoenix', hp: 3000, speed: 0, r: 46, dmg: 0, atk: 2, score: 2500, mass: 99, aggro: 0, fly: true, color: '#ff9a3c' },
  titan: { name: 'Smogmaw the Titan', hp: 5200, speed: 0, r: 80, dmg: 0, atk: 2, score: 5000, mass: 99, aggro: 0, color: '#ff5a3c' },
};

export function spawnEnemy(S, kind, x, y, hpMul = 1) {
  const k = KINDS[kind];
  const e = {
    id: S.nextId++, kind, x, y, r: k.r, hp: k.hp * hpMul, maxHp: k.hp * hpMul, hpMul,
    speed: k.speed * (0.92 + S.rng() * 0.16), dmg: k.dmg * (S.foeDmg ?? 1), atk: k.atk, atkT: k.atk * S.rng(), score: k.score,
    mass: k.mass, aggro: k.aggro, range: k.range ?? 0, fly: !!k.fly, color: k.color,
    face: Math.atan2(PLAZA.y - y, PLAZA.x - x), t: S.rng() * 10, kx: 0, ky: 0, flash: 0, inv: 0, lunge: 0,
    slowT: 0, slowAmt: 0, frozenT: 0, burnT: 0, burnDps: 0, grabbed: false, lift: 0, thrown: 0, dead: false, boss: false,
  };
  S.enemies.push(e);
  return e;
}

export const comboMult = (S) => Math.min(5, 1 + Math.floor(S.combo / 8) * 0.5);

function turn(a, b, max) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + Math.max(-max, Math.min(max, d));
}

export function updateEnemies(S, dt) {
  for (const e of S.enemies) {
    if (e.dead) continue;
    e.t += dt;
    e.flash -= dt;
    e.inv -= dt;
    e.lunge = Math.max(0, e.lunge - dt);
    if (e.burnT > 0) {
      e.burnT -= dt;
      damageEnemy(S, e, e.burnDps * dt, { quiet: true });
      if (S.rng() < dt * 16) burst(S, e.x + (S.rng() - 0.5) * e.r, e.y, S.rng() < 0.5 ? '#ff7a2e' : '#ffd66b', 1, { angle: -Math.PI / 2, spread: 0.6, speed: 70, life: 0.45, size: 4, drag: 1 });
      if (e.dead) continue;
    }
    if (e.slowT > 0 && (e.slowT -= dt) <= 0) e.slowAmt = 0;
    if (e.thrown > 0) {
      updateThrown(S, e, dt);
      continue;
    }
    if (e.grabbed) continue;
    if (e.lift > 0) e.lift = Math.max(0, e.lift - dt * 4);
    if (e.boss) continue;
    e.x += e.kx * dt;
    e.y += e.ky * dt;
    const kd = Math.exp(-7 * dt);
    e.kx *= kd;
    e.ky *= kd;
    if (e.frozenT > 0) e.frozenT -= dt;
    else behave(S, e, dt);
    if (!e.fly) pushOutOfBuildings(e, e.r);
  }
  separate(S);
}

function behave(S, e, dt) {
  const p = S.player;
  const slow = 1 - (e.slowT > 0 ? e.slowAmt : 0);
  let tx = PLAZA.x;
  let ty = PLAZA.y;
  let tr = PLAZA.r;
  let hero = false;
  if (p.down <= 0 && e.aggro && dist(e.x, e.y, p.x, p.y) < e.aggro) {
    tx = p.x;
    ty = p.y;
    tr = p.r;
    hero = true;
  }
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.face = turn(e.face, Math.atan2(dy, dx), dt * 8);
  const spd = e.speed * slow;
  if (e.kind === 'spitter') {
    if (d > e.range) {
      e.x += (dx / d) * spd * dt;
      e.y += (dy / d) * spd * dt;
    } else {
      const side = Math.sin(e.t * 0.8 + e.id) * 0.5;
      e.x += (-dy / d) * spd * side * dt;
      e.y += (dx / d) * spd * side * dt;
    }
    e.atkT -= dt;
    if (d < e.range + 40 && e.atkT <= 0) {
      e.atkT = e.atk;
      e.lunge = 0.25;
      const a = Math.atan2(dy, dx);
      S.foes.push({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, r: 7, dmg: e.dmg, life: 2.4, kind: 'glob', color: '#9dff4a' });
      S.sfx('spit');
    }
    return;
  }
  const reach = tr + e.r + 3;
  if (d > reach) {
    let mx = dx / d;
    let my = dy / d;
    if (e.kind === 'runner' || e.kind === 'flier' || e.kind === 'mini') {
      const w = Math.sin(e.t * (e.kind === 'flier' ? 2.5 : 7) + e.id) * (e.kind === 'flier' ? 0.8 : 0.55);
      const nx = mx - my * w;
      const ny = my + mx * w;
      const n = Math.hypot(nx, ny);
      mx = nx / n;
      my = ny / n;
    }
    e.x += mx * spd * dt;
    e.y += my * spd * dt;
    e.atkT = Math.max(0.2, e.atkT - dt);
    return;
  }
  e.atkT -= dt;
  if (e.atkT > 0) return;
  e.atkT = e.atk;
  e.lunge = 0.18;
  if (hero) {
    hurtPlayer(S, e.dmg);
    return;
  }
  hurtPlaza(S, e.dmg);
  if (S.mods.thorns) {
    arc(S, PLAZA.x, PLAZA.y - 20, e.x, e.y, '#8ff3ff', 2.5);
    damageEnemy(S, e, S.mods.thorns, { color: '#8ff3ff', noCharge: true });
  }
}

function updateThrown(S, e, dt) {
  e.thrown -= dt;
  e.x += e.tvx * dt;
  e.y += e.tvy * dt;
  e.lift = 1;
  burst(S, e.x, e.y, '#c77dff', 1, { speed: 40, life: 0.4, size: 5 });
  for (const o of S.enemies) {
    if (o === e || o.dead || o.grabbed || o.thrown || e.thrownHit.includes(o.id) || dist(o.x, o.y, e.x, e.y) > o.r + e.r) continue;
    e.thrownHit.push(o.id);
    damageEnemy(S, o, e.throwDmg * 0.4, { noCharge: true, color: '#c77dff', kx: e.tvx * 0.4, ky: e.tvy * 0.4 });
  }
  const out = e.x < -30 || e.x > W + 30 || e.y < -30 || e.y > H + 30;
  const wall = !e.fly && pushOutOfBuildings(e, e.r);
  if (e.thrown > 0 && !out && !wall) return;
  e.thrown = 0;
  e.x = Math.max(10, Math.min(W - 10, e.x));
  e.y = Math.max(10, Math.min(H - 10, e.y));
  aoe(S, e.x, e.y, 85, e.throwDmg * 0.6, { noCharge: true, skip: e, color: '#c77dff', knock: 220 });
  damageEnemy(S, e, e.throwDmg, { noCharge: true, color: '#c77dff' });
  ring(S, e.x, e.y, '#c77dff', 10, 90, 0.35, 6);
  burst(S, e.x, e.y, '#e7b8ff', 16, { speed: 280, life: 0.5, size: 4 });
  shake(S, 6);
  S.sfx('slam');
}

function separate(S) {
  const list = S.enemies;
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i];
    if (a.dead || a.grabbed || a.thrown) continue;
    for (let j = i + 1; j < list.length; j += 1) {
      const b = list[j];
      if (b.dead || b.grabbed || b.thrown || a.fly !== b.fly) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rr = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      const push = (rr - d) * 0.5;
      const wa = a.boss ? 0 : b.boss ? 1 : b.mass / (a.mass + b.mass);
      const wb = 1 - wa;
      a.x -= (dx / d) * push * wa * 2;
      a.y -= (dy / d) * push * wa * 2;
      b.x += (dx / d) * push * wb * 2;
      b.y += (dy / d) * push * wb * 2;
    }
    if (!a.fly && !a.boss) {
      const d = dist(a.x, a.y, PLAZA.x, PLAZA.y);
      const min = PLAZA.r + a.r;
      if (d < min && d > 0.01) {
        a.x = PLAZA.x + ((a.x - PLAZA.x) / d) * min;
        a.y = PLAZA.y + ((a.y - PLAZA.y) / d) * min;
      }
    }
  }
}

export function handleDeath(S, e) {
  S.kills += 1;
  S.combo += 1;
  S.comboT = 3 + S.mods.comboKeep;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  S.score += Math.round(e.score * comboMult(S) * S.mods.scoreMul);
  burst(S, e.x, e.y, e.color, 14, { speed: 260, life: 0.55, size: 4 });
  burst(S, e.x, e.y, '#140a26', 5, { kind: 'smoke', add: false, speed: 60, life: 0.8, size: 9 });
  ring(S, e.x, e.y, e.color, e.r * 0.5, e.r * 2.3, 0.35, 4);
  S.sfx('pop');
  if (e.kind === 'splitter') {
    for (const s of [-1, 1]) {
      const m = spawnEnemy(S, 'mini', e.x + s * 8, e.y - s * 4, e.hpMul);
      m.kx = s * 220;
      m.ky = -s * 80;
    }
  }
  if (S.rng() < 0.07 && S.pickups.length < 4) S.pickups.push({ x: e.x, y: e.y, t: 0 });
}

// ---------------------------------------------------------------- drawing

export function drawEnemy(ctx, e, t) {
  const r = e.r;
  const lift = e.fly ? 16 : e.lift * 22;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.55, r * (e.fly ? 0.8 : 1.05), r * 0.42, 0, 0, TAU);
  ctx.fill();
  ctx.translate(0, -lift);
  const lunge = e.lunge > 0 ? Math.sin((e.lunge / 0.18) * Math.PI) * 5 : 0;
  ctx.rotate(e.face);
  ctx.translate(lunge, 0);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(14,4,28,0.9)';
  switch (e.kind) {
    case 'grunt': {
      blob(ctx, r, t * 6 + e.id, 0.09);
      ctx.fillStyle = radial(ctx, r, '#c590ff', '#7432b8', '#2c0d50');
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2c0d50';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, s * r * 0.55);
        ctx.lineTo(-r * 1.15, s * r * 0.95);
        ctx.lineTo(-r * 0.2, s * r * 0.85);
        ctx.fill();
      }
      eyes(ctx, r * 0.45, r * 0.33, r * 0.19, '#ff6a3c');
      break;
    }
    case 'runner': {
      ctx.strokeStyle = '#4a0614';
      ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k += 1) {
          const bx = -r * 0.5 + k * r * 0.5;
          const sw = Math.sin(t * 30 + k * 2 + s) * r * 0.4;
          ctx.beginPath();
          ctx.moveTo(bx, s * r * 0.4);
          ctx.lineTo(bx + sw, s * r * 1.15);
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.35, r * 0.8, 0, 0, TAU);
      ctx.fillStyle = radial(ctx, r, '#ff8197', '#d01c42', '#4a0614');
      ctx.fill();
      ctx.strokeStyle = 'rgba(14,4,28,0.9)';
      ctx.stroke();
      ctx.strokeStyle = '#ffb3c0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r * 0.5, 0);
      ctx.stroke();
      eyes(ctx, r * 0.95, r * 0.3, r * 0.2, '#ffe94a');
      break;
    }
    case 'tank': {
      ctx.fillStyle = '#3c4266';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(r * 0.72, s * r * 0.82, r * 0.4, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = radial(ctx, r, '#a3acd8', '#535b85', '#1e2238');
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#1c1f30';
      ctx.lineWidth = 4;
      for (let k = 0; k < 3; k += 1) {
        ctx.beginPath();
        ctx.arc(-r * 0.15 - k * r * 0.25, 0, r * 0.75, Math.PI - 0.9, Math.PI + 0.9);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#ff8a3c';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6 + Math.sin(t * 4 + e.id) * 0.3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.6);
      ctx.lineTo(-r * 0.1, -r * 0.2);
      ctx.lineTo(-r * 0.4, r * 0.1);
      ctx.lineTo(0, r * 0.55);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      glow(ctx, 0, 0, r * 1.2, '#ff8a3c', 0.25);
      ctx.fillStyle = '#ff3b2e';
      for (const s of [-1, 1]) ctx.fillRect(r * 0.5, s * r * 0.28 - 2, r * 0.3, 4);
      glow(ctx, r * 0.65, 0, r * 0.6, '#ff3b2e', 0.6);
      break;
    }
    case 'spitter': {
      const pulse = 0.75 + Math.sin(t * 5 + e.id) * 0.08 + (e.lunge > 0 ? 0.15 : 0);
      ctx.beginPath();
      ctx.arc(-r * 0.6, 0, r * pulse, 0, TAU);
      ctx.fillStyle = 'rgba(200,255,122,0.85)';
      ctx.fill();
      ctx.stroke();
      glow(ctx, -r * 0.6, 0, r * 1.4, '#9dff4a', 0.35);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = radial(ctx, r, '#8dff9a', '#2f9a45', '#0d361a');
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0b1f0f';
      ctx.beginPath();
      ctx.arc(r * 0.62, 0, r * 0.36, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#d7ff9a';
      ctx.stroke();
      if (e.lunge > 0) glow(ctx, r * 0.8, 0, r * 1.2, '#9dff4a', 0.9);
      eyes(ctx, r * 0.15, r * 0.5, r * 0.15, '#ffe94a');
      break;
    }
    case 'splitter':
    case 'mini': {
      glow(ctx, 0, 0, r * 2, '#ff4fd8', 0.3);
      blob(ctx, r, t * 4 + e.id, 0.12);
      ctx.fillStyle = 'rgba(255,90,220,0.62)';
      ctx.fill();
      ctx.strokeStyle = '#ffb0f0';
      ctx.stroke();
      ctx.fillStyle = '#7a0f63';
      const n = e.kind === 'splitter' ? 2 : 1;
      for (let k = 0; k < n; k += 1) {
        ctx.beginPath();
        ctx.arc(-r * 0.25 + (n > 1 ? (k - 0.5) * r * 0.3 : 0), (n > 1 ? (k - 0.5) * r * 0.7 : 0) + Math.sin(t * 3 + k) * 2, r * 0.26, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.2, -r * 0.45, r * 0.3, r * 0.15, -0.4, 0, TAU);
      ctx.fill();
      eyes(ctx, r * 0.45, r * 0.3, r * 0.16, '#ffffff');
      break;
    }
    case 'flier': {
      const flap = 0.45 + Math.abs(Math.sin(t * 13 + e.id)) * 0.75;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(r * 0.2, s * r * 0.2);
        ctx.quadraticCurveTo(r * 0.3, s * r * 1.8 * flap, -r * 0.5, s * r * 2.1 * flap);
        ctx.lineTo(-r * 0.4, s * r * 1.2 * flap);
        ctx.lineTo(-r * 0.75, s * r * 1.1 * flap);
        ctx.lineTo(-r * 0.5, s * r * 0.3);
        ctx.closePath();
        ctx.fillStyle = '#35205a';
        ctx.fill();
        ctx.strokeStyle = '#8b63d6';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.8, r * 0.55, 0, 0, TAU);
      ctx.fillStyle = radial(ctx, r * 0.8, '#9a78d8', '#5a3a96', '#24133f');
      ctx.fill();
      ctx.strokeStyle = 'rgba(14,4,28,0.9)';
      ctx.stroke();
      eyes(ctx, r * 0.45, r * 0.22, r * 0.15, '#4dffe0');
      break;
    }
    default:
  }
  ctx.rotate(-e.face);
  if (e.frozenT > 0) {
    ctx.fillStyle = 'rgba(190,240,255,0.5)';
    ctx.strokeStyle = '#effdff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * TAU + 0.3;
      ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.5);
    ctx.lineTo(-r * 0.1, -r * 0.9);
    ctx.stroke();
  } else if (e.slowT > 0) {
    ctx.strokeStyle = 'rgba(150,230,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 3, 0, TAU);
    ctx.stroke();
  }
  if (e.flash > 0) {
    ctx.globalAlpha = Math.min(1, e.flash / 0.1) * 0.75;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.02, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (e.hp < e.maxHp) {
    const w = Math.max(24, r * 2);
    ctx.fillStyle = 'rgba(10,4,24,0.85)';
    ctx.fillRect(-w / 2 - 1, -r - 12, w + 2, 6);
    ctx.fillStyle = e.frozenT > 0 ? '#bff4ff' : '#ff4d6a';
    ctx.fillRect(-w / 2, -r - 11, (w * e.hp) / e.maxHp, 4);
  }
  ctx.restore();
}

function blob(ctx, r, ph, amt) {
  ctx.beginPath();
  for (let i = 0; i <= 12; i += 1) {
    const a = (i / 12) * TAU;
    const rr = r * (1 + amt * Math.sin(ph + i * 1.9));
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

function radial(ctx, r, a, b, c) {
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, a);
  g.addColorStop(0.5, b);
  g.addColorStop(1, c);
  return g;
}

function eyes(ctx, x, y, s, color) {
  for (const k of [-1, 1]) {
    glow(ctx, x, k * y, s * 3.2, color, 0.7);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, k * y, s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + s * 0.2, k * y - s * 0.2, s * 0.4, 0, TAU);
    ctx.fill();
  }
}
