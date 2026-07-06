// ============================================================================
// coverage-summary.mjs — reporte multivista de cobertura en $GITHUB_STEP_SUMMARY
// ============================================================================
// Agnóstico del lenguaje: lee los reportes de istanbul (coverage-summary.json y
// coverage-final.json) que produce ts-jest, para tres corridas:
//   - COMBINADA (gate)  → tests/reports/coverage
//   - UNIT              → tests/reports/coverage-unit
//   - INTEGRATION       → tests/reports/coverage-integration
// Secciones (§5 de la guía): veredicto del gate, global combinada, por tipo con
// HUELLA + % Total, patch coverage (código nuevo), focos, distribución, detalle
// por archivo y glosario.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const GATE = Number(process.env.COVERAGE_GATE || 85);
const OUT = process.env.GITHUB_STEP_SUMMARY;
const DIR_COMBINED = process.env.COVERAGE_DIR || 'tests/reports/coverage';
const DIR_UNIT = process.env.COVERAGE_UNIT_DIR || 'tests/reports/coverage-unit';
const DIR_INT = process.env.COVERAGE_INT_DIR || 'tests/reports/coverage-integration';
const METRICS = ['statements', 'branches', 'functions', 'lines'];

function write(md) {
  if (OUT) fs.appendFileSync(OUT, md + '\n');
  else process.stdout.write(md + '\n');
}
function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}
function rel(p) {
  const norm = p.replace(/\\/g, '/');
  const i = norm.lastIndexOf('/src/');
  return i >= 0 ? norm.slice(i + 1) : path.basename(norm);
}
function pct(covered, total) {
  return total === 0 ? 100 : Math.round((covered / total) * 10000) / 100;
}
function bar(p) {
  return p >= GATE ? '✅' : '⚠️';
}

const summaryCombined = readJSON(path.join(DIR_COMBINED, 'coverage-summary.json'));
const finalCombined = readJSON(path.join(DIR_COMBINED, 'coverage-final.json'));

