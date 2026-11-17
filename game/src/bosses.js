// The three bosses of nights 5, 10 and 15: the Tidecrusher Kraken (tentacle slams, ink rings),
// the Cinder Phoenix (telegraphed dives, fire fans, feather rain) and Smogmaw the Titan (stomps,
// beam fans, mortars). Each has phases, and each phase roar snuffs the two lamps nearest it;
// every big hit is telegraphed in red first. Dawn waits until the boss is banished.
import { H, BEACON, TAU, W, clamp, dist, edgePoint, hurtBeacon, hurtPlayer, segDist } from './combat.js';
import { spawnEnemy } from './enemies.js';
import { snuffNearest } from './lamps.js';
import { addText, burst, flash, glow, ring, shake } from './particles.js';

export const BOSS_OF = { 5: 'kraken', 10: 'phoenix', 15: 'titan' };
export const BOSS_TITLE = { kraken: 'TIDECRUSHER KRAKEN', phoenix: 'CINDER PHOENIX', titan: 'SMOGMAW THE TITAN' };

const SEQ = {
  kraken: [['slam', 'ink', 'slam', 'summon'], ['slam', 'ink', 'slam', 'slam', 'summon']],
  phoenix: [['dive', 'fan', 'dive', 'rain'], ['dive', 'rain', 'dive', 'fan', 'dive', 'rain']],
  titan: [['smash', 'beam', 'stomp', 'summon', 'mortar'], ['smash', 'beam', 'mortar', 'stomp', 'beam', 'summon']],
};

export function spawnBoss(S, wave) {
  const kind = BOSS_OF[wave];
  const start = { kraken: [640, -100], phoenix: [W + 120, -80], titan: [640, -130] }[kind];
  const b = spawnEnemy(S, kind, start[0], start[1], 1 + (S.mods.dmgMul - 1) * 0.35);
  Object.assign(b, { boss: true, phase: 1, state: 'enter', st: 0, ft: 0, inv: 2.4, atkT: 1.2, step: 0, face: Math.PI / 2, oa: -0.6, contactT: 0 });
  S.boss = b;
  S.sfx('roar');
  shake(S, 12);
  return b;
}

function tele(S, shape, data, dur, fire) {
  S.tele.push({ shape, ...data, t: 0, dur, fire });
  if (S.time - (S.lastWarn ?? -1) > 0.2) {
    S.lastWarn = S.time;
    S.sfx('warn');
  }
}

function lineTele(S, x1, y1, tx, ty, len, w, dur, fire) {
  const a = Math.atan2(ty - y1, tx - x1);
  tele(S, 'line', { x1, y1, x2: x1 + Math.cos(a) * len, y2: y1 + Math.sin(a) * len, w }, dur, fire);
}

function lineHits(S, tl, playerDmg, coreDmg) {
  const p = S.player;
  if (p.down <= 0 && segDist(p.x, p.y, tl.x1, tl.y1, tl.x2, tl.y2) < tl.w / 2 + p.r * 0.6) hurtPlayer(S, playerDmg);
  if (coreDmg && segDist(BEACON.x, BEACON.y, tl.x1, tl.y1, tl.x2, tl.y2) < tl.w / 2 + BEACON.r) hurtBeacon(S, coreDmg);
}

function circleHits(S, tl, playerDmg, coreDmg) {
  const p = S.player;
  if (p.down <= 0 && dist(p.x, p.y, tl.x, tl.y) < tl.r + p.r * 0.5) hurtPlayer(S, playerDmg);
  if (coreDmg && dist(BEACON.x, BEACON.y, tl.x, tl.y) < tl.r + BEACON.r) hurtBeacon(S, coreDmg);
}

/** A target point: the hero (chance) or the Beacon. Only attacks aimed at the Core damage it. */
function playerOrCore(S, chance = 0.7) {
  const p = S.player;
  if (p.down <= 0 && S.rng() < chance) return { x: p.x, y: p.y, core: false };
  return { x: BEACON.x + (S.rng() - 0.5) * 40, y: BEACON.y + (S.rng() - 0.5) * 40, core: true };
}

