// Screenshots and play-testing with Playwright, against the game served by `node serve.ts --port 8090`.
//   node tools/shots.cjs            -> renders every scene in shots.json into screenshots/ (JPEG, <= 256 KiB)
//   node tools/shots.cjs one '?shot=cover&seed=2' /tmp/x.jpg -> renders one scene to a file
//   node tools/shots.cjs play [s]   -> plays each hero for s seconds with scripted input, saving frames to /tmp/hcs-play
const { chromium } = require('/root/makefun/tools/node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.BASE_URL || 'http://localhost:8090/';
const EXE = '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const root = path.join(__dirname, '..');
const LIMIT = 256 * 1024;

async function open(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return { page, errors };
}

async function shots(browser, only) {
  const list = only ?? JSON.parse(fs.readFileSync(path.join(root, 'shots.json'), 'utf8'));
  fs.mkdirSync(path.join(root, 'screenshots'), { recursive: true });
  for (const s of list) {
    const { page, errors } = await open(browser);
    const t0 = Date.now();
    await page.goto(BASE + s.query);
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 });
    let q = 90;
    let buf = await page.screenshot({ type: 'jpeg', quality: q });
    while (buf.length > LIMIT && q > 30) {
      q -= 5;
      buf = await page.screenshot({ type: 'jpeg', quality: q });
    }
    fs.writeFileSync(path.isAbsolute(s.name) ? s.name : path.join(root, 'screenshots', s.name), buf);
    console.log(`${s.name}: ${(buf.length / 1024).toFixed(0)} KiB at q${q} in ${Date.now() - t0} ms`, errors.length ? errors : '');
    await page.close();
  }
}

async function play(browser, seconds) {
  const out = path.resolve(process.argv[4] || '/tmp/hcs-play');
  fs.mkdirSync(out, { recursive: true });
  for (let hero = 1; hero <= 6; hero += 1) {
    const { page, errors } = await open(browser);
    await page.goto(BASE);
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await page.keyboard.press(`Digit${hero}`);
    const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
    let held = null;
    const end = Date.now() + seconds * 1000;
    let i = 0;
    await page.mouse.move(640, 200);
    await page.mouse.down();
    while (Date.now() < end) {
      i += 1;
      const a = i * 0.7;
      await page.mouse.move(640 + Math.cos(a) * 400, 384 + Math.sin(a) * 260);
      if (i % 4 === 0) {
        if (held) await page.keyboard.up(held);
        held = keys[(i / 4) % 4];
        await page.keyboard.down(held);
      }
      if (i % 7 === 0) await page.keyboard.press('Space');
      if (i % 5 === 0) await page.keyboard.press('KeyE');
      if (i % 9 === 0) await page.keyboard.press('Digit2');
      if (i === 30) { await page.keyboard.press('KeyP'); await page.waitForTimeout(150); await page.keyboard.press('KeyP'); }
      if (i === 40) { await page.keyboard.press('KeyM'); await page.keyboard.press('KeyM'); }
      if (i % 60 === 0) await page.screenshot({ path: `${out}/hero${hero}-${i}.jpg`, type: 'jpeg', quality: 70 });
      await page.waitForTimeout(100);
    }
    await page.screenshot({ path: `${out}/hero${hero}-end.jpg`, type: 'jpeg', quality: 70 });
    console.log(`hero ${hero}: ${i} input ticks`, errors.length ? errors : 'no console errors');
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    if (process.argv[2] === 'play') await play(browser, Number(process.argv[3] || 20));
    else if (process.argv[2] === 'one') await shots(browser, [{ query: process.argv[3], name: path.resolve(process.argv[4]) }]);
    else await shots(browser);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
