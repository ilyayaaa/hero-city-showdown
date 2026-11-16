// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps, and
// the screen is painted at 1280x720 game units scaled to fit the window. Screens: title, hero
// select, play (with the upgrade choice between waves), paused, and the end screen.
//
// ?seed=N fixes the run. ?shot=cover|boss|upgrade|title (with &seed=N) stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { H, W } from './combat.js';
import { HEROES } from './heroes.js';
import { chooseUpgrade, createWorld, newIntent, stepWorld } from './world.js';
import { createInput } from './input.js';
import { drawWorld } from './render.js';
import { drawHud } from './hud.js';
import { cardAt, drawEnd, drawPause, drawSelect, drawTitle, drawUpgrade, selectCard, upgradeCard } from './screens.js';
import { initAudio, isMuted, setMusic, sfx, toggleMute } from './audio.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const BEST_KEY = 'hero-city-showdown.best';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const fixedSeed = Number.isInteger(seedParam) ? seedParam : null;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const view = { scale: 1, ox: 0, oy: 0, dpr: 1 };

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  view.dpr = dpr;
  view.scale = Math.min(canvas.width / W, canvas.height / H);
  view.ox = (canvas.width - W * view.scale) / 2;
  view.oy = (canvas.height - H * view.scale) / 2;
}
resize();
window.addEventListener('resize', resize);

function toGame(cx, cy) {
  const r = canvas.getBoundingClientRect();
  return { x: ((cx - r.left) * view.dpr - view.ox) / view.scale, y: ((cy - r.top) * view.dpr - view.oy) / view.scale };
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

const app = { screen: 'title', menu: createWorld(7, 0), S: null, sel: 0, hover: -1, best: readBest(), newBest: false, t: 0 };

function paint() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05030c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  const sc = app.screen;
  if (sc === 'title' || sc === 'select') {
    drawWorld(ctx, app.menu, { noHero: true });
    if (sc === 'title') drawTitle(ctx, app.t, app.best);
    else drawSelect(ctx, app.t, app.sel);
  } else {
    const S = app.S;
    drawWorld(ctx, S);
    if (sc !== 'over') {
      drawHud(ctx, S);
      if (S.phase === 'upgrade') drawUpgrade(ctx, S, app.hover, app.t);
    }
    if (sc === 'paused') drawPause(ctx, isMuted());
    if (sc === 'over') drawEnd(ctx, S, app.best, app.newBest, app.t);
  }
  ctx.restore();
}