function setPhase(S, b, phase, text) {
  b.phase = phase;
  b.inv = 1.2;
  b.step = 0;
  b.atkT = 1.4;
  S.sfx('roar');
  shake(S, 16);
  flash(S, '#ff3355', 0.35);
  ring(S, b.x, b.y, b.color, 20, 360, 0.8, 10);
  snuffNearest(S, b.x, b.y, 2);
  S.banner = { title: text, sub: 'Its roar snuffed two lamps!', t: 0, dur: 2.2, color: '#ff5a6e', small: true };
}

export function updateBosses(S, dt) {
  for (const b of S.enemies) {
    if (!b.boss || b.dead) continue;
    b.st += dt;
    const p = S.player;
    if (b.state !== 'enter') {
      b.ft += dt;
      b.contactT -= dt;
      if (p.down <= 0 && b.contactT <= 0 && dist(b.x, b.y, p.x, p.y) < b.r * 0.85 + p.r) {
        b.contactT = 0.6;
        hurtPlayer(S, 14);
      }
    }
    if (b.kind === 'kraken') kraken(S, b, dt);
    else if (b.kind === 'phoenix') phoenix(S, b, dt);
    else titan(S, b, dt);
  }
}

function nextAttack(S, b) {
  const seq = SEQ[b.kind][Math.min(1, b.phase - 1)];
  const name = seq[b.step % seq.length];
  b.step += 1;
  return name;
}

function summon(S, b, kinds) {
  for (const k of kinds) {
    const pt = edgePoint(S);
    spawnEnemy(S, k, pt.x, pt.y, S.hpMul);
  }
}

// ---------------------------------------------------------------- kraken

function kraken(S, b, dt) {
  if (b.state === 'enter') {
    b.y += (150 - b.y) * Math.min(1, dt * 1.5);
    if (b.st > 2.4) b.state = 'fight';
    return;
  }
  b.x = 640 + Math.sin(b.ft * 0.35) * 230;
  b.y = 150 + Math.sin(b.ft * 0.8) * 14;
  b.face = Math.atan2(S.player.y - b.y, S.player.x - b.x);
  if (b.phase === 1 && b.hp < b.maxHp * 0.5) {
    setPhase(S, b, 2, 'THE KRAKEN IS ENRAGED!');
    summon(S, b, ['runner', 'runner', 'grunt', 'grunt']);
  }
  const sp = b.phase === 2 ? 1.45 : 1;
  b.atkT -= dt * sp;
  if (b.atkT > 0) return;
  const atk = nextAttack(S, b);
  const ox = b.x;
  const oy = b.y + 40;
  const slam = (target) => {
    const len = Math.max(300, dist(ox, oy, target.x, target.y) + 90);
    lineTele(S, ox, oy, target.x, target.y, len, 64, b.phase === 2 ? 0.85 : 1.15, (S2, tl) => {
      lineHits(S2, tl, 28, target.core ? 40 : 0);
      S2.slams.push({ ...tl, t: 0, color: b.phase === 2 ? '#d8436e' : '#2fc7b4' });
      for (let i = 0; i <= 8; i += 1) {
        const x = tl.x1 + ((tl.x2 - tl.x1) * i) / 8;
        const y = tl.y1 + ((tl.y2 - tl.y1) * i) / 8;
        burst(S2, x, y, '#7ff7ea', 4, { speed: 220, life: 0.5, size: 4 });
      }
      shake(S2, 11);
      S2.sfx('slam');
    });
  };
  if (atk === 'slam') {
    slam(playerOrCore(S));
    if (b.phase === 2) slam(playerOrCore(S, 0.2));
    b.atkT = 2.1;
  } else if (atk === 'ink') {
    const n = b.phase === 2 ? 22 : 14;
    const off = S.rng() * TAU;
    for (let i = 0; i < n; i += 1) {
      const a = off + (i / n) * TAU;
      S.foes.push({ x: b.x, y: b.y + 20, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, r: 9, dmg: 10, life: 4, kind: 'ink', color: '#7a5cff' });
    }
    S.sfx('spit');
    b.atkT = 1.8;
  } else {
    for (let i = 0; i < 4; i += 1) {
      const m = spawnEnemy(S, i < 2 ? 'grunt' : 'runner', b.x + (i - 1.5) * 30, b.y + 50, S.hpMul);
      m.ky = 220;
    }
    b.atkT = 2.2;
  }
}

