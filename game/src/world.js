// The game world and its fixed-step update: the hero, allies, projectiles, monsters, bosses,
// telegraphed attacks, hazards, pickups, combo and score, and the wave cycle
// (intro -> fight -> clear -> upgrade -> next wave, until wave 15 is beaten or the Core falls).
import { H, PLAZA, TAU, W, clamp, damageEnemy, dist, hurtPlaza, hurtPlayer, nearestEnemy, pushOutOfBuildings } from './combat.js';
import { createRandom } from './random.js';
import { HEROES, heroAttack, heroUltimate, onShotHit, updateZones } from './heroes.js';
import { handleDeath, updateEnemies } from './enemies.js';
import { onBossDeath, updateBosses } from './bosses.js';
import { MAX_WAVE, buildWave, updateSpawns, waveBanner } from './waves.js';
import { applyUpgrade, newMods, rollOffer } from './upgrades.js';
import { addText, burst, ring, updateFx } from './particles.js';

export function createWorld(seed, heroIndex) {
  const hero = HEROES[heroIndex];
  return {
    rng: createRandom(seed), sfx: () => {}, hero, heroIndex,
    time: 0, wave: 1, phase: 'intro', phaseT: 0, result: null, banner: waveBanner(1), ultFx: null,
    player: {
      x: PLAZA.x, y: PLAZA.y + 100, vx: 0, vy: 0, r: 15, hp: hero.hp, maxHp: hero.hp, ult: 0, ultReady: false,
      atkCd: 0, dashT: 0, dashCd: 0, dvx: 0, dvy: 0, dashHit: [], inv: 0, down: 0, hurtT: 0, fireT: 0,
      aim: -Math.PI / 2, aimX: PLAZA.x, aimY: 200, moving: false,
    },
    plaza: { hp: 1000, max: 1000, hitT: 0, healT: 0, lastSfx: -1 },
    enemies: [], shots: [], foes: [], zones: [], tele: [], hazards: [], allies: [], bolts: [], slams: [], beams: [], ghosts: [], pickups: [],
    parts: [], texts: [], arcs: [], shake: 0, flashA: 0, flashColor: '#ffffff',
    queue: [], waveT: 0, hpMul: 1, boss: null, bossKills: 0, droneA: 0,
    score: 0, combo: 0, comboT: 0, maxCombo: 0, kills: 0, slowT: 0,
    mods: newMods(), picks: {}, offer: null, nextId: 1,
    stats: { damage: 0, ults: 0, coreDamage: 0 },
  };
}

/** A fresh intent: what the player wants this step (movement, aim point, fire, dash, ultimate). */
export function newIntent() {
  return { mx: 0, my: 0, ax: PLAZA.x, ay: 200, fire: false, dash: false, ult: false };
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
  updatePhase(S, dt);
  updatePlayer(S, dt, I);
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
  if (S.comboT > 0 && (S.comboT -= dt) <= 0) S.combo = 0;
  S.plaza.hitT -= dt;
  S.plaza.healT -= dt;
  updateFx(S, dt);
}

export function chooseUpgrade(S, index) {
  const id = S.offer?.[index];
  if (!id) return false;
  applyUpgrade(S, id);
  S.lastPick = id;
  S.offer = null;
  S.wave += 1;
  S.phase = 'intro';
  S.phaseT = 0;
  S.banner = waveBanner(S.wave);
  const p = S.player;
  if (p.down <= 0) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
  S.plaza.hp = Math.min(S.plaza.max, S.plaza.hp + S.plaza.max * 0.04);
  return true;
}

function updatePhase(S, dt) {
  S.phaseT += dt;
  if (S.banner && (S.banner.t += dt) > S.banner.dur) S.banner = null;
  if (S.ultFx && (S.ultFx.t += dt) > 1.6) S.ultFx = null;
  if (S.phase === 'intro') {
    if (S.phaseT > 2.3) {
      S.phase = 'fight';
      S.phaseT = 0;
      buildWave(S, S.wave);
      S.sfx('go');
    }
  } else if (S.phase === 'fight') {
    updateSpawns(S, dt);
    if (!S.queue.length && !S.enemies.some((e) => !e.dead)) {
      S.phase = 'clear';
      S.phaseT = 0;
      const bonus = 100 * S.wave + Math.round((300 * S.plaza.hp) / S.plaza.max);
      S.score += bonus;
      S.banner = { title: S.wave >= MAX_WAVE ? 'CITY SAVED!' : 'WAVE CLEAR!', sub: `+${bonus} bonus`, t: 0, dur: 2, color: '#7dff6e' };
      S.foes = [];
      S.tele = [];
      S.sfx('clear');
    }
  } else if (S.phase === 'clear' && S.phaseT > 2.1) {
    if (S.wave >= MAX_WAVE) S.result = 'victory';
    else {
      S.phase = 'upgrade';
      S.offer = rollOffer(S);
      S.sfx('offer');
    }
  }
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
      p.x = PLAZA.x;
      p.y = PLAZA.y + 90;
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
    p.dashCd = 0.85 * m.dashCdMul;
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
    const sp = h.speed * m.speedMul;
    const k = Math.min(1, dt * 14);
    p.vx += (mx * sp - p.vx) * k;
    p.vy += (my * sp - p.vy) * k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  pushOutOfBuildings(p, p.r);
  const dc = dist(p.x, p.y, PLAZA.x, PLAZA.y);
  const minD = PLAZA.r + p.r - 6;
  if (dc < minD && dc > 0.01) {
    p.x = PLAZA.x + ((p.x - PLAZA.x) / dc) * minD;
    p.y = PLAZA.y + ((p.y - PLAZA.y) / dc) * minD;
  }
  p.x = clamp(p.x, p.r, W - p.r);
  p.y = clamp(p.y, p.r, H - p.r);
  if (I.fire && p.atkCd <= 0) {
    heroAttack(S);
    p.atkCd = h.rate / m.rateMul;
  }
  if (I.ult) {
    if (p.ult >= 100) heroUltimate(S);
    else S.sfx('deny');
  }
  I.ult = false;
  const regen = m.regen + (h.id === 'bloom' ? 1.5 : 0);
  if (regen) p.hp = Math.min(p.maxHp, p.hp + regen * dt);
  if (p.ult >= 100 && !p.ultReady) {
    p.ultReady = true;
    S.sfx('ready');
    addText(S, p.x, p.y - 38, 'ULTIMATE READY! [E]', h.color, 18, true);
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
    } else if (dist(f.x, f.y, PLAZA.x, PLAZA.y) < f.r + PLAZA.r) {
      hurtPlaza(S, f.dmg);
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
