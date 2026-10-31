// state: draft | engine-generated
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const config = path.join(root, '.netlify/operational-typecheck.tsconfig.json');
const require = createRequire(import.meta.url);
fs.mkdirSync(path.dirname(config), { recursive: true });
fs.writeFileSync(
  config,
  JSON.stringify({
    extends: '../tsconfig.json',
    include: ['../src', '../test', '../netlify/functions'],
    exclude: ['../node_modules', '../dist'],
  })
);
let result;
try {
  result = spawnSync(
    process.execPath,
    [require.resolve('typescript/bin/tsc'), '--noEmit', '--project', config],
    {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      timeout: 120_000,
    }
  );
} finally {
  fs.unlinkSync(config);
}
const text = result.stdout ?? '';
const diagnostics = [...text.matchAll(/^(.+)\((\d+),(\d+)\): error (TS\d+):/gm)].map((match) => ({
  file: path.relative(root, path.resolve(match[1])).split(path.sep).join('/'),
  line: Number(match[2]),
  column: Number(match[3]),
  code: match[4],
}));
function countBy(key) {
  const counts = {};
  for (const item of diagnostics) {
    const name = key(item);
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}
const report = {
  state: 'draft',
  authorship: 'engine-generated',
  generatedAt: new Date().toISOString(),
  method: 'Original compiler options with src/test/function exclusions removed; no emit or build.',
  exitCode: result.status,
  executionCompleted: !result.error && result.signal === null,
  diagnosticCount: diagnostics.length,
  affectedFiles: new Set(diagnostics.map((item) => item.file)).size,
  errorCodes: countBy((item) => item.code),
  areas: countBy((item) => item.file.split('/').slice(0, 2).join('/')),
  globalCodes: [...text.matchAll(/^error (TS\d+):/gm)].map((match) => match[1]),
  limits: [
    'Compiler messages, source excerpts and values are never exported.',
    'The existing configuration does not enable JSX or supply absent React dependencies; most diagnostics describe that inactive scope.',
    'Diagnostics are not a count of independent defects, and this run is not a production-readiness certification.',
  ],
  diagnostics,
};
fs.mkdirSync('docs/audits', { recursive: true });
fs.writeFileSync(
  'docs/audits/TYPECHECK-COMPLETO-2026-10-24.json',
  JSON.stringify(report, null, 2) + '\n'
);
console.log(
  JSON.stringify({
    exitCode: report.exitCode,
    executionCompleted: report.executionCompleted,
    diagnosticCount: report.diagnosticCount,
    affectedFiles: report.affectedFiles,
    errorCodes: report.errorCodes,
  })
);
process.exitCode = result.status ?? 1;
