// Visual effects kept in the world state: particles, floating damage numbers, lightning arcs,
// screen shake and screen flashes, plus the cached soft-glow sprite every drawing uses. None of it
// changes the rules, only how a moment looks.
const TAU = Math.PI * 2;
const MAX_PARTS = 1500;

export function burst(S, x, y, color, n, o = {}) {
  const rnd = S.rng;
  const speed = o.speed ?? 160;
  const life = o.life ?? 0.5;
  const size = o.size ?? 3;
  const jitter = o.jitter ?? 0;
  for (let i = 0; i < n; i += 1) {
    const a = o.angle === undefined ? rnd() * TAU : o.angle + (rnd() - 0.5) * (o.spread ?? 1);
    const sp = speed * (0.35 + rnd() * 0.85);
    const l = life * (0.6 + rnd() * 0.7);
    S.parts.push({
      x: x + (rnd() - 0.5) * jitter,
      y: y + (rnd() - 0.5) * jitter,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp + (o.vy ?? 0),
      life: l,
      max: l,
      size: size * (0.6 + rnd() * 0.8),
      color,
      kind: o.kind ?? 'dot',
      drag: o.drag ?? 4,
      grav: o.grav ?? 0,
      add: o.add ?? true,
      rot: rnd() * TAU,
    });
  }
  if (S.parts.length > MAX_PARTS) S.parts.splice(0, S.parts.length - MAX_PARTS);
}

export function ring(S, x, y, color, r0, r1, life, width = 4) {
  S.parts.push({ x, y, vx: 0, vy: 0, life, max: life, size: width, r0, r1, color, kind: 'ring', drag: 0, grav: 0, add: true, rot: 0 });
}

export function addText(S, x, y, text, color, size = 15, big = false) {
  if (S.texts.length > 90) S.texts.shift();
  const life = big ? 1.1 : 0.75;
  S.texts.push({ x, y, text: String(text), color, size, life, max: life, vy: big ? -70 : -60 });
}

/** A jagged lightning arc between two points. */
export function arc(S, x1, y1, x2, y2, color, width = 3, life = 0.2) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(3, Math.floor(len / 20));
  const nx = -(y2 - y1) / (len || 1);
  const ny = (x2 - x1) / (len || 1);
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const off = i === 0 || i === n ? 0 : (S.rng() - 0.5) * Math.min(40, len * 0.25);
    pts.push(x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off);
  }
  S.arcs.push({ pts, color, width, life, max: life });
  if (S.arcs.length > 60) S.arcs.shift();
}

export function shake(S, amount) {
  S.shake = Math.min(26, Math.max(S.shake, amount));
}

export function flash(S, color, a) {
  S.flashColor = color;
  S.flashA = Math.max(S.flashA, a);
}

export function updateFx(S, dt) {
  let j = 0;
  for (let i = 0; i < S.parts.length; i += 1) {
    const p = S.parts[i];
    p.life -= dt;
    if (p.life <= 0) continue;
    const k = Math.exp(-p.drag * dt);
    p.vx *= k;
    p.vy = p.vy * k + p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    S.parts[j++] = p;
  }
  S.parts.length = j;
  j = 0;
  for (let i = 0; i < S.texts.length; i += 1) {
    const t = S.texts[i];
    t.life -= dt;
    if (t.life <= 0) continue;
    t.y += t.vy * dt;
    t.vy *= Math.exp(-3 * dt);
    S.texts[j++] = t;
  }
  S.texts.length = j;
  S.arcs = S.arcs.filter((a) => (a.life -= dt) > 0);
  S.shake = S.shake < 0.3 ? 0 : S.shake * Math.exp(-dt * 9);
  S.flashA = Math.max(0, S.flashA - dt * 1.6);
}

// ---------------------------------------------------------------- drawing

const glowCache = new Map();

/** A soft additive glow of `color` (hex) with radius r. */
export function glow(ctx, x, y, r, color, alpha = 1) {
  let g = glowCache.get(color);
  if (!g) {
    g = document.createElement('canvas');
    g.width = g.height = 128;
    const c = g.getContext('2d');
    const grad = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, color);
    grad.addColorStop(0.25, hexA(color, 0.55));
    grad.addColorStop(0.6, hexA(color, 0.14));
    grad.addColorStop(1, hexA(color, 0));
    c.fillStyle = grad;
    c.fillRect(0, 0, 128, 128);
    glowCache.set(color, g);
  }
  const op = ctx.globalCompositeOperation;
  const ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = ga * alpha;
  ctx.drawImage(g, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = ga;
  ctx.globalCompositeOperation = op;
}

/** '#rrggbb' to an rgba() string. */
export function hexA(hex, a) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function drawParts(ctx, S) {
  ctx.save();
  for (const additive of [false, true]) {
    ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
    for (const p of S.parts) {
      if (p.add !== additive) continue;
      const a = p.life / p.max;
      ctx.globalAlpha = Math.min(1, a * 1.4);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      switch (p.kind) {
        case 'spark': {
          ctx.lineWidth = p.size * 0.7;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          ctx.stroke();
          break;
        }
        case 'ring': {
          const t = 1 - a;
          ctx.lineWidth = p.size * a + 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - (1 - t) * (1 - t)), 0, TAU);
          ctx.stroke();
          break;
        }
        case 'plus': {
          const s = p.size * (0.6 + a * 0.6);
          ctx.fillRect(p.x - s, p.y - s * 0.32, s * 2, s * 0.64);
          ctx.fillRect(p.x - s * 0.32, p.y - s, s * 0.64, s * 2);
          break;
        }
        case 'smoke': {
          ctx.globalAlpha = a * 0.35;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (2 - a), 0, TAU);
          ctx.fill();
          break;
        }
        case 'shard': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot + (1 - a) * 6);
          ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
          ctx.restore();
          break;
        }
        case 'petal': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot + (1 - a) * 4);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        default: {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, TAU);
          ctx.fill();
        }
      }
    }
  }
  ctx.restore();
}

export function drawArcs(ctx, S) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const a of S.arcs) {
    const k = a.life / a.max;
    for (const [w, col, al] of [[a.width * 3.2, a.color, 0.35], [a.width, '#ffffff', 0.95]]) {
      ctx.globalAlpha = al * k;
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(a.pts[0], a.pts[1]);
      for (let i = 2; i < a.pts.length; i += 2) ctx.lineTo(a.pts[i], a.pts[i + 1]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawTexts(ctx, S) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const t of S.texts) {
    const a = t.life / t.max;
    const pop = 1 + Math.max(0, (a - 0.8) * 2.5);
    ctx.globalAlpha = Math.min(1, a * 2);
    ctx.font = `900 ${Math.round(t.size * pop)}px ${FONT}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(10,4,24,0.9)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}

export const FONT = "'Trebuchet MS', 'Segoe UI', 'DejaVu Sans', Verdana, sans-serif";
