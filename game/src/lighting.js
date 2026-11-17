// Drawing the blackout: warm pools of lamplight on the street, the lamp posts, the night itself
// (a deep blue overlay with every light cut out of it), the dark auras and glowing eyes of the
// shrouded shadows, Spark motes, relight prompts, and the sunrise sweeping the night away.
import { H, TAU, W } from './combat.js';
import { lampInReach, lampRadius, lightSources, relightCost } from './lamps.js';
import { darkness, sunriseX } from './night.js';
import { FONT, glow, hexA } from './particles.js';

const NIGHT_RGB = '4,9,30';
const NIGHT_ALPHA = 0.8;
const LAMP_GOLD = '#ffc861';
const PAD = 40;

let shade = null;
const sprites = new Map();

/** A soft radial sprite: `stops` as [offset, alpha] pairs of `rgb`, cached per key. */
function sprite(key, rgb, stops) {
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [o, a] of stops) grad.addColorStop(o, `rgba(${rgb},${a})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  sprites.set(key, c);
  return c;
}

const cutSprite = () => sprite('cut', '255,255,255', [[0, 1], [0.55, 0.95], [0.8, 0.55], [1, 0]]);
const poolSprite = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  return sprite(`pool${hex}`, rgb, [[0, 0.55], [0.35, 0.32], [0.75, 0.12], [1, 0]]);
};

function lightColor(s) {
  if (s.kind === 'flare') return s.color ?? '#ffffff';
  if (s.kind === 'beacon') return '#ffe2a0';
  if (s.kind === 'lantern') return '#fff0c8';
  return LAMP_GOLD;
}

/** Warm light pooled on the street under every light source, with a faint rim where it ends. */
export function drawLightPools(ctx, S) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of lightSources(S)) {
    const r = s.r * (1 + Math.sin(S.time * 7 + s.x) * 0.012);
    ctx.globalAlpha = (s.kind === 'flare' ? 0.5 : 0.42) * s.power;
    ctx.drawImage(poolSprite(lightColor(s)), s.x - r, s.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.setLineDash([10, 9]);
  ctx.lineWidth = 2;
  for (const l of S.lamps) {
    if (l.power <= 0) continue;
    ctx.strokeStyle = `rgba(255,214,130,${0.22 * l.power})`;
    ctx.beginPath();
    ctx.arc(l.x, l.y, lampRadius(S, l), 0, TAU);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

/** The posts themselves, drawn on the ground layer (the glowing heads come after the night). */
export function drawLampPosts(ctx, S) {
  for (const l of S.lamps) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(l.x + 8, l.y + 4, 14, 6, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1d2547';
    ctx.strokeStyle = '#4a5893';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(l.x, l.y, 10, 5, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#3b4678';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(l.x, l.y - 34);
    ctx.stroke();
    ctx.strokeStyle = '#7c8ac4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(l.x - 1.5, l.y - 2);
    ctx.lineTo(l.x - 1.5, l.y - 32);
    ctx.stroke();
  }
}

/** The night: a blue-black veil over the city with every light cut out (and the dawn wiped off). */
export function drawDarkness(ctx, S) {
  const level = darkness(S);
  if (level <= 0) return;
  if (!shade) {
    shade = document.createElement('canvas');
    shade.width = W + PAD * 2;
    shade.height = H + PAD * 2;
  }
  const g = shade.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, shade.width, shade.height);
  g.fillStyle = `rgba(${NIGHT_RGB},${NIGHT_ALPHA * level})`;
  g.fillRect(0, 0, shade.width, shade.height);
  g.translate(PAD, PAD);
  g.globalCompositeOperation = 'destination-out';
  const cut = cutSprite();
  for (const s of lightSources(S)) {
    const flick = s.kind === 'lamp' && s.power < 1 ? 0.75 + Math.sin(S.time * 40 + s.x) * 0.2 : 1;
    const r = s.r * 1.08;
    g.globalAlpha = Math.min(1, s.power * flick);
    g.drawImage(cut, s.x - r, s.y - r, r * 2, r * 2);
  }
  g.globalAlpha = 1;
  const sx = sunriseX(S);
  if (sx !== null) {
    const edge = g.createLinearGradient(sx - 220, 0, sx, 0);
    edge.addColorStop(0, 'rgba(0,0,0,1)');
    edge.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = edge;
    g.fillRect(-PAD, -PAD, sx + PAD, H + PAD * 2);
  }
  ctx.drawImage(shade, -PAD, -PAD);
}

/** Shrouded shadows: a dark violet aura and glowing eyes, so they read even in the deep night. */
export function drawShrouds(ctx, S) {
  if (darkness(S) <= 0) return;
  for (const e of S.enemies) {
    if (e.dead || e.lit) continue;
    const lift = e.fly ? 16 : e.lift * 22;
    const y = e.y - lift;
    const r = e.r * (e.boss ? 1.4 : 1);
    glow(ctx, e.x, y, r * 2.8, '#5a36e0', 0.32 + Math.sin(S.time * 5 + e.id) * 0.06);
    ctx.save();
    ctx.strokeStyle = 'rgba(150,120,255,0.45)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k += 1) {
      const a = S.time * 2.2 + e.id + (k / 3) * TAU;
      ctx.beginPath();
      ctx.arc(e.x, y, r * 1.35, a, a + 0.9);
      ctx.stroke();
    }
    ctx.restore();
    if (e.boss) continue;
    const fx = Math.cos(e.face);
    const fy = Math.sin(e.face);
    for (const side of [-1, 1]) {
      const ex = e.x + fx * r * 0.55 - fy * side * r * 0.3;
      const ey = y + fy * r * 0.55 + fx * side * r * 0.3;
      glow(ctx, ex, ey, r * 0.55, '#ff4f7a', 0.8);
      ctx.fillStyle = '#ffd0da';
      ctx.fillRect(ex - 1.5, ey - 1.5, 3, 3);
    }
  }
}

/** Lamp heads after the night: lit bulbs blaze gold, dark ones show their relight prompt. */
export function drawLampHeads(ctx, S) {
  const near = lampInReach(S);
  const t = S.time;
  for (const l of S.lamps) {
    const hx = l.x;
    const hy = l.y - 38;
    const lit = l.power > 0;
    const flick = l.power < 1 && lit ? 0.6 + Math.sin(t * 37 + l.id) * 0.4 : 1;
    if (lit) {
      glow(ctx, hx, hy, 46, LAMP_GOLD, 0.95 * flick * l.power);
      glow(ctx, hx, hy, 16, '#ffffff', 0.9 * flick);
    }
    ctx.fillStyle = lit ? '#2d3560' : '#1a1f3a';
    ctx.strokeStyle = lit ? '#ffd98a' : '#5a5f88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - 12, hy + 3);
    ctx.quadraticCurveTo(hx, hy - 13, hx + 12, hy + 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = lit ? `rgba(255,246,214,${flick})` : '#3a3f62';
    ctx.beginPath();
    ctx.arc(hx, hy + 5, 4.5, 0, TAU);
    ctx.fill();
    if (lit || S.backdrop) continue;
    // A dark lamp: smoke wisps and its prompt.
    const pulse = 0.5 + Math.sin(t * 4 + l.id) * 0.5;
    ctx.save();
    ctx.strokeStyle = `rgba(150,130,255,${0.35 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(l.x, l.y, 34, 0, TAU);
    ctx.stroke();
    ctx.restore();
    const isNear = near === l;
    const label = isNear ? `HOLD E  ·  ${relightCost(S, l)} SPARK` : 'DARK LAMP';
    labelTag(ctx, label, hx, hy - 22, isNear ? '#ffd36b' : '#a99cff');
  }
  if (near && S.relightK > 0) {
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(10,8,30,0.8)';
    ctx.beginPath();
    ctx.arc(near.x, near.y, 30, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#ffd36b';
    ctx.beginPath();
    ctx.arc(near.x, near.y, 30, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, S.relightK));
    ctx.stroke();
    ctx.restore();
    glow(ctx, near.x, near.y - 38, 30 + S.relightK * 40, LAMP_GOLD, S.relightK);
  }
}

function labelTag(ctx, s, x, y, color) {
  ctx.save();
  ctx.font = `800 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(s).width + 14;
  ctx.fillStyle = 'rgba(6,8,24,0.85)';
  ctx.fillRect(x - w / 2, y - 9, w, 18);
  ctx.strokeStyle = hexA(color, 0.7);
  ctx.lineWidth = 1;
  ctx.strokeRect(x - w / 2 + 0.5, y - 8.5, w - 1, 17);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y + 0.5);
  ctx.restore();
}

/** Spark motes: little golden four-point twinkles. */
export function drawMotes(ctx, S) {
  for (const m of S.motes) {
    const fade = Math.min(1, (14 - m.t) / 2);
    const tw = 0.7 + Math.sin(S.time * 9 + m.x) * 0.3;
    const s = (m.n > 1 ? 7 : 5) * tw;
    glow(ctx, m.x, m.y, 16 + m.n * 3, '#ffcf5a', 0.8 * fade);
    ctx.fillStyle = `rgba(255,248,220,${fade})`;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y - s);
    ctx.lineTo(m.x + s * 0.3, m.y - s * 0.3);
    ctx.lineTo(m.x + s, m.y);
    ctx.lineTo(m.x + s * 0.3, m.y + s * 0.3);
    ctx.lineTo(m.x, m.y + s);
    ctx.lineTo(m.x - s * 0.3, m.y + s * 0.3);
    ctx.lineTo(m.x - s, m.y);
    ctx.lineTo(m.x - s * 0.3, m.y - s * 0.3);
    ctx.closePath();
    ctx.fill();
  }
}

/** The sunrise: a blazing band sweeping left to right, warm morning light behind it. */
export function drawSunrise(ctx, S) {
  if (S.phase !== 'dawn') return;
  const sx = sunriseX(S);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const warm = ctx.createLinearGradient(0, 0, 0, H);
  warm.addColorStop(0, 'rgba(255,170,90,0.16)');
  warm.addColorStop(1, 'rgba(255,120,80,0.04)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, Math.max(0, sx - 60), H);
  const band = ctx.createLinearGradient(sx - 200, 0, sx + 40, 0);
  band.addColorStop(0, 'rgba(255,150,60,0)');
  band.addColorStop(0.7, 'rgba(255,190,90,0.35)');
  band.addColorStop(0.95, 'rgba(255,240,190,0.6)');
  band.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = band;
  ctx.fillRect(sx - 200, 0, 240, H);
  ctx.restore();
}
