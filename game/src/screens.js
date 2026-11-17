// The screens around the night: the title (logo, story, how to play, the six heroes and the
// difficulty choice), hero select, the dawn blessing choice, pause, and the two endings: the
// dawn victory and the darkness defeat. Also where the clickable cards are, so clicks and
// drawing agree.
import { H, TAU, W } from './combat.js';
import { HEROES, drawPortrait } from './heroes.js';
import { BY_ID, RARITY, drawIcon } from './upgrades.js';
import { DIFFICULTY, NIGHTS } from './night.js';
import { drawGoalLine, panel, text } from './hud.js';
import { FONT, glow, hexA } from './particles.js';

const GOLD = '#ffcf5a';

// ---------------------------------------------------------------- layout

const SEL = { w: 192, h: 416, gap: 12, y: 184 };
export function selectCard(i) {
  const total = HEROES.length * SEL.w + (HEROES.length - 1) * SEL.gap;
  return { x: (W - total) / 2 + i * (SEL.w + SEL.gap), y: SEL.y, w: SEL.w, h: SEL.h };
}
export function upgradeCard(i) {
  return { x: W / 2 - 160 + (i - 1) * 340, y: 214, w: 320, h: 330 };
}
export function difficultyCard(i) {
  return { x: 486 + i * 252, y: 470, w: 236, h: 78 };
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
  ctx.fillStyle = `rgba(4,7,22,${a})`;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- logo

/** "HERO CITY: BLACKOUT": gold letters lit from behind by the Beacon, a half-dead neon BLACKOUT. */
export function drawLogo(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // The Beacon's rays fanning up behind the title.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i += 1) {
    const a = -Math.PI / 2 + (i - 6.5) * 0.2 + Math.sin(t * 0.6 + i) * 0.03;
    const g = ctx.createLinearGradient(0, 40, Math.cos(a) * 420, 40 + Math.sin(a) * 420);
    g.addColorStop(0, 'rgba(255,207,90,0.22)');
    g.addColorStop(1, 'rgba(255,207,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.lineTo(Math.cos(a - 0.05) * 420, 40 + Math.sin(a - 0.05) * 420);
    ctx.lineTo(Math.cos(a + 0.05) * 420, 40 + Math.sin(a + 0.05) * 420);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  glow(ctx, 0, 10, 300, '#ffb347', 0.28);
  // A crescent moon and the dark skyline under the words.
  glow(ctx, 330, -70, 60, '#c9d6ff', 0.5);
  ctx.fillStyle = '#e6ecff';
  ctx.beginPath();
  ctx.arc(330, -70, 22, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#070b20';
  ctx.beginPath();
  ctx.arc(340, -77, 20, 0, TAU);
  ctx.fill();
  const sky = [[-330, 70], [-300, 40], [-270, 82], [-240, 22], [-205, 60], [-170, 34], [-140, 74], [140, 64], [170, 30], [205, 70], [235, 16], [270, 56], [300, 38], [330, 80]];
  for (const [bx, top] of sky) {
    ctx.fillStyle = '#0c1330';
    ctx.fillRect(bx - 14, top, 28, 140 - top);
    for (let wy = top + 8; wy < 128; wy += 11) {
      for (let wx = bx - 9; wx < bx + 10; wx += 7) {
        if (((wx * 7 + wy * 13) & 15) === 3) {
          ctx.fillStyle = '#ffcf7a';
          ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
  }
  // HERO CITY:
  ctx.save();
  ctx.transform(1, 0, -0.12, 1, 0, 0);
  ctx.font = `900 84px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 10; i > 0; i -= 1) {
    ctx.fillStyle = i > 7 ? '#03050f' : '#6a3a10';
    ctx.fillText('HERO CITY:', 0, -38 + i);
  }
  ctx.lineWidth = 10;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#05070f';
  ctx.strokeText('HERO CITY:', 0, -38);
  const g = ctx.createLinearGradient(0, -78, 0, 0);
  g.addColorStop(0, '#fffbe6');
  g.addColorStop(0.45, '#ffd36b');
  g.addColorStop(1, '#ff8a2e');
  ctx.fillStyle = g;
  ctx.fillText('HERO CITY:', 0, -38);
  ctx.restore();
  // BLACKOUT: dark tube letters, outlined in failing gold neon (one letter flickers out).
  ctx.save();
  ctx.font = `900 92px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const word = 'BLACKOUT';
  const total = ctx.measureText(word).width + (word.length - 1) * 6;
  let cx = -total / 2;
  for (let i = 0; i < word.length; i += 1) {
    const ch = word[i];
    const cw = ctx.measureText(ch).width;
    const lx = cx + cw / 2;
    const dead = i === 5 && Math.sin(t * 13) + Math.sin(t * 7.3) > 0.9;
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#03050f';
    ctx.strokeText(ch, lx, 52);
    ctx.fillStyle = '#0d1430';
    ctx.fillText(ch, lx, 52);
    ctx.lineWidth = 3;
    ctx.shadowColor = dead ? 'rgba(0,0,0,0)' : '#ffb347';
    ctx.shadowBlur = dead ? 0 : 22;
    ctx.strokeStyle = dead ? '#4a4030' : '#ffd88a';
    ctx.strokeText(ch, lx, 52);
    ctx.shadowBlur = 0;
    cx += cw + 6;
  }
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- title

const HOW = [
  ['WASD', 'Move'],
  ['MOUSE + LMB', 'Aim and attack (hold)'],
  ['SPACE', 'Dash through danger'],
  ['E (hold)', 'Relight a dark lamp: costs Spark'],
  ['Q', 'Ultimate: a blast and a flare of light'],
];

export function drawTitle(ctx, t, best, difficulty) {
  dim(ctx, 0.42);
  const top = ctx.createLinearGradient(0, 0, 0, 260);
  top.addColorStop(0, 'rgba(3,5,16,0.85)');
  top.addColorStop(1, 'rgba(3,5,16,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 260);
  drawLogo(ctx, W / 2, 110, 0.92, t);
  text(ctx, 'At midnight the power died, and the shadows crawled out of the dark. They fear only light.', W / 2, 222, 17, '#e6ebff', 'center', 700);
  text(ctx, 'Guard the last Beacon, keep its eight street lamps burning, and hold the plaza until dawn: fifteen nights.', W / 2, 248, 17, '#ffe08a', 'center', 700);
  // How to play
  panel(ctx, 40, 288, 410, 300, 16, hexA(GOLD, 0.5));
  text(ctx, 'HOW TO PLAY', 62, 312, 17, GOLD);
  HOW.forEach(([k, v], i) => {
    const y = 346 + i * 32;
    ctx.font = `900 13px ${FONT}`;
    const kw = ctx.measureText(k).width + 16;
    ctx.fillStyle = 'rgba(255,207,90,0.14)';
    ctx.fillRect(62, y - 12, kw, 24);
    ctx.strokeStyle = hexA(GOLD, 0.7);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(62.5, y - 11.5, kw - 1, 23);
    text(ctx, k, 62 + kw / 2, y, 13, '#fff1c8', 'center');
    text(ctx, v, 74 + kw, y, 14, '#e6ebff', 'left', 700);
  });
  para(ctx, 'In the light, shadows take full damage and slow down; in the dark they take only 30%. Banished shadows drop Spark. Every lit lamp wards the Beacon.', 245, 520, 370, 13, '#b9c4f0', 1.35);
  // The six heroes
  text(ctx, 'SIX HEROES', 486, 300, 15, '#9fb0ff');
  HEROES.forEach((h, i) => {
    const x = 546 + i * 124;
    drawPortrait(ctx, h, x, 350, 0.58, t + i * 0.9);
    text(ctx, h.name, x, 430, 15, h.color, 'center');
  });
  // Difficulty
  text(ctx, 'DIFFICULTY  (← → or click)', 486, 456, 13, '#9fb0ff');
  DIFFICULTY.forEach((d, i) => {
    const r = difficultyCard(i);
    const on = i === difficulty;
    if (on) glow(ctx, r.x + r.w / 2, r.y + r.h / 2, 150, d.color, 0.3);
    panel(ctx, r.x, r.y, r.w, r.h, 12, on ? d.color : hexA(d.color, 0.3));
    if (on) {
      ctx.fillStyle = hexA(d.color, 0.12);
      ctx.fill();
    }
    text(ctx, d.name, r.x + r.w / 2, r.y + 26, 22, on ? d.color : hexA(d.color, 0.6), 'center');
    text(ctx, d.desc, r.x + r.w / 2, r.y + 56, 12, on ? '#ffffff' : '#8f9acc', 'center', 700);
  });
  if (Math.sin(t * 4) > -0.4) text(ctx, 'CLICK OR PRESS ENTER TO CHOOSE YOUR HERO', 852, 588, 21, '#ffffff', 'center');
  drawGoalLine(ctx, W / 2, 640, 15);
  if (best > 0) text(ctx, `BEST SCORE ${best.toLocaleString('en-US')}`, W / 2, 684, 14, '#ffe45c', 'center');
  else text(ctx, 'M mute  ·  P pause', W / 2, 684, 12, 'rgba(190,200,255,0.6)', 'center', 700);
}

// ---------------------------------------------------------------- hero select

export function drawSelect(ctx, t, sel, difficulty) {
  dim(ctx, 0.58);
  drawLogo(ctx, W / 2, 80, 0.5, t);
  const d = DIFFICULTY[difficulty];
  text(ctx, 'CHOOSE YOUR HERO', W / 2, 158, 24, '#ffffff', 'center');
  text(ctx, d.name, W / 2 + 160, 158, 14, d.color, 'left');
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
    text(ctx, h.role.toUpperCase(), cx, y + 193, 12, '#cfd6ff', 'center', 700);
    ctx.fillStyle = hexA(h.color, 0.4);
    ctx.fillRect(r.x + 18, y + 206, r.w - 36, 1);
    const n = para(ctx, h.basic, cx, y + 222, r.w - 26, 12, '#e8ecff');
    const uy = y + 222 + n * 15.6 + 12;
    text(ctx, h.ult, cx, uy, 14, h.color, 'center');
    para(ctx, h.ultDesc, cx, uy + 18, r.w - 26, 12, '#b8c2ec');
    ['POWER', 'SPEED', 'SUPPORT'].forEach((label, k) => {
      const by = y + r.h - 56 + k * 17;
      ctx.font = `800 10px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#939ccc';
      ctx.fillText(label, r.x + 16, by);
      for (let j = 0; j < 5; j += 1) {
        ctx.fillStyle = j < h.bars[k] ? h.color : 'rgba(255,255,255,0.12)';
        ctx.fillRect(r.x + 82 + j * 19, by - 4, 16, 8);
      }
    });
  });
  text(ctx, 'Click a hero or press 1-6  ·  Arrows + Enter  ·  Esc back', W / 2, 640, 16, 'rgba(220,226,255,0.85)', 'center', 700);
  drawGoalLine(ctx, W / 2, 676, 14);
}

// ---------------------------------------------------------------- the dawn's blessing

export function drawUpgrade(ctx, S, hover, t) {
  dim(ctx, 0.5);
  const sky = ctx.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, 'rgba(255,170,90,0.28)');
  sky.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 200);
  text(ctx, `DAWN  ·  NIGHT ${S.night} SURVIVED`, W / 2, 122, 42, '#ffcf5a', 'center');
  text(ctx, `CHOOSE A BLESSING FOR NIGHT ${S.night + 1}`, W / 2, 172, 19, '#ffffff', 'center');
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
    text(ctx, u.kind === 'lamp' ? 'LAMP BLESSING' : `HERO  ·  ${rar.label}`, cx, y + 26, 13, rar.color, 'center');
    ctx.strokeStyle = hexA(rar.color, 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, y + 104, 50, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(8,12,32,0.85)';
    ctx.fill();
    drawIcon(ctx, id, cx, y + 104, 34, rar.color);
    text(ctx, u.name, cx, y + 190, 26, '#ffffff', 'center');
    para(ctx, u.desc, cx, y + 228, r.w - 50, 16, '#dbe0ff');
    const lv = S.picks[id] ?? 0;
    for (let k = 0; k < u.max; k += 1) {
      ctx.fillStyle = k < lv ? rar.color : k === lv ? '#ffffff' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(cx - (u.max * 22) / 2 + k * 22 + 3, y + r.h - 42, 16, 6);
    }
    text(ctx, lv ? `LEVEL ${lv + 1}` : 'NEW', cx, y + r.h - 22, 12, lv ? rar.color : '#ffe45c', 'center');
    panel(ctx, r.x - 14, y - 14, 34, 34, 8, rar.color);
    text(ctx, `${i + 1}`, r.x + 3, y + 3, 18, '#ffffff', 'center');
  });
  text(ctx, 'Click a card or press 1, 2 or 3', W / 2, 590, 17, 'rgba(220,226,255,0.85)', 'center', 700);
}

// ---------------------------------------------------------------- pause and endings

export function drawPause(ctx, muted) {
  dim(ctx, 0.7);
  text(ctx, 'PAUSED', W / 2, 160, 64, '#ffffff', 'center');
  const rows = [
    ['WASD / Arrows', 'Move'], ['Mouse', 'Aim'], ['Left click (hold)', 'Attack'], ['Space / Right click', 'Dash (dodges damage)'],
    ['E (hold)', 'Relight the dark lamp you stand in (Spark)'], ['Q', 'Ultimate (when the meter is full)'],
    ['P / Esc', 'Pause'], ['M', muted ? 'Unmute (muted)' : 'Mute'],
  ];
  panel(ctx, W / 2 - 300, 210, 600, rows.length * 34 + 30, 14, hexA(GOLD, 0.5));
  rows.forEach(([k, v], i) => {
    text(ctx, k, W / 2 - 60, 240 + i * 34, 17, GOLD, 'right');
    text(ctx, v, W / 2 - 40, 240 + i * 34, 17, '#ffffff', 'left', 700);
  });
  drawGoalLine(ctx, W / 2, 540, 15);
  text(ctx, 'P / Esc to resume  ·  Q to quit to title', W / 2, 590, 18, '#9fdcff', 'center', 700);
}

/** The endings: a sunrise over the saved city, or the plaza swallowed by the dark. */
export function drawEnd(ctx, S, best, newBest, t) {
  const won = S.result === 'victory';
  if (won) drawSunriseSky(ctx, t);
  else drawNightfall(ctx, t);
  const col = won ? '#ffcf5a' : '#ff6a8a';
  text(ctx, won ? 'DAWN BREAKS' : 'THE BEACON WENT DARK', W / 2, 92, 66, col, 'center');
  text(ctx, won
    ? `${S.hero.name} held the light through all ${NIGHTS} nights. Hero City sees the sun!`
    : `The shadows swallowed the plaza on night ${S.night}. The city waits for another hero.`, W / 2, 148, 20, '#ffffff', 'center', 700);
  drawPortrait(ctx, S.hero, W / 2 - 360, 310, 1.8, t, { power: won ? 0.9 : 0 });
  panel(ctx, W / 2 - 180, 190, 500, 336, 18, hexA(col, 0.7));
  const d = S.diff;
  const rows = [
    ['SCORE', S.score.toLocaleString('en-US'), '#ffe45c'],
    ['BEST', best.toLocaleString('en-US'), newBest ? '#7dff6e' : '#ffffff'],
    ['NIGHTS SURVIVED', `${won ? NIGHTS : S.nightsSurvived} / ${NIGHTS}`, won ? GOLD : '#ffffff'],
    ['SHADOWS BANISHED', `${S.kills}`, '#ffffff'],
    ['LAMPS RELIT', `${S.stats.relit}`, GOLD],
    ['BEST CHAIN', `${S.maxCombo}`, '#ff7ae0'],
    ['BOSSES BANISHED', `${S.bossKills} / 3`, '#ff8a9a'],
  ];
  rows.forEach(([k, v, c], i) => {
    const y = 228 + i * 41;
    text(ctx, k, W / 2 - 152, y, i === 0 ? 20 : 15, '#a9b6f0', 'left');
    text(ctx, v, W / 2 + 296, y, i === 0 ? 32 : 20, c, 'right');
  });
  text(ctx, `${d.name} DIFFICULTY`, W / 2 + 70, 508, 12, d.color, 'center');
  if (newBest && Math.sin(t * 6) > -0.3) text(ctx, 'NEW BEST!', W / 2 + 60, 269, 15, '#7dff6e', 'center');
  if (Math.sin(t * 4) > -0.4) text(ctx, 'PRESS R OR CLICK TO PLAY AGAIN', W / 2, 584, 28, '#ffffff', 'center');
  text(ctx, 'H: another hero  ·  T: title and difficulty', W / 2, 624, 16, '#c9d2ff', 'center', 700);
  drawGoalLine(ctx, W / 2, 676, 14);
}

function drawSunriseSky(ctx, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, 'rgba(36,40,110,0.88)');
  sky.addColorStop(0.45, 'rgba(190,90,120,0.72)');
  sky.addColorStop(0.8, 'rgba(255,170,80,0.72)');
  sky.addColorStop(1, 'rgba(255,214,130,0.8)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const sx = W / 2;
  const sy = H + 40;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 18; i += 1) {
    const a = Math.PI + (i / 17) * Math.PI + Math.sin(t * 0.4) * 0.02;
    const g = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * 900, sy + Math.sin(a) * 900);
    g.addColorStop(0, 'rgba(255,220,140,0.3)');
    g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a - 0.04) * 900, sy + Math.sin(a - 0.04) * 900);
    ctx.lineTo(sx + Math.cos(a + 0.04) * 900, sy + Math.sin(a + 0.04) * 900);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  glow(ctx, sx, sy, 420, '#ffcf5a', 0.9);
  ctx.fillStyle = '#fff4d0';
  ctx.beginPath();
  ctx.arc(sx, sy, 120, 0, TAU);
  ctx.fill();
  // The skyline, silhouetted against the morning.
  ctx.fillStyle = 'rgba(30,20,50,0.85)';
  for (let i = 0; i < 26; i += 1) {
    const bx = i * 52 - 10;
    const bh = 40 + ((i * 37) % 70);
    ctx.fillRect(bx, H - bh, 46, bh);
  }
}

function drawNightfall(ctx, t) {
  dim(ctx, 0.78);
  const v = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.7);
  v.addColorStop(0, 'rgba(60,30,140,0.2)');
  v.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i += 1) {
    const x = ((i * 211 + t * 12) % (W + 80)) - 40;
    const y = 120 + ((i * 137) % 480);
    glow(ctx, x, y, 7, '#ff4f7a', 0.5 + Math.sin(t * 3 + i) * 0.3);
    glow(ctx, x + 14, y, 7, '#ff4f7a', 0.5 + Math.sin(t * 3 + i) * 0.3);
  }
}
