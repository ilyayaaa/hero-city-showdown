// The screens around the fight: the title with the logo, hero select, the upgrade choice between
// waves, pause, and the game over / victory screens. Also where the clickable cards are, so
// clicks and drawing agree.
import { H, TAU, W } from './combat.js';
import { HEROES, drawPortrait } from './heroes.js';
import { BY_ID, RARITY, drawIcon } from './upgrades.js';
import { MAX_WAVE } from './waves.js';
import { panel, text } from './hud.js';
import { FONT, glow, hexA } from './particles.js';

// ---------------------------------------------------------------- layout

const SEL = { w: 192, h: 416, gap: 12, y: 184 };
export function selectCard(i) {
  const total = HEROES.length * SEL.w + (HEROES.length - 1) * SEL.gap;
  return { x: (W - total) / 2 + i * (SEL.w + SEL.gap), y: SEL.y, w: SEL.w, h: SEL.h };
}
export function upgradeCard(i) {
  return { x: W / 2 - 160 + (i - 1) * 340, y: 214, w: 320, h: 330 };
}
export function cardAt(rect, n, x, y) {
  for (let i = 0; i < n; i += 1) {
    const r = rect(i);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function wrap(ctx, s, maxW) {
  const out = [];
  let cur = '';
  for (const w of s.split(' ')) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxW && cur) {
      out.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

function para(ctx, s, x, y, maxW, size, color, lh = 1.3, align = 'center') {
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  const lines = wrap(ctx, s, maxW);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * lh));
  return lines.length;
}

function dim(ctx, a = 0.62) {
  ctx.fillStyle = `rgba(8,4,22,${a})`;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- logo

export function drawLogo(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // rays and emblem
  ctx.save();
  ctx.rotate(t * 0.08);
  for (let i = 0; i < 16; i += 1) {
    ctx.rotate(TAU / 16);
    const g = ctx.createLinearGradient(0, 0, 0, -330);
    g.addColorStop(0, i % 2 ? 'rgba(255,79,176,0.22)' : 'rgba(51,230,255,0.2)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-34, -330);
    ctx.lineTo(34, -330);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  glow(ctx, 0, 0, 330, '#ff4fb0', 0.35);
  ctx.save();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#33e6ff';
  ctx.shadowColor = '#33e6ff';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * TAU + Math.PI / 6;
    ctx.lineTo(Math.cos(a) * 150, Math.sin(a) * 118);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(16,8,40,0.75)';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // skyline
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * TAU + Math.PI / 6;
    ctx.lineTo(Math.cos(a) * 147, Math.sin(a) * 115);
  }
  ctx.closePath();
  ctx.clip();
  const sky = [[-150, 40], [-128, 10], [-104, 52], [-84, -14], [-58, 30], [-40, -38], [-14, 20], [6, -56], [30, 4], [52, -30], [76, 24], [96, -8], [118, 36], [140, 16]];
  for (const [bx, top] of sky) {
    ctx.fillStyle = '#2a1650';
    ctx.fillRect(bx, top, 22, 140);
    for (let wy = top + 8; wy < 120; wy += 12) {
      for (let wx = bx + 4; wx < bx + 18; wx += 8) {
        if (((wx * 7 + wy * 13) & 7) < 3) {
          ctx.fillStyle = ((wx + wy) & 3) === 0 ? '#33e6ff' : '#ffcf7a';
          ctx.fillRect(wx, wy, 4, 5);
        }
      }
    }
  }
  ctx.restore();
  // title text with extrusion
  ctx.save();
  ctx.transform(1, 0, -0.16, 1, 0, 0);
  ctx.font = `900 112px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 12; i > 0; i -= 1) {
    ctx.fillStyle = i > 9 ? '#12051f' : '#7a0f58';
    ctx.fillText('HERO CITY', 0, -22 + i);
  }
  ctx.lineWidth = 12;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#12051f';
  ctx.strokeText('HERO CITY', 0, -22);
  const g = ctx.createLinearGradient(0, -70, 0, 26);
  g.addColorStop(0, '#fffbe0');
  g.addColorStop(0.35, '#ffd23f');
  g.addColorStop(0.7, '#ff7a2e');
  g.addColorStop(1, '#ff3b8a');
  ctx.fillStyle = g;
  ctx.fillText('HERO CITY', 0, -22);
  // banner
  ctx.translate(0, 64);
  const bg = ctx.createLinearGradient(-230, 0, 230, 0);
  bg.addColorStop(0, '#a03cff');
  bg.addColorStop(1, '#ff3b8a');
  ctx.fillStyle = '#12051f';
  ctx.fillRect(-236, -30, 472, 62);
  ctx.fillStyle = bg;
  ctx.fillRect(-228, -24, 456, 50);
  ctx.font = `900 46px ${FONT}`;
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#12051f';
  ctx.strokeText('SHOWDOWN', 0, 2);
  ctx.shadowColor = '#33e6ff';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#e6fdff';
  ctx.fillText('SHOWDOWN', 0, 2);
  ctx.restore();
  // sparkles
  for (let i = 0; i < 7; i += 1) {
    const a = i * 2.4 + t * 0.4;
    const r = 180 + (i % 3) * 40;
    const tw = (Math.sin(t * 3 + i * 1.7) + 1) / 2;
    const sx = Math.cos(a) * r * 1.3;
    const sy = Math.sin(a) * r * 0.55;
    glow(ctx, sx, sy, 20 * tw + 4, i % 2 ? '#ffe45c' : '#33e6ff', 0.9);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx - 8 * tw, sy - 1, 16 * tw, 2);
    ctx.fillRect(sx - 1, sy - 8 * tw, 2, 16 * tw);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- title

export function drawTitle(ctx, t, best) {
  dim(ctx, 0.5);
  drawLogo(ctx, W / 2, 218, 1, t);
  HEROES.forEach((h, i) => {
    const x = W / 2 + (i - 2.5) * 150;
    const y = 432;
    drawPortrait(ctx, h, x, y, 0.95, t + i * 0.9);
    text(ctx, h.name, x, y + 116, 18, h.color, 'center');
  });
  if (Math.sin(t * 4) > -0.4) text(ctx, 'CLICK OR PRESS ENTER TO DEFEND THE CITY', W / 2, 622, 22, '#ffffff', 'center');
  text(ctx, 'WASD move  ·  Mouse aim  ·  Left click attack  ·  Right click / Space dash  ·  E ultimate', W / 2, 668, 14, 'rgba(210,200,255,0.8)', 'center', 700);
  if (best > 0) text(ctx, `BEST SCORE ${best.toLocaleString('en-US')}`, W / 2, 696, 13, '#ffe45c', 'center');
}

// ---------------------------------------------------------------- hero select

export function drawSelect(ctx, t, sel) {
  dim(ctx, 0.58);
  drawLogo(ctx, W / 2, 76, 0.46, t);
  text(ctx, 'CHOOSE YOUR HERO', W / 2, 156, 24, '#ffffff', 'center');
  HEROES.forEach((h, i) => {
    const r = selectCard(i);
    const on = i === sel;
    const lift = on ? -10 : 0;
    const y = r.y + lift;
    if (on) glow(ctx, r.x + r.w / 2, y + r.h / 2, 260, h.color, 0.4);
    panel(ctx, r.x, y, r.w, r.h, 16, on ? h.color : hexA(h.color, 0.35));
    if (on) {
      ctx.fillStyle = hexA(h.color, 0.1);
      ctx.fill();
    }
    const cx = r.x + r.w / 2;
    ctx.save();
    panel(ctx, r.x + 6, y + 6, r.w - 12, 146, 12, 'rgba(0,0,0,0)');
    ctx.clip();
    const pg = ctx.createLinearGradient(0, y, 0, y + 150);
    pg.addColorStop(0, hexA(h.color, on ? 0.3 : 0.15));
    pg.addColorStop(1, hexA(h.color, 0));
    ctx.fillStyle = pg;
    ctx.fillRect(r.x, y, r.w, 150);
    drawPortrait(ctx, h, cx, y + 58, on ? 0.95 : 0.88, t + i * 0.9, { power: on ? 0.6 + Math.sin(t * 5) * 0.3 : 0 });
    ctx.restore();
    text(ctx, `${i + 1}`, r.x + 20, y + 22, 15, 'rgba(255,255,255,0.7)', 'center');
    text(ctx, h.name, cx, y + 170, 26, h.color, 'center');
    text(ctx, h.role.toUpperCase(), cx, y + 193, 12, '#cfc6ff', 'center', 700);
    ctx.fillStyle = hexA(h.color, 0.4);
    ctx.fillRect(r.x + 18, y + 206, r.w - 36, 1);
    const n = para(ctx, h.basic, cx, y + 222, r.w - 26, 12, '#e8e2ff');
    const uy = y + 222 + n * 15.6 + 12;
    text(ctx, h.ult, cx, uy, 14, h.color, 'center');
    para(ctx, h.ultDesc, cx, uy + 18, r.w - 26, 12, '#bdb3ea');
    ['POWER', 'SPEED', 'SUPPORT'].forEach((label, k) => {
      const by = y + r.h - 56 + k * 17;
      ctx.font = `800 10px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9d93cc';
      ctx.fillText(label, r.x + 16, by);
      for (let j = 0; j < 5; j += 1) {
        ctx.fillStyle = j < h.bars[k] ? h.color : 'rgba(255,255,255,0.12)';
        ctx.fillRect(r.x + 82 + j * 19, by - 4, 16, 8);
      }
    });
  });
  text(ctx, 'Click a hero or press 1-6  ·  Arrows + Enter  ·  Esc back', W / 2, 640, 16, 'rgba(220,210,255,0.85)', 'center', 700);
  text(ctx, 'Protect the City Core in the plaza. Charge your ultimate by dealing damage, then press E.', W / 2, 672, 15, '#8ff3ff', 'center', 700);
}

