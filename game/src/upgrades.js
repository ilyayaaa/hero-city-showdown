// Upgrades offered between waves: three random picks, each a real change to how the hero plays
// (pierce, chain, lifesteal, a turret ally, a bigger ultimate...). Also each upgrade's icon.
import { PLAZA, TAU } from './combat.js';
import { glow } from './particles.js';

export const RARITY = {
  common: { label: 'COMMON', color: '#9fb4ff' },
  rare: { label: 'RARE', color: '#5ef2ff' },
  epic: { label: 'EPIC', color: '#ff7ae0' },
};

export const UPGRADES = [
  { id: 'pierce', name: 'Piercing Shots', rarity: 'common', max: 3, desc: 'Basic attacks pass through 1 more monster.', apply: (m) => { m.pierce += 1; } },
  { id: 'chain', name: 'Chain Spark', rarity: 'rare', max: 3, desc: 'Every hit arcs to 1 more nearby monster for 50% damage.', apply: (m) => { m.chain += 1; } },
  { id: 'lifesteal', name: 'Vampiric Core', rarity: 'rare', max: 3, desc: 'Heal for 6% of all damage you deal.', apply: (m) => { m.lifesteal += 0.06; } },
  { id: 'ultpower', name: 'Overcharge', rarity: 'epic', max: 3, desc: 'Ultimate is 35% bigger and charges 25% faster.', apply: (m) => { m.ultPower += 0.35; m.ultGain += 0.25; } },
  { id: 'turret', name: 'Sentry Turret', rarity: 'epic', max: 3, desc: 'Build an auto-turret by the City Core that guns down monsters.', apply: (m) => { m.turrets += 1; } },
  { id: 'multishot', name: 'Split Shot', rarity: 'rare', max: 3, desc: 'Fire 1 extra projectile in a spread.', apply: (m) => { m.multishot += 1; } },
  { id: 'rate', name: 'Rapid Fire', rarity: 'common', max: 4, desc: 'Attack 25% faster.', apply: (m) => { m.rateMul += 0.25; } },
  { id: 'damage', name: 'Heavy Hitter', rarity: 'common', max: 4, desc: 'All your damage +30%.', apply: (m) => { m.dmgMul += 0.3; } },
  { id: 'swift', name: 'Swift Boots', rarity: 'common', max: 3, desc: 'Move 15% faster; dash recharges 30% faster.', apply: (m) => { m.speedMul += 0.15; m.dashCdMul *= 0.7; } },
  { id: 'dashstrike', name: 'Dash Strike', rarity: 'rare', max: 2, desc: 'Dashing through monsters deals 60 damage and knocks them away.', apply: (m) => { m.dashStrike += 60; } },
  { id: 'barrier', name: 'Core Barrier', rarity: 'common', max: 3, desc: 'City Core +250 max HP, repairs 350 HP and zaps attackers.', apply: (m, S) => { S.plaza.max += 250; S.plaza.hp = Math.min(S.plaza.max, S.plaza.hp + 350); m.thorns += 12; } },
  { id: 'crit', name: 'Critical Focus', rarity: 'rare', max: 3, desc: '+15% chance to critically hit for 2.5x damage.', apply: (m) => { m.crit += 0.15; } },
  { id: 'explode', name: 'Volatile Rounds', rarity: 'rare', max: 2, desc: 'Hits blow up for 40% damage around the target.', apply: (m) => { m.explode += 1; } },
  { id: 'drone', name: 'Guardian Drone', rarity: 'epic', max: 3, desc: 'A drone orbits you and slices monsters it touches.', apply: (m) => { m.drones += 1; } },
  { id: 'vigor', name: 'Hero Vigor', rarity: 'common', max: 3, desc: '+40 max HP, full heal and regenerate 2 HP per second.', apply: (m, S) => { S.player.maxHp += 40; S.player.hp = S.player.maxHp; m.regen += 2; } },
  { id: 'combo', name: 'Showboat', rarity: 'common', max: 2, desc: 'Combos last 2 s longer and kills score +25%.', apply: (m) => { m.comboKeep += 2; m.scoreMul += 0.25; } },
];

export const BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
export const TURRET_SPOTS = [
  { x: PLAZA.x - 120, y: PLAZA.y - 64 },
  { x: PLAZA.x + 120, y: PLAZA.y - 64 },
  { x: PLAZA.x, y: PLAZA.y + 128 },
];

