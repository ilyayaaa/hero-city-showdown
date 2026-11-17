// The game world and its fixed-step update: the hero, allies, projectiles, shadows, bosses,
// telegraphed attacks, hazards, Spark motes, lamps, chain and score. The night cycle itself
// (dusk -> night -> dawn -> upgrade -> next dusk) lives in night.js, the light rules in lamps.js.
import { BEACON, H, TAU, W, clamp, damageEnemy, dist, hurtBeacon, hurtPlayer, nearestEnemy, pushOutOfBuildings } from './combat.js';
import { createRandom } from './random.js';
import { HEROES, heroAttack, heroUltimate, onShotHit, updateZones } from './heroes.js';
import { handleDeath, updateEnemies } from './enemies.js';
import { onBossDeath, updateBosses } from './bosses.js';
import { applyUpgrade, newMods } from './upgrades.js';
import { DIFFICULTY, startNight, updateNight } from './night.js';
import { addFlare, createLamps, revealShadows, updateLamps } from './lamps.js';
import { addText, burst, ring, updateFx } from './particles.js';

export const DASH_CD = 0.85;
export const START_SPARK = 10;

export function createWorld(seed, heroIndex, difficulty = 1) {
  const hero = HEROES[heroIndex];
  const diff = DIFFICULTY[difficulty];
  const S = {
    rng: createRandom(seed), sfx: () => {}, hero, heroIndex, diff, difficulty,
    time: 0, night: 1, phase: 'dusk', phaseT: 0, nightT: 0, nightLen: 45, result: null, banner: null, ultFx: null,
    player: {
      x: BEACON.x, y: BEACON.y + 100, vx: 0, vy: 0, r: 15, hp: hero.hp, maxHp: hero.hp, ult: 0, ultReady: false,
      atkCd: 0, dashT: 0, dashCd: 0, dvx: 0, dvy: 0, dashHit: [], inv: 0, down: 0, hurtT: 0, fireT: 0,
      aim: -Math.PI / 2, aimX: BEACON.x, aimY: 200, moving: false,
    },
    beacon: { hp: diff.beacon, max: diff.beacon, hitT: 0, healT: 0, lastSfx: -1 },
    lamps: createLamps(), flares: [], wardMul: 1, relightLamp: null, relightK: 0,
    spark: START_SPARK, motes: [],
    enemies: [], shots: [], foes: [], zones: [], tele: [], hazards: [], allies: [], bolts: [], slams: [], beams: [], ghosts: [], pickups: [],
    parts: [], texts: [], arcs: [], shake: 0, flashA: 0, flashColor: '#ffffff',
    queue: [], spawnT: 0, hpMul: 1, foeDmg: 1, boss: null, bossKills: 0, droneA: 0,
    score: 0, combo: 0, comboT: 0, maxCombo: 0, kills: 0, slowT: 0, nightsSurvived: 0,
    mods: newMods(), picks: {}, offer: null, nextId: 1,
    stats: { damage: 0, ults: 0, beaconDamage: 0, relit: 0, snuffed: 0 },
  };
  // Night 1 opens with one lamp already dark, so the relight is learned at once.
  S.lamps[6].power = 0;
  startNight(S);
  return S;
}

/** A fresh intent: what the player wants this step (move, aim, fire, dash, relight held, ultimate). */
export function newIntent() {
  return { mx: 0, my: 0, ax: BEACON.x, ay: 200, fire: false, dash: false, relight: false, ult: false };
}

export function stepWorld(S, realDt, I) {
  let dt = realDt;
  if (S.slowT > 0) {
    S.slowT -= realDt;
    dt = realDt * 0.3;
  }
  S.time += dt;
  if (S.phase === 'upgrade' || S.result) {
    updateFx(S, dt);
    return;
  }
  updateNight(S, dt);
  revealShadows(S);
  updatePlayer(S, dt, I);
  updateLamps(S, dt, I);
  updateAllies(S, dt);
  updateZones(S, dt);
  updateBosses(S, dt);
  updateEnemies(S, dt);
  updateShots(S, dt);
  updateFoes(S, dt);
  updateTele(S, dt);
  for (const e of S.enemies) {
    if (!e.dead || e.handled) continue;
    e.handled = true;
    handleDeath(S, e);
    if (e.boss) onBossDeath(S, e);
  }
  S.enemies = S.enemies.filter((e) => !e.dead);
  updateMotes(S, dt);
  if (S.comboT > 0 && (S.comboT -= dt) <= 0) S.combo = 0;
  S.beacon.hitT -= dt;
  S.beacon.healT -= dt;
  updateFx(S, dt);
}

