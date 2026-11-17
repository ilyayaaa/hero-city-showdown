// Blessings offered at each dawn: three picks, always at least one for the lamps and one for
// the hero. Lamp blessings change the light itself (wider pools, lamps that zap, a faster and
// cheaper relight, a lantern the hero carries); hero blessings change how the hero fights
// (pierce, chain, lifesteal, a turret ally, a bigger ultimate...). Also each blessing's icon.
import { BEACON, TAU } from './combat.js';
import { glow } from './particles.js';

export const RARITY = {
  common: { label: 'COMMON', color: '#9fb4ff' },
  rare: { label: 'RARE', color: '#5ef2ff' },
  epic: { label: 'EPIC', color: '#ff7ae0' },
  lamp: { label: 'LAMP', color: '#ffcf5a' },
};

export const UPGRADES = [
  { id: 'widelight', kind: 'lamp', name: 'Wide Lenses', rarity: 'lamp', max: 3, desc: 'Every lamp and the Beacon cast 20% wider light.', apply: (m) => { m.lampRadiusMul += 0.2; } },
  { id: 'zaplamp', kind: 'lamp', name: 'Arc Lamps', rarity: 'lamp', max: 3, desc: 'Lit lamps zap a shadow inside their light every second.', apply: (m) => { m.lampZap += 1; } },
  { id: 'quickwick', kind: 'lamp', name: 'Quick Wick', rarity: 'lamp', max: 2, desc: 'Relight 45% faster for 40% less Spark.', apply: (m) => { m.relightTimeMul *= 0.55; m.relightCostMul *= 0.6; } },
  { id: 'sear', kind: 'lamp', name: 'Searing Light', rarity: 'lamp', max: 3, desc: 'Shadows inside the light take +25% damage.', apply: (m) => { m.sear += 1; } },
  { id: 'lantern', kind: 'lamp', name: 'Hero Lantern', rarity: 'lamp', max: 2, desc: 'Carry a small light that reveals shadows near you; Spark flies to you from further.', apply: (m) => { m.lantern += 1; m.magnet += 0.5; } },
  { id: 'barrier', kind: 'lamp', name: 'Beacon Ward', rarity: 'lamp', max: 3, desc: 'Beacon +250 max HP, repairs 350 HP and zaps attackers.', apply: (m, S) => { S.beacon.max += 250; S.beacon.hp = Math.min(S.beacon.max, S.beacon.hp + 350); m.thorns += 12; } },
  { id: 'pierce', name: 'Piercing Shots', rarity: 'common', max: 3, desc: 'Basic attacks pass through 1 more shadow.', apply: (m) => { m.pierce += 1; } },
  { id: 'chain', name: 'Chain Spark', rarity: 'rare', max: 3, desc: 'Every hit arcs to 1 more nearby shadow for 50% damage.', apply: (m) => { m.chain += 1; } },
  { id: 'lifesteal', name: 'Vampiric Spark', rarity: 'rare', max: 3, desc: 'Heal for 6% of all damage you deal.', apply: (m) => { m.lifesteal += 0.06; } },
  { id: 'ultpower', name: 'Overcharge', rarity: 'epic', max: 3, desc: 'Ultimate is 35% bigger and charges 25% faster.', apply: (m) => { m.ultPower += 0.35; m.ultGain += 0.25; } },
  { id: 'turret', name: 'Sentry Turret', rarity: 'epic', max: 3, desc: 'Build an auto-turret by the Beacon that guns down shadows.', apply: (m) => { m.turrets += 1; } },
  { id: 'multishot', name: 'Split Shot', rarity: 'rare', max: 3, desc: 'Fire 1 extra projectile in a spread.', apply: (m) => { m.multishot += 1; } },
  { id: 'rate', name: 'Rapid Fire', rarity: 'common', max: 4, desc: 'Attack 25% faster.', apply: (m) => { m.rateMul += 0.25; } },
  { id: 'damage', name: 'Heavy Hitter', rarity: 'common', max: 4, desc: 'All your damage +30%.', apply: (m) => { m.dmgMul += 0.3; } },
  { id: 'swift', name: 'Swift Boots', rarity: 'common', max: 3, desc: 'Move 15% faster; dash recharges 30% faster.', apply: (m) => { m.speedMul += 0.15; m.dashCdMul *= 0.7; } },
  { id: 'dashstrike', name: 'Dash Strike', rarity: 'rare', max: 2, desc: 'Dashing through shadows deals 60 damage and knocks them away.', apply: (m) => { m.dashStrike += 60; } },
  { id: 'crit', name: 'Critical Focus', rarity: 'rare', max: 3, desc: '+15% chance to critically hit for 2.5x damage.', apply: (m) => { m.crit += 0.15; } },
  { id: 'explode', name: 'Volatile Rounds', rarity: 'rare', max: 2, desc: 'Hits blow up for 40% damage around the target.', apply: (m) => { m.explode += 1; } },
  { id: 'drone', name: 'Guardian Drone', rarity: 'epic', max: 3, desc: 'A drone orbits you and slices shadows it touches.', apply: (m) => { m.drones += 1; } },
  { id: 'vigor', name: 'Hero Vigor', rarity: 'common', max: 3, desc: '+40 max HP, full heal and regenerate 2 HP per second.', apply: (m, S) => { S.player.maxHp += 40; S.player.hp = S.player.maxHp; m.regen += 2; } },
  { id: 'combo', name: 'Showboat', rarity: 'common', max: 2, desc: 'Chains last 2 s longer and every banish scores +25%.', apply: (m) => { m.comboKeep += 2; m.scoreMul += 0.25; } },
];
for (const u of UPGRADES) u.kind = u.kind ?? 'hero';

