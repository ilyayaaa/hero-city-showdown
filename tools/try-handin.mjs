// Runs main.ts the way the grader does, but into a scratch directory (default /tmp/hcs-out),
// twice, and checks both runs wrote the same dossier bytes.
//   node tools/try-handin.mjs [outdir]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] || '/tmp/hcs-out';
const main = new URL('../main.ts', import.meta.url).pathname;
const digest = () => createHash('sha256').update(readFileSync(join(out, 'dossier.json'))).digest('hex');
const run = () => execFileSync(process.execPath, [main], { env: { ...process.env, MAKEFUN_OUTPUT_DIR: out }, stdio: 'inherit' });

run();
const first = digest();
run();
const second = digest();
console.log(first === second ? `both runs wrote dossier sha256 ${first}` : `MISMATCH ${first} vs ${second}`);
if (first !== second) process.exit(1);