if (!summaryCombined) {
  write('## 🎯 Coverage Gate\n\n⚠️ No se encontró `coverage-summary.json` de la corrida combinada.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 1) VEREDICTO DEL GATE
// ---------------------------------------------------------------------------
const total = summaryCombined.total;
const passed = METRICS.every((m) => total[m].pct >= GATE);

write(`## 🎯 Coverage Gate (mínimo ${GATE}%)`);
write('');
write(`**Coverage Gate (${GATE}%): ${passed ? 'PASSED ✅' : 'FAILED ❌'}**`);
write('');

// ---------------------------------------------------------------------------
// 2) COBERTURA GLOBAL (COMBINADA)
// ---------------------------------------------------------------------------
write('### 📦 Cobertura global (combinada)');
write('');
write('| Métrica | Cobertura | Cubierto/Total | ≥' + GATE + '% |');
write('|---|---:|---:|:---:|');
for (const m of METRICS) {
  const t = total[m];
  write(`| ${m} | ${t.pct}% | ${t.covered}/${t.total} | ${bar(t.pct)} |`);
}
write('');

// ---------------------------------------------------------------------------
// 3) COBERTURA POR TIPO DE TEST (huella + % Total)
// ---------------------------------------------------------------------------
// Huella = solo los archivos que la suite EJERCITA (statements.covered > 0).
function footprint(dir) {
  const s = readJSON(path.join(dir, 'coverage-summary.json'));
  if (!s) return null;
  const files = Object.entries(s).filter(([k]) => k !== 'total');
  const touched = files.filter(([, v]) => (v.statements?.covered ?? 0) > 0);
  const agg = { statements: [0, 0], branches: [0, 0], functions: [0, 0], lines: [0, 0] };
  for (const [, v] of touched) {
    for (const m of METRICS) {
      agg[m][0] += v[m].covered;
      agg[m][1] += v[m].total;
    }
  }
  const totalCov = METRICS.reduce((a, m) => a + agg[m][0], 0);
  const totalAll = METRICS.reduce((a, m) => a + agg[m][1], 0);
  return {
    files: touched.map(([k]) => k),
    pct: Object.fromEntries(METRICS.map((m) => [m, pct(agg[m][0], agg[m][1])])),
    totalPct: pct(totalCov, totalAll),
  };
}

const fpUnit = footprint(DIR_UNIT);
const fpInt = footprint(DIR_INT);
const fpComb = footprint(DIR_COMBINED);

write('### 🧪 Cobertura por tipo de test');
write('');
write('_Cada % se mide sobre la **huella** de la suite (los archivos que ejercita), no sobre toda la superficie._');
write('');
write('| Tipo | % Stmts | % Branch | % Funcs | % Lines | % Total | Archivos |');
write('|---|---:|---:|---:|---:|---:|---:|');
for (const [label, fp] of [
  ['Unit', fpUnit],
  ['Integration', fpInt],
  ['Combinada (gate)', fpComb],
]) {
  if (!fp) {
    write(`| ${label} | — | — | — | — | — | — |`);
    continue;
  }
  write(
    `| ${label} | ${fp.pct.statements}% | ${fp.pct.branches}% | ${fp.pct.functions}% | ${fp.pct.lines}% | **${fp.totalPct}%** | ${fp.files.length} |`,
  );
}
write('');
if (fpUnit && fpInt && fpComb) {
  const shared = fpUnit.files.filter((f) => fpInt.files.includes(f)).length;
  write(
    `> ${shared} archivo(s) se ejercitan por Unit **y** Integration; por eso ${fpUnit.files.length} + ${fpInt.files.length} no son archivos únicos.`,
  );
  write(
    `> Contando sin repetir (unión) quedan **${fpComb.files.length} = Combinada**.`,
  );
  write('');
}

// ---------------------------------------------------------------------------
// 4) COBERTURA DE CÓDIGO NUEVO (PATCH) — estilo SonarQube "new code"
// ---------------------------------------------------------------------------
function computePatch() {
  if (!finalCombined) return null;
  let base = '';
  try {
    if (process.env.GITHUB_BASE_REF) {
      base = `origin/${process.env.GITHUB_BASE_REF}`;
      execSync(`git rev-parse --verify ${base}`, { stdio: 'ignore' });
    } else {
      execSync('git rev-parse --verify HEAD~1', { stdio: 'ignore' });
      base = 'HEAD~1';
    }
  } catch {
    return null;
  }

  let diff = '';
  try {
    diff = execSync(
      `git diff --unified=0 --diff-filter=AM ${base}...HEAD -- "src/**/*.ts"`,
      { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
    );
  } catch {
    return null;
  }

  // Mapa absoluto→cobertura por línea (statementMap + hits `s`).
  const lineHits = {}; // relPath -> Map(line -> covered?)
  for (const [abs, data] of Object.entries(finalCombined)) {
    const r = rel(abs);
    const map = new Map();
    for (const [id, loc] of Object.entries(data.statementMap || {})) {
      const line = loc.start.line;
      const hit = (data.s?.[id] ?? 0) > 0;
      if (!map.has(line)) map.set(line, hit);
      else map.set(line, map.get(line) || hit);
    }
    lineHits[r] = map;
  }

  const perFile = {};
  let curFile = null;
  let newLine = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ b/')) {
      curFile = raw.slice(6).replace(/\\/g, '/');
      const i = curFile.lastIndexOf('/src/');
      curFile = i >= 0 ? curFile.slice(i + 1) : curFile;
      continue;
    }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk) {
      newLine = parseInt(hunk[1], 10);
      continue;
    }
    if (!curFile) continue;
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      const map = lineHits[curFile];
      if (map && map.has(newLine)) {
        perFile[curFile] = perFile[curFile] || { total: 0, covered: 0 };
        perFile[curFile].total += 1;
        if (map.get(newLine)) perFile[curFile].covered += 1;
      }
      newLine += 1;
    } else if (!raw.startsWith('-')) {
      newLine += 1;
    }
  }

  const files = Object.entries(perFile);
  const totalNew = files.reduce((a, [, v]) => a + v.total, 0);
  const coveredNew = files.reduce((a, [, v]) => a + v.covered, 0);
  return { base, files, totalNew, coveredNew };
}

const patch = computePatch();
write('### 🆕 Cobertura de código nuevo (patch)');
write('');
if (!patch || patch.totalNew === 0) {
  write('`N/A` — el cambio no toca líneas ejecutables de `src/` (o no hay base para comparar).');
  write('');
} else {
  const p = pct(patch.coveredNew, patch.totalNew);
  write(
    `Líneas nuevas: **${patch.totalNew}** · cubiertas: **${patch.coveredNew}** · **${p}%** ${p < GATE ? '⚠️' : '✅'} _(informativo, no bloquea)_`,
  );
  write('');
  write('| Archivo | Nuevas | Cubiertas | % |');
  write('|---|---:|---:|---:|');
  for (const [f, v] of patch.files.sort((a, b) => a[0].localeCompare(b[0]))) {
    write(`| ${f} | ${v.total} | ${v.covered} | ${pct(v.covered, v.total)}% |`);
  }
  write('');
}

