// Every sound is synthesized with WebAudio: short oscillator and filtered-noise recipes for the
// effects, and a small step sequencer for the music (a calm pad on menus, a driving loop in a
// fight, a heavier one against bosses). Audio starts on the first key press or click.
let ac = null;
let master;
let sfxBus;
let musicBus;
let noiseBuf;
let muted = false;
let mode = 'off';
let nextT = 0;
let stepI = 0;
const last = {};

export function initAudio() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ac = new AC();
  } catch {
    ac = null;
    return;
  }
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(ac.destination);
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  comp.connect(master);
  sfxBus = ac.createGain();
  sfxBus.gain.value = 0.75;
  sfxBus.connect(comp);
  musicBus = ac.createGain();
  musicBus.gain.value = 0.34;
  musicBus.connect(comp);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  nextT = ac.currentTime + 0.1;
  setInterval(schedule, 40);
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ac.currentTime, 0.03);
  return muted;
}

export const isMuted = () => muted;

export function setMusic(m) {
  if (m === mode) return;
  mode = m;
  stepI = 0;
  if (ac) nextT = ac.currentTime + 0.08;
}

function tone(f, dur, o = {}) {
  const t0 = ac.currentTime + (o.delay ?? 0);
  const osc = ac.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(f, t0);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t0 + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = osc;
  if (o.lp) {
    const f2 = ac.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.value = o.lp;
    osc.connect(f2);
    node = f2;
  }
  node.connect(g).connect(o.bus ?? sfxBus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur, o = {}) {
  const t0 = ac.currentTime + (o.delay ?? 0);
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = o.type ?? 'lowpass';
  f.frequency.setValueAtTime(o.freq ?? 1000, t0);
  if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
  f.Q.value = o.q ?? 1;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t0 + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(o.bus ?? sfxBus);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.05);
}

const arp = (notes, step, o) => notes.forEach((n, i) => tone(n, o.dur ?? 0.16, { ...o, delay: (o.delay ?? 0) + i * step }));

const GAP = { hit: 0.035, pop: 0.03, core: 0.25, zap: 0.05, wind: 0.2, spit: 0.08, warn: 0.15, deny: 0.3, turret: 0.09, boom: 0.07, slam: 0.06, hurt: 0.1, ui: 0.04 };

