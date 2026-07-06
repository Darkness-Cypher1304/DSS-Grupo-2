# 🔒 Tests E2E — RESERVADO

Los tests **end-to-end** ejercitan la aplicación **completa** (`INestApplication`
real) contra una base de datos **PostgreSQL real** con migraciones aplicadas y
datos sembrados. Son el análogo de **Playwright** en el frontend: validan el
sistema real de extremo a extremo (incluyendo **RLS**), no una frontera mockeada.

Hoy están **reservados** (no se ejecutan en el pipeline: el job `e2e` está con
`if: false`). Los tests de **unit** e **integration** ya cubren la lógica y los
flujos HTTP con **Prisma mockeado**; el e2e se reserva para lo que solo se puede
verificar con motor real: **migraciones, transacciones y políticas RLS**.

## Cómo activarlos (cuando toque)

1. Crear specs en `tests/e2e/**/*.e2e-spec.ts` (app real + `supertest`), usando
   `buildApp()` **sin** mockear `PrismaService` (Prisma real apuntando a la DB
   de test).
2. En CI ya existe el servicio `postgres:15`; aplicar migraciones antes de
   correr:
   ```bash
   npx prisma migrate deploy
   npm run test:e2e
   ```
3. En el pipeline: quitar `if: false` del job `e2e` (entre `smoke-test` y
   `dast`) y hacer que `dast` dependa de `e2e` (`needs: e2e`).

## ⚠️ RLS — campo minado

Los e2e con DB real **sí** activan Row-Level Security. Respetar
`runWithUserContext` y **no** reactivar `FORCE ROW LEVEL SECURITY` a ciegas
(ver [`docs/SECURITY-RLS.md`](../../docs/SECURITY-RLS.md)). Un cambio a ciegas ya
provocó un 500 en login en el pasado.
