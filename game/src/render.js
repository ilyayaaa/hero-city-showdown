// Painting the world: the dusk city (pre-rendered once: streets, roundabout plaza, rooftops,
// neon signs, street lamps), the City Core, then everything alive in the right order, and the
// screen-wide light (vignette, flashes, low-health pulse).
import { BUILDINGS, H, PLAZA, TAU, W } from './combat.js';
import { createRandom } from './random.js';
import { drawHero, drawShot, drawZones } from './heroes.js';
import { drawEnemy } from './enemies.js';
import { drawBoss, drawBossFx, drawHazards, drawTele } from './bosses.js';
import { FONT, drawArcs, drawParts, drawTexts, glow, hexA } from './particles.js';

const M = 32;
let bg = null;
let vignette = null;

/** o.noHero: draw the city without the hero (menu backdrops). */
export function drawWorld(ctx, S, o = {}) {
  if (!bg) bg = buildBackground();
  if (!vignette) vignette = buildVignette();
  const t = S.time;
  const sx = S.shake ? Math.sin(t * 97.3) * S.shake : 0;
  const sy = S.shake ? Math.cos(t * 81.7) * S.shake : 0;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.drawImage(bg, -M, -M);
  drawLights(ctx, t);
  drawZones(ctx, S, true);
  drawHazards(ctx, S);
  drawTele(ctx, S);
  for (const pk of S.pickups) {
    const y = pk.y - 6 + Math.sin(pk.t * 5) * 3;
    glow(ctx, pk.x, y, 26, '#7dff6e', 0.8);
    ctx.fillStyle = '#eaffe0';
    ctx.fillRect(pk.x - 6, y - 2, 12, 4);
    ctx.fillRect(pk.x - 2, y - 6, 4, 12);
  }
  drawCore(ctx, S);
  for (const a of S.allies) drawTurret(ctx, a, t);
  const p = S.player;
  const ground = S.enemies.filter((e) => !e.fly && e.lift <= 0 && !e.grabbed && !e.thrown && !(e.boss && e.kind === 'kraken'));
  const kraken = S.enemies.find((e) => e.kind === 'kraken');
  if (kraken) drawBoss(ctx, kraken, t);
  const order = ground.map((e) => [e.y, e]);
  if (p.down <= 0 && !o.noHero) order.push([p.y, null]);
  order.sort((a, b) => a[0] - b[0]);
  if (o.noHero) S.ghosts.length = 0;
  for (const g of S.ghosts) drawHero(ctx, S.hero, g.x, g.y, g.a, t, { alpha: 0.35 * (1 - g.t / 0.25), scale: 1.15 });
  for (const [, e] of order) {
    if (e === null) {
      const blink = p.inv > 0 && p.dashT <= 0 && Math.sin(t * 40) > 0;
      drawHero(ctx, S.hero, p.x, p.y, p.aim, t, { moving: p.moving, fire: Math.max(0, p.fireT) * 8, alpha: blink ? 0.45 : 1, scale: 1.15 });
      if (p.hurtT > 0) glow(ctx, p.x, p.y, 40, '#ff3355', p.hurtT * 2);
    } else if (e.boss) drawBoss(ctx, e, t);
    else drawEnemy(ctx, e, t);
  }
  if (p.down > 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `900 16px ${FONT}`;
    ctx.fillStyle = '#ff8a9a';
    ctx.fillText(`RESPAWN ${Math.ceil(p.down)}`, PLAZA.x, PLAZA.y + 92);
    ctx.restore();
  }
  for (const s of S.shots) drawShot(ctx, s, t);
  for (const f of S.foes) drawFoe(ctx, f, t);
  drawBossFx(ctx, S);
  for (const e of S.enemies) {
    if (e.kind === 'kraken' || !(e.fly || e.lift > 0 || e.grabbed || e.thrown)) continue;
    if (e.boss) drawBoss(ctx, e, t);
    else drawEnemy(ctx, e, t);
  }
  drawZones(ctx, S, false);
  if (S.mods.drones && p.down <= 0) {
    for (let i = 0; i < S.mods.drones; i += 1) {
      const a = S.droneA + (i / S.mods.drones) * TAU;
      const x = p.x + Math.cos(a) * 58;
      const y = p.y + Math.sin(a) * 58 - 10;
      glow(ctx, x, y, 22, '#8ff3ff', 0.8);
      ctx.fillStyle = '#16314a';
      ctx.strokeStyle = '#8ff3ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200,250,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.stroke();
    }
  }
  drawParts(ctx, S);
  drawArcs(ctx, S);
  drawTexts(ctx, S);
  ctx.restore();
  ctx.drawImage(vignette, 0, 0);
  if (S.flashA > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, S.flashA);
    ctx.fillStyle = hexA(S.flashColor, 0.6);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const low = p.down > 0 ? 1 : p.hp / p.maxHp < 0.3 ? 0.6 : S.plaza.hp / S.plaza.max < 0.25 ? 0.45 : 0;
  if (low) {
    ctx.save();
    ctx.globalAlpha = low * (0.5 + Math.sin(t * 6) * 0.3);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, 'rgba(255,0,60,0)');
    g.addColorStop(1, 'rgba(255,0,60,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function drawFoe(ctx, f, t) {
  if (f.kind === 'ink') {
    glow(ctx, f.x, f.y, 22, '#7a5cff', 0.7);
    ctx.fillStyle = '#1b1238';
    ctx.strokeStyle = '#b9a6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    return;
  }
  glow(ctx, f.x, f.y, f.r * 3.4, f.color, 0.9);
  ctx.fillStyle = f.kind === 'glob' ? '#e8ffb8' : '#fff4d0';
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.r * (0.65 + Math.sin(t * 20 + f.x) * 0.08), 0, TAU);
  ctx.fill();
}