// ---------------------------------------------------------------------------
// 5) FOCOS DE ATENCIÓN — menor % de ramas + líneas sin cubrir
// ---------------------------------------------------------------------------
function uncoveredLines(data) {
  const lines = new Set();
  for (const [id, loc] of Object.entries(data.statementMap || {})) {
    if ((data.s?.[id] ?? 0) === 0) lines.add(loc.start.line);
  }
  return [...lines].sort((a, b) => a - b);
}
if (finalCombined && summaryCombined) {
  const files = Object.entries(summaryCombined)
    .filter(([k]) => k !== 'total')
    .map(([k, v]) => ({ f: rel(k), abs: k, br: v.branches.pct }))
    .filter((x) => x.br < 100)
    .sort((a, b) => a.br - b.br)
    .slice(0, 8);
  write('### 🔎 Focos de atención (menor cobertura de ramas)');
  write('');
  if (files.length === 0) {
    write('Sin focos: todos los archivos tienen 100% de ramas. 🎉');
  } else {
    write('| Archivo | % Branch | Líneas sin cubrir |');
    write('|---|---:|---|');
    for (const x of files) {
      const data = finalCombined[x.abs];
      const uncovered = data ? uncoveredLines(data) : [];
      const shown = uncovered.slice(0, 12).join(', ') + (uncovered.length > 12 ? ', …' : '');
      write(`| ${x.f} | ${x.br}% | ${shown || '—'} |`);
    }
  }
  write('');
}

// ---------------------------------------------------------------------------
// 6) DISTRIBUCIÓN por rango de cobertura de líneas
// ---------------------------------------------------------------------------
{
  const buckets = { '100%': 0, '90–99%': 0, '80–89%': 0, '<80%': 0 };
  for (const [k, v] of Object.entries(summaryCombined)) {
    if (k === 'total') continue;
    const p = v.lines.pct;
    if (p >= 100) buckets['100%']++;
    else if (p >= 90) buckets['90–99%']++;
    else if (p >= 80) buckets['80–89%']++;
    else buckets['<80%']++;
  }
  write('### 📊 Distribución (cobertura de líneas por archivo)');
  write('');
  write('| Rango | Archivos |');
  write('|---|---:|');
  for (const [k, v] of Object.entries(buckets)) write(`| ${k} | ${v} |`);
  write('');
}

// ---------------------------------------------------------------------------
// 7) DETALLE POR ARCHIVO (colapsable) — Unit / Integration / Combinada
// ---------------------------------------------------------------------------
function detail(label, dir) {
  const s = readJSON(path.join(dir, 'coverage-summary.json'));
  if (!s) return;
  const rows = Object.entries(s)
    .filter(([k]) => k !== 'total')
    .map(([k, v]) => ({ f: rel(k), ...v }))
    .sort((a, b) => a.f.localeCompare(b.f));
  write('<details>');
  write(`<summary>📄 Detalle por archivo — ${label}</summary>`);
  write('');
  write('| Archivo | % Stmts | % Branch | % Funcs | % Lines |');
  write('|---|---:|---:|---:|---:|');
  for (const r of rows) {
    write(`| ${r.f} | ${r.statements.pct}% | ${r.branches.pct}% | ${r.functions.pct}% | ${r.lines.pct}% |`);
  }
  write('');
  write('</details>');
  write('');
}
detail('Combinada', DIR_COMBINED);
detail('Unit', DIR_UNIT);
detail('Integration', DIR_INT);

// ---------------------------------------------------------------------------
// 8) GLOSARIO Y NOTAS
// ---------------------------------------------------------------------------
write('### 📖 Glosario y notas');
write('');
write('- **Huella**: para una suite, solo los archivos que realmente ejercita (statements cubiertos > 0). Evita el número engañoso de medir una suite contra toda la superficie.');
write('- **% Total**: cobertura conjunta de las 4 métricas (Σcubierto / Σtotal) sobre la huella. Un único número resumen.');
write('- **Patch coverage**: cobertura, **por línea**, de las líneas nuevas/modificadas vs la rama base (estilo SonarQube "new code"). Informativa; no bloquea.');
write('- **Combinada**: la unión de unit + integration. Es sobre esta corrida que se aplica el gate (85% en las 4 métricas).');
write('- **Branches** es la métrica más exigente (cada rama `if/else`, `?:`, `&&`, `||` cuenta).');
write('');
