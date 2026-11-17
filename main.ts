// Hero City: Blackout - hand-in program for make.fun's best-game-01 (Node 22, standard library only).
//
// What it does, in order:
//   1. finds the repository it lives in and the output directory (/output, or MAKEFUN_OUTPUT_DIR);
//   2. checks the entry before touching anything: game/index.html is a file, screenshots/ holds 3-4
//      PNG/JPEG images within the size cap;
//   3. replaces output/game and output/screenshots with fresh copies from the repository;
//   4. writes output/dossier.json with buildDossier (vendor/makefun-game.ts, never edited);
//   5. prints a short summary, or a clear reason and exit code 1 when a check fails.
//
// Try it locally:  MAKEFUN_OUTPUT_DIR=/tmp/hcs-out node main.ts

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, DossierError } from './vendor/makefun-game.ts';

const REPO = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

// The gate's limits for best-game-01, passed to buildDossier so it refuses what the gate would refuse.
const LIMITS = {
  text_max_bytes: 160 * 1024,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};
const MIN_SHOTS = 3;
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

class EntryProblem extends Error {}

function kib(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

/** Walks game/ and returns how many files it holds and their total size (symlinks are refused). */
function surveyGame(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name);
      if (entry.isSymbolicLink()) throw new EntryProblem(`game/ must hold plain files only, but ${full} is a symlink`);
      if (entry.isDirectory()) walk(full);
      else {
        files += 1;
        bytes += statSync(full).size;
      }
    }
  };
  walk(dir);
  return { files, bytes };
}

/** Lists the screenshots the dossier will carry (sorted, the first is the cover) after checking each one. */
function listScreenshots(dir: string): { name: string; bytes: number }[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new EntryProblem('screenshots/ is missing: the entry needs 3 or 4 renders of the game');
  const shots = readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .sort()
    .map((name) => {
      if (!SHOT_NAME.test(name)) throw new EntryProblem(`screenshots/${name}: use letters, digits and . _ - only`);
      if (!/\.(png|jpe?g)$/i.test(name)) throw new EntryProblem(`screenshots/${name}: only PNG or JPEG images are accepted`);
      const bytes = lstatSync(join(dir, name)).size;
      if (bytes > LIMITS.screenshots.max_bytes) throw new EntryProblem(`screenshots/${name} is ${kib(bytes)}, over the ${kib(LIMITS.screenshots.max_bytes)} cap`);
      return { name, bytes };
    });
  if (shots.length < MIN_SHOTS || shots.length > LIMITS.screenshots.max) {
    throw new EntryProblem(`screenshots/ holds ${shots.length} images; the gate wants ${MIN_SHOTS} to ${LIMITS.screenshots.max}`);
  }
  return shots;
}

/** Replaces target with a copy of source (so a second run writes exactly the same tree). */
function mirror(source: string, target: string): void {
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

function handIn(): void {
  const gameDir = join(REPO, 'game');
  const index = join(gameDir, 'index.html');
  if (!existsSync(index) || !lstatSync(index).isFile()) throw new EntryProblem('game/index.html is missing: it is the page the judge and players open');
  if (lstatSync(index).size > 1024 * 1024) throw new EntryProblem('game/index.html is over 1 MiB');

  const game = surveyGame(gameDir);
  if (game.files > LIMITS.game_max_files) throw new EntryProblem(`game/ holds ${game.files} files, over ${LIMITS.game_max_files}`);
  const shots = listScreenshots(join(REPO, 'screenshots'));

  mkdirSync(OUTPUT, { recursive: true });
  mirror(gameDir, join(OUTPUT, 'game'));
  mirror(join(REPO, 'screenshots'), join(OUTPUT, 'screenshots'));

  const dossier = buildDossier(OUTPUT, LIMITS);
  writeFileSync(join(OUTPUT, 'dossier.json'), dossier);

  console.log('Hero City: Blackout - entry written');
  console.log(`  output      ${OUTPUT}`);
  console.log(`  game/       ${game.files} files, ${kib(game.bytes)}`);
  console.log(`  screenshots ${shots.length}: ${shots.map((s) => `${s.name} (${kib(s.bytes)})`).join(', ')}`);
  console.log(`  cover       ${shots[0]!.name}`);
  console.log(`  dossier     ${kib(dossier.length)}`);
}

try {
  handIn();
} catch (err) {
  if (err instanceof EntryProblem || err instanceof DossierError) {
    console.error(`hand-in refused: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