function drawTurret(ctx, a, t) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 20, 9, 0, 0, TAU);
  ctx.fill();
  glow(ctx, 0, 0, 34, '#8ff3ff', 0.35 + Math.sin(t * 4) * 0.1);
  ctx.fillStyle = '#1f2a4a';
  ctx.strokeStyle = '#8ff3ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) ctx.lineTo(Math.cos((i / 6) * TAU) * 16, Math.sin((i / 6) * TAU) * 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.rotate(a.aim);
  ctx.fillStyle = '#c9f9ff';
  ctx.fillRect(2, -3.5, 18, 7);
  ctx.fillStyle = '#2e3d66';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, TAU);
  ctx.fill();
  ctx.stroke();
  if (a.fireT > 0) glow(ctx, 22, 0, 18, '#ffffff', 1);
  ctx.restore();
}

function drawCore(ctx, S) {
  const z = S.plaza;
  const k = z.hp / z.max;
  const t = S.time;
  const col = k > 0.5 ? '#5ef2ff' : k > 0.25 ? '#ffd23f' : '#ff4d6a';
  const { x, y } = PLAZA;
  ctx.save();
  glow(ctx, x, y - 10, 150, col, 0.35 + Math.sin(t * 2) * 0.05);
  ctx.fillStyle = '#2a2147';
  ctx.strokeStyle = hexA(col, 0.9);
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * TAU + Math.PI / 6;
    ctx.lineTo(x + Math.cos(a) * 40, y + Math.sin(a) * 30 + 6);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(10,6,24,0.8)';
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 54, 42, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 54, 42, 0, -Math.PI / 2, -Math.PI / 2 + TAU * k);
  ctx.stroke();
  for (let i = 0; i < 3; i += 1) {
    const a = t * 1.6 + (i / 3) * TAU;
    glow(ctx, x + Math.cos(a) * 54, y + 6 + Math.sin(a) * 42, 12, col, 0.9);
  }
  const bob = Math.sin(t * 2.4) * 4;
  const cy = y - 22 + bob;
  const g = ctx.createLinearGradient(x - 18, cy - 30, x + 18, cy + 24);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, col);
  g.addColorStop(1, hexA(col, 0.4));
  ctx.fillStyle = g;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, cy - 34);
  ctx.lineTo(x + 17, cy - 6);
  ctx.lineTo(x, cy + 22);
  ctx.lineTo(x - 17, cy - 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.moveTo(x, cy - 34);
  ctx.lineTo(x, cy + 22);
  ctx.moveTo(x - 17, cy - 6);
  ctx.lineTo(x + 17, cy - 6);
  ctx.stroke();
  glow(ctx, x, cy - 6, 50, col, 0.8);
  if (z.hitT > 0) glow(ctx, x, cy, 90, '#ff3355', z.hitT * 3);
  if (z.healT > 0) glow(ctx, x, cy, 90, '#7dff6e', z.healT * 2);
  ctx.restore();
}

