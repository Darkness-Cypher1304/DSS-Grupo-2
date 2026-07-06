# Seguridad de dependencias — triage de `npm audit` (OWASP A06)

> Documento de seguridad de NeuroAlert. Registra la **postura de supply-chain**
> del backend: qué reporta `npm audit`, por qué cada hallazgo **aplica o no** a
> nuestro patrón de uso, y su remediación. Complementa a
> [`SECURITY-RLS.md`](./SECURITY-RLS.md). Mapea a **OWASP A06:2021 — Vulnerable
> and Outdated Components** y a **RNF-14** (escaneo de dependencias/imagen).
> Regla de oro: un hallazgo se **corrige** (bump/override) salvo que se demuestre,
> con evidencia de código, que **no es explotable** en nuestro uso; en ese caso se
> **documenta aquí** con su plan. Nunca se ignora en silencio.

## 1. Contexto — programa de supply-chain

La seguridad de dependencias no es un evento único, es un proceso continuo:

- **Escaneo automático (RNF-14):** el job **`supply-chain`** del `ci.yml`
  (**Trivy** fs-scan CRITICAL/HIGH + **SBOM CycloneDX**) corre en **paralelo**,
  report-only, y sube SARIF a *GitHub Security* + el SBOM como artifact (90 días).
- **Gate de dependencias (BLOQUEANTE):** el job **`dependency-scan`** ejecuta
  **`node .github/scripts/audit-gate.mjs`**, que corre `npm audit --omit=dev`
  y **falla el pipeline** ante cualquier **HIGH/CRITICAL en dependencias de
  producción** que no tenga una excepción **documentada y vigente** en
  [`.github/audit-allowlist.json`](../.github/audit-allowlist.json). Antes era
  `npm audit … || true` (report-only): ahora el pipeline **decide**. Las
  excepciones llevan `id` (GHSA), motivo, dueño y `expires` (una excepción
  caducada vuelve a bloquear) — alineado con la regla de oro de este documento.