// ---------------------------------------------------------------- phoenix

function phoenix(S, b, dt) {
  const sp = b.phase === 2 ? 1.4 : 1;
  if (b.phase === 1 && b.hp < b.maxHp * 0.5 && b.state === 'orbit') {
    setPhase(S, b, 2, 'THE PHOENIX IS REBORN IN BLUE FIRE!');
    burst(S, b.x, b.y, '#8fdcff', 60, { speed: 420, life: 0.9, size: 5 });
  }
  if (S.rng() < dt * 30) {
    burst(S, b.x + (S.rng() - 0.5) * 40, b.y - 20, b.phase === 2 ? '#8fdcff' : S.rng() < 0.5 ? '#ff9a3c' : '#ffd66b', 1, { speed: 60, vy: 30, life: 0.7, size: 5, drag: 1 });
  }
  if (b.state === 'enter' || b.state === 'orbit') {
    b.oa += dt * 0.55 * sp;
    const tx = 640 + Math.cos(b.oa) * 420;
    const ty = 350 + Math.sin(b.oa) * 230;
    const k = Math.min(1, dt * (b.state === 'enter' ? 1.2 : 3));
    const nx = b.x + (tx - b.x) * k;
    const ny = b.y + (ty - b.y) * k;
    if (Math.hypot(nx - b.x, ny - b.y) > 0.2) b.face = Math.atan2(ny - b.y, nx - b.x);
    b.x = nx;
    b.y = ny;
    if (b.state === 'enter') {
      if (b.st > 2.4) b.state = 'orbit';
      return;
    }
    b.atkT -= dt * sp;
    if (b.atkT > 0) return;
    const atk = nextAttack(S, b);
    if (atk === 'dive') {
      const tg = playerOrCore(S, 0.65);
      const a = Math.atan2(tg.y - b.y, tg.x - b.x);
      let len = dist(b.x, b.y, tg.x, tg.y) + 260;
      const ex = clamp(b.x + Math.cos(a) * len, 40, W - 40);
      const ey = clamp(b.y + Math.sin(a) * len, 40, H - 40);
      len = dist(b.x, b.y, ex, ey);
      b.state = 'charge';
      b.face = a;
      lineTele(S, b.x, b.y, ex, ey, len, 58, b.phase === 2 ? 0.72 : 0.95, (S2, tl) => {
        b.state = 'dive';
        b.dive = { x: tl.x2, y: tl.y2, last: 0, core: !tg.core, hit: false };
        S2.sfx('dive');
      });
    } else if (atk === 'fan') {
      const n = b.phase === 2 ? 9 : 5;
      const a0 = Math.atan2(S.player.y - b.y, S.player.x - b.x);
      for (let i = 0; i < n; i += 1) {
        const a = a0 + (i - (n - 1) / 2) * 0.17;
        S.foes.push({ x: b.x, y: b.y, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, r: 9, dmg: 12, life: 3, kind: 'fireball', color: b.phase === 2 ? '#8fdcff' : '#ff9a3c' });
      }
      S.sfx('shot_blaze');
      b.atkT = 1.6;
    } else {
      const n = b.phase === 2 ? 8 : 5;
      for (let i = 0; i < n; i += 1) {
        const c = i % 2 ? S.player : BEACON;
        const x = clamp(c.x + (S.rng() - 0.5) * 320, 50, W - 50);
        const y = clamp(c.y + (S.rng() - 0.5) * 240, 50, H - 50);
        tele(S, 'circle', { x, y, r: 62 }, 1.2 + i * 0.12, (S2, tl) => {
          circleHits(S2, tl, 22, 18);
          burst(S2, tl.x, tl.y, b.phase === 2 ? '#8fdcff' : '#ffb347', 18, { speed: 260, life: 0.5, size: 5 });
          ring(S2, tl.x, tl.y, '#ffd66b', 10, tl.r, 0.35, 6);
          shake(S2, 5);
          S2.sfx('boom');
        });
      }
      b.atkT = 2.2;
    }
    return;
  }
  if (b.state === 'charge') {
    b.x += Math.sin(b.st * 60) * 0.8;
    return;
  }
  if (b.state === 'dive') {
    const dv = b.dive;
    const dx = dv.x - b.x;
    const dy = dv.y - b.y;
    const d = Math.hypot(dx, dy);
    const step = 1250 * dt;
    if (d <= step) {
      b.x = dv.x;
      b.y = dv.y;
      b.state = 'orbit';
      b.oa = Math.atan2((b.y - 350) / 230, (b.x - 640) / 420);
      b.atkT = 1.3;
      shake(S, 6);
      return;
    }
    b.x += (dx / d) * step;
    b.y += (dy / d) * step;
    b.face = Math.atan2(dy, dx);
    dv.last += step;
    if (dv.last > 34) {
      dv.last = 0;
      S.hazards.push({ x: b.x, y: b.y, r: 26, t: 0, dur: 2.6, dps: 16, color: b.phase === 2 ? '#8fdcff' : '#ff7a2e' });
    }
    const p = S.player;
    if (!dv.hit && p.down <= 0 && dist(b.x, b.y, p.x, p.y) < b.r * 0.8 + p.r) dv.hit = hurtPlayer(S, 30);
    if (!dv.core && dist(b.x, b.y, BEACON.x, BEACON.y) < BEACON.r + 30) {
      dv.core = true;
      hurtBeacon(S, 32);
    }
  }
}