export function newMods() {
  return {
    dmgMul: 1, rateMul: 1, pierce: 0, chain: 0, lifesteal: 0, ultGain: 1, ultPower: 1, multishot: 0, crit: 0, explode: 0,
    speedMul: 1, dashCdMul: 1, dashStrike: 0, thorns: 0, turrets: 0, drones: 0, comboKeep: 0, scoreMul: 1, regen: 0,
  };
}

/** Three different upgrades that are not maxed yet. */
export function rollOffer(S) {
  const pool = UPGRADES.filter((u) => (S.picks[u.id] ?? 0) < u.max).map((u) => u.id);
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(S.rng() * pool.length), 1)[0]);
  return out;
}

export function applyUpgrade(S, id) {
  const u = BY_ID[id];
  S.picks[id] = (S.picks[id] ?? 0) + 1;
  u.apply(S.mods, S);
  if (id === 'turret') {
    const spot = TURRET_SPOTS[S.mods.turrets - 1];
    S.allies.push({ x: spot.x, y: spot.y, cd: 0, aim: -Math.PI / 2, fireT: 0 });
  }
}

/** The upgrade's icon, centred at (x, y), about 2s across. */
export function drawIcon(ctx, id, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 20, s / 20);
  glow(ctx, 0, 0, 34, color, 0.5);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
  };
  const poly = (pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  };
  switch (id) {
    case 'pierce':
      for (const cx of [-4, 8]) {
        ctx.beginPath();
        ctx.arc(cx, 0, 6, 0, TAU);
        ctx.stroke();
      }
      line([-18, 0, 18, 0]);
      poly([18, 0, 10, -6, 10, 6]);
      break;
    case 'chain':
      line([-14, -14, -2, -2, -8, 2, 6, 14]);
      for (const [cx, cy] of [[-14, -14], [6, 14], [14, -8]]) {
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, TAU);
        ctx.fill();
      }
      line([-2, -2, 14, -8]);
      break;
    case 'lifesteal':
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.bezierCurveTo(-22, -2, -10, -20, 0, -8);
      ctx.bezierCurveTo(10, -20, 22, -2, 0, 14);
      ctx.fill();
      break;
    case 'ultpower': {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * TAU - Math.PI / 2;
        const r = i % 2 ? 7 : 17;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'turret':
      ctx.fillRect(-12, 6, 24, 8);
      ctx.beginPath();
      ctx.arc(0, 2, 9, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 5;
      line([0, 2, 12, -12]);
      break;
    case 'multishot':
      for (const a of [-0.45, 0, 0.45]) {
        ctx.save();
        ctx.rotate(a - Math.PI / 2);
        line([-12, 0, 12, 0]);
        poly([16, 0, 8, -5, 8, 5]);
        ctx.restore();
      }
      break;
    case 'rate':
      ctx.lineWidth = 4;
      line([-14, -10, -4, 0, -14, 10]);
      line([-2, -10, 8, 0, -2, 10]);
      line([10, -10, 20, 0, 10, 10]);
      break;
    case 'damage':
      ctx.lineWidth = 4;
      line([-14, 14, 12, -12]);
      line([14, 14, -12, -12]);
      line([-16, 6, -6, 16]);
      line([16, 6, 6, 16]);
      break;
    case 'swift':
      poly([-6, -14, 8, -14, 8, 6, 16, 10, 16, 14, -6, 14]);
      line([-18, -4, -10, -4]);
      line([-20, 4, -10, 4]);
      break;
    case 'dashstrike':
      poly([-16, -6, 4, -6, 4, -14, 18, 0, 4, 14, 4, 6, -16, 6]);
      break;
    case 'barrier':
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(14, -10);
      ctx.quadraticCurveTo(14, 8, 0, 16);
      ctx.quadraticCurveTo(-14, 8, -14, -10);
      ctx.closePath();
      ctx.fill();
      break;
    case 'crit':
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, TAU);
      ctx.stroke();
      line([0, -18, 0, -6]);
      line([0, 18, 0, 6]);
      line([-18, 0, -6, 0]);
      line([18, 0, 6, 0]);
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, TAU);
      ctx.fill();
      break;
    case 'explode': {
      ctx.beginPath();
      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * TAU;
        const r = i % 2 ? 7 : 17 - (i % 4) * 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'drone':
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 9, -0.4, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(14, -6, 4, 0, TAU);
      ctx.fill();
      break;
    case 'vigor':
      ctx.fillRect(-5, -15, 10, 30);
      ctx.fillRect(-15, -5, 30, 10);
      break;
    default:
      ctx.font = '900 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('x2', 0, 1);
  }
  ctx.restore();
}