/** Lamp and neon glows that breathe a little over the static city. */
function drawLights(ctx, t) {
  for (const [x, y, c, r] of LIGHTS) glow(ctx, x, y, r, c, 0.16 + Math.sin(t * 1.3 + x) * 0.03);
}

const LIGHTS = [
  [360, 300, '#ffcf7a', 90], [920, 300, '#ffcf7a', 90], [360, 470, '#ffcf7a', 90], [920, 470, '#ffcf7a', 90],
  [550, 120, '#ffcf7a', 80], [730, 120, '#ffcf7a', 80], [550, 640, '#ffcf7a', 80], [730, 640, '#ffcf7a', 80],
  [90, 240, '#ff4fb0', 120], [1190, 240, '#33e6ff', 120], [150, 540, '#ff4fb0', 100], [1130, 540, '#ffd23f', 100],
];

function buildVignette() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const top = g.createLinearGradient(0, 0, 0, H);
  top.addColorStop(0, 'rgba(255,110,80,0.07)');
  top.addColorStop(0.5, 'rgba(0,0,0,0)');
  top.addColorStop(1, 'rgba(60,10,110,0.12)');
  g.fillStyle = top;
  g.fillRect(0, 0, W, H);
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, W * 0.72);
  v.addColorStop(0, 'rgba(6,2,18,0)');
  v.addColorStop(1, 'rgba(6,2,18,0.6)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  return c;
}

// ---------------------------------------------------------------- the city, drawn once

const ROAD = '#17112b';
const PAVE = '#251d3d';

