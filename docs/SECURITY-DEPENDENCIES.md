# Seguridad de dependencias — triage de `npm audit` (OWASP A06)

> Documento de seguridad de NeuroAlert. Registra la **postura de supply-chain**
> del backend: qué reporta `npm audit`, por qué cada hallazgo **aplica o no** a
> nuestro patrón de uso, y el plan de remediación. Complementa a
> [`SECURITY-RLS.md`](./SECURITY-RLS.md). Mapea a **OWASP A06:2021 — Vulnerable
> and Outdated Components** y a **RNF-14** (escaneo de dependencias/imagen).
> Regla de oro: un hallazgo se **corrige** (bump) salvo que se demuestre, con
> evidencia de código, que **no es explotable** en nuestro uso; en ese caso se
> **documenta aquí** con su plan de remediación. Nunca se ignora en silencio.

## 1. Contexto — programa de supply-chain

La seguridad de dependencias no es un evento único, es un proceso continuo:

- **Escaneo automático (RNF-14):** el job **`supply-chain`** del `ci.yml`
  (**Trivy** fs-scan CRITICAL/HIGH + **SBOM CycloneDX**) corre en **paralelo**,
  report-only (`exit-code: 0`), sin bloquear el gate ZAP (PR #64). Sube SARIF a
  *GitHub Security* y el SBOM como artifact (90 días).
- **Auditoría de dependencias:** el job **`test`** ejecuta
  `npm audit --audit-level=high || true` — **informativo, no bloquea** (`|| true`).
  Por eso un HIGH en `npm audit` **no** enrojece el pipeline; la decisión de
  corregir es **humana y se documenta aquí**.
- **Higiene del árbol (ya ejecutada):**
  - `minio` **eliminado** (PR #67): dependencia huérfana (0 imports; `StorageService`
    migró a Postgres `bytea`) → −24 paquetes transitivos.
  - `bcrypt` **5.1.1 → 6.0.0** (PR #68): abandona `@mapbox/node-pre-gyp`→`tar`
    (**7 HIGH** de path-traversal en tiempo de instalación) por `node-gyp-build`
    → `tar`/`node-pre-gyp` **salen del árbol**. Hashes `$2b$` compatibles, API
    idéntica, sin cambios de código. Verificado e2e en prod (login 200).

## 2. Criterio de decisión (corregir vs. documentar)

Un hallazgo de `npm audit` se **corrige con un bump** salvo que documentar sea
estrictamente mejor. Se **acepta-y-documenta** (temporalmente) solo si se cumplen
TODAS:

1. **No explotable en nuestro uso**, demostrado leyendo el/los sitio(s) de uso
   reales (no basta la teoría del advisory).
2. **Fuera de la ruta de ejecución de producción**, o mitigado por otra capa.
3. El fix está **planificado** con comandos concretos y *definition of done*.

La corrección se ejecuta **local-first** (regenerar `package-lock.json` con
`npm install` y validar `npm ci` + `nest build`, el gate real de Render) y entra
por **PR hacia `main`** (regla ⭐: rama → PR → CI del PR verde → squash-merge).

## 3. Veredicto por hallazgo

### 🟠 `nodemailer` — 5 HIGH (`npm audit`) → **no explotable en nuestro uso; bump planificado a `^9.0.3`**

| Aspecto | Detalle |
|---|---|
| **Versión actual** | `^6.10.1` (dependencia de producción). |
| **Advisories** | jsonTransport evade `disableFileAccess`/`disableUrlAccess` (GHSA-wqvq-jvpq-h66f); opción `raw` a nivel de mensaje → lectura de archivos + SSRF (GHSA-p6gq-j5cr-w38f); validación TLS en el fetch del token OAuth2 (GHSA-r7g4-qg5f-qqm2); + relacionadas de normalización / CRLF. *(Nota: `npm audit` los agrega como 5 HIGH; el CVSS de varios es Medium — la severidad real depende del uso.)* |
| **Único sitio de uso** | `src/mail/mail.service.ts` (confirmado por code search: `nodemailer` solo aparece en ese `.ts` y en `package.json`). |
| **Patrón de uso** | `createTransport({ host, port, secure, auth })` + `sendMail({ from, to, subject, html, text })` — **SMTP básico**. **No** usamos `jsonTransport`, **ni** OAuth2, **ni** la opción `raw`, **ni** adjuntos por `path`/`href`. Los vectores de las 5 advisories **no son alcanzables**. |
| **En producción** | El transporter SMTP **ni se instancia**: con `BREVO_API_KEY`, `provider='brevo'`, `this.smtp=null`, y el correo sale por `fetch` a la **API HTTP de Brevo** (puerto 443; Render free bloquea SMTP). nodemailer es **fallback SMTP solo-local** → **fuera de la ruta de prod**. |
| **Riesgo en contexto** | **Bajo.** Sin vector alcanzable ni presencia en la ruta de prod. |
| **Remediación** | Bump a **`nodemailer@^9.0.3`** (última; 2026-06-30). Es **zero-dependency**, `engines: node>=6` (nuestro runtime es node 20). Breaking 6→9 vs. nuestro uso: 7.0 quitó SES (no usado), 8.0 renombró un error code (no lo consumimos), 9.0 valida TLS al **descargar contenido remoto** (no descargamos) → **no-breaking para nuestro patrón**; la API `createTransport`/`sendMail` es idéntica. |
| **Estado** | ⏳ **Planificado, local-first.** Requiere regenerar `package-lock.json` (`npm ci` en Dockerfile/CI exige lockfile coherente); se ejecuta en cuanto haya entorno con red a npm/GitHub. |

### 🟡 `qs` — 2 moderate (transitiva) → **baja prioridad, seguimiento**

Según la última auditoría local (§21.4 del HANDOFF), `qs` aparece por vía
**transitiva** (express 5 / supertest). No la usamos directamente. Prioridad
menor; reevaluar con `npm audit fix` **acotado** (verificando que no fuerce
*majors* no deseados) en el mismo pase local que `nodemailer`, y reconfirmar con
`npm audit --omit=dev` (el árbol pudo cambiar tras `minio`/`bcrypt6`).

## 4. Remediación pendiente — receta local-first

```bash
# Backend (NestJS en la raíz de main), en un entorno CON red a GitHub + npm:
git fetch --depth 1 origin main && git checkout -b fix/deps-nodemailer FETCH_HEAD
npm i nodemailer@^9.0.3          # zero-dep → el diff del lockfile es ~1 entrada
npm ci                           # valida que package.json <-> package-lock.json cuadran
npx prisma generate && npm run build   # gate REAL de Render (el CI backend no compila TS)
npm audit --omit=dev             # confirmar: 5 HIGH de nodemailer → 0
# (opcional, mismo pase) evaluar qs:  npm audit fix   (revisar que no meta majors)
# → PR hacia main (⭐), esperar CI del PR verde, squash-merge, y verificar el deploy
#   por la CAÍDA del uptime en /health (NO por el smoke-test, que da falsos verdes — §21.3).
```

**Definition of done:** `npm audit --omit=dev` sin HIGH de `nodemailer`; `npm ci`
+ `nest build` verdes en local; PR verde; deploy materializado (uptime de
`/health` reseteado en dev **y** prod) y login de seeds 200 (nodemailer no está
en la ruta de prod, pero un arranque sano confirma que `nodemailer@9` carga).

## 5. Nota operativa (por qué no se corrigió en la sesión que creó este doc)

El bump exige regenerar `package-lock.json` con `npm`, y el entorno de esa sesión
**no tenía red a `github.com` ni a npm** (solo `api.github.com`). Reescribir a mano
un lockfile de ~383 KB, sin poder validar `npm ci`/`nest build` en local, es un
riesgo de deploy (un `integrity` erróneo → `npm ci` falla → deploy dev+prod en
rojo) que la metodología prohíbe (validar antes de mergear; deploy = campo
minado). Por eso se **documentó el análisis** y se dejó la corrección para
**ejecutar local-first**, sin degradar la seguridad ni arriesgar producción.

## 6. Resumen

La postura de supply-chain es **corregir por defecto, documentar con evidencia
cuando la corrección debe esperar, nunca ignorar en silencio**. Hoy: `nodemailer`
(5 HIGH) está **acotado** (no explotable en nuestro uso + fuera de la ruta de
prod) con **bump a 9.0.3 planificado**; `qs` (2 moderate, transitiva) en
seguimiento; el resto del árbol saneado (`minio` fuera, `bcrypt` 6, Trivy+SBOM
activos).

---
*(by Meyshel Ospinal y Yeremi Villavicencio)*
