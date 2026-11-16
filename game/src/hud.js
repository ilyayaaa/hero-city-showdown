// The heads-up display over the fight: wave, City Core HP, boss bar, score and combo, the hero's
// HP / dash / ultimate meter, owned upgrades, wave banners and the ultimate's name call-out.
import { H, TAU, W } from './combat.js';
import { comboMult } from './enemies.js';
import { drawPortrait } from './heroes.js';
import { MAX_WAVE } from './waves.js';
import { BY_ID, RARITY, drawIcon } from './upgrades.js';
import { BOSS_TITLE } from './bosses.js';
import { FONT, glow, hexA } from './particles.js';

export function panel(ctx, x, y, w, h, r = 12, stroke = 'rgba(150,130,255,0.35)') {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(12,8,30,0.74)';
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
  ctx.strokeStyle = 'rgba(8,4,20,0.9)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function bar(ctx, x, y, w, h, k, c1, c2, back = 'rgba(255,255,255,0.08)') {
  ctx.fillStyle = 'rgba(5,2,14,0.85)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, k)), h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, k)), h * 0.35);
}

export function drawHud(ctx, S) {
  ctx.save();
  // wave
  panel(ctx, 16, 14, 196, 64);
  text(ctx, 'WAVE', 32, 32, 14, '#b9a8ff');
  text(ctx, `${S.wave}`, 32, 58, 34, '#ffffff');
  ctx.font = `900 34px ${FONT}`;
  const ww = ctx.measureText(`${S.wave}`).width;
  text(ctx, `/ ${MAX_WAVE}`, 38 + ww, 61, 18, '#8d7fd0');
  const left = S.queue.length + S.enemies.length;
  const info = S.phase === 'fight' ? `${left} LEFT` : S.phase === 'intro' ? 'GET READY' : 'CLEAR';
  text(ctx, info, 198, 58, 14, S.phase === 'fight' ? '#ff8a9a' : '#7dff6e', 'right');
  // city core
  const z = S.plaza;
  const k = z.hp / z.max;
  panel(ctx, 420, 12, 440, 46);
  text(ctx, 'CITY CORE', 436, 26, 13, '#8ff3ff');
  text(ctx, `${Math.ceil(z.hp)} / ${z.max}`, 844, 26, 13, '#ffffff', 'right');
  const cc = k > 0.5 ? ['#7dfcff', '#1fb6d6'] : k > 0.25 ? ['#ffe06b', '#e0a020'] : ['#ff7a8a', '#d0203c'];
  bar(ctx, 436, 36, 408, 12, k, cc[0], cc[1]);
  if (z.hitT > 0) {
    ctx.fillStyle = `rgba(255,60,90,${z.hitT * 2})`;
    ctx.fillRect(436, 36, 408, 12);
  }
  // boss
  const b = S.boss;
  if (b && !b.dead) {
    const by = H - 64;
    panel(ctx, 362, by, 556, 50, 12, 'rgba(255,90,110,0.6)');
    text(ctx, BOSS_TITLE[b.kind], 378, by + 15, 15, '#ff8a9a');
    const phases = b.kind === 'titan' ? 3 : 2;
    for (let i = 0; i < phases; i += 1) {
      ctx.fillStyle = i < b.phase ? '#ff4d6a' : 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(894 - (phases - 1 - i) * 16, by + 15, 5, 0, TAU);
      ctx.fill();
    }
    text(ctx, 'PHASE', 894 - phases * 16 - 4, by + 15, 11, '#ff8a9a', 'right');
    bar(ctx, 378, by + 28, 524, 12, b.hp / b.maxHp, '#ff7a9a', '#b0103a');
    for (const f of b.kind === 'titan' ? [0.6, 0.25] : [0.5]) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(378 + 524 * f - 1, by + 26, 2, 16);
    }
  }
  // score and combo
  panel(ctx, W - 236, 14, 220, 64);
  text(ctx, 'SCORE', W - 222, 32, 14, '#b9a8ff');
  text(ctx, S.score.toLocaleString('en-US'), W - 30, 58, 30, '#ffe45c', 'right');
  if (S.combo >= 2) {
    const m = comboMult(S);
    const pulse = 1 + Math.max(0, S.comboT - (2.6 + S.mods.comboKeep)) * 0.8;
    panel(ctx, W - 236, 84, 220, 44, 12, hexA('#ff7ae0', 0.5));
    ctx.save();
    ctx.translate(W - 222, 104);
    ctx.scale(pulse, pulse);
    text(ctx, `x${m.toFixed(1)}`, 0, 0, 24, m >= 3 ? '#ff7ae0' : '#ffb347');
    ctx.restore();
    text(ctx, `${S.combo} COMBO`, W - 30, 100, 15, '#ffffff', 'right');
    bar(ctx, W - 140, 114, 110, 4, S.comboT / (3 + S.mods.comboKeep), '#ff7ae0', '#a03cff');
  }
  drawHeroPanel(ctx, S);
  // owned upgrades
  const owned = Object.keys(S.picks);
  if (owned.length) {
    const w = owned.length * 40 + 16;
    panel(ctx, W - 16 - w, H - 60, w, 46);
    owned.forEach((id, i) => {
      const x = W - 16 - w + 28 + i * 40;
      drawIcon(ctx, id, x, H - 37, 13, RARITY[BY_ID[id].rarity].color);
      if (S.picks[id] > 1) text(ctx, `${S.picks[id]}`, x + 14, H - 24, 11, '#ffffff', 'right');
    });
  }
  text(ctx, 'P pause   M mute', W - 20, H - 74, 11, 'rgba(200,190,255,0.55)', 'right', 700);
  // banners
  if (S.banner) drawBanner(ctx, S.banner);
  if (S.ultFx) {
    const u = S.ultFx;
    const a = Math.min(1, u.t * 6, (1.6 - u.t) * 2.5);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(W / 2, 168);
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
  ctx.restore();
}