function buildBackground() {
  const c = document.createElement('canvas');
  c.width = W + M * 2;
  c.height = H + M * 2;
  const g = c.getContext('2d');
  g.translate(M, M);
  const rnd = createRandom(2024);
  g.fillStyle = PAVE;
  g.fillRect(-M, -M, W + M * 2, H + M * 2);
  g.strokeStyle = 'rgba(255,255,255,0.035)';
  g.lineWidth = 1;
  for (let x = -M; x < W + M; x += 40) line(g, x, -M, x, H + M);
  for (let y = -M; y < H + M; y += 40) line(g, -M, y, W + M, y);
  for (let i = 0; i < 3000; i += 1) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.1)';
    g.fillRect(rnd() * W, rnd() * H, 2, 2);
  }
  // roads and the roundabout
  g.fillStyle = ROAD;
  g.fillRect(-M, 318, W + M * 2, 132);
  g.fillRect(574, -M, 132, H + M * 2);
  g.beginPath();
  g.arc(PLAZA.x, PLAZA.y, 205, 0, TAU);
  g.fill();
  for (let i = 0; i < 1500; i += 1) {
    g.fillStyle = 'rgba(255,255,255,0.025)';
    const a = rnd() * TAU;
    const r = rnd() * 205;
    g.fillRect(PLAZA.x + Math.cos(a) * r, PLAZA.y + Math.sin(a) * r, 2, 2);
  }
  g.strokeStyle = '#3d3264';
  g.lineWidth = 3;
  for (const [x1, y1, x2, y2] of [[-M, 318, 452, 318], [828, 318, W + M, 318], [-M, 450, 452, 450], [828, 450, W + M, 450]]) line(g, x1, y1, x2, y2);
  for (const [x1, y1, x2, y2] of [[574, -M, 574, 200], [706, -M, 706, 200], [574, 568, 574, H + M], [706, 568, 706, H + M]]) line(g, x1, y1, x2, y2);
  g.setLineDash([22, 18]);
  g.strokeStyle = 'rgba(240,200,90,0.5)';
  g.lineWidth = 3;
  line(g, -M, 384, 420, 384);
  line(g, 860, 384, W + M, 384);
  line(g, 640, -M, 640, 165);
  line(g, 640, 605, 640, H + M);
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.beginPath();
  g.arc(PLAZA.x, PLAZA.y, 168, 0, TAU);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = 'rgba(235,230,255,0.22)';
  for (let k = 0; k < 9; k += 1) {
    g.fillRect(408, 326 + k * 14, 26, 8);
    g.fillRect(846, 326 + k * 14, 26, 8);
    g.fillRect(582 + k * 14, 150, 8, 26);
    g.fillRect(582 + k * 14, 592, 8, 26);
  }
  // the plaza island
  g.fillStyle = '#2c2350';
  g.beginPath();
  g.arc(PLAZA.x, PLAZA.y, 132, 0, TAU);
  g.fill();
  g.strokeStyle = '#c9a24a';
  g.globalAlpha = 0.55;
  g.lineWidth = 3;
  g.stroke();
  g.globalAlpha = 1;
  g.strokeStyle = '#3d3170';
  g.lineWidth = 2;
  for (const r of [62, 92, 118]) {
    g.beginPath();
    g.arc(PLAZA.x, PLAZA.y, r, 0, TAU);
    g.stroke();
  }
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * TAU;
    line(g, PLAZA.x + Math.cos(a) * 62, PLAZA.y + Math.sin(a) * 62, PLAZA.x + Math.cos(a) * 130, PLAZA.y + Math.sin(a) * 130);
  }
  g.fillStyle = '#3a2d6a';
  g.strokeStyle = '#6b58b0';
  g.beginPath();
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * TAU - Math.PI / 2;
    const r = i % 2 ? 30 : 62;
    g.lineTo(PLAZA.x + Math.cos(a) * r, PLAZA.y + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.stroke();
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * TAU + Math.PI / 4;
    planter(g, PLAZA.x + Math.cos(a) * 100, PLAZA.y + Math.sin(a) * 100, rnd);
  }
  // sidewalks around the blocks
  for (const b of BUILDINGS) {
    g.fillStyle = '#2e2548';
    g.fillRect(b.x - 16, b.y - 16, b.w + 32, b.h + 32);
    g.strokeStyle = '#4a3d78';
    g.lineWidth = 2;
    g.strokeRect(b.x - 16, b.y - 16, b.w + 32, b.h + 32);
  }
  // street furniture
  for (const [x, y] of [[330, 250], [520, 255], [760, 255], [950, 250], [330, 515], [520, 512], [760, 512], [950, 515], [420, 90], [860, 90], [420, 660], [860, 660]]) tree(g, x, y, rnd);
  for (const [x, y, a, col] of [[70, 340, 0, '#ff4f7b'], [190, 426, Math.PI, '#4fd0ff'], [1220, 340, 0, '#ffd23f'], [1090, 428, Math.PI, '#b06bff'], [596, 40, Math.PI / 2, '#5effa0'], [684, 680, -Math.PI / 2, '#ff8a3c']]) car(g, x, y, a, col);
  for (const [x, y] of [[360, 300], [920, 300], [360, 470], [920, 470], [550, 120], [730, 120], [550, 640], [730, 640]]) lamp(g, x, y);
  // buildings
  building(g, { x: -M, y: -M, w: 170 + M, h: 200 + M, roof: '#2e2549', face: 46, sign: ['HOTEL', '#ff4fb0'], feat: 'tank' }, rnd);
  building(g, { x: 170, y: -M, w: 130, h: 200 + M, roof: '#362a54', face: 30, sign: ['RAMEN', '#33e6ff'], feat: 'garden' }, rnd);
  building(g, { x: 980, y: -M, w: 140, h: 200 + M, roof: '#2a2f55', face: 38, sign: ['ARCADE', '#ffd23f'], feat: 'solar' }, rnd);
  building(g, { x: 1120, y: -M, w: 160 + M, h: 200 + M, roof: '#33264c', face: 54, sign: ['HERO HQ', '#33e6ff'], feat: 'heli' }, rnd);
  building(g, { x: -M, y: 566, w: 165 + M, h: 154 + M, roof: '#2b2448', face: 0, feat: 'skylight' }, rnd);
  building(g, { x: 165, y: 566, w: 135, h: 154 + M, roof: '#30284f', face: 0, sign: ['24/7', '#ff4fb0'], feat: 'ac' }, rnd);
  building(g, { x: 980, y: 566, w: 150, h: 154 + M, roof: '#28304f', face: 0, sign: ['CAFE', '#5effa0'], feat: 'tank' }, rnd);
  building(g, { x: 1130, y: 566, w: 150 + M, h: 154 + M, roof: '#352649', face: 0, feat: 'pool' }, rnd);
  return c;
}

