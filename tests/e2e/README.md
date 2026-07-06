# Tests E2E — app real contra PostgreSQL real (ACTIVO)

Los tests **end-to-end** ejercitan la aplicación **completa** (`INestApplication`
real) contra una base de datos **PostgreSQL real**, con **PrismaService real** y
las migraciones aplicadas. Mail y Redis se **mockean** (no enviamos correos ni
dependemos de Redis). Son el análogo de **Playwright** en el frontend, pero a
nivel **HTTP/API** con **supertest** (el backend no tiene UI).

A diferencia de `unit`/`integration` (Prisma **mockeado**), el e2e valida lo que
solo se ve con un motor real: **migraciones, SQL, transacciones,
`runWithUserContext`** y el **aislamiento por usuario a nivel de app** (IDOR → 404).

## Estado: ACTIVO

- **Dónde corre:** en la **fase CI** del pipeline (job `e2e` de `ci.yml`), en
  **push y pull_request**. Levanta su propia app + su propio Postgres en el
  runner (service container `postgres:15`); **no** prueba la instancia desplegada.
- **Qué gatea:** `deploy-dev` depende de `e2e` (además de `coverage-gate`), así
  que **un e2e roto bloquea el despliegue**.
- **Cómo prepara la BD:** `npx prisma migrate deploy` (aplica las 9 migraciones,
  **incluidas las de RLS**), y luego `npm run test:e2e`.

## ⚠️ RLS — qué SÍ y qué NO valida este e2e

Con DB real se ejercita el camino de `runWithUserContext` (`SET LOCAL
app.current_user_id/role` dentro de una transacción). **Pero el efecto de
`FORCE ROW LEVEL SECURITY` NO se valida aquí:** en CI la app conecta como
**superusuario** de Postgres, y los superusuarios **bypassan RLS siempre** (aun
con `FORCE`). El bloqueo efectivo de RLS a nivel de BD **solo se observa en
Render** (la app conecta como **dueño no-superusuario**). Ver
[`docs/SECURITY-RLS.md`](../../docs/SECURITY-RLS.md).

Por eso el aislamiento que se valida en el e2e es el de la **capa de aplicación**
(p. ej. `GET /api/mchat/:id` de otro padre → **404**), que es la protección
efectiva de acceso hoy. **No** se reactiva `FORCE` a ciegas (ya causó un 500).

## Alcance actual (flujos críticos, no exhaustivo)

- **`health.e2e-spec.ts`** — `GET /health` confirma la conexión REAL a la BD.
- **`auth.e2e-spec.ts`** — ciclo real: registro → verificación (token leído de la
  BD) → login → `/me` → refresh (cookie HttpOnly) → logout, + negativos (login
  sin verificar → 401, contraseña incorrecta → 401).
- **`mchat.e2e-spec.ts`** — submit con **scoring en el servidor** (LOW/HIGH),
  historial y detalle propios (200), y detalle **ajeno → 404** (IDOR).

## Correr el e2e en LOCAL (opcional, para desarrollo)

El entorno **oficial y reproducible** es el CI. En local es **opcional** y
necesitas alguna PostgreSQL. Dos formas:

**A) Con Docker (BD desechable):**
```bash
docker run --rm -d --name na-e2e -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=neuroalert_e2e -p 5432:5432 postgres:15
export DATABASE_URL='postgresql://postgres:postgres@localhost:5432/neuroalert_e2e?schema=public'
npx prisma migrate deploy
npm run test:e2e
docker rm -f na-e2e   # limpiar al terminar
```

**B) Con un PostgreSQL ya instalado:** crea una BD **dedicada** de test (no uses
tu BD de desarrollo), apunta `DATABASE_URL` a ella y corre `prisma migrate deploy`
+ `npm run test:e2e`.

## Estructura

- `helpers/e2e-app.ts` — `buildE2EApp()` (app con Prisma real, Mail/Redis mock).
- `helpers/e2e-auth.ts` — `registerAndVerify` / `registerVerifyLogin` (usuarios
  reales vía API + token de verificación leído de la BD).
- `*.e2e-spec.ts` — los specs. `jest-e2e.config.js` los corre en serie
  (`maxWorkers: 1`) porque comparten la misma BD.
