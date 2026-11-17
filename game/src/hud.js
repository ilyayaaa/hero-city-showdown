// The heads-up display over the night: the night counter and dawn timer, the Beacon light bar
// with its lamp wards, the WIN / LOSE line, the boss bar, score and chain, blessing chips, the
// hero's HP and Spark, the four skill keys with their cooldowns, the minimap, the night banners
// and the ultimate's name call-out.
import { H, TAU, W } from './combat.js';
import { comboMult } from './enemies.js';
import { drawPortrait } from './heroes.js';
import { BY_ID, RARITY, drawIcon } from './upgrades.js';
import { BOSS_TITLE } from './bosses.js';
import { GOAL_TEXT, NIGHTS, dawnLeft } from './night.js';
import { WARD_PER_LAMP, relightCost } from './lamps.js';
import { DASH_CD } from './world.js';
import { MINIMAP, drawMinimap } from './minimap.js';
import { FONT, glow, hexA } from './particles.js';

const GOLD = '#ffcf5a';
const INK = 'rgba(6,9,26,0.9)';

export function panel(ctx, x, y, w, h, r = 12, stroke = 'rgba(120,150,255,0.35)') {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(7,11,32,0.78)';
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function text(ctx, s, x, y, size, color, align = 'left', weight = 900) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size / 6);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

export function bar(ctx, x, y, w, h, k, c1, c2, back = 'rgba(255,255,255,0.08)') {
  ctx.fillStyle = 'rgba(3,5,16,0.88)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  const f = Math.max(0, Math.min(1, k));
  ctx.fillRect(x, y, w * f, h);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x, y, w * f, h * 0.35);
}

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function drawHud(ctx, S) {
  ctx.save();
  drawNightPanel(ctx, S);
  drawBeaconPanel(ctx, S);
  drawGoalLine(ctx, W / 2, 82);
  drawBossBar(ctx, S);
  drawScorePanel(ctx, S);
  drawChips(ctx, S);
  drawHeroPanel(ctx, S);
  drawSkillKeys(ctx, S);
  drawMinimap(ctx, S, W - 16 - MINIMAP.w, H - 14 - MINIMAP.h);
  text(ctx, 'P pause  ·  M mute', W - 20, H - 140, 11, 'rgba(190,200,255,0.6)', 'right', 700);
  if (S.banner) drawBanner(ctx, S.banner);
  if (S.ultFx) drawUltCallout(ctx, S.ultFx);
  ctx.restore();
}