// ---------------------------------------------------------------- titan

function titan(S, b, dt) {
  if (S.rng() < dt * 14) {
    for (const s of [-1, 1]) burst(S, b.x + s * 62, b.y - 36, '#2a2238', 1, { kind: 'smoke', add: false, angle: -Math.PI / 2, spread: 0.6, speed: 50, life: 1.4, size: 10, drag: 0.5 });
  }
  if (b.state === 'enter') {
    b.y += (175 - b.y) * Math.min(1, dt * 1.1);
    if (Math.floor(b.st * 1.6) !== Math.floor((b.st - dt) * 1.6)) {
      shake(S, 6);
      S.sfx('slam');
    }
    if (b.st > 3) b.state = 'fight';
    return;
  }
  b.x = 640 + Math.sin(b.ft * 0.25) * 150;
  b.y = 175 + Math.sin(b.ft * 0.5) * 10;
  b.face = Math.atan2(S.player.y - b.y, S.player.x - b.x);
  if (b.phase === 1 && b.hp < b.maxHp * 0.6) {
    setPhase(S, b, 2, 'SMOGMAW STOKES ITS FURNACE!');
    summon(S, b, ['flier', 'flier', 'spitter', 'spitter']);
  } else if (b.phase === 2 && b.hp < b.maxHp * 0.25) {
    setPhase(S, b, 3, 'SMOGMAW GOES BERSERK!');
    summon(S, b, ['tank', 'runner', 'runner', 'runner']);
  }
  const sp = [1, 1, 1.3, 1.7][b.phase];
  b.atkT -= dt * sp;
  if (b.atkT > 0) return;
  const atk = nextAttack(S, b);
  const p = S.player;
  if (atk === 'smash') {
    const n = b.phase === 1 ? 1 : 3;
    for (let i = 0; i < n; i += 1) {
      const x = clamp(p.x + (i ? (S.rng() - 0.5) * 200 : 0), 40, W - 40);
      const y = clamp(p.y + (i ? (S.rng() - 0.5) * 160 : 0), 40, H - 40);
      tele(S, 'circle', { x, y, r: 95 }, 1.05 + i * 0.3, (S2, tl) => {
        circleHits(S2, tl, 32, 40);
        ring(S2, tl.x, tl.y, '#ff8a3c', 10, tl.r * 1.2, 0.45, 9);
        burst(S2, tl.x, tl.y, '#5a4a6a', 14, { kind: 'smoke', add: false, speed: 160, life: 0.9, size: 12 });
        burst(S2, tl.x, tl.y, '#ffb347', 14, { speed: 300, life: 0.4, size: 4 });
        shake(S2, 12);
        S2.sfx('slam');
      });
    }
    b.atkT = 2.3;
  } else if (atk === 'beam') {
    const n = b.phase === 1 ? 3 : 5;
    const a0 = Math.atan2(p.y - b.y, p.x - b.x);
    for (let i = 0; i < n; i += 1) {
      const a = a0 + (i - (n - 1) / 2) * 0.32;
      lineTele(S, b.x, b.y + 10, b.x + Math.cos(a) * 100, b.y + 10 + Math.sin(a) * 100, 1000, 38, 1.1, (S2, tl) => {
        lineHits(S2, tl, 26, 0);
        S2.beams.push({ ...tl, t: 0 });
        shake(S2, 7);
      });
    }
    S.sfx('charge');
    b.atkT = 2.4;
  } else if (atk === 'stomp') {
    tele(S, 'circle', { x: b.x, y: b.y, r: 210 }, 1.15, (S2, tl) => {
      circleHits(S2, tl, 30, 0);
      ring(S2, tl.x, tl.y, '#ff5a3c', 20, tl.r * 1.15, 0.55, 14);
      burst(S2, tl.x, tl.y, '#4a3a5a', 24, { kind: 'smoke', add: false, speed: 260, life: 1, size: 12 });
      shake(S2, 18);
      S2.sfx('boom');
    });
    b.atkT = 2;
  } else if (atk === 'mortar') {
    for (let i = 0; i < 4; i += 1) {
      const a = S.rng() * TAU;
      const rr = 40 + S.rng() * 120;
      tele(S, 'circle', { x: BEACON.x + Math.cos(a) * rr, y: BEACON.y + Math.sin(a) * rr, r: 64 }, 1.4 + i * 0.15, (S2, tl) => {
        circleHits(S2, tl, 22, 30);
        burst(S2, tl.x, tl.y, '#9dff4a', 16, { speed: 240, life: 0.5, size: 5 });
        ring(S2, tl.x, tl.y, '#9dff4a', 8, tl.r, 0.35, 6);
        shake(S2, 6);
        S2.sfx('boom');
      });
    }
    b.atkT = 2;
  } else {
    summon(S, b, b.phase === 1 ? ['spitter', 'flier', 'splitter'] : ['spitter', 'flier', 'flier', 'splitter', 'tank']);
    S.sfx('roar');
    b.atkT = 1.8;
  }
}

