// ============================================================================
// test-summary.mjs — resumen de una corrida de Jest en $GITHUB_STEP_SUMMARY
// ============================================================================
// Uso: node .github/scripts/test-summary.mjs <results.json> "<Título>"
// Lee el JSON de `jest --json --outputFile=...` (agnóstico del proyecto).
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
const passedSuites = r.numPassedTestSuites ?? 0;
const tests = r.numTotalTests ?? 0;
const passed = r.numPassedTests ?? 0;
const failed = r.numFailedTests ?? 0;
const pending = r.numPendingTests ?? 0;
const durationMs = (r.testResults ?? []).reduce(
  (acc, t) => acc + Math.max(0, (t.endTime ?? 0) - (t.startTime ?? 0)),
  0,
);

write(`## ${title}`);
write('');
write('| Métrica | Valor |');
write('|---|---|');
write(`| Suites | ${passedSuites}/${suites} |`);
write(`| Tests aprobados | ${passed}/${tests} |`);
write(`| Tests fallidos | ${failed} |`);
if (pending) write(`| Tests omitidos | ${pending} |`);
write(`| Duración | ${(durationMs / 1000).toFixed(1)} s |`);
write('');
write(failed === 0 ? '✅ Todas las pruebas pasaron.' : `❌ ${failed} prueba(s) fallaron.`);
write('');