function drawHeroPanel(ctx, S) {
  const p = S.player;
  const h = S.hero;
  const x = 16;
  const y = H - 96;
  panel(ctx, x, y, 330, 82, 14, hexA(h.color, 0.5));
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + 42, y + 41, 30, 0, TAU);
  ctx.fillStyle = hexA(h.color, 0.18);
  ctx.fill();
  ctx.strokeStyle = h.color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.clip();
  drawPortrait(ctx, h, x + 42, y + 38, 0.62, S.time, { power: p.ult >= 100 ? 1 : 0 });
  ctx.restore();
  text(ctx, h.name, x + 84, y + 18, 18, h.color);
  text(ctx, `${Math.ceil(p.hp)} / ${p.maxHp}`, x + 230, y + 18, 12, '#ffffff', 'right');
  bar(ctx, x + 84, y + 32, 146, 10, p.hp / p.maxHp, '#7dff8a', '#1f9a3c');
  const dashK = p.dashCd <= 0 ? 1 : 1 - p.dashCd / (0.85 * S.mods.dashCdMul);
  text(ctx, 'DASH', x + 84, y + 60, 11, dashK >= 1 ? '#ffffff' : '#7a70a8');
  bar(ctx, x + 120, y + 56, 110, 7, dashK, '#ffffff', '#a8a0d8');
  // ultimate ring
  const cx = x + 282;
  const cy = y + 41;
  const k = p.ult / 100;
  const ready = k >= 1;
  if (ready) glow(ctx, cx, cy, 70 + Math.sin(S.time * 8) * 8, h.color, 0.9);
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(5,2,14,0.9)';
  ctx.beginPath();
  ctx.arc(cx, cy, 29, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = ready ? '#ffffff' : h.color;
  ctx.beginPath();
  ctx.arc(cx, cy, 29, -Math.PI / 2, -Math.PI / 2 + TAU * k);
  ctx.stroke();
  ctx.fillStyle = ready ? h.color : 'rgba(30,20,60,0.9)';
  ctx.beginPath();
  ctx.arc(cx, cy, 23, 0, TAU);
  ctx.fill();
  text(ctx, 'E', cx, cy - 6, 18, ready ? '#140a26' : '#ffffff', 'center');
  text(ctx, ready ? 'READY' : `${Math.floor(k * 100)}%`, cx, cy + 11, 8,ready ? '#140a26' : '#cfc6ff', 'center');
}

export function drawBanner(ctx, b) {
  const a = Math.min(1, b.t * 5, (b.dur - b.t) * 3);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const y = b.small ? 210 : 250;
  const slide = (1 - Math.min(1, b.t * 4)) * 60;
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(10,6,28,0)');
  g.addColorStop(0.25, 'rgba(10,6,28,0.82)');
  g.addColorStop(0.75, 'rgba(10,6,28,0.82)');
  g.addColorStop(1, 'rgba(10,6,28,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y - 46, W, b.sub ? 104 : 80);
  ctx.fillStyle = b.color;
  ctx.fillRect(W * 0.25, y - 46, W * 0.5, 2);
  ctx.fillRect(W * 0.25, y + (b.sub ? 56 : 32), W * 0.5, 2);
  ctx.translate(slide, 0);
  text(ctx, b.title, W / 2, y - 4, b.small ? 32 : 54, b.color, 'center');
  if (b.sub) text(ctx, b.sub, W / 2, y + 36, 19, '#ffffff', 'center', 700);
  ctx.restore();
}