export function sfx(name) {
  if (!ac || muted) return;
  const now = ac.currentTime;
  if (now - (last[name] ?? -1) < (GAP[name] ?? 0.02)) return;
  last[name] = now;
  switch (name) {
    case 'shot_blaze': noise(0.13, { freq: 900, vol: 0.22 }); tone(190, 0.1, { type: 'sawtooth', slide: 90, vol: 0.06 }); break;
    case 'shot_volt': tone(1500, 0.06, { type: 'square', slide: 600, vol: 0.05 }); noise(0.05, { type: 'highpass', freq: 3500, vol: 0.08 }); break;
    case 'shot_frost': tone(1900, 0.09, { slide: 1200, vol: 0.09 }); tone(2700, 0.05, { type: 'triangle', vol: 0.04 }); break;
    case 'shot_gale': noise(0.17, { type: 'bandpass', freq: 1300, slide: 500, q: 2, vol: 0.25 }); break;
    case 'shot_mind': tone(480, 0.13, { slide: 950, vol: 0.09 }); tone(720, 0.1, { type: 'triangle', slide: 1100, vol: 0.04 }); break;
    case 'shot_bloom': tone(880, 0.09, { type: 'triangle', slide: 1320, vol: 0.08 }); break;
    case 'hit': noise(0.045, { type: 'bandpass', freq: 2200, vol: 0.12 }); break;
    case 'pop': tone(320, 0.12, { type: 'square', slide: 60, vol: 0.07, lp: 1800 }); noise(0.1, { freq: 900, vol: 0.12 }); break;
    case 'hurt': tone(230, 0.25, { type: 'sawtooth', slide: 80, vol: 0.16, lp: 1500 }); break;
    case 'down': tone(320, 0.8, { type: 'sawtooth', slide: 40, vol: 0.2, lp: 1400 }); break;
    case 'core': tone(130, 0.2, { type: 'square', slide: 70, vol: 0.1, lp: 900 }); noise(0.18, { freq: 400, vol: 0.14 }); break;
    case 'dash': noise(0.16, { type: 'bandpass', freq: 600, slide: 2600, q: 1.5, vol: 0.24 }); break;
    case 'zap': noise(0.12, { type: 'highpass', freq: 2500, vol: 0.16 }); tone(95, 0.1, { type: 'square', vol: 0.06, lp: 600 }); break;
    case 'wind': noise(0.3, { type: 'bandpass', freq: 700, q: 3, vol: 0.12 }); break;
    case 'throw': noise(0.35, { type: 'bandpass', freq: 300, slide: 1800, q: 2, vol: 0.28 }); break;
    case 'slam': tone(95, 0.42, { slide: 35, vol: 0.5 }); noise(0.3, { freq: 500, vol: 0.32 }); break;
    case 'boom': tone(130, 0.35, { slide: 40, vol: 0.32 }); noise(0.3, { freq: 900, vol: 0.22 }); break;
    case 'spit': tone(420, 0.12, { slide: 150, vol: 0.07 }); break;
    case 'warn': tone(880, 0.08, { type: 'square', vol: 0.05, lp: 2500 }); tone(660, 0.08, { type: 'square', vol: 0.05, lp: 2500, delay: 0.1 }); break;
    case 'roar': tone(72, 1.0, { type: 'sawtooth', slide: 44, vol: 0.28, lp: 700, attack: 0.08 }); tone(108, 1.0, { type: 'sawtooth', slide: 60, vol: 0.14, lp: 900, attack: 0.08 }); noise(1, { freq: 420, vol: 0.2, attack: 0.1 }); break;
    case 'dive': noise(0.5, { type: 'bandpass', freq: 400, slide: 2600, q: 1.5, vol: 0.26 }); tone(300, 0.5, { type: 'sawtooth', slide: 900, vol: 0.06, lp: 2000 }); break;
    case 'charge': tone(110, 1.0, { type: 'sawtooth', slide: 620, vol: 0.09, lp: 1800, attack: 0.3 }); break;
    case 'bossdown':
      tone(200, 1.6, { slide: 30, vol: 0.5 });
      noise(1.5, { freq: 1600, slide: 100, vol: 0.4 });
      arp([523, 659, 784, 1047], 0.12, { type: 'triangle', vol: 0.12, dur: 0.4, delay: 0.5 });
      break;
    case 'ready': arp([660, 880, 1320], 0.06, { type: 'triangle', vol: 0.1, dur: 0.14 }); break;
    case 'deny': tone(140, 0.08, { type: 'square', vol: 0.05, lp: 800 }); break;
    case 'heal': tone(660, 0.2, { slide: 990, vol: 0.1 }); tone(990, 0.2, { slide: 1320, vol: 0.08, delay: 0.08 }); break;
    case 'go': tone(440, 0.1, { type: 'square', vol: 0.06, lp: 2400 }); tone(660, 0.18, { type: 'square', vol: 0.07, lp: 2400, delay: 0.11 }); break;
    case 'clear': arp([523, 659, 784, 1047], 0.09, { type: 'triangle', vol: 0.12, dur: 0.22 }); break;
    case 'offer': arp([392, 523, 659], 0.05, { type: 'sine', vol: 0.08, dur: 0.5 }); break;
    case 'pick': tone(784, 0.16, { type: 'triangle', slide: 1568, vol: 0.12 }); noise(0.2, { type: 'highpass', freq: 4000, vol: 0.06 }); break;
    case 'ui': tone(620, 0.05, { type: 'triangle', vol: 0.06 }); break;
    case 'select': tone(520, 0.14, { type: 'square', slide: 1040, vol: 0.07, lp: 3000 }); break;
    case 'turret': tone(1100, 0.04, { type: 'square', slide: 700, vol: 0.025, lp: 3000 }); break;
    case 'gameover': arp([392, 330, 262, 196], 0.22, { type: 'sawtooth', vol: 0.1, dur: 0.4, lp: 1500 }); break;
    case 'victory': arp([523, 659, 784, 1047, 1319], 0.12, { type: 'triangle', vol: 0.13, dur: 0.5 }); arp([262, 330, 392], 0, { type: 'sawtooth', vol: 0.05, dur: 1.6, lp: 1200, delay: 0.6 }); break;
    default:
      if (name.startsWith('ult_')) {
        noise(0.7, { freq: 300, slide: 4000, vol: 0.3 });
        const base = { ult_blaze: 110, ult_volt: 147, ult_frost: 196, ult_gale: 131, ult_mind: 165, ult_bloom: 220 }[name] ?? 130;
        for (const m of [1, 1.5, 2, 3]) tone(base * m, 0.9, { type: m === 1 ? 'sawtooth' : 'triangle', vol: 0.08, lp: 3000, attack: 0.02 });
        tone(60, 0.6, { slide: 30, vol: 0.4 });
      }
  }
}

// ---------------------------------------------------------------- music

const STEP = 60 / 118 / 4;
const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const mtof = (n) => 440 * 2 ** ((n - 69) / 12);

function schedule() {
  if (!ac || mode === 'off') return;
  while (nextT < ac.currentTime + 0.16) {
    playStep(stepI, nextT - ac.currentTime);
    nextT += STEP;
    stepI += 1;
  }
}

function playStep(i, delay) {
  if (delay < 0) return;
  const bus = musicBus;
  const s = i % 16;
  const chord = PROG[Math.floor(i / 16) % 4];
  if (mode === 'menu') {
    if (s === 0) for (const n of chord) tone(mtof(n), STEP * 16, { type: 'triangle', vol: 0.045, attack: 0.4, delay, bus });
    if (s === 0) tone(mtof(chord[0] - 24), STEP * 16, { type: 'sine', vol: 0.08, attack: 0.2, delay, bus });
    if (s % 3 === 0) tone(mtof(chord[(s / 3) % 3] + 12), STEP * 3, { type: 'sine', vol: 0.03, delay, bus });
    return;
  }
  const boss = mode === 'boss';
  const bass = chord[0] - (boss ? 36 : 24) + (s % 4 === 2 ? 12 : 0);
  if (s % 2 === 0) tone(mtof(bass), STEP * 1.7, { type: 'sawtooth', vol: 0.1, lp: boss ? 500 : 700, delay, bus });
  tone(mtof(chord[s % 3] + 12 + (s >= 8 ? 12 : 0)), STEP * 0.9, { type: boss ? 'square' : 'triangle', vol: boss ? 0.018 : 0.035, lp: 2600, delay, bus });
  if (s % 4 === 0 || (boss && s === 10)) tone(150, 0.18, { slide: 45, vol: 0.32, delay, bus });
  if (s % 2 === 1) noise(0.03, { type: 'highpass', freq: 7000, vol: 0.05, delay, bus });
  if (s === 4 || s === 12) noise(0.13, { type: 'bandpass', freq: 1800, vol: 0.12, delay, bus });
  if (boss && s % 8 === 0) for (const n of chord) tone(mtof(n), STEP * 2, { type: 'sawtooth', vol: 0.02, lp: 1600, delay, bus });
}