// ---------------------------------------------------------------- upgrade choice

export function drawUpgrade(ctx, S, hover, t) {
  dim(ctx, 0.6);
  text(ctx, `WAVE ${S.wave} CLEARED`, W / 2, 128, 46, '#7dff6e', 'center');
  text(ctx, 'CHOOSE AN UPGRADE', W / 2, 176, 20, '#ffffff', 'center');
  (S.offer ?? []).forEach((id, i) => {
    const u = BY_ID[id];
    const rar = RARITY[u.rarity];
    const r = upgradeCard(i);
    const on = i === hover;
    const y = r.y + (on ? -10 : 0) + Math.sin(t * 2 + i) * 2;
    if (on) glow(ctx, r.x + r.w / 2, y + r.h / 2, 260, rar.color, 0.45);
    panel(ctx, r.x, y, r.w, r.h, 18, on ? '#ffffff' : rar.color);
    const g = ctx.createLinearGradient(0, y, 0, y + 150);
    g.addColorStop(0, hexA(rar.color, 0.28));
    g.addColorStop(1, hexA(rar.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(r.x + 2, y + 2, r.w - 4, 150);
    const cx = r.x + r.w / 2;
    text(ctx, rar.label, cx, y + 26, 13, rar.color, 'center');
    ctx.strokeStyle = hexA(rar.color, 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, y + 104, 50, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(10,6,28,0.8)';
    ctx.fill();
    drawIcon(ctx, id, cx, y + 104, 34, rar.color);
    text(ctx, u.name, cx, y + 190, 26, '#ffffff', 'center');
    para(ctx, u.desc, cx, y + 228, r.w - 50, 16, '#d8d0ff');
    const lv = S.picks[id] ?? 0;
    for (let k = 0; k < u.max; k += 1) {
      ctx.fillStyle = k < lv ? rar.color : k === lv ? '#ffffff' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(cx - (u.max * 22) / 2 + k * 22 + 3, y + r.h - 42, 16, 6);
    }
    text(ctx, lv ? `LEVEL ${lv + 1}` : 'NEW', cx, y + r.h - 22, 12, lv ? rar.color : '#ffe45c', 'center');
    panel(ctx, r.x - 14, y - 14, 34, 34, 8, rar.color);
    text(ctx, `${i + 1}`, r.x + 3, y + 3, 18, '#ffffff', 'center');
  });
  text(ctx, 'Click a card or press 1, 2 or 3', W / 2, 600, 17, 'rgba(220,210,255,0.85)', 'center', 700);
}

// ---------------------------------------------------------------- pause and endings

export function drawPause(ctx, muted) {
  dim(ctx, 0.66);
  text(ctx, 'PAUSED', W / 2, 200, 64, '#ffffff', 'center');
  const rows = [
    ['WASD / Arrows', 'Move'], ['Mouse', 'Aim'], ['Left click (hold)', 'Basic attack'], ['Right click / Space', 'Dash (dodges damage)'],
    ['E', 'Ultimate (when the meter is full)'], ['P / Esc', 'Pause'], ['M', muted ? 'Unmute (muted)' : 'Mute'],
  ];
  panel(ctx, W / 2 - 260, 250, 520, rows.length * 34 + 30);
  rows.forEach(([k, v], i) => {
    text(ctx, k, W / 2 - 20, 280 + i * 34, 17, '#ffe45c', 'right');
    text(ctx, v, W / 2 + 10, 280 + i * 34, 17, '#ffffff', 'left', 700);
  });
  text(ctx, 'P / Esc to resume  ·  Q to quit to title', W / 2, 560, 18, '#8ff3ff', 'center', 700);
}

export function drawEnd(ctx, S, best, newBest, t) {
  const won = S.result === 'victory';
  dim(ctx, 0.66);
  const col = won ? '#ffe45c' : '#ff5a6e';
  glow(ctx, W / 2, 140, 360, won ? '#ffd23f' : '#ff3355', 0.35);
  text(ctx, won ? 'CITY SAVED!' : 'THE CITY HAS FALLEN', W / 2, 120, 64, col, 'center');
  text(ctx, won ? `${S.hero.name} defeated all ${MAX_WAVE} waves and every boss!` : `The monsters broke the City Core on wave ${S.wave}.`, W / 2, 178, 20, '#ffffff', 'center', 700);
  drawPortrait(ctx, S.hero, W / 2 - 330, 300, 1.9, t, { power: won ? 0.8 : 0 });
  panel(ctx, W / 2 - 170, 224, 470, 300, 18, hexA(col, 0.6));
  const rows = [
    ['SCORE', S.score.toLocaleString('en-US'), '#ffe45c'],
    ['BEST', best.toLocaleString('en-US'), newBest ? '#7dff6e' : '#ffffff'],
    ['WAVE', `${won ? MAX_WAVE : S.wave} / ${MAX_WAVE}`, '#ffffff'],
    ['MONSTERS DEFEATED', `${S.kills}`, '#ffffff'],
    ['BEST COMBO', `${S.maxCombo}`, '#ff7ae0'],
    ['BOSSES DEFEATED', `${S.bossKills} / 3`, '#ff8a9a'],
  ];
  rows.forEach(([k, v, c], i) => {
    const y = 262 + i * 44;
    text(ctx, k, W / 2 - 144, y, i === 0 ? 20 : 16, '#b9a8ff', 'left');
    text(ctx, v, W / 2 + 276, y, i === 0 ? 30 : 20, c, 'right');
  });
  if (newBest && Math.sin(t * 6) > -0.3) text(ctx, 'NEW BEST!', W / 2 + 70, 306, 16, '#7dff6e', 'center');
  if (Math.sin(t * 4) > -0.4) text(ctx, 'PRESS R OR CLICK TO PLAY AGAIN', W / 2, 590, 26, '#ffffff', 'center');
  text(ctx, 'H to choose another hero', W / 2, 630, 16, '#cfc6ff', 'center', 700);
}
