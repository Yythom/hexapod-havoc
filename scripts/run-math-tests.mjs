import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = path.join(os.tmpdir(), `hexapod-math-test-${Date.now()}.mjs`);
try {
  await build({
    entryPoints: ['scripts/test-math.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: tmp,
    logLevel: 'silent',
  });
  execFileSync(process.execPath, [tmp], { stdio: 'inherit' });
} finally {
  fs.rmSync(tmp, { force: true });
}