- **Higiene del árbol (ejecutada):**
  - `minio` **eliminado** (PR #67): huérfano (0 imports) → −24 paquetes.
  - `bcrypt` **5.1.1 → 6.0.0** (PR #68) y luego **`bcrypt` nativo ELIMINADO**
    (este pase): nadie lo importaba — todo el código, el seed y los tests usan
    **`bcryptjs`** (JS puro, sin toolchain nativo). Se quitó también
    `@types/bcrypt`.

## 2. Criterio de decisión (corregir vs. documentar)

Un hallazgo se **corrige** (bump directo o `overrides` para transitivas) salvo que
documentar sea estrictamente mejor. Se **acepta-y-documenta** (temporalmente, con
excepción en la allowlist) solo si se cumplen TODAS:

1. **No explotable en nuestro uso**, demostrado leyendo el/los sitio(s) reales.
2. **Fuera de la ruta de ejecución de producción**, o mitigado por otra capa.
3. La excepción se registra en la allowlist con **motivo, dueño y caducidad**.

La corrección se ejecuta **local-first** (regenerar `package-lock.json`, validar
`npm ci` + `nest build` + suite de tests + `npm audit --omit=dev`) y entra por
**PR hacia `main`** (rama → PR → CI del PR verde → squash-merge).

> **Pinning de transitivas:** cuando el paquete vulnerable lo fija un framework
> (p. ej. NestJS/Express) y ni su última versión trae el parche, se fija la
> versión parcheada con **`overrides`** en `package.json`. **No** se downgradea el
> framework (lo que propone `npm audit fix --force`) ni se forkea.

## 3. Veredicto por hallazgo (auditoría 2026-07-06)

Estado de partida: `npm audit --omit=dev` reportaba **7 (5 high, 2 moderate)**,
reducibles a **4 causas raíz** (los `@nestjs/core`/`platform-express`/`swagger`
eran *efectos* de multer/js-yaml). Tras este pase: **0 en producción**.

### ✅ `multer` — DoS de parseo multipart (high + moderate) → **corregido con `overrides` a `2.2.0`**

| Aspecto | Detalle |
|---|---|
| **Advisories** | DoS por *nombres de campo profundamente anidados* (GHSA-72gw-mp4g-v24j, high) y DoS por *limpieza incompleta de uploads abortados* (GHSA-3p4h-7m6x-2hcm, moderate). |
| **Uso real** | Sí lo usamos: `FileInterceptor` en `POST /storage/upload` (autenticado) y `FileFieldsInterceptor` en **`POST /applications` (PÚBLICO**, cv + dni), vía `@nestjs/platform-express`. **Alcanzable** — el límite de 4 MB no frena los vectores (nombres de campo / aborto), y `/applications` es público. |
| **Por qué `overrides`** | `@nestjs/platform-express` **fija `multer@2.1.1` incluso en su última versión (11.1.27)** → subir NestJS no basta. Se fija `multer@^2.2.0` con `overrides`. Validado: build + los tests de storage y applications en verde. |

### ✅ `nodemailer` — 8 advisories (2 high) → **corregido con bump directo a `^9.0.3`**

| Aspecto | Detalle |
|---|---|
| **Uso real** | Único sitio: `src/mail/mail.service.ts` (`createTransport` + `sendMail` con from/to/subject/html/text). En **producción ni se instancia**: con `BREVO_API_KEY` el correo sale por la **API HTTP de Brevo**; nodemailer es fallback SMTP **solo-local**. No usamos `jsonTransport`, `raw`, OAuth2, `envelope.size` ni nombres de transport → los vectores no eran alcanzables. |
| **Remediación** | Bump a `nodemailer@9.0.3` (zero-dep, `engines: node>=6`; runtime node 20). No-breaking para nuestro patrón (`createTransport`/`sendMail` idénticos). `@types/nodemailer@8` cubre la API. Validado con build + type-check + test de mail. |

### ✅ `qs` — DoS en `stringify` (moderate) → **corregido con `overrides` a `6.15.3`**

Transitiva de **express 5** (prod) y supertest (dev). El advisory
(GHSA-q8mj-m7cp-5q26) afecta a `qs.stringify` con `comma` + `encodeValuesOnly`;
express usa `qs.parse`, **no** ese camino → no alcanzable. Se fija `qs@^6.15.3`
(parche minor) con `overrides` (express fija 6.15.1).

### ✅ `js-yaml` (producción, vía `@nestjs/swagger`) — DoS merge-keys (moderate) → **corregido con `overrides` scoped a `4.3.0`**

Advisory de complejidad cuadrática al parsear YAML con *merge keys* repetidas;
solo explotable con **YAML no confiable**, que no procesamos (Swagger emite YAML
desde nuestros decoradores; Swagger además solo se monta en dev). Se fija a
`js-yaml@^4.3.0` (mismo major, seguro) con un override **scoped** bajo
`@nestjs/swagger` para **no** tocar el `js-yaml@3.14.2` de istanbul (dev).

## 4. Vulnerabilidades restantes — **solo dependencias de desarrollo** (no se despliegan)

`npm audit` completo (incl. dev) aún muestra 4 hallazgos, **todos en tooling de
test/build** y por tanto **fuera del gate de producción** (`--omit=dev`):

| Paquete | Sev | Vía (dev) | Situación |
|---|---|---|---|
| `form-data` | high | supertest → superagent | Cliente HTTP de **tests**. No se despliega. Seguimiento (bump de supertest/override cuando haya parche estable). |
| `brace-expansion` | moderate | tooling de build | Dev-only. |
| `js-yaml` (3.14.2) | moderate | babel-plugin-istanbul (coverage) | Dev-only; el 3.x no tiene parche compatible y forzarlo rompería istanbul. |
| `@babel/core` | low | ts-jest / babel | Dev-only. |

No se acepta ninguna excepción de **producción** en la allowlist (hoy está
vacía: prod = 0). Estos dev-only se tratarán con Dependabot/override cuando exista
un parche que no rompa la cadena de test.

## 5. Definition of done (este pase) — verificado en local

- `npm audit --omit=dev` → **0 vulnerabilidades** de producción (antes: 7).
- `npm ci` + `npx prisma generate` + `nest build` → verdes (gate real de Render).
- `npm run type-check` + `npm run lint` → limpios.
- `npm test` → **301/301** (33 suites), incluidos storage y applications (multer)
  y mail (nodemailer).
- Gate `audit-gate.mjs` probado en local: PASA con prod=0; BLOQUEA ante un HIGH sin
  excepción; una excepción **vigente** lo cubre y una **caducada** vuelve a bloquear.

## 6. Resumen

Postura: **corregir por defecto, documentar con evidencia y caducidad cuando deba
esperar, nunca ignorar en silencio — y ahora el CI lo hace cumplir con un gate
bloqueante**. Estado tras este pase: **0 vulnerabilidades de producción**
(`nodemailer` bump a 9; `multer`, `qs`, `js-yaml` fijados con `overrides`;
`bcrypt` nativo eliminado); restos **solo en dev** documentados; Trivy + SBOM
activos; `npm audit` de prod convertido en **gate**.

---
*(Base original by Meyshel Ospinal y Yeremi Villavicencio; actualizado 2026-07-06 en el pase de remediación de dependencias.)*