function line(g, x1, y1, x2, y2) {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

function planter(g, x, y, rnd) {
  g.fillStyle = '#1a1430';
  g.beginPath();
  g.arc(x, y, 17, 0, TAU);
  g.fill();
  g.strokeStyle = '#c9a24a';
  g.globalAlpha = 0.5;
  g.lineWidth = 2;
  g.stroke();
  g.globalAlpha = 1;
  for (let i = 0; i < 6; i += 1) {
    g.fillStyle = i % 2 ? '#2f8a54' : '#3fb06a';
    g.beginPath();
    g.arc(x + (rnd() - 0.5) * 14, y + (rnd() - 0.5) * 14, 7, 0, TAU);
    g.fill();
  }
  for (let i = 0; i < 5; i += 1) {
    g.fillStyle = rnd() < 0.5 ? '#ff7ad9' : '#ffe96b';
    g.fillRect(x + (rnd() - 0.5) * 18, y + (rnd() - 0.5) * 18, 3, 3);
  }
}

function tree(g, x, y, rnd) {
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(x + 6, y + 8, 24, 16, 0, 0, TAU);
  g.fill();
  for (let i = 0; i < 7; i += 1) {
    const a = rnd() * TAU;
    const r = rnd() * 9;
    const gr = g.createRadialGradient(x + Math.cos(a) * r - 4, y + Math.sin(a) * r - 4, 2, x + Math.cos(a) * r, y + Math.sin(a) * r, 14);
    gr.addColorStop(0, '#3fae7a');
    gr.addColorStop(1, '#14473a');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 13, 0, TAU);
    g.fill();
  }
}

function car(g, x, y, a, col) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(-22, -9, 48, 24);
  g.fillStyle = col;
  roundRect(g, -24, -12, 48, 24, 6);
  g.fill();
  g.fillStyle = '#121022';
  roundRect(g, -10, -9, 22, 18, 4);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(-6, -7, 12, 14);
  g.fillStyle = '#fff3c0';
  g.fillRect(21, -10, 3, 5);
  g.fillRect(21, 5, 3, 5);
  g.fillStyle = '#ff3355';
  g.fillRect(-24, -10, 3, 5);
  g.fillRect(-24, 5, 3, 5);
  g.globalCompositeOperation = 'lighter';
  const hl = g.createRadialGradient(40, 0, 0, 40, 0, 40);
  hl.addColorStop(0, 'rgba(255,240,190,0.28)');
  hl.addColorStop(1, 'rgba(255,240,190,0)');
  g.fillStyle = hl;
  g.beginPath();
  g.moveTo(22, 0);
  g.lineTo(84, -26);
  g.lineTo(84, 26);
  g.closePath();
  g.fill();
  g.restore();
}