/** Takes upgrade `index` of the offer and starts the next night's dusk. */
export function chooseUpgrade(S, index) {
  const id = S.offer?.[index];
  if (!id) return false;
  applyUpgrade(S, id);
  S.lastPick = id;
  S.offer = null;
  S.night += 1;
  const p = S.player;
  if (p.down <= 0) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
  S.beacon.hp = Math.min(S.beacon.max, S.beacon.hp + S.beacon.max * 0.05);
  startNight(S);
  return true;
}

function updatePlayer(S, dt, I) {
  const p = S.player;
  const h = S.hero;
  const m = S.mods;
  p.inv -= dt;
  p.hurtT -= dt;
  p.fireT -= dt;
  p.dashCd -= dt;
  p.atkCd -= dt;
  p.aimX = I.ax;
  p.aimY = I.ay;
  for (const g of S.ghosts) g.t += dt;
  S.ghosts = S.ghosts.filter((g) => g.t < 0.25);
  if (p.down > 0) {
    I.dash = false;
    I.ult = false;
    p.down -= dt;
    if (p.down <= 0) {
      p.x = BEACON.x;
      p.y = BEACON.y + 90;
      p.vx = p.vy = 0;
      p.hp = p.maxHp;
      p.inv = 2;
      ring(S, p.x, p.y, h.color, 10, 90, 0.6, 6);
      S.sfx('ready');
    }
    return;
  }
  p.aim = Math.atan2(I.ay - p.y, I.ax - p.x);
  let mx = I.mx;
  let my = I.my;
  const ml = Math.hypot(mx, my);
  if (ml > 0) {
    mx /= ml;
    my /= ml;
  }
  p.moving = ml > 0;
  if (I.dash && p.dashCd <= 0) {
    const a = ml > 0 ? Math.atan2(my, mx) : p.aim;
    p.dvx = Math.cos(a) * 900;
    p.dvy = Math.sin(a) * 900;
    p.dashT = 0.17;
    p.dashCd = DASH_CD * m.dashCdMul;
    p.dashHit = [];
    S.sfx('dash');
    burst(S, p.x, p.y, h.color, 10, { angle: a + Math.PI, spread: 1.2, speed: 220, life: 0.35, size: 3 });
  }
  I.dash = false;
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.x += p.dvx * dt;
    p.y += p.dvy * dt;
    S.ghosts.push({ x: p.x, y: p.y, a: p.aim, t: 0 });
    if (m.dashStrike) {
      for (const e of S.enemies) {
        if (e.dead || p.dashHit.includes(e.id) || dist(e.x, e.y, p.x, p.y) > e.r + p.r + 8) continue;
        p.dashHit.push(e.id);
        damageEnemy(S, e, m.dashStrike * m.dmgMul, { canCrit: true, color: h.color, kx: p.dvx * 0.5, ky: p.dvy * 0.5 });
      }
    }
  } else {
    // Holding E at a lamp roots the hero while the wick catches.
    const sp = h.speed * m.speedMul * (I.relight && S.relightLamp ? 0.25 : 1);
    const k = Math.min(1, dt * 14);
    p.vx += (mx * sp - p.vx) * k;
    p.vy += (my * sp - p.vy) * k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  pushOutOfBuildings(p, p.r);
  const dc = dist(p.x, p.y, BEACON.x, BEACON.y);
  const minD = BEACON.r + p.r - 6;
  if (dc < minD && dc > 0.01) {
    p.x = BEACON.x + ((p.x - BEACON.x) / dc) * minD;
    p.y = BEACON.y + ((p.y - BEACON.y) / dc) * minD;
  }
  p.x = clamp(p.x, p.r, W - p.r);
  p.y = clamp(p.y, p.r, H - p.r);
  if (I.fire && p.atkCd <= 0) {
    heroAttack(S);
    p.atkCd = h.rate / m.rateMul;
  }
  if (I.ult) {
    if (p.ult >= 100) {
      heroUltimate(S);
      addFlare(S, p.x, p.y, 250 * Math.sqrt(m.ultPower), 4, h.color);
    } else S.sfx('deny');
  }
  I.ult = false;
  const regen = m.regen + (h.id === 'bloom' ? 1.5 : 0);
  if (regen) p.hp = Math.min(p.maxHp, p.hp + regen * dt);
  if (p.ult >= 100 && !p.ultReady) {
    p.ultReady = true;
    S.sfx('ready');
    addText(S, p.x, p.y - 38, 'ULTIMATE READY! [Q]', h.color, 18, true);
  } else if (p.ult < 100) p.ultReady = false;
  for (const pk of S.pickups) {
    pk.t += dt;
    const d = dist(pk.x, pk.y, p.x, p.y);
    if (d < 90) {
      pk.x += ((p.x - pk.x) / d) * 320 * dt;
      pk.y += ((p.y - pk.y) / d) * 320 * dt;
    }
    if (d < 22) {
      pk.t = 99;
      p.hp = Math.min(p.maxHp, p.hp + 22);
      S.sfx('heal');
      burst(S, p.x, p.y, '#7dff6e', 8, { kind: 'plus', speed: 120, vy: -40, life: 0.7, size: 5 });
      addText(S, p.x, p.y - 30, '+22', '#7dff6e', 16);
    }
  }
  S.pickups = S.pickups.filter((pk) => pk.t < 12);
}