export const BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
export const TURRET_SPOTS = [
  { x: BEACON.x - 120, y: BEACON.y - 64 },
  { x: BEACON.x + 120, y: BEACON.y - 64 },
  { x: BEACON.x, y: BEACON.y + 128 },
];

export function newMods() {
  return {
    dmgMul: 1, rateMul: 1, pierce: 0, chain: 0, lifesteal: 0, ultGain: 1, ultPower: 1, multishot: 0, crit: 0, explode: 0,
    speedMul: 1, dashCdMul: 1, dashStrike: 0, thorns: 0, turrets: 0, drones: 0, comboKeep: 0, scoreMul: 1, regen: 0,
    lampRadiusMul: 1, lampZap: 0, relightTimeMul: 1, relightCostMul: 1, sear: 0, lantern: 0, magnet: 1,
  };
}

/** Three different blessings not maxed yet: one for the lamps, one for the hero, one of either. */
export function rollOffer(S) {
  const open = UPGRADES.filter((u) => (S.picks[u.id] ?? 0) < u.max);
  const take = (list) => (list.length ? list.splice(Math.floor(S.rng() * list.length), 1)[0].id : null);
  const lamps = open.filter((u) => u.kind === 'lamp');
  const heroes = open.filter((u) => u.kind === 'hero');
  const out = [take(lamps), take(heroes)];
  const rest = [...lamps, ...heroes];
  out.push(take(rest));
  while (out.filter(Boolean).length < 3 && rest.length) out.push(take(rest));
  const picks = out.filter(Boolean);
  // Shuffle so the lamp card is not always first.
  for (let i = picks.length - 1; i > 0; i -= 1) {
    const j = Math.floor(S.rng() * (i + 1));
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }
  return picks;
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
    case 'widelight':
      lampHead(ctx, 0, -6);
      ctx.lineWidth = 2.5;
      for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) line([Math.sin(a) * 8, 4, Math.sin(a) * 20, 4 + Math.cos(a) * 14]);
      break;
    case 'zaplamp':
      lampHead(ctx, -6, -6);
      poly([10, -16, 2, 0, 8, 0, 2, 16, 18, -4, 11, -4, 16, -16]);
      break;
    case 'quickwick':
      ctx.beginPath();
      ctx.moveTo(-4, 14);
      ctx.quadraticCurveTo(-16, 2, -4, -16);
      ctx.quadraticCurveTo(0, -4, 6, -6);
      ctx.quadraticCurveTo(10, 8, -4, 14);
      ctx.fill();
      line([8, 6, 18, 6]);
      line([10, -2, 20, -2]);
      break;
    case 'sear':
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * TAU;
        line([Math.cos(a) * 12, Math.sin(a) * 12, Math.cos(a) * 18, Math.sin(a) * 18]);
      }
      break;
    case 'lantern':
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-8, -10, 16, 22);
      line([-5, -10, 0, -17, 5, -10]);
      ctx.beginPath();
      ctx.arc(0, 1, 5, 0, TAU);
      ctx.fill();
      break;
    default:
      ctx.font = '900 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('x2', 0, 1);
  }
  ctx.restore();
}

/** A small street-lamp head (dome and glowing bulb) for the lamp icons. */
function lampHead(ctx, x, y) {
  ctx.beginPath();
  ctx.moveTo(x - 11, y + 3);
  ctx.quadraticCurveTo(x, y - 14, x + 11, y + 3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y + 5, 4, 0, TAU);
  ctx.fill();
}
