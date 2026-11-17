// The minimap in the HUD's corner: the streets, the Beacon and its light, every lamp lit (gold)
// or dark (violet cross), shadows as dots (red when revealed, violet when shrouded), the boss
// and the hero.
import { BEACON, BUILDINGS, H, TAU, W } from './combat.js';
import { beaconRadius, lampRadius } from './lamps.js';
import { glow } from './particles.js';

export const MINIMAP = { w: 196, h: 110 };

export function drawMinimap(ctx, S, x, y) {
  const k = MINIMAP.w / W;
  const px = (v) => x + v * k;
  const py = (v) => y + v * k;
  ctx.save();
  ctx.fillStyle = 'rgba(6,10,28,0.88)';
  ctx.strokeStyle = 'rgba(255,207,90,0.55)';
  ctx.lineWidth = 2;
  ctx.fillRect(x - 4, y - 4, MINIMAP.w + 8, MINIMAP.h + 8);
  ctx.strokeRect(x - 4, y - 4, MINIMAP.w + 8, MINIMAP.h + 8);
  ctx.beginPath();
  ctx.rect(x, y, MINIMAP.w, H * k);
  ctx.clip();
  ctx.fillStyle = '#121b38';
  ctx.fillRect(x, y, MINIMAP.w, H * k);
  ctx.fillStyle = '#0b1229';
  ctx.fillRect(x, py(318), MINIMAP.w, 132 * k);
  ctx.fillRect(px(574), y, 132 * k, H * k);
  ctx.fillStyle = '#26315a';
  for (const b of BUILDINGS) ctx.fillRect(px(b.x), py(b.y), b.w * k, b.h * k);
  ctx.fillStyle = 'rgba(255,214,120,0.18)';
  ctx.beginPath();
  ctx.arc(px(BEACON.x), py(BEACON.y), beaconRadius(S) * k, 0, TAU);
  ctx.fill();
  for (const l of S.lamps) {
    if (l.power > 0) {
      ctx.fillStyle = `rgba(255,200,97,${0.16 + 0.12 * l.power})`;
      ctx.beginPath();
      ctx.arc(px(l.x), py(l.y), lampRadius(S, l) * k, 0, TAU);
      ctx.fill();
      glow(ctx, px(l.x), py(l.y), 8, '#ffc861', 0.9);
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(px(l.x) - 2, py(l.y) - 2, 4, 4);
    } else {
      const blink = Math.sin(S.time * 6 + l.id) > -0.2;
      ctx.strokeStyle = blink ? '#b49cff' : '#5b4fa0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px(l.x) - 3.5, py(l.y) - 3.5);
      ctx.lineTo(px(l.x) + 3.5, py(l.y) + 3.5);
      ctx.moveTo(px(l.x) + 3.5, py(l.y) - 3.5);
      ctx.lineTo(px(l.x) - 3.5, py(l.y) + 3.5);
      ctx.stroke();
    }
  }
  for (const e of S.enemies) {
    if (e.dead) continue;
    ctx.fillStyle = e.boss ? '#ff4d6a' : e.kind === 'snuffer' ? '#c8b8ff' : e.lit ? '#ff6a7a' : '#8a6cff';
    const s = e.boss ? 6 : 2.4;
    ctx.fillRect(px(e.x) - s / 2, py(e.y) - s / 2, s, s);
  }
  glow(ctx, px(BEACON.x), py(BEACON.y), 10, '#ffe2a0', 1);
  const p = S.player;
  if (p.down <= 0) {
    ctx.fillStyle = S.hero.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px(p.x), py(p.y), 3.2, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