/** Spark motes left by banished shadows: they drift, fly to a hero who comes near, then fade. */
function updateMotes(S, dt) {
  const p = S.player;
  for (const m of S.motes) {
    m.t += dt;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    const k = Math.exp(-3 * dt);
    m.vx *= k;
    m.vy *= k;
    if (p.down > 0) continue;
    const d = dist(m.x, m.y, p.x, p.y);
    if (d < 150 * S.mods.magnet && d > 0.1) {
      const pull = 900 * dt;
      m.vx += ((p.x - m.x) / d) * pull;
      m.vy += ((p.y - m.y) / d) * pull;
    }
    if (d < 24) {
      m.t = 99;
      S.spark += m.n;
      S.sfx('spark');
    }
  }
  S.motes = S.motes.filter((m) => m.t < 14);
}

function updateAllies(S, dt) {
  const m = S.mods;
  for (const a of S.allies) {
    a.cd -= dt;
    a.fireT -= dt;
    const e = nearestEnemy(S, a.x, a.y, 430);
    if (!e) continue;
    a.aim = Math.atan2(e.y - a.y, e.x - a.x);
    if (a.cd > 0) continue;
    a.cd = 0.42;
    a.fireT = 0.08;
    S.shots.push({ kind: 'turret', x: a.x + Math.cos(a.aim) * 18, y: a.y + Math.sin(a.aim) * 18, vx: Math.cos(a.aim) * 900, vy: Math.sin(a.aim) * 900, a: a.aim, r: 5, dmg: 9 * m.dmgMul, life: 0.6, pierce: 0, hit: [], t: 0, color: '#8ff3ff', src: 'turret', knock: 20 });
    S.sfx('turret');
  }
  if (!m.drones || S.player.down > 0) return;
  S.droneA += dt * 3.4;
  const p = S.player;
  for (let i = 0; i < m.drones; i += 1) {
    const a = S.droneA + (i / m.drones) * TAU;
    const x = p.x + Math.cos(a) * 58;
    const y = p.y + Math.sin(a) * 58;
    for (const e of S.enemies) {
      if (e.dead || (e.droneT ?? 0) > S.time || dist(x, y, e.x, e.y) > e.r + 10) continue;
      e.droneT = S.time + 0.35;
      damageEnemy(S, e, 16 * m.dmgMul, { color: '#8ff3ff' });
    }
  }
}