function drawNightPanel(ctx, S) {
  panel(ctx, 16, 12, 262, 92, 14, hexA(GOLD, 0.45));
  text(ctx, 'NIGHT', 32, 30, 13, '#9fb0ff');
  text(ctx, `${S.night}`, 32, 60, 38, '#ffffff');
  ctx.font = `900 38px ${FONT}`;
  const nw = ctx.measureText(`${S.night}`).width;
  text(ctx, `/ ${NIGHTS}`, 38 + nw, 64, 18, '#8a9ad8');
  const diff = S.diff;
  ctx.font = `900 11px ${FONT}`;
  const dw = ctx.measureText(diff.name).width + 14;
  ctx.fillStyle = hexA(diff.color, 0.18);
  ctx.fillRect(262 - dw, 22, dw, 17);
  ctx.strokeStyle = hexA(diff.color, 0.7);
  ctx.lineWidth = 1;
  ctx.strokeRect(262 - dw + 0.5, 22.5, dw - 1, 16);
  text(ctx, diff.name, 262 - dw / 2, 31, 11, diff.color, 'center');
  // Dawn timer and the moon-to-sun track.
  const bossHolds = S.phase === 'night' && S.boss && !S.boss.dead && dawnLeft(S) <= 0;
  let label;
  let col = GOLD;
  if (S.phase === 'dusk') label = 'DUSK FALLS';
  else if (S.phase === 'dawn' || S.phase === 'upgrade') label = 'SUNRISE';
  else if (bossHolds) {
    label = 'BANISH THE BOSS';
    col = '#ff8a9a';
  } else label = `DAWN IN ${clock(dawnLeft(S))}`;
  text(ctx, label, 262, 58, 16, col, 'right');
  const k = S.phase === 'night' ? Math.min(1, S.nightT / S.nightLen) : S.phase === 'dusk' ? 0 : 1;
  const bx = 34;
  const bw = 210;
  const by = 86;
  ctx.fillStyle = 'rgba(3,5,16,0.9)';
  ctx.fillRect(bx - 2, by - 4, bw + 4, 8);
  const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  g.addColorStop(0, '#3a4fae');
  g.addColorStop(0.7, '#b06bd0');
  g.addColorStop(1, '#ffb24a');
  ctx.fillStyle = g;
  ctx.fillRect(bx, by - 2, bw * k, 4);
  // moon and sun
  ctx.fillStyle = '#dfe6ff';
  ctx.beginPath();
  ctx.arc(bx - 8, by, 6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0b1230';
  ctx.beginPath();
  ctx.arc(bx - 5, by - 2, 5, 0, TAU);
  ctx.fill();
  glow(ctx, bx + bw + 10, by, 18, '#ffb24a', 0.4 + k * 0.6);
  ctx.fillStyle = '#ffd36b';
  ctx.beginPath();
  ctx.arc(bx + bw + 10, by, 5, 0, TAU);
  ctx.fill();
  glow(ctx, bx + bw * k, by, 12, '#ffffff', 0.8);
}

function drawBeaconPanel(ctx, S) {
  const z = S.beacon;
  const k = z.hp / z.max;
  const x = 420;
  const w = 440;
  panel(ctx, x, 10, w, 56, 14, hexA(GOLD, 0.55));
  glow(ctx, x + 22, 30, 20, GOLD, 0.6);
  ctx.fillStyle = '#fff1b8';
  ctx.beginPath();
  ctx.moveTo(x + 22, 21);
  ctx.quadraticCurveTo(x + 29, 31, x + 22, 38);
  ctx.quadraticCurveTo(x + 15, 31, x + 22, 21);
  ctx.fill();
  text(ctx, 'BEACON LIGHT', x + 38, 26, 13, GOLD);
  text(ctx, `${Math.ceil(z.hp)}/${z.max}`, x + 154, 26, 11, '#ffffff');
  const lit = S.lamps.filter((l) => l.power > 0).length;
  const ward = Math.round(lit * WARD_PER_LAMP * 100);
  text(ctx, `${lit}/${S.lamps.length} LAMPS LIT · WARD -${ward}%`, x + w - 14, 26, 11, lit >= 6 ? '#ffe08a' : lit >= 3 ? '#ffb46b' : '#ff8a9a', 'right');
  const cc = k > 0.5 ? ['#fff0b0', '#e3a12c'] : k > 0.25 ? ['#ffc07a', '#d0661c'] : ['#ff8a96', '#c01c3c'];
  bar(ctx, x + 16, 42, w - 32, 12, k, cc[0], cc[1]);
  if (z.hitT > 0) {
    ctx.fillStyle = `rgba(255,60,90,${z.hitT * 2})`;
    ctx.fillRect(x + 16, 42, w - 32, 12);
  }
}

/** The goal, always on screen: WIN in gold, LOSE in red. */
export function drawGoalLine(ctx, cx, y, size = 13) {
  const [win, lose] = GOAL_TEXT.split('|').map((s) => s.trim());
  ctx.font = `900 ${size}px ${FONT}`;
  const sep = '   |   ';
  const ww = ctx.measureText(win).width;
  const sw = ctx.measureText(sep).width;
  const lw = ctx.measureText(lose).width;
  const total = ww + sw + lw;
  const x0 = cx - total / 2;
  ctx.fillStyle = 'rgba(6,9,26,0.72)';
  ctx.fillRect(x0 - 12, y - size * 0.85, total + 24, size * 1.7);
  text(ctx, win, x0, y, size, '#ffe08a');
  text(ctx, sep, x0 + ww, y, size, 'rgba(200,210,255,0.5)');
  text(ctx, lose, x0 + ww + sw, y, size, '#ff8a9a');
}

function drawBossBar(ctx, S) {
  const b = S.boss;
  if (!b || b.dead) return;
  const x = 380;
  const y = 100;
  panel(ctx, x, y, 520, 46, 12, 'rgba(255,90,110,0.65)');
  text(ctx, BOSS_TITLE[b.kind], x + 16, y + 14, 14, '#ff8a9a');
  const phases = b.kind === 'titan' ? 3 : 2;
  for (let i = 0; i < phases; i += 1) {
    ctx.fillStyle = i < b.phase ? '#ff4d6a' : 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(x + 500 - (phases - 1 - i) * 16, y + 14, 5, 0, TAU);
    ctx.fill();
  }
  text(ctx, b.lit ? 'REVEALED' : 'SHROUDED', x + 500 - phases * 16 - 6, y + 14, 11, b.lit ? '#ffe08a' : '#a99cff', 'right');
  bar(ctx, x + 16, y + 26, 488, 10, b.hp / b.maxHp, '#ff7a9a', '#b0103a');
  for (const f of b.kind === 'titan' ? [0.6, 0.25] : [0.5]) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x + 16 + 488 * f - 1, y + 24, 2, 14);
  }
}