function runShot(name) {
  const hero = Number.parseInt(params.get('hero') ?? '', 10);
  Object.assign(app, stageShot(name, fixedSeed ?? 1, hero >= 0 && hero < HEROES.length ? hero : null));
  let painted = 0;
  function frame() {
    paint();
    painted += 1;
    if (painted < 2) requestAnimationFrame(frame);
    else window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

function runGame() {
  const input = createInput(canvas, toGame);
  const intent = newIntent();
  let acc = 0;
  let last = performance.now();
  let lastMouse = '';
  const announce = (m) => {
    status.textContent = m;
  };
  window.addEventListener('pointerdown', initAudio);
  window.addEventListener('keydown', initAudio);

  function start(i) {
    app.sel = i;
    app.S = createWorld(fixedSeed ?? Math.floor(Math.random() * 4294967296), i);
    app.S.sfx = sfx;
    app.screen = 'play';
    app.newBest = false;
    app.hover = -1;
    acc = 0;
    Object.assign(intent, newIntent());
    sfx('select');
    setMusic('fight');
    announce(`${HEROES[i].name} defends the city. Wave 1.`);
  }

  function end() {
    const S = app.S;
    app.screen = 'over';
    if (S.score > app.best) {
      app.best = S.score;
      app.newBest = true;
      saveBest(S.score);
    }
    sfx(S.result === 'victory' ? 'victory' : 'gameover');
    setMusic('menu');
    announce(`${S.result === 'victory' ? 'Victory' : 'Game over'}. Score ${S.score}. Best ${app.best}. Press R to play again.`);
  }

  function pick(i) {
    if (chooseUpgrade(app.S, i)) {
      sfx('pick');
      app.hover = -1;
      announce(`Upgrade chosen. Wave ${app.S.wave}.`);
    }
  }

  function handle(codes) {
    const m = input.mouse;
    for (const c of codes) {
      if (c === 'KeyM') {
        toggleMute();
        continue;
      }
      const digit = c.startsWith('Digit') ? Number(c.slice(5)) : c.startsWith('Numpad') ? Number(c.slice(6)) : 0;
      switch (app.screen) {
        case 'title':
          if (c === 'Enter' || c === 'Space' || c === 'Mouse0') {
            app.screen = 'select';
            sfx('ui');
            announce('Choose your hero: press 1 to 6.');
          }
          break;
        case 'select': {
          if (digit >= 1 && digit <= HEROES.length) start(digit - 1);
          else if (c === 'ArrowLeft' || c === 'KeyA') {
            app.sel = (app.sel + HEROES.length - 1) % HEROES.length;
            sfx('ui');
          } else if (c === 'ArrowRight' || c === 'KeyD') {
            app.sel = (app.sel + 1) % HEROES.length;
            sfx('ui');
          } else if (c === 'Enter' || c === 'Space') start(app.sel);
          else if (c === 'Escape') app.screen = 'title';
          else if (c === 'Mouse0') {
            const i = cardAt(selectCard, HEROES.length, m.x, m.y);
            if (i >= 0) start(i);
          }
          break;
        }
        case 'play': {
          const S = app.S;
          if (c === 'KeyP' || c === 'Escape') {
            app.screen = 'paused';
            announce('Paused.');
          } else if (S.phase === 'upgrade') {
            if (digit >= 1 && digit <= 3) pick(digit - 1);
            else if (c === 'Mouse0') {
              const i = cardAt(upgradeCard, 3, m.x, m.y);
              if (i >= 0) pick(i);
            }
          } else if (c === 'KeyE') intent.ult = true;
          else if (c === 'Space' || c === 'Mouse2' || c === 'ShiftLeft') intent.dash = true;
          break;
        }
        case 'paused':
          if (c === 'KeyP' || c === 'Escape') {
            app.screen = 'play';
            announce('Playing.');
          } else if (c === 'KeyQ') {
            app.screen = 'title';
            setMusic('menu');
          }
          break;
        case 'over':
          if (c === 'KeyR' || c === 'Mouse0' || c === 'Enter') start(app.sel);
          else if (c === 'KeyH') app.screen = 'select';
          break;
        default:
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    app.t += dt;
    handle(input.take());
    const m = input.mouse;
    const mk = `${Math.round(m.x)},${Math.round(m.y)}`;
    if (mk !== lastMouse) {
      lastMouse = mk;
      if (app.screen === 'select') {
        const i = cardAt(selectCard, HEROES.length, m.x, m.y);
        if (i >= 0 && i !== app.sel) {
          app.sel = i;
          sfx('ui');
        }
      } else if (app.screen === 'play' && app.S.phase === 'upgrade') {
        const i = cardAt(upgradeCard, 3, m.x, m.y);
        if (i !== app.hover && i >= 0) sfx('ui');
        app.hover = i;
      }
    }
    if (app.screen === 'title' || app.screen === 'select') {
      app.menu.time += dt;
      setMusic('menu');
    } else if (app.screen === 'play') {
      const S = app.S;
      acc += dt;
      while (acc >= STEP && !S.result) {
        intent.mx = input.moveX();
        intent.my = input.moveY();
        intent.ax = m.x;
        intent.ay = m.y;
        intent.fire = m.left && S.phase !== 'upgrade';
        stepWorld(S, STEP, intent);
        acc -= STEP;
      }
      if (S.result) end();
      else setMusic(S.boss ? 'boss' : 'fight');
    } else if (app.screen === 'over') {
      stepWorld(app.S, dt, intent);
    }
    paint();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && app.screen === 'play') {
      app.screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Hero City Showdown. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