export function onBossDeath(S, b) {
  S.slowT = 1.6;
  S.tele = [];
  S.hazards = [];
  S.foes = [];
  S.boss = null;
  S.bossKills += 1;
  shake(S, 26);
  flash(S, '#ffffff', 0.85);
  burst(S, b.x, b.y, b.color, 90, { speed: 520, life: 1.2, size: 6 });
  burst(S, b.x, b.y, '#ffffff', 40, { speed: 300, life: 0.9, size: 4, kind: 'spark' });
  ring(S, b.x, b.y, '#ffffff', 20, 420, 1, 12);
  ring(S, b.x, b.y, b.color, 10, 300, 1.3, 8);
  addText(S, b.x, b.y - 60, 'BOSS DEFEATED!', '#ffe45c', 34, true);
  S.sfx('bossdown');
}

// ---------------------------------------------------------------- drawing

export function drawTele(ctx, S) {
  ctx.save();
  for (const tl of S.tele) {
    const k = Math.min(1, tl.t / tl.dur);
    const pulse = 0.55 + Math.sin(S.time * 22) * 0.25;
    if (tl.shape === 'circle') {
      ctx.fillStyle = 'rgba(255,40,80,0.13)';
      ctx.beginPath();
      ctx.arc(tl.x, tl.y, tl.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(255,50,90,${0.18 + k * 0.22})`;
      ctx.beginPath();
      ctx.arc(tl.x, tl.y, tl.r * k, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,70,100,${pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 8]);
      ctx.lineDashOffset = -S.time * 40;
      ctx.beginPath();
      ctx.arc(tl.x, tl.y, tl.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(255,200,210,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tl.x - 10, tl.y - 10);
      ctx.lineTo(tl.x + 10, tl.y + 10);
      ctx.moveTo(tl.x + 10, tl.y - 10);
      ctx.lineTo(tl.x - 10, tl.y + 10);
      ctx.stroke();
    } else {
      const len = dist(tl.x1, tl.y1, tl.x2, tl.y2);
      ctx.save();
      ctx.translate(tl.x1, tl.y1);
      ctx.rotate(Math.atan2(tl.y2 - tl.y1, tl.x2 - tl.x1));
      ctx.fillStyle = 'rgba(255,40,80,0.13)';
      ctx.fillRect(0, -tl.w / 2, len, tl.w);
      ctx.fillStyle = `rgba(255,50,90,${0.18 + k * 0.22})`;
      ctx.fillRect(0, -tl.w / 2, len * k, tl.w);
      ctx.strokeStyle = `rgba(255,70,100,${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(0, -tl.w / 2, len, tl.w);
      ctx.strokeStyle = `rgba(255,190,200,${pulse * 0.9})`;
      ctx.lineWidth = 3;
      for (let x = ((S.time * 160) % 46) + 10; x < len - 10; x += 46) {
        ctx.beginPath();
        ctx.moveTo(x - 8, -tl.w * 0.25);
        ctx.lineTo(x + 4, 0);
        ctx.lineTo(x - 8, tl.w * 0.25);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

export function drawHazards(ctx, S) {
  for (const h of S.hazards) {
    const a = Math.min(1, (h.dur - h.t) * 2, h.t * 6);
    glow(ctx, h.x, h.y, h.r * 2.2, h.color, 0.55 * a);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = h.color;
    for (let i = 0; i < 3; i += 1) {
      const f = Math.sin(S.time * 14 + h.x * 0.1 + i * 2);
      const x = h.x + (i - 1) * 9;
      ctx.beginPath();
      ctx.moveTo(x - 5, h.y + 4);
      ctx.quadraticCurveTo(x, h.y - 14 - f * 5, x + 5, h.y + 4);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Kraken tentacle slams and Titan beams, drawn just after they land. */
export function drawBossFx(ctx, S) {
  for (const s of S.slams) {
    const a = 1 - s.t / 0.6;
    const len = dist(s.x1, s.y1, s.x2, s.y2);
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 1.5);
    ctx.translate(s.x1, s.y1);
    ctx.rotate(Math.atan2(s.y2 - s.y1, s.x2 - s.x1));
    for (let i = 0; i <= 20; i += 1) {
      const u = i / 20;
      const rr = 30 * (1 - u) + 9;
      const y = Math.sin(u * 7 + s.t * 10) * 6;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(u * len, y, rr, 0, TAU);
      ctx.fill();
      if (i % 3 === 1) {
        ctx.fillStyle = '#ffd1e6';
        ctx.beginPath();
        ctx.arc(u * len, y + rr * 0.45, rr * 0.25, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const bm of S.beams) {
    const a = 1 - bm.t / 0.45;
    for (const [w, c] of [[bm.w * 1.4, 'rgba(255,60,60,0.35)'], [bm.w * 0.6, 'rgba(255,150,120,0.8)'], [bm.w * 0.2, '#ffffff']]) {
      ctx.globalAlpha = a;
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bm.x1, bm.y1);
      ctx.lineTo(bm.x2, bm.y2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawBoss(ctx, b, t) {
  if (b.kind === 'kraken') drawKraken(ctx, b, t);
  else if (b.kind === 'phoenix') drawPhoenix(ctx, b, t);
  else drawTitan(ctx, b, t);
  if (b.flash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, b.x, b.y, b.r * 1.8, '#ffffff', b.flash * 4);
    ctx.restore();
  }
}

function drawKraken(ctx, b, t) {
  const rage = b.phase === 2;
  const skin = rage ? ['#ff8fb0', '#c2325e', '#4a0a24'] : ['#7ff7ea', '#239e93', '#0a3a40'];
  ctx.save();
  ctx.translate(b.x, b.y);
  const pool = ctx.createRadialGradient(0, 20, 10, 0, 20, 170);
  pool.addColorStop(0, 'rgba(8,40,60,0.95)');
  pool.addColorStop(0.7, 'rgba(10,60,80,0.6)');
  pool.addColorStop(1, 'rgba(10,60,80,0)');
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.ellipse(0, 20, 175, 95, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(127,247,234,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i += 1) {
    const k = (t * 0.6 + i / 3) % 1;
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    ctx.ellipse(0, 20, 80 + k * 100, 40 + k * 50, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 8; i += 1) {
    const base = -0.35 + (i / 7) * (Math.PI + 0.7);
    for (let k = 0; k <= 16; k += 1) {
      const s = k / 16;
      const a = base + Math.sin(t * 2.2 + i * 1.3 + s * 4) * 0.4 * s;
      const d = 44 + s * 125;
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d * 0.8 + 20;
      const rr = 17 * (1 - s) + 3;
      ctx.fillStyle = k % 2 ? skin[1] : skin[2];
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.fill();
      if (k % 3 === 0 && k < 14) {
        ctx.fillStyle = skin[0];
        ctx.beginPath();
        ctx.arc(x, y, rr * 0.35, 0, TAU);
        ctx.fill();
      }
    }
  }
  if (rage) glow(ctx, 0, -10, 140, '#ff3355', 0.4);
  else glow(ctx, 0, -10, 140, '#3fe0d0', 0.3);
  const g = ctx.createRadialGradient(-20, -50, 10, 0, -10, 90);
  g.addColorStop(0, skin[0]);
  g.addColorStop(0.5, skin[1]);
  g.addColorStop(1, skin[2]);
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(5,10,20,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, -18, 62, 78 + Math.sin(t * 2) * 3, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (const [x, y, r] of [[-22, -60, 9], [18, -70, 6], [30, -35, 8], [-35, -20, 6], [5, -45, 5]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  for (const s of [-1, 1]) {
    const ex = s * 27;
    const ey = 22;
    ctx.fillStyle = '#10161f';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 17, 14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rage ? '#ffef6b' : '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 14, 11, 0, 0, TAU);
    ctx.fill();
    glow(ctx, ex, ey, 34, rage ? '#ff6a3c' : '#ffd23f', 0.6);
    ctx.fillStyle = '#10161f';
    ctx.beginPath();
    ctx.ellipse(ex + Math.cos(b.face) * 5, ey + Math.sin(b.face) * 4, 3, 9, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawPhoenix(ctx, b, t) {
  const blue = b.phase === 2;
  const c = blue ? ['#f2fbff', '#6fd0ff', '#1d46b8'] : ['#fff2b0', '#ff8a2e', '#b1220a'];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 48, 60, 18, 0, 0, TAU);
  ctx.fill();
  ctx.translate(b.x, b.y - 18);
  glow(ctx, 0, 0, 170, c[1], b.state === 'charge' ? 0.9 : 0.55);
  ctx.rotate(b.face);
  const flap = Math.sin(t * (b.state === 'dive' ? 3 : 7));
  for (let i = 0; i < 3; i += 1) {
    ctx.strokeStyle = i === 1 ? c[0] : c[1];
    ctx.lineWidth = 7 - i;
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.moveTo(-20, (i - 1) * 6);
    for (let k = 1; k <= 8; k += 1) ctx.lineTo(-20 - k * 13, (i - 1) * (6 + k * 4) + Math.sin(t * 8 + k * 0.8 + i) * k * 1.6);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const s of [-1, 1]) {
    const span = (b.state === 'dive' ? 70 : 95) * (0.8 + 0.2 * flap);
    const g = ctx.createLinearGradient(0, 0, -10, s * span);
    g.addColorStop(0, c[0]);
    g.addColorStop(0.45, c[1]);
    g.addColorStop(1, c[2]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(14, s * 8);
    ctx.quadraticCurveTo(26, s * span * 0.6, 6, s * span);
    for (let k = 0; k < 5; k += 1) {
      const u = k / 4;
      ctx.lineTo(-8 - u * 30, s * span * (1 - u * 0.55));
      ctx.lineTo(-2 - u * 30, s * span * (0.86 - u * 0.55));
    }
    ctx.lineTo(-24, s * 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c[0];
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  const bg = ctx.createRadialGradient(8, -4, 3, 0, 0, 34);
  bg.addColorStop(0, c[0]);
  bg.addColorStop(0.6, c[1]);
  bg.addColorStop(1, c[2]);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 17, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(30, 0, 12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffe45c';
  ctx.beginPath();
  ctx.moveTo(40, -5);
  ctx.lineTo(54, 0);
  ctx.lineTo(40, 5);
  ctx.fill();
  ctx.fillStyle = '#1a0a05';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(33, s * 5.5, 2.4, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = c[0];
  for (let k = 0; k < 3; k += 1) {
    ctx.beginPath();
    ctx.moveTo(22, (k - 1) * 4);
    ctx.lineTo(8 - Math.sin(t * 16 + k) * 4, (k - 1) * 10);
    ctx.lineTo(18, (k - 1) * 4 + 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTitan(ctx, b, t) {
  const rage = b.phase === 3;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 50, 120, 40, 0, 0, TAU);
  ctx.fill();
  const look = Math.max(-0.6, Math.min(0.6, b.face - Math.PI / 2));
  ctx.rotate(look * 0.4);
  const steel = (r) => {
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, '#7d7898');
    g.addColorStop(0.55, '#3c3752');
    g.addColorStop(1, '#14111f');
    return g;
  };
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0b0912';
  for (const s of [-1, 1]) {
    const swing = Math.sin(t * 2 + (s > 0 ? 0 : Math.PI)) * 8;
    ctx.save();
    ctx.translate(s * 92, 28 + swing);
    ctx.fillStyle = steel(32);
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = rage ? '#ff3b2e' : '#ff8a3c';
    ctx.lineWidth = 3;
    for (let k = -1; k <= 1; k += 1) {
      ctx.beginPath();
      ctx.moveTo(k * 10 - 4, 18);
      ctx.lineTo(k * 10 + 4, 18);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle = steel(88);
  ctx.beginPath();
  ctx.moveTo(-78, -40);
  ctx.quadraticCurveTo(0, -78, 78, -40);
  ctx.quadraticCurveTo(98, 10, 66, 52);
  ctx.quadraticCurveTo(0, 80, -66, 52);
  ctx.quadraticCurveTo(-98, 10, -78, -40);
  ctx.fill();
  ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.fillStyle = steel(34);
    ctx.beginPath();
    ctx.arc(s * 62, -30, 34, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#16131f';
    ctx.beginPath();
    ctx.arc(s * 62, -36, 13, 0, TAU);
    ctx.fill();
    glow(ctx, s * 62, -36, 22, '#ff8a3c', 0.7);
  }
  const pulse = 0.7 + Math.sin(t * (rage ? 12 : 5)) * 0.3;
  glow(ctx, 0, 18, 70, rage ? '#ff3b2e' : '#ff8a3c', pulse);
  ctx.fillStyle = rage ? '#ff5a3c' : '#ffb347';
  ctx.beginPath();
  ctx.arc(0, 18, 22, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#2a1408';
  ctx.lineWidth = 3;
  for (let k = -2; k <= 2; k += 1) {
    ctx.beginPath();
    ctx.moveTo(k * 8, 0);
    ctx.lineTo(k * 8, 36);
    ctx.stroke();
  }
  ctx.fillStyle = steel(30);
  ctx.strokeStyle = '#0b0912';
  ctx.beginPath();
  ctx.arc(0, -26, 28, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff2e3b';
  ctx.fillRect(-18, -22, 36, 8);
  glow(ctx, 0, -18, 46, '#ff2e3b', 0.9);
  if (b.phase >= 2) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rage ? '#ff3b2e' : '#ff8a3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-50, -20);
    ctx.lineTo(-30, 0);
    ctx.lineTo(-44, 22);
    ctx.moveTo(48, -10);
    ctx.lineTo(30, 14);
    ctx.lineTo(46, 34);
    ctx.stroke();
  }
  ctx.restore();
}