function drawScorePanel(ctx, S) {
  panel(ctx, W - 236, 12, 220, 62, 14);
  text(ctx, 'SCORE', W - 222, 29, 13, '#9fb0ff');
  text(ctx, S.score.toLocaleString('en-US'), W - 30, 54, 29, '#ffe45c', 'right');
  const m = comboMult(S);
  const active = S.combo >= 2;
  panel(ctx, W - 236, 80, 220, 44, 12, active ? hexA('#ff7ae0', 0.6) : 'rgba(120,150,255,0.25)');
  const pulse = active ? 1 + Math.max(0, S.comboT - (2.6 + S.mods.comboKeep)) * 0.8 : 1;
  ctx.save();
  ctx.translate(W - 222, 101);
  ctx.scale(pulse, pulse);
  text(ctx, `x${m.toFixed(1)}`, 0, 0, 22, !active ? '#5d6aa0' : m >= 3 ? '#ff7ae0' : '#ffb347');
  ctx.restore();
  text(ctx, active ? `CHAIN ${S.combo}` : 'CHAIN', W - 30, 96, 14, active ? '#ffffff' : '#7a86b8', 'right');
  bar(ctx, W - 150, 110, 120, 4, active ? S.comboT / (3 + S.mods.comboKeep) : 0, '#ff7ae0', '#a03cff');
}

/** Owned blessings as chips down the right edge; lamp blessings ringed in gold. */
function drawChips(ctx, S) {
  const owned = Object.keys(S.picks);
  if (!owned.length) return;
  text(ctx, 'BLESSINGS', W - 18, 140, 10, '#9fb0ff', 'right');
  owned.forEach((id, i) => {
    const col = Math.floor(i / 9);
    const row = i % 9;
    const x = W - 38 - col * 46;
    const y = 170 + row * 44;
    const u = BY_ID[id];
    const c = RARITY[u.rarity].color;
    panel(ctx, x - 19, y - 19, 38, 38, 9, hexA(c, u.kind === 'lamp' ? 0.9 : 0.5));
    drawIcon(ctx, id, x, y, 11, c);
    if (S.picks[id] > 1) text(ctx, `${S.picks[id]}`, x + 16, y + 13, 11, '#ffffff', 'right');
  });
}

function drawHeroPanel(ctx, S) {
  const p = S.player;
  const h = S.hero;
  const x = 16;
  const y = H - 92;
  panel(ctx, x, y, 318, 78, 14, hexA(h.color, 0.55));
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + 40, y + 39, 29, 0, TAU);
  ctx.fillStyle = hexA(h.color, 0.18);
  ctx.fill();
  ctx.strokeStyle = h.color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.clip();
  drawPortrait(ctx, h, x + 40, y + 36, 0.6, S.time, { power: p.ult >= 100 ? 1 : 0 });
  ctx.restore();
  text(ctx, h.name, x + 80, y + 18, 17, h.color);
  text(ctx, `${Math.ceil(p.hp)} / ${p.maxHp}`, x + 302, y + 18, 12, '#ffffff', 'right');
  bar(ctx, x + 80, y + 32, 222, 10, p.hp / p.maxHp, '#7dff8a', '#1f9a3c');
  // Spark: a golden twinkle and the count.
  const sx = x + 90;
  const sy = y + 60;
  glow(ctx, sx, sy, 16, GOLD, 0.8);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.moveTo(sx, sy - 8);
  ctx.lineTo(sx + 2.5, sy - 2.5);
  ctx.lineTo(sx + 8, sy);
  ctx.lineTo(sx + 2.5, sy + 2.5);
  ctx.lineTo(sx, sy + 8);
  ctx.lineTo(sx - 2.5, sy + 2.5);
  ctx.lineTo(sx - 8, sy);
  ctx.lineTo(sx - 2.5, sy - 2.5);
  ctx.closePath();
  ctx.fill();
  text(ctx, `${S.spark}`, x + 104, sy, 18, GOLD);
  ctx.font = `900 18px ${FONT}`;
  const sw = ctx.measureText(`${S.spark}`).width;
  text(ctx, 'SPARK', x + 110 + sw, sy + 1, 11, '#c9b27a', 'left', 800);
  text(ctx, 'relights lamps', x + 302, sy + 1, 11, 'rgba(200,210,255,0.6)', 'right', 700);
}

