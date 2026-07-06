// ============================================================================
// test-summary.mjs — resumen de una corrida de Jest en $GITHUB_STEP_SUMMARY
// ============================================================================
// Uso: node .github/scripts/test-summary.mjs <results.json> "<Título>"
// Lee el JSON de `jest --json --outputFile=...` (agnóstico del proyecto) y emite
// una tabla Markdown HORIZONTAL (Suites | Tests | Aprobados | Fallidos |
// Duración | Estado), en paridad con el resumen del frontend.
// ============================================================================

import fs from 'node:fs';

const file = process.argv[2] || 'tests/reports/results.json';
const title = process.argv[3] || 'Tests';
const OUT = process.env.GITHUB_STEP_SUMMARY;

function write(md) {
  if (OUT) fs.appendFileSync(OUT, md + '\n');
  else process.stdout.write(md + '\n');
}

let r;
try {
  r = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch {
  write(`## ${title}\n\n⚠️ No se encontró el reporte de resultados (${file}).`);
  process.exit(0);
}

const suites = r.numTotalTestSuites ?? 0;
const failedSuites = r.numFailedTestSuites ?? 0;
const tests = r.numTotalTests ?? 0;
const passed = r.numPassedTests ?? 0;
const failed = r.numFailedTests ?? 0;
const durationMs = (r.testResults ?? []).reduce(
  (acc, t) => acc + Math.max(0, (t.endTime ?? 0) - (t.startTime ?? 0)),
  0,
);
const ok = failed === 0 && failedSuites === 0;

write(`## ${title}`);
write('');
write('| Suites | Tests | Aprobados | Fallidos | Duración | Estado |');
write('|:--:|:--:|:--:|:--:|:--:|:--:|');
write(
  `| ${suites} | ${tests} | ${passed} | ${failed} | ${(durationMs / 1000).toFixed(1)}s | ${ok ? '✅ PASSED' : '❌ FAILED'} |`,
);
write('');