function turnTo(a, b, max) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + Math.max(-max, Math.min(max, d));
}

function updateShots(S, dt) {
  for (const s of S.shots) {
    s.t += dt;
    if (s.homing) {
      const e = nearestEnemy(S, s.x, s.y, 320);
      if (e) {
        s.a = turnTo(s.a, Math.atan2(e.y - s.y, e.x - s.x), s.homing * dt);
        const sp = Math.hypot(s.vx, s.vy);
        s.vx = Math.cos(s.a) * sp;
        s.vy = Math.sin(s.a) * sp;
      }
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.kind === 'fire' && S.rng() < (s.src === 'ult' ? 0.2 : 0.6)) burst(S, s.x, s.y, S.rng() < 0.5 ? '#ff7a2e' : '#ffd66b', 1, { speed: 40, life: 0.3, size: 5, drag: 2 });
    else if (s.kind === 'psy' && S.rng() < 0.5) burst(S, s.x, s.y, '#c77dff', 1, { speed: 20, life: 0.35, size: 4 });
    else if (s.kind === 'seed' && S.rng() < 0.15) burst(S, s.x, s.y, '#ff8ade', 1, { kind: 'petal', speed: 30, life: 0.6, size: 4 });
    else if (s.kind === 'ice' && S.rng() < 0.3) burst(S, s.x, s.y, '#bff4ff', 1, { speed: 20, life: 0.3, size: 2 });
    for (const e of S.enemies) {
      if (e.dead || e.grabbed || s.hit.includes(e.id) || dist(s.x, s.y, e.x, e.y) > s.r + e.r) continue;
      s.hit.push(e.id);
      onShotHit(S, s, e);
      s.pierce -= 1;
      if (s.pierce < 0) {
        s.dead = true;
        break;
      }
    }
  }
  S.shots = S.shots.filter((s) => !s.dead && s.t < s.life && s.x > -60 && s.x < W + 60 && s.y > -60 && s.y < H + 60);
}

function updateFoes(S, dt) {
  const p = S.player;
  for (const f of S.foes) {
    f.life -= dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (p.down <= 0 && dist(f.x, f.y, p.x, p.y) < f.r + p.r * 0.8) {
      if (hurtPlayer(S, f.dmg) || p.dashT <= 0) f.life = 0;
    } else if (dist(f.x, f.y, BEACON.x, BEACON.y) < f.r + BEACON.r) {
      hurtBeacon(S, f.dmg);
      f.life = 0;
    } else if (pushOutOfBuildings({ x: f.x, y: f.y }, f.r)) f.life = 0;
    if (f.life <= 0) burst(S, f.x, f.y, f.color, 6, { speed: 140, life: 0.3, size: 3 });
  }
  S.foes = S.foes.filter((f) => f.life > 0 && f.x > -80 && f.x < W + 80 && f.y > -80 && f.y < H + 80);
}

function updateTele(S, dt) {
  const fire = [];
  for (const tl of S.tele) {
    tl.t += dt;
    if (tl.t >= tl.dur) fire.push(tl);
  }
  if (fire.length) {
    S.tele = S.tele.filter((tl) => tl.t < tl.dur);
    for (const tl of fire) tl.fire(S, tl);
  }
  const p = S.player;
  for (const hz of S.hazards) {
    hz.t += dt;
    if (p.down > 0 || p.dashT > 0 || dist(hz.x, hz.y, p.x, p.y) > hz.r + p.r * 0.5) continue;
    if (p.hp > hz.dps * dt + 1) {
      p.hp -= hz.dps * dt;
      p.hurtT = 0.1;
    } else hurtPlayer(S, 5);
  }
  S.hazards = S.hazards.filter((hz) => hz.t < hz.dur);
  for (const s of S.slams) s.t += dt;
  S.slams = S.slams.filter((s) => s.t < 0.6);
  for (const b of S.beams) b.t += dt;
  S.beams = S.beams.filter((b) => b.t < 0.45);
}