/** The four skill keys: what each does, with its cooldown filling up the cap. */
function drawSkillKeys(ctx, S) {
  const p = S.player;
  const h = S.hero;
  const lamp = S.relightLamp;
  const cost = lamp ? relightCost(S, lamp) : 0;
  const canRelight = !!lamp && S.spark >= cost;
  const keys = [
    { key: 'LMB', name: 'ATTACK', k: p.atkCd > 0 ? 1 - p.atkCd / (h.rate / S.mods.rateMul) : 1, color: h.color },
    { key: 'SPACE', name: 'DASH', k: p.dashCd > 0 ? 1 - p.dashCd / (DASH_CD * S.mods.dashCdMul) : 1, color: '#bfe3ff' },
    { key: 'E', name: lamp ? `RELIGHT · ${cost}` : 'RELIGHT', color: GOLD, k: canRelight ? 1 : 0.25, glow: canRelight, prog: S.relightK, hint: lamp ? (canRelight ? 'HOLD' : 'SPARK!') : 'AT LAMP' },
    { key: 'Q', name: 'ULTIMATE', k: p.ult / 100, color: h.color, glow: p.ult >= 100, meter: true },
  ];
  const size = 60;
  const gap = 12;
  const x0 = W / 2 - (keys.length * size + (keys.length - 1) * gap) / 2 - 40;
  const y = H - 80;
  keys.forEach((c, i) => {
    const x = x0 + i * (size + gap);
    const ready = c.k >= 0.999;
    if (c.glow) glow(ctx, x + size / 2, y + size / 2, 56 + Math.sin(S.time * 8) * 6, c.color, 0.7);
    panel(ctx, x, y, size, size, 10, ready ? hexA(c.color, 0.95) : 'rgba(120,140,220,0.4)');
    // Fill: the meter rises from the bottom; cooldowns fill as they recharge.
    const f = Math.max(0, Math.min(1, c.k));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 3, y + 3, size - 6, size - 6);
    ctx.clip();
    ctx.fillStyle = hexA(c.color, ready ? 0.3 : 0.16);
    ctx.fillRect(x, y + size - size * f, size, size * f);
    if (c.prog > 0) {
      ctx.fillStyle = hexA(c.color, 0.55);
      ctx.fillRect(x, y + size - size * c.prog, size, size * c.prog);
    }
    ctx.restore();
    text(ctx, c.key, x + size / 2, y + 24, c.key.length > 2 ? 14 : 22, ready ? '#ffffff' : '#8f9acc', 'center');
    const sub = c.hint ?? (c.meter ? (ready ? 'READY' : `${Math.floor(f * 100)}%`) : ready ? 'READY' : '');
    text(ctx, sub, x + size / 2, y + 46, 10, ready ? c.color : '#c9d2ff', 'center', 800);
    text(ctx, c.name, x + size / 2, y - 9, 10, ready ? '#e8ecff' : '#8f9acc', 'center', 800);
  });
}

function drawUltCallout(ctx, u) {
  const a = Math.min(1, u.t * 6, (1.6 - u.t) * 2.5);
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.translate(W / 2, 196);
  ctx.transform(1, 0, -0.18, 1, 0, 0);
  const s = 1 + Math.max(0, 0.2 - u.t) * 2;
  ctx.scale(s, s);
  glow(ctx, 0, 0, 260, u.color, 0.5);
  text(ctx, u.name, 0, 0, 52, u.color, 'center');
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.max(0, a) * 0.5;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(u.name, 0, 0);
  ctx.restore();
}

export function drawBanner(ctx, b) {
  const a = Math.min(1, b.t * 5, (b.dur - b.t) * 3);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const y = b.small ? 230 : 270;
  const slide = (1 - Math.min(1, b.t * 4)) * 60;
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(6,10,30,0)');
  g.addColorStop(0.22, 'rgba(6,10,30,0.86)');
  g.addColorStop(0.78, 'rgba(6,10,30,0.86)');
  g.addColorStop(1, 'rgba(6,10,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y - 46, W, b.sub ? 104 : 80);
  ctx.fillStyle = b.color;
  ctx.fillRect(W * 0.22, y - 46, W * 0.56, 2);
  ctx.fillRect(W * 0.22, y + (b.sub ? 56 : 32), W * 0.56, 2);
  ctx.translate(slide, 0);
  text(ctx, b.title, W / 2, y - 4, b.small ? 32 : 54, b.color, 'center');
  if (b.sub) text(ctx, b.sub, W / 2, y + 36, 18, '#ffffff', 'center', 700);
  ctx.restore();
}