function lamp(g, x, y) {
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.beginPath();
  g.ellipse(x + 3, y + 4, 6, 3, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#4a3f6a';
  g.beginPath();
  g.arc(x, y, 4, 0, TAU);
  g.fill();
  g.fillStyle = '#fff1c8';
  g.beginPath();
  g.arc(x, y, 2, 0, TAU);
  g.fill();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function neon(g, text, x, y, size, color) {
  g.save();
  g.font = `900 ${size}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.shadowBlur = 6;
  g.fillStyle = '#ffffff';
  g.globalAlpha = 0.85;
  g.fillText(text, x, y);
  g.restore();
}

function building(g, b, rnd) {
  const roofH = b.h - b.face;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(b.x + 8, b.y + 8, b.w, b.h);
  // facade with windows (visible on blocks south of the camera's horizon)
  if (b.face) {
    const fy = b.y + roofH;
    const fg = g.createLinearGradient(0, fy, 0, fy + b.face);
    fg.addColorStop(0, '#1a1430');
    fg.addColorStop(1, '#120d24');
    g.fillStyle = fg;
    g.fillRect(b.x, fy, b.w, b.face);
    for (let wx = b.x + 8; wx < b.x + b.w - 10; wx += 15) {
      for (let wy = fy + 6; wy < fy + b.face - 8; wy += 12) {
        const r = rnd();
        if (r < 0.5) {
          const col = r < 0.32 ? '#ffcf7a' : r < 0.42 ? '#7af0ff' : '#ff8ad8';
          g.fillStyle = hexA(col, 0.25);
          g.fillRect(wx - 2, wy - 2, 13, 10);
          g.fillStyle = col;
        } else g.fillStyle = '#231b3d';
        g.fillRect(wx, wy, 9, 6);
      }
    }
    if (b.sign) {
      const sx = b.x + b.w / 2 + (b.x < 0 ? M / 2 : 0);
      const ref = g.createRadialGradient(sx, b.y + b.h + 30, 0, sx, b.y + b.h + 30, 90);
      ref.addColorStop(0, hexA(b.sign[1], 0.22));
      ref.addColorStop(1, hexA(b.sign[1], 0));
      g.fillStyle = ref;
      g.fillRect(sx - 90, b.y + b.h - 60, 180, 180);
    }
  }
  // roof
  g.fillStyle = b.roof;
  g.fillRect(b.x, b.y, b.w, roofH);
  for (let i = 0; i < (b.w * roofH) / 40; i += 1) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.12)';
    g.fillRect(b.x + rnd() * b.w, b.y + rnd() * roofH, 2, 2);
  }
  g.strokeStyle = 'rgba(160,140,230,0.35)';
  g.lineWidth = 4;
  g.strokeRect(b.x + 4, b.y + 4, b.w - 8, roofH - 8);
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.lineWidth = 2;
  g.strokeRect(b.x + 8, b.y + 8, b.w - 16, roofH - 16);
  const cx = b.x + b.w / 2 + (b.x < 0 ? M / 2 : 0);
  const cy = b.y + roofH / 2 + (b.y < 0 ? M / 2 : 0);
  switch (b.feat) {
    case 'tank': {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.beginPath();
      g.arc(cx + 6, cy + 6, 26, 0, TAU);
      g.fill();
      const tg = g.createRadialGradient(cx - 8, cy - 8, 2, cx, cy, 26);
      tg.addColorStop(0, '#8a6a58');
      tg.addColorStop(1, '#3e2c2a');
      g.fillStyle = tg;
      g.beginPath();
      g.arc(cx, cy, 24, 0, TAU);
      g.fill();
      g.strokeStyle = '#21161a';
      g.stroke();
      ac(g, cx - 50, cy + 10);
      break;
    }
    case 'garden':
      for (let i = 0; i < 6; i += 1) {
        g.fillStyle = i % 2 ? '#2b7a4c' : '#36985c';
        g.fillRect(b.x + 18 + (i % 2) * 48, b.y + 40 + Math.floor(i / 2) * 36, 40, 26);
      }
      break;
    case 'solar':
      for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 4; j += 1) {
          g.fillStyle = '#23407a';
          g.fillRect(b.x + 16 + i * 38, b.y + 30 + j * 30, 32, 24);
          g.strokeStyle = 'rgba(120,180,255,0.35)';
          g.lineWidth = 1;
          g.strokeRect(b.x + 16 + i * 38, b.y + 30 + j * 30, 32, 24);
        }
      }
      break;
    case 'heli':
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(cx, cy, 40, 0, TAU);
      g.stroke();
      g.font = `900 40px ${FONT}`;
      g.fillStyle = '#ffd23f';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('H', cx, cy + 2);
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * TAU;
        g.fillStyle = i % 2 ? '#ff4f7b' : '#5ef2ff';
        g.beginPath();
        g.arc(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52, 3, 0, TAU);
        g.fill();
      }
      break;
    case 'skylight':
      for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 3; j += 1) {
          g.fillStyle = 'rgba(120,230,255,0.22)';
          g.fillRect(b.x + 40 + i * 34, b.y + 22 + j * 36, 26, 26);
          g.strokeStyle = 'rgba(160,240,255,0.5)';
          g.lineWidth = 1;
          g.strokeRect(b.x + 40 + i * 34, b.y + 22 + j * 36, 26, 26);
        }
      }
      break;
    case 'ac':
      ac(g, b.x + 30, b.y + 50);
      ac(g, b.x + 80, b.y + 50);
      ac(g, b.x + 30, b.y + 100);
      break;
    case 'pool': {
      const pg = g.createLinearGradient(b.x + 20, b.y + 26, b.x + 120, b.y + 110);
      pg.addColorStop(0, '#3ff0ff');
      pg.addColorStop(1, '#1060c0');
      g.fillStyle = pg;
      roundRect(g, b.x + 20, b.y + 26, 110, 70, 10);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        g.beginPath();
        g.moveTo(b.x + 30 + i * 22, b.y + 50);
        g.quadraticCurveTo(b.x + 40 + i * 22, b.y + 44, b.x + 50 + i * 22, b.y + 50);
        g.stroke();
      }
      break;
    }
    default:
  }
  if (b.sign) {
    const sx = b.x + b.w / 2 + (b.x < 0 ? M / 2 : 0);
    const sy = b.face ? b.y + roofH + b.face / 2 : b.y + 7;
    const w = b.sign[0].length * 15 + 22;
    g.fillStyle = 'rgba(10,6,22,0.9)';
    g.fillRect(sx - w / 2, sy - 14, w, 28);
    g.strokeStyle = hexA(b.sign[1], 0.6);
    g.lineWidth = 2;
    g.strokeRect(sx - w / 2, sy - 14, w, 28);
    neon(g, b.sign[0], sx, sy + 1, 19, b.sign[1]);
  }
}

function ac(g, x, y) {
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(x + 4, y + 4, 30, 24);
  g.fillStyle = '#5a5478';
  g.fillRect(x, y, 30, 24);
  g.strokeStyle = '#2a2640';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(x + 15, y + 12, 8, 0, TAU);
  g.stroke();
  line(g, x + 9, y + 12, x + 21, y + 12);
}
