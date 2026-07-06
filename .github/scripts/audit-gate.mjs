// ============================================================================
// audit-gate.mjs — gate BLOQUEANTE de npm audit para dependencias de PRODUCCIÓN
// ----------------------------------------------------------------------------
// Corre `npm audit --omit=dev --json` y FALLA (exit 1) si hay alguna
// vulnerabilidad de severidad >= umbral (por defecto `high`) en el árbol de
// producción que NO esté en la allowlist de excepciones documentadas
// (.github/audit-allowlist.json) o cuya excepción haya EXPIRADO.
//
// Reemplaza al antiguo `npm audit ... || true` (report-only): ahora el pipeline
// DECIDE. Las excepciones son explícitas (id GHSA + motivo + dueño + caducidad),
// alineado con OWASP A06 (fix-by-default, accept-with-justification).
//
// Env: AUDIT_LEVEL (def. high) · AUDIT_OMIT_DEV (def. true) ·
//      AUDIT_ALLOWLIST (def. .github/audit-allowlist.json)
// ============================================================================
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const LEVELS = ['info', 'low', 'moderate', 'high', 'critical'];
const THRESHOLD = process.env.AUDIT_LEVEL || 'high';
const OMIT_DEV = process.env.AUDIT_OMIT_DEV !== 'false';
const ALLOWLIST_PATH = process.env.AUDIT_ALLOWLIST || '.github/audit-allowlist.json';
const minIdx = LEVELS.indexOf(THRESHOLD);

function loadAllowlist() {
  const today = new Date().toISOString().slice(0, 10);
  const active = new Map();
  try {
    const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
    const list = Array.isArray(raw) ? raw : raw.exceptions || [];
    for (const e of list) {
      if (!e || !e.id) continue;
      if (e.expires && e.expires < today) continue; // expirada → ya no cubre
      active.set(String(e.id).toUpperCase(), e);
    }
  } catch {
    /* sin allowlist → todo high/critical bloquea */
  }
  return active;
}

function runAudit() {
  const cmd = `npm audit ${OMIT_DEV ? '--omit=dev ' : ''}--json`;
  try {
    return JSON.parse(execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  } catch (err) {
    // npm audit sale con código != 0 cuando encuentra vulns; el JSON va igual a stdout.
    if (err.stdout) return JSON.parse(err.stdout.toString());
    throw err;
  }
}

function ghsaFrom(via) {
  const ids = [];
  for (const v of via || []) {
    if (v && typeof v === 'object') {
      const m = String(v.url || '').match(/GHSA-[0-9a-z-]+/i);
      if (m) ids.push(m[0].toUpperCase());
    }
  }
  return ids;
}

const allow = loadAllowlist();
const audit = runAudit();
const vulns = audit.vulnerabilities || {};

const blocking = [];
const allowed = [];
for (const [name, v] of Object.entries(vulns)) {
  if (LEVELS.indexOf(v.severity) < minIdx) continue;
  const ghsas = ghsaFrom(v.via);
  // Cubierta solo si TODOS sus advisories están en la allowlist activa.
  const covered = ghsas.length > 0 && ghsas.every((g) => allow.has(g));
  (covered ? allowed : blocking).push({ name, severity: v.severity, ghsas });
}

const scope = OMIT_DEV ? 'solo prod' : 'todo (incl. dev)';
console.log(`## 🔒 Dependency Audit Gate (umbral: ${THRESHOLD}, ${scope})`);
if (allowed.length) {
  console.log('\n**Excepciones activas (allowlist):**');
  for (const a of allowed) console.log(`- \`${a.name}\` [${a.severity}] — ${a.ghsas.join(', ')}`);
}
if (blocking.length === 0) {
  console.log(`\n✅ Sin vulnerabilidades ≥ ${THRESHOLD} sin justificar en dependencias de ${scope}.`);
  process.exit(0);
}
console.log(`\n❌ ${blocking.length} vulnerabilidad(es) ≥ ${THRESHOLD} sin excepción documentada:`);
for (const b of blocking) console.log(`- \`${b.name}\` [${b.severity}] — ${b.ghsas.join(', ') || '(sin GHSA)'}`);
console.log(`\nCorrige (bump/override) o añade una excepción documentada en \`${ALLOWLIST_PATH}\` (id GHSA, motivo, dueño, caducidad).`);
process.exit(1);
